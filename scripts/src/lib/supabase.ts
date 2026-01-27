import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL || ''
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const service = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
const key = service || anon
function makeSafeClient() {
  const safe = {
    auth: {
      async signOut() { return { error: null } },
      async getUser() { return { data: { user: null } } },
    },
    from(_table: string) {
      return {
        select: async () => ({ data: [], error: url && key ? null : { message: 'Supabase 未初始化（缺少 URL/KEY）' } }),
        insert: async (_v: any) => ({ data: null, error: url && key ? null : { message: 'Supabase 未初始化（缺少 URL/KEY）' } }),
        upsert: async (_v: any) => ({ data: null, error: url && key ? null : { message: 'Supabase 未初始化（缺少 URL/KEY）' } }),
        update: async (_v: any) => ({ data: null, error: url && key ? null : { message: 'Supabase 未初始化（缺少 URL/KEY）' } }),
        eq: (_c: string, _v: any) => ({ select: async () => ({ data: [], error: null }) } as any),
        single: async () => ({ data: null, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        order: (_c: string, _opt: any) => ({ select: async () => ({ data: [], error: null }) } as any),
        limit: (_n: number) => ({ select: async () => ({ data: [], error: null }) } as any),
        in: (_c: string, _arr: any[]) => ({ select: async () => ({ data: [], error: null }) } as any),
      }
    },
    channel() { return { on() { return this }, subscribe() { return this }, unsubscribe() {} } },
  } as any
  return safe
}
export const supabase = (url && key) ? createClient(url, key) : makeSafeClient()

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          phone: string
          user_type: 'passenger' | 'driver' | 'admin'
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          phone: string
          user_type: 'passenger' | 'driver' | 'admin'
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          phone?: string
          user_type?: 'passenger' | 'driver' | 'admin'
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      driver_profiles: {
        Row: {
          id: string
          user_id: string
          license_number: string
          car_model: string
          car_plate: string
          rating: number
          is_online: boolean
          current_location: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          license_number: string
          car_model: string
          car_plate: string
          rating?: number
          is_online?: boolean
          current_location?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          license_number?: string
          car_model?: string
          car_plate?: string
          rating?: number
          is_online?: boolean
          current_location?: any
          created_at?: string
          updated_at?: string
        }
      }
      trips: {
        Row: {
          id: string
          passenger_id: string
          passenger_name?: string
          driver_id?: string
          pickup_location: any
          dropoff_location: any
          pickup_address: string
          dropoff_address: string
          car_type: string
          status: 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
          estimated_price: number
          final_price?: number
          distance_km?: number
          duration_minutes?: number
          rating?: number
          created_at: string
          updated_at: string
          completed_at?: string
        }
        Insert: {
          id?: string
          passenger_id: string
          passenger_name?: string
          driver_id?: string
          pickup_location: any
          dropoff_location: any
          pickup_address: string
          dropoff_address: string
          car_type: string
          status?: 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
          estimated_price: number
          final_price?: number
          distance_km?: number
          duration_minutes?: number
          rating?: number
          created_at?: string
          updated_at?: string
          completed_at?: string
        }
        Update: {
          id?: string
          passenger_id?: string
          passenger_name?: string
          driver_id?: string
          pickup_location?: any
          dropoff_location?: any
          pickup_address?: string
          dropoff_address?: string
          car_type?: string
          status?: 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
          estimated_price?: number
          final_price?: number
          distance_km?: number
          duration_minutes?: number
          rating?: number
          created_at?: string
          updated_at?: string
          completed_at?: string
        }
      }
      trip_status: {
        Row: {
          id: string
          trip_id: string
          status: string
          location: any
          driver_lat?: number
          driver_lng?: number
          notes?: string
          created_at: string
        }
        Insert: {
          id?: string
          trip_id: string
          status: string
          location: any
          driver_lat?: number
          driver_lng?: number
          notes?: string
          created_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          status?: string
          location?: any
          driver_lat?: number
          driver_lng?: number
          notes?: string
          created_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          trip_id: string
          amount: number
          payment_method: string
          transaction_id?: string
          status: 'pending' | 'completed' | 'failed'
          created_at: string
          completed_at?: string
        }
        Insert: {
          id?: string
          trip_id: string
          amount: number
          payment_method: string
          transaction_id?: string
          status?: 'pending' | 'completed' | 'failed'
          created_at?: string
          completed_at?: string
        }
        Update: {
          id?: string
          trip_id?: string
          amount?: number
          payment_method?: string
          transaction_id?: string
          status?: 'pending' | 'completed' | 'failed'
          created_at?: string
          completed_at?: string
        }
      }
    }
  }
}
