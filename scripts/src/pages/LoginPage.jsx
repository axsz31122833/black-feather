import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { isAdmin } from '../lib/auth'
import { useNavigate } from 'react-router-dom'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('passenger')
  const [password, setPassword] = useState('')
  const [res, setRes] = useState(null)
  const navigate = useNavigate()

  async function loginPhoneOnly() {
    try {
      const normalized = String(phone || '').trim()
      if (!normalized || normalized.length < 8) {
        setRes({ error: '請輸入有效的手機號碼' })
        return
      }
      // role guard
      if (role === 'admin') {
        const adminPwd = import.meta.env.VITE_ADMIN_PASSWORD || ''
        if (!isAdmin() || password !== adminPwd) {
          setRes({ error: '管理員驗證失敗（手機或密碼不正確）' })
          return
        }
      } else {
        if (!password || password.length < 6) {
          setRes({ error: '請輸入密碼（至少 6 碼）' })
          return
        }
      }
      // persist
      localStorage.setItem('bf_role', role)
      localStorage.setItem('bf_auth_phone', normalized)
      // write to DB accordingly
      if (role === 'driver') {
        await supabase.from('passengers').upsert({ phone: normalized, name: normalized }, { onConflict: 'phone' })
        await supabase.from('drivers').upsert({ phone: normalized, name: normalized, is_online: false }, { onConflict: 'phone' })
      } else {
        await supabase.from('passengers').upsert({ phone: normalized, name: normalized }, { onConflict: 'phone' })
      }
      setRes({ ok: true, phone: normalized, role })
      setTimeout(() => {
        if (role === 'driver') navigate('/driver')
        else if (role === 'admin') navigate('/admin')
        else navigate('/passenger')
      }, 300)
    } catch (e) { setRes({ error: String(e) }) }
  }

  async function logout() {
    await supabase.auth.signOut()
    try { localStorage.removeItem('bf_auth_phone') } catch (_) {}
    setRes({ loggedOut: true })
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="title">手機號碼登入</div>
      <div className="form-group">
        <div className="label">手機號碼（+886 或本地格式）</div>
        <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="例如 09xxxxxxxx" />
      </div>
      <div className="form-group">
        <div className="label">身份</div>
        <div style={{ display:'flex', gap:8 }}>
          <label><input type="radio" name="role" checked={role==='passenger'} onChange={()=>setRole('passenger')} /> 乘客</label>
          <label><input type="radio" name="role" checked={role==='driver'} onChange={()=>setRole('driver')} /> 司機</label>
          <label><input type="radio" name="role" checked={role==='admin'} onChange={()=>setRole('admin')} /> 管理員</label>
        </div>
      </div>
        <div className="form-group">
          <div className="label">密碼</div>
          <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="請輸入密碼" />
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button className="btn btn-primary" onClick={loginPhoneOnly}>登入</button>
          <button className="btn" onClick={logout}>登出</button>
          <button className="btn" onClick={() => navigate('/register')}>前往註冊</button>
        </div>
        <pre className="muted" style={{ marginTop:12 }}>{res ? JSON.stringify(res, null, 2) : null}</pre>
      </div>
    </div>
  )
}
