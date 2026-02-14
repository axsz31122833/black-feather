import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { User, Car } from 'lucide-react'

 

export default function Register() {
  const navigate = useNavigate()
  const { signUp, isLoading } = useAuthStore()
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('密碼不匹配')
      return
    }

    if (password.length < 6) {
      setError('密碼至少需要6個字符')
      return
    }

    try {
      const { supabase } = await import('../lib/supabaseClient')
      const p = phone.trim()
      const adminPhone = p === '0971827628' || p === '0982214855'
      let inviterRow: any = null
      if (!adminPhone) {
        const { count } = await supabase.from('profiles').select('user_id', { count: 'exact', head: true } as any)
        if ((count || 0) > 0) {
          const { data: inviter } = await supabase.from('profiles').select('user_id,name,phone').eq('phone', inviteCode).limit(1)
          if (!inviter || inviter.length === 0) {
            setError('查無此邀請人，請確認推薦人電話號碼')
            return
          }
          inviterRow = inviter[0]
        }
      }
      const role = adminPhone ? 'admin' : 'passenger'
      const regName = adminPhone ? '豐家' : name
      let pwdHash = ''
      try {
        const enc = new TextEncoder().encode(password)
        const buf = await (crypto as any).subtle.digest('SHA-256', enc)
        pwdHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
      } catch {
        pwdHash = password
      }
      try { await supabase.auth.signOut() } catch {}
      if (!adminPhone) {
        const code = String(inviteCode || '').trim()
        if (!code) { setError('邀請碼不可為空'); return }
        const { data: ref } = await supabase.from('profiles').select('id').eq('phone', code).limit(1)
        if (!ref || ref.length === 0) { setError('查無此邀請人，請確認推薦人電話號碼'); return }
      }
      const { data: profData, error: profErr } = await supabase.from('profiles').insert({
        full_name: regName,
        phone,
        role,
        password_hash: pwdHash,
        referrer_phone: String(inviteCode || '').trim() || null
      } as any)
      console.log('profiles insert result:', { data: profData, error: profErr })
      if (profErr) {
        const code = (profErr as any)?.code ?? (profErr as any)?.status ?? null
        const msg = (profErr as any)?.message || '註冊失敗，資料庫拒絕寫入'
        if (String(code) === '23505' || /duplicate/i.test(msg)) {
          navigate('/passenger/login')
          return
        }
        alert(msg)
        throw profErr
      }
      const emailAlias = `u-${phone.trim()}-${Date.now()}@blackfeather.com`
      useAuthStore.getState().setUser({
        email: emailAlias,
        phone,
        user_type: role as any
      })
      try { localStorage.setItem('bf_phone', phone) } catch {}
      navigate('/admin')
    } catch (err) {
      const code = (err as any)?.code ?? (err as any)?.status ?? null
      const msg = typeof err === 'string' ? err : (err instanceof Error ? err.message : '註冊失敗，請確認資料或稍後再試')
      if (String(code) === '23505' || /duplicate/i.test(msg)) { navigate('/passenger/login'); return }
      setError(code ? `[${code}] ${msg}` : msg)
      try { alert(code ? `[${code}] ${msg}` : msg) } catch {}
    }
  }

  

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
      <div className="rounded-2xl shadow-2xl border border-[#D4AF37]/30 w-full max-w-md p-8" style={{ backgroundImage: 'linear-gradient(180deg, rgba(26,26,26,1) 0%, rgba(15,15,15,1) 100%)' }}>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color:'#FFD700' }}>註冊</h1>
          <p className="text-gray-300">創建您的新帳號</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-white mb-2">
              姓名
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-[#D4AF37] bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="請輸入真實姓名以利管理"
              required
            />
          </div>

          

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-white mb-2">
              手機號碼
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-[#D4AF37] bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="請輸入您的手機號碼"
              required
            />
          </div>
          
          <div>
            <label htmlFor="invite" className="block text-sm font-medium text-white mb-2">
              邀請碼
            </label>
            <input
              id="invite"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full px-4 py-3 border border-[#D4AF37] bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="請輸入您的邀請碼（推薦人手機號碼）"
              
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
              密碼
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-[#D4AF37] bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="請輸入您的密碼"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2">
              確認密碼
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-[#D4AF37] bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="請再次輸入您的密碼"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 px-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition font-bold text-black text-lg hover:brightness-110 active:brightness-125"
            style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)', boxShadow: '0 0 12px rgba(212,175,55,0.35)' }}
          >
            {isLoading ? '註冊中...' : '註冊'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            已經有帳號？{' '}
            <button
              onClick={() => navigate('/passenger/login')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              立即登入
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
