import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../lib/supabase'

type User = Database['public']['Tables']['users']['Row']
type DriverProfile = Database['public']['Tables']['driver_profiles']['Row']

interface AuthState {
  user: User | null
  driverProfile: DriverProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  userType: 'passenger' | 'driver' | 'admin' | null
  
  // Actions
  signIn: (email: string, password: string, userType: 'passenger' | 'driver' | 'admin') => Promise<void>
  signUp: (email: string, password: string, phone: string, userType: 'passenger' | 'driver') => Promise<void>
  signOut: () => Promise<void>
  checkAuth: () => Promise<void>
  loadDriverProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  driverProfile: null,
  isAuthenticated: false,
  isLoading: true,
  userType: null,

  signIn: async (email: string, password: string, userType: 'passenger' | 'driver' | 'admin') => {
    try {
      set({ isLoading: true })
      const client = (supabase as any)?.auth?.signInWithPassword
        ? supabase
        : createClient(
            (import.meta as any)?.env?.VITE_SUPABASE_URL || 'https://hmlyfcpicjpjxayilyhk.supabase.co',
            (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_MSRGbeXWokHV5p0wsZm-uA_71ry5z2j'
          )
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        // Get user profile
        const { data: userData, error: userError } = await client
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single()

        if (userError) throw userError

        if (userData.user_type !== userType) {
          throw new Error('Invalid user type')
        }

        set({ 
          user: userData, 
          isAuthenticated: true, 
          userType: userData.user_type,
          isLoading: false 
        })

        // Load driver profile if user is a driver
        if (userData.user_type === 'driver') {
          await get().loadDriverProfile()
        }
      }
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  signUp: async (email: string, password: string, phone: string, userType: 'passenger' | 'driver') => {
    try {
      set({ isLoading: true })
      const client = (supabase as any)?.auth?.signUp
        ? supabase
        : createClient(
            (import.meta as any)?.env?.VITE_SUPABASE_URL || 'https://hmlyfcpicjpjxayilyhk.supabase.co',
            (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_MSRGbeXWokHV5p0wsZm-uA_71ry5z2j'
          )
      const { data, error } = await client.auth.signUp({
        email,
        password,
      })

      if (error) throw error

      if (data.user) {
        // Create user profile
        const { error: profileError } = await client
          .from('users')
          .insert({
            id: data.user.id,
            email,
            phone,
            user_type: userType,
          })

        if (profileError) throw profileError

        // Create driver profile if user is a driver
        if (userType === 'driver') {
          const { error: driverError } = await client
            .from('driver_profiles')
            .insert({
              user_id: data.user.id,
              license_number: '',
              car_model: '',
              car_plate: '',
            })

          if (driverError) throw driverError
        }

        set({ 
          user: {
            id: data.user.id,
            email,
            phone,
            user_type: userType,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, 
          isAuthenticated: true, 
          userType,
          isLoading: false 
        })
      }
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  signOut: async () => {
    try {
      const client = (supabase as any)?.auth?.signOut
        ? supabase
        : createClient(
            (import.meta as any)?.env?.VITE_SUPABASE_URL || 'https://hmlyfcpicjpjxayilyhk.supabase.co',
            (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_MSRGbeXWokHV5p0wsZm-uA_71ry5z2j'
          )
      const { error } = await client.auth.signOut()
      if (error) throw error
      
      set({ 
        user: null, 
        driverProfile: null,
        isAuthenticated: false, 
        userType: null 
      })
    } catch (error) {
      throw error
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true })
      const client = (supabase as any)?.auth?.getUser
        ? supabase
        : createClient(
            (import.meta as any)?.env?.VITE_SUPABASE_URL || 'https://hmlyfcpicjpjxayilyhk.supabase.co',
            (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_MSRGbeXWokHV5p0wsZm-uA_71ry5z2j'
          )
      const { data: { user } } = await client.auth.getUser()
      
      if (user) {
        const { data: userData, error } = await client
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (error) throw error

        set({ 
          user: userData, 
          isAuthenticated: true, 
          userType: userData.user_type,
          isLoading: false 
        })

        if (userData.user_type === 'driver') {
          await get().loadDriverProfile()
        }
      } else {
        set({ isLoading: false })
      }
    } catch (error) {
      set({ isLoading: false })
      console.error('Auth check failed:', error)
    }
  },

  loadDriverProfile: async () => {
    try {
      const { user } = get()
      if (!user || user.user_type !== 'driver') return

      const client = (supabase as any)?.from ? supabase : createClient(
        (import.meta as any)?.env?.VITE_SUPABASE_URL || 'https://hmlyfcpicjpjxayilyhk.supabase.co',
        (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_MSRGbeXWokHV5p0wsZm-uA_71ry5z2j'
      )
      const { data, error } = await client
        .from('driver_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error
      set({ driverProfile: data })
    } catch (error) {
      console.error('Failed to load driver profile:', error)
    }
  },
}))
