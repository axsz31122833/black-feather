import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'
type User = {
  id: string
  email: string
  phone: string
  user_type: 'passenger' | 'driver' | 'admin'
  status: string
  created_at: string
  updated_at: string
}
type DriverProfile = {
  id: string
  user_id: string
  status?: string
  license_number?: string
  car_model?: string
  car_plate?: string
  rating?: number
  is_online?: boolean
  current_lat?: number
  current_lng?: number
  created_at?: string
  updated_at?: string
}


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
  setUser: (u: Partial<User> & { user_type: 'passenger' | 'driver' | 'admin' }) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  driverProfile: null,
  isAuthenticated: false,
  isLoading: true,
  userType: null,

  signIn: async (phone: string, password: string, userType: 'passenger' | 'driver' | 'admin') => {
    try {
      try { console.log('Attempting login for role:', userType) } catch {}
      set({ isLoading: true })
      const client = supabase
      try { await client.auth.signOut() } catch {}
      let hash = ''
      try {
        const enc = new TextEncoder().encode(password)
        const buf = await (crypto as any).subtle.digest('SHA-256', enc)
        hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
      } catch {
        hash = password
      }
      const { data: prof } = await client
        .from('profiles')
        .select('id,full_name,phone,role')
        .eq('phone', phone)
        .eq('password_hash', hash)
        .maybeSingle()
      if (!prof) throw new Error('找不到帳戶或密碼錯誤')
      if (userType === 'admin' && (prof as any).role !== 'admin') throw new Error('非管理員帳號')
      const now = new Date().toISOString()
      const tempUser: any = {
        id: prof.id,
        email: '',
        phone: prof.phone,
        user_type: (prof.role as any) || userType,
        status: 'active',
        created_at: now,
        updated_at: now,
      }
      try { localStorage.setItem('bf_role', String(tempUser.user_type || '')) } catch {}
      set({ 
        user: tempUser, 
        isAuthenticated: true, 
        userType: tempUser.user_type,
        isLoading: false 
      })
      if (tempUser.user_type === 'driver') {
        await get().loadDriverProfile()
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

  setUser: (u) => {
    const now = new Date().toISOString()
    const user: User = {
      id: (u.id as string) || ((typeof (globalThis as any).crypto?.randomUUID === 'function') ? (globalThis as any).crypto.randomUUID() : Math.random().toString(36).slice(2)),
      email: (u as any).email || '',
      phone: (u as any).phone || '',
      user_type: u.user_type,
      status: (u as any).status || 'active',
      created_at: (u as any).created_at || now,
      updated_at: (u as any).updated_at || now,
    }
    set({
      user,
      userType: user.user_type,
      isAuthenticated: true,
      isLoading: false,
    })
  }
}))
