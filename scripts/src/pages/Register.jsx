import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../stores/auth'
import { useNavigate } from 'react-router-dom'

export default function Register() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [invite, setInvite] = useState('')
  const [plate, setPlate] = useState('')
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
      const { data: signData, error: signErr } = await supabase.auth.signUp({ email: emailAlias, password })
      if (signErr) { try { alert('註冊失敗：' + (signErr.message || '未知錯誤')) } catch {}; setRes({ error: signErr.message }); return }
      const uid = signData?.user?.id
      if (!uid) { setRes({ error:'未取得使用者 ID' }); return }
      const { error: usersErr } = await supabase.from('users').upsert({ id: uid, email: emailAlias, phone: normalized, user_type: adminPhone ? 'admin' : 'passenger', name: adminPhone ? '豐家' : name }, { onConflict:'id' })
      if (usersErr) { try { alert('建立 users 資料失敗：' + (usersErr.message || '未知錯誤')) } catch {}; setRes({ error: usersErr.message }); return }
      try { console.log('【註冊同步檢查】Auth ID:', uid, '準備寫入 Profile...') } catch {}
      const payload = {
        id: uid,
        user_id: uid,
        name: adminPhone ? '豐家' : name || '新乘客',
        full_name: adminPhone ? '豐家' : name || '新乘客',
        license_plate: plate || null,
        phone: normalized,
        role: adminPhone ? 'admin' : 'passenger',
        recommended_by_phone: adminPhone ? null : (invite || null),
        created_at: new Date().toISOString()
      }
      const { error: upErr } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' })
      if (upErr) { try { alert('註冊檔案建立失敗：' + (upErr.message || '未知錯誤')) } catch {}; setRes({ error: upErr.message }); return }
      try {
        const { data: au } = await supabase.auth.getUser()
        const cur = au?.user?.id || ''
        if (!cur || cur !== uid) {
          console.error('【錯誤】目標用戶不存在於 Auth 系統，無法建立司機檔案', { current: cur, target: uid })
        } else {
          await supabase.from('driver_profiles').upsert({ user_id: uid }, { onConflict:'user_id' })
        }
      } catch {}
      setRes({ ok:true, phone: normalized, role: adminPhone ? 'admin' : 'passenger' })
      setTimeout(() => navigate('/'), 300)
    } catch (e) { setRes({ error: String(e) }); try { alert('註冊失敗：' + String(e)) } catch {} }
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
            <div className="label" style={{ color:'#FFFFFF', marginBottom:6 }}>車牌號碼（司機可填，選填）</div>
            <input className="input" value={plate} onChange={e=>setPlate(e.target.value)} placeholder="例如 ABC-1234" style={{ width:'100%', padding:'10px 12px', background:'#1a1a1a', color:'#fff', border:'1px solid #D4AF37', borderRadius:12 }} />
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
