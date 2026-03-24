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
      try {
        await client.from('profiles').upsert({ id: prof.id, user_id: prof.id, full_name: prof.full_name || '新乘客', name: prof.full_name || '新乘客', phone: prof.phone, role: (prof.role as any) || userType } as any, { onConflict:'id' } as any)
      } catch (e) { try { alert('使用者檔案同步失敗：' + (e instanceof Error ? e.message : String(e))) } catch {}; throw e }
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
      try {
        if (userType === 'admin') {
          (window as any).location.replace('/admin/dashboard')
        } else if (userType === 'driver') {
          (window as any).location.assign('/driver')
        } else {
          (window as any).location.assign('/passenger')
        }
      } catch {}
    } catch (error) {
      set({ isLoading: false })
      const msg = typeof error === 'string' ? error : (error instanceof Error ? error.message : '登入失敗，請稍後再試')
      throw new Error(msg)
    }
  },

  signUp: async (_email: string, password: string, phone: string, userType: 'passenger' | 'driver' | 'admin', name?: string) => {
    try {
      set({ isLoading: true })
      const client = supabase
      const email = `u-${(phone || '').trim()}-${Date.now()}@blackfeather.com`
      const { data: signData, error: signErr } = await client.auth.signUp({ email, password })
      if (signErr) { try { alert('註冊失敗：' + (signErr.message || '未知錯誤')) } catch {}; throw signErr }
      const uid = signData?.user?.id
      if (!uid) { throw new Error('未取得使用者 ID') }
      const { error: usersErr } = await client
        .from('users')
        .upsert({
          id: uid!,
          email,
          phone,
          user_type: userType,
          name: name || null,
        }, { onConflict: 'id' } as any)
      if (usersErr) { try { alert('建立 users 資料失敗：' + (usersErr.message || '未知錯誤')) } catch {}; throw usersErr }
      try { console.log('【註冊同步檢查】Auth ID:', uid, '準備寫入 Profile...') } catch {}
      const pPayload: any = {
        id: uid!,
        user_id: uid!,
        full_name: name || '新乘客',
        name: name || '新乘客',
        phone,
        role: userType || 'passenger',
      }
      const { error: upErr } = await client.from('profiles').upsert(pPayload, { onConflict: 'id' } as any)
      if (upErr) { try { alert('建立使用者資料失敗：' + (upErr.message || '未知錯誤')) } catch {} ; throw upErr }
      if (userType === 'driver') {
        try {
          const { data: au } = await client.auth.getUser()
          const cur = au?.user?.id || ''
          if (!cur || cur !== uid) {
            console.error('【錯誤】目標用戶不存在於 Auth 系統，無法建立司機檔案', { current: cur, target: uid })
          } else {
            const { error: driverError } = await client
              .from('driver_profiles')
              .upsert({
                user_id: uid!,
                license_number: '',
                car_model: '',
                car_plate: '',
                status: 'pending',
              }, { onConflict: 'user_id' } as any)
            if (driverError) throw driverError
          }
        } catch (e) {
          console.error('建立司機檔案失敗：', e)
        }
      }
      set({ 
        user: {
          id: uid!,
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
      try {
        const { data: { user } } = await client.auth.getUser()
        const { data: prof } = await client.from('profiles').select('id,role,full_name,phone').eq('id', user?.id || '').limit(1).maybeSingle()
        console.error('【強制登出診斷】原因:', 'manual_or_unknown', '目前 Profile 狀態:', prof || null)
      } catch {}
      const { error } = await client.auth.signOut()
      if (error) throw error
      
      set({ 
        user: null, 
        driverProfile: null,
        isAuthenticated: false, 
        userType: null 
      })
      try {
        const path = typeof window !== 'undefined' ? window.location.pathname : '/'
        if (path.startsWith('/admin')) (window as any).location.assign('/admin/login')
        else if (path.startsWith('/driver')) (window as any).location.assign('/driver/login')
        else (window as any).location.assign('/passenger/login')
      } catch {}
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
          .maybeSingle()

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
        .maybeSingle()

      if (error) throw error
      set({ driverProfile: data })
    } catch (error) {
      console.error('Failed to load driver profile:', error)
    }
  },

  setUser: (u) => {
    const now = new Date().toISOString()
    const user: User = {
      id: (u.id as string) || '',
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
