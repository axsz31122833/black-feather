import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import { useNavigate } from 'react-router-dom'

export default function Register() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [res, setRes] = useState(null)
  const navigate = useNavigate()
  const { signUp } = useAuthStore()

  async function submit() {
    const normalized = String(phone||'').trim()
    if (!name.trim()) { setRes({ error:'請輸入真實姓名' }); return }
    if (!normalized || normalized.length < 8) { setRes({ error:'請輸入有效的手機號碼' }); return }
    if (!password || password.length < 6) { setRes({ error:'請輸入密碼（至少 6 碼）' }); return }
    try {
      const emailAlias = `u-${normalized}-${Date.now()}@blackfeather.com`
      const adminPhone = normalized === '0971827628' || normalized === '0982214855'
      if (!adminPhone) {
        const { count } = await supabase.from('profiles').select('user_id', { count: 'exact', head: true })
        if ((count || 0) > 0) {
          if (!invite || invite.trim().length < 8) { setRes({ error:'查無此邀請人，請確認推薦人電話號碼' }); return }
          const { data: inviter } = await supabase.from('profiles').select('user_id, phone').eq('phone', invite).maybeSingle()
          if (!inviter) { setRes({ error:'查無此邀請人，請確認推薦人電話號碼' }); return }
        }
      }
      await signUp(emailAlias, password, normalized, adminPhone ? 'admin' : 'passenger', adminPhone ? '豐家' : name)
      const { data: me } = await supabase.from('users').select('id').eq('email', emailAlias).single()
      if (me?.id) {
        await supabase.from('profiles').upsert({
          user_id: me.id,
          name: adminPhone ? '豐家' : name,
          full_name: adminPhone ? '豐家' : name,
          phone: normalized,
          recommended_by_phone: adminPhone ? null : (invite || null),
          created_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
      }
      setRes({ ok:true, phone: normalized, role: adminPhone ? 'admin' : 'passenger' })
      setTimeout(() => navigate('/'), 300)
    } catch (e) { setRes({ error: String(e) }) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#000000', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ width:'100%', maxWidth:420, border:'1px solid #D4AF37', borderRadius:16, padding:24, background:'linear-gradient(180deg, #1a1a1a 0%, #0f0f0f 100%)', boxShadow:'0 0 24px rgba(212,175,55,0.25)' }}>
        <div style={{ textAlign:'center', marginBottom:16, color:'#FFD700', fontWeight:700, fontSize:24 }}>註冊</div>
        <div style={{ display:'grid', gap:16 }}>
          <div className="form-group">
            <div className="label" style={{ color:'#FFFFFF', marginBottom:6 }}>姓名</div>
            <input
              className="input"
              value={name}
              onChange={e=>setName(e.target.value)}
              placeholder="請輸入真實姓名"
              style={{ width:'100%', padding:'10px 12px', background:'#1a1a1a', color:'#fff', border:'1px solid #D4AF37', borderRadius:12 }}
            />
          </div>
          <div className="form-group">
            <div className="label" style={{ color:'#FFFFFF', marginBottom:6 }}>手機號碼</div>
            <input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="例如 09xxxxxxxx" style={{ width:'100%', padding:'10px 12px', background:'#1a1a1a', color:'#fff', border:'1px solid #D4AF37', borderRadius:12 }} />
          </div>
          <div className="form-group">
            <div className="label" style={{ color:'#FFFFFF', marginBottom:6 }}>密碼</div>
            <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少 6 碼" style={{ width:'100%', padding:'10px 12px', background:'#1a1a1a', color:'#fff', border:'1px solid #D4AF37', borderRadius:12 }} />
          </div>
          <div className="form-group">
            <div className="label" style={{ color:'#FFFFFF', marginBottom:6 }}>邀請碼（已註冊之手機號）</div>
            <input className="input" value={invite} onChange={e=>setInvite(e.target.value)} placeholder="例如 09xxxxxxxx" style={{ width:'100%', padding:'10px 12px', background:'#1a1a1a', color:'#fff', border:'1px solid #D4AF37', borderRadius:12 }} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button
              className="btn btn-primary"
              onClick={submit}
              style={{ flex:1, padding:'12px 16px', borderRadius:14, color:'#000', fontWeight:700, background:'linear-gradient(90deg, #D4AF37 0%, #B8860B 100%)', boxShadow:'0 0 12px rgba(212,175,55,0.35)' }}
            >
              註冊
            </button>
          </div>
          <pre className="muted" style={{ marginTop:12, color:'#999' }}>{res ? JSON.stringify(res, null, 2) : null}</pre>
        </div>
      </div>
    </div>
  )
}
