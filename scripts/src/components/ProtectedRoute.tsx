import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabaseClient'

interface Props {
  children: React.ReactElement
  roles?: Array<'passenger' | 'driver' | 'admin'>
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { isAuthenticated, isLoading } = useAuthStore() as any
  const [role, setRole] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const path = typeof window !== 'undefined' ? window.location.pathname : '/'

  useEffect(() => {
    let mounted = true
    ;(async ()=>{
      try {
        const storedRole = typeof window !== 'undefined' ? (localStorage.getItem('bf_role') || '') : ''
        if (storedRole) {
          if (mounted) setRole(storedRole)
        } else {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user?.id) { if (mounted) setLoading(false); return }
          const { data } = await supabase.from('profiles').select('role').eq('id', user.id).limit(1).single()
          if (mounted) setRole(data?.role || '')
        }
      } catch {}
      if (mounted) setLoading(false)
    })()
    return () => { mounted = false }
  }, [])

  if (isLoading || loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', background:'#0a0a0a' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:28, fontWeight:900, color:'#D4AF37', marginBottom:12 }}>Black Feather</div>
          <div style={{ width:48, height:48, borderRadius:'50%', border:'3px solid #D4AF37', borderTopColor:'transparent', margin:'0 auto', animation:'spin 1s linear infinite' }} />
          <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
          <div style={{ color:'#9ca3af', marginTop:8 }}>載入中...</div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    const storedRole = typeof window !== 'undefined' ? (localStorage.getItem('bf_role') || '') : ''
    if (storedRole === 'admin') return children
    if (path.startsWith('/admin')) return <Navigate to="/admin/login" replace />
    if (path.startsWith('/driver')) return <Navigate to="/driver/login" replace />
    return <Navigate to="/passenger/login" replace />
  }

  // Hardened gatekeeper by path
  if (role === 'admin') {
    return children
  }
  // Driver area: only driver/admin may enter
  if (path.startsWith('/driver')) {
    if (!(role === 'driver' || role === 'admin')) {
      alert('請使用司機帳號登入')
      return <Navigate to="/passenger" replace />
    }
  }
  // Passenger area: passenger/driver/admin allowed
  // Admin area: only admin; if not, show "無權存取"
  if (path.startsWith('/admin')) {
    if (role !== 'admin') {
      try { alert('無權存取管理後台') } catch {}
      return <Navigate to="/" replace />
    }
  }

  // Role list gate (optional compatibility)
  if (roles && role && !roles.includes(role as any)) {
    return <Navigate to="/passenger" replace />
  }
  return children
}
