import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'

export default function AppSelector() {
  const navigate = useNavigate()
  const [uid, setUid] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const ADMIN_UIDS = (import.meta.env.VITE_ADMIN_UIDS || '').split(',').map(s => s.trim()).filter(Boolean)

  useEffect(() => {
    ;(async ()=>{
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const id = user?.id || ''
        setUid(id)
        if (id) {
          const { data } = await supabase.from('profiles').select('role').eq('id', id).limit(1).single()
          setRole(data?.role || '')
        } else {
          setRole('')
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const goPassenger = () => {
    navigate('/passenger')
  }
  const goDriver = () => {
    if (role === 'driver') navigate('/driver')
    else navigate('/passenger')
  }
  const goAdmin = () => {
    if (uid && ADMIN_UIDS.includes(uid)) navigate('/admin')
    else navigate('/passenger')
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#D4AF37', marginBottom: 16 }}>選擇入口</div>
      <div style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
        <button onClick={goPassenger} style={{ padding: 12, borderRadius: 10, background: '#D4AF37', color: '#111', fontWeight: 700 }}>乘客端</button>
        <button onClick={goDriver} style={{ padding: 12, borderRadius: 10, background: '#333', color: '#fff' }}>司機端</button>
        <button onClick={goAdmin} style={{ padding: 12, borderRadius: 10, background: '#333', color: '#fff' }}>管理端</button>
      </div>
      {loading ? <div style={{ marginTop: 12, color: '#9ca3af' }}>檢查權限中...</div> : (
        <div style={{ marginTop: 12, color: '#9ca3af' }}>目前身分：{role || '未登入'}</div>
      )}
    </div>
  )
}
