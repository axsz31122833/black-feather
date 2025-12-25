import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabase'
import { processPayment, PaymentMethod, PaymentResult } from '../utils/payments'

type Trip = Database['public']['Tables']['trips']['Row']
type TripStatus = Database['public']['Tables']['trip_status']['Row']

interface TripState {
  trips: Trip[]
  currentTrip: Trip | null
  isLoading: boolean
  error: string | null
  driverLocation: { lat: number; lng: number } | null
  
  // Actions
  createTrip: (tripData: Partial<Trip>) => Promise<void>
  getTrips: (userId: string, userType: 'passenger' | 'driver') => Promise<void>
  updateTripStatus: (tripId: string, status: Trip['status'], driverId?: string) => Promise<void>
  subscribeToTrips: (userId: string, userType: 'passenger' | 'driver') => () => void
  getCurrentTrip: (userId: string, userType: 'passenger' | 'driver') => Promise<void>
  updateDriverLocation: (tripId: string, lat: number, lng: number) => Promise<void>
  subscribeToDriverLocation: (tripId: string) => () => void
  processTripPayment: (tripId: string, amount: number, paymentMethod: PaymentMethod) => Promise<PaymentResult>
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  currentTrip: null,
  isLoading: false,
  error: null,
  driverLocation: null,

  createTrip: async (tripData: Partial<Trip>) => {
    try {
      set({ isLoading: true, error: null })
      
      const { data, error } = await supabase
        .from('trips')
        .insert(tripData)
        .select()
        .single()

      if (error) throw error

      set({ 
        currentTrip: data,
        isLoading: false 
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create trip',
        isLoading: false 
      })
      throw error
    }
  },

  getTrips: async (userId: string, userType: 'passenger' | 'driver') => {
    try {
      set({ isLoading: true, error: null })
      
      const column = userType === 'passenger' ? 'passenger_id' : 'driver_id'
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq(column, userId)
        .order('created_at', { ascending: false })

      if (error) throw error

      set({ 
        trips: data || [],
        isLoading: false 
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch trips',
        isLoading: false 
      })
    }
  },

  updateTripStatus: async (tripId: string, status: Trip['status'], driverId?: string) => {
    try {
      set({ isLoading: true, error: null })
      
      const updateData: Partial<Trip> = { status }
      if (driverId) {
        updateData.driver_id = driverId
      }
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('trips')
        .update(updateData)
        .eq('id', tripId)
        .select()
        .single()

      if (error) throw error

      set({ 
        currentTrip: data,
        isLoading: false 
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update trip status',
        isLoading: false 
      })
      throw error
    }
  },

  getCurrentTrip: async (userId: string, userType: 'passenger' | 'driver') => {
    try {
      set({ isLoading: true, error: null })
      
      const column = userType === 'passenger' ? 'passenger_id' : 'driver_id'
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq(column, userId)
        .in('status', ['requested', 'accepted', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      set({ 
        currentTrip: data || null,
        isLoading: false 
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch current trip',
        isLoading: false 
      })
    }
  },

  subscribeToTrips: (userId: string, userType: 'passenger' | 'driver') => {
    const column = userType === 'passenger' ? 'passenger_id' : 'driver_id'
    
    const subscription = supabase
      .channel('trips-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trips',
          filter: `${column}=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const trip = payload.new as Trip
            set({ currentTrip: trip })
            
            // Update trips list
            const { trips } = get()
            const updatedTrips = trips.map(t => t.id === trip.id ? trip : t)
            if (!trips.find(t => t.id === trip.id)) {
              updatedTrips.unshift(trip)
            }
            set({ trips: updatedTrips })
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  },

  updateDriverLocation: async (tripId: string, lat: number, lng: number) => {
    try {
      set({ isLoading: true, error: null })
      
      const { error } = await supabase
        .from('trip_status')
        .upsert({
          trip_id: tripId,
          driver_lat: lat,
          driver_lng: lng,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      set({ 
        driverLocation: { lat, lng },
        isLoading: false 
      })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update driver location',
        isLoading: false 
      })
      throw error
    }
  },

  subscribeToDriverLocation: (tripId: string) => {
    const subscription = supabase
      .channel('driver-location-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_status',
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const status = payload.new as TripStatus
            if (status.driver_lat && status.driver_lng) {
              set({ 
                driverLocation: { 
                  lat: status.driver_lat, 
                  lng: status.driver_lng 
                }
              })
            }
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  },

  processTripPayment: async (tripId: string, amount: number, paymentMethod: PaymentMethod): Promise<PaymentResult> => {
    try {
      set({ isLoading: true, error: null })
      
      const result = await processPayment(tripId, amount, paymentMethod)
      
      if (result.success) {
        // Update trip status to paid
        const { error: tripError } = await supabase
          .from('trips')
          .update({ status: 'completed' })
          .eq('id', tripId)

        if (tripError) throw tripError

        // Update current trip
        const { currentTrip } = get()
        if (currentTrip && currentTrip.id === tripId) {
          set({ currentTrip: { ...currentTrip, status: 'completed' } })
        }
      }

      set({ isLoading: false })
      return result
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Payment processing failed',
        isLoading: false 
      })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed'
      }
    }
  },
}))