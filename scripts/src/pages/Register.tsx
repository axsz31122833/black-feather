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
      const { supabase } = await import('../lib/supabase')
      const adminPhone = phone.trim() === '0971827628'
      let inviterRow: any = null
      if (!adminPhone) {
        const { count } = await supabase.from('users').select('id', { count: 'exact', head: true } as any)
        if ((count || 0) > 0) {
          const { data: inviter } = await supabase.from('users').select('id,name,phone').eq('phone', inviteCode).limit(1)
          if (!inviter || inviter.length === 0) {
            setError('邀請碼不存在；首位使用者無需邀請碼')
            return
          }
          inviterRow = inviter[0]
        }
      }
      const role = adminPhone ? 'admin' : 'passenger'
      const regName = adminPhone ? '豐家' : name
      const emailAlias = `u-${phone.trim()}@blackfeather.com`
      await signUp(emailAlias, password, phone, role as any, regName)
      const { data: me } = await supabase.auth.getUser()
      let uid = me?.user?.id || null
      if (!uid) {
        try {
          const { data: u1 } = await supabase.from('users').select('id').eq('email', emailAlias).limit(1)
          uid = u1 && u1[0]?.id || null
          if (!uid) {
            const { data: u2 } = await supabase.from('users').select('id').eq('phone', phone).limit(1)
            uid = u2 && u2[0]?.id || null
          }
        } catch {}
      }
      if (uid) {
        await supabase.from('profiles').upsert({
          user_id: uid,
          name: regName,
          full_name: regName,
          phone,
          created_at: new Date().toISOString(),
          ride_frequency: 0,
          recommended_by_phone: adminPhone ? null : (inviterRow?.phone || inviteCode || null),
          recommended_by_name: adminPhone ? null : (inviterRow?.name || null)
        }, { onConflict: 'user_id' } as any)
      }
      navigate('/')
    } catch (err) {
      setError(typeof err === 'string' ? err : (err instanceof Error ? err.message : JSON.stringify(err)))
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
              onClick={() => navigate('/login')}
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
