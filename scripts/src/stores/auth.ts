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
  signIn: (phone: string, password: string, userType: 'passenger' | 'driver' | 'admin') => Promise<void>
  signUp: (email: string, password: string, phone: string, userType: 'passenger' | 'driver' | 'admin', name?: string) => Promise<void>
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

  signIn: async (phone: string, password: string, userType: 'passenger' | 'driver' | 'admin') => {
    try {
      set({ isLoading: true })
      const client = supabase
      const { data: userByPhone, error: phoneErr } = await client
        .from('users')
        .select('id,email,user_type')
        .eq('phone', phone)
        .limit(1)
      if (phoneErr) throw phoneErr
      const targetEmail = userByPhone?.[0]?.email
      if (!targetEmail) throw new Error('找不到此手機號碼的帳戶')
      const { data, error } = await client.auth.signInWithPassword({
        email: targetEmail,
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

  signUp: async (_email: string, password: string, phone: string, userType: 'passenger' | 'driver' | 'admin', name?: string) => {
    try {
      set({ isLoading: true })
      const client = supabase
      const email = `u-${(phone || '').trim()}-${Date.now()}@blackfeather.com`
      const createdId =
        (typeof (globalThis as any).crypto?.randomUUID === 'function')
          ? (globalThis as any).crypto.randomUUID()
          : Math.random().toString(36).slice(2)
      const { error: profileError } = await client
        .from('users')
        .upsert({
          id: createdId!,
          email,
          phone,
          user_type: userType,
          name: name || null,
        }, { onConflict: 'id' } as any)
      if (profileError) throw profileError
      if (userType === 'driver') {
        const { error: driverError } = await client
          .from('driver_profiles')
          .upsert({
            user_id: createdId!,
            license_number: '',
            car_model: '',
            car_plate: '',
            status: 'pending',
          }, { onConflict: 'user_id' } as any)
        if (driverError) throw driverError
      }
      set({ 
        user: {
          id: createdId!,
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
    } catch (error) {
      set({ isLoading: false })
      const msg = typeof error === 'string' ? error : (error instanceof Error ? error.message : '註冊失敗，請稍後再試或聯繫客服')
      throw msg
    }
  },

  signOut: async () => {
    try {
      const client = supabase
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
      const client = supabase
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

      const client = supabase
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
