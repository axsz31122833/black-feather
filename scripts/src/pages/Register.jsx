import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { useNavigate } from 'react-router-dom'

export default function Register() {
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('passenger')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [plate, setPlate] = useState('')
  const [carModel, setCarModel] = useState('')
  const [carColor, setCarColor] = useState('')
  const [res, setRes] = useState(null)
  const navigate = useNavigate()
  const { signUp } = useAuthStore()

  async function submit() {
    const normalized = String(phone||'').trim()
    if (!normalized || normalized.length < 8) { setRes({ error:'請輸入有效的手機號碼' }); return }
    if (!invite || invite.trim().length < 8) { setRes({ error:'請輸入有效的邀請碼（已註冊之手機號）' }); return }
    if (!password || password.length < 6) { setRes({ error:'請輸入密碼（至少 6 碼）' }); return }
    if (role==='driver' && (!plate.trim() || !carModel.trim() || !carColor.trim())) { setRes({ error:'請完整填寫車牌、車型與顏色' }); return }
    try {
      const { data: inviterUser } = await supabase.from('users').select('id, phone').eq('phone', invite).maybeSingle()
      if (!inviterUser) {
        const { data: inviterPassenger } = await supabase.from('passengers').select('id, phone').eq('phone', invite).maybeSingle()
        if (!inviterPassenger) { setRes({ error:'邀請碼不存在，請確認' }); return }
      }
      const emailAlias = `u-${normalized}@bf.example.com`
      await signUp(emailAlias, password, normalized, role)
      if (role === 'driver') {
        const { data: me } = await supabase.from('users').select('id').eq('email', emailAlias).single()
        if (me?.id) {
          await supabase.from('driver_profiles').update({ car_model: carModel, car_plate: plate }).eq('user_id', me.id)
        }
      }
      setRes({ ok:true, phone: normalized, role })
      setTimeout(() => {
        if (role === 'driver') navigate('/driver')
        else if (role === 'admin') navigate('/admin')
        else navigate('/passenger')
      }, 300)
    } catch (e) { setRes({ error: String(e) }) }
  }

  return (
    <div className="grid">
      <div className="card">
        <div className="title">註冊</div>
      <div className="form-group">
        <div className="label">手機號碼</div>
        <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="例如 09xxxxxxxx" />
      </div>
      <div className="form-group">
        <div className="label">密碼</div>
        <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少 6 碼" />
      </div>
      <div className="form-group">
        <div className="label">邀請碼（已註冊之手機號）</div>
        <input className="input" value={invite} onChange={e=>setInvite(e.target.value)} placeholder="例如 09xxxxxxxx" />
      </div>
      <div className="form-group">
        <div className="label">身份</div>
        <div style={{ display:'flex', gap:8 }}>
          <label><input type="radio" name="regrole" checked={role==='passenger'} onChange={()=>setRole('passenger')} /> 乘客</label>
          <label><input type="radio" name="regrole" checked={role==='driver'} onChange={()=>setRole('driver')} /> 司機</label>
          <label><input type="radio" name="regrole" checked={role==='admin'} onChange={()=>setRole('admin')} /> 管理員</label>
        </div>
      </div>
      {role==='driver' && (
        <div className="form-group">
          <div className="label">車輛資訊</div>
          <div style={{ display:'grid', gap:8, gridTemplateColumns:'1fr 1fr 1fr' }}>
            <input className="input" value={plate} onChange={e=>setPlate(e.target.value)} placeholder="車牌號碼" />
            <input className="input" value={carModel} onChange={e=>setCarModel(e.target.value)} placeholder="車型" />
            <input className="input" value={carColor} onChange={e=>setCarColor(e.target.value)} placeholder="顏色" />
          </div>
        </div>
      )}
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary" onClick={submit}>註冊</button>
        </div>
        <pre className="muted" style={{ marginTop:12 }}>{res ? JSON.stringify(res, null, 2) : null}</pre>
      </div>
    </div>
  )
}
