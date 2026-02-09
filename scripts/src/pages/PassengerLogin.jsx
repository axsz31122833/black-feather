import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

export default function PassengerLogin() {
  const navigate = useNavigate()
  const { isLoading, signIn } = useAuthStore()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await signIn(phone, password, 'passenger')
      navigate('/passenger')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || 'Login failed')
      setError(msg)
      try { alert(msg) } catch {}
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #0d0d0d 100%)' }}>
      <div className="w-full max-w-xl px-6 py-10 rounded-2xl" style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #121212 100%)', border: '1px solid rgba(212,175,55,0.35)', boxShadow: '0 0 30px rgba(212,175,55,0.12)' }}>
        <div className="text-4xl font-extrabold mb-6" style={{ color: '#D4AF37', textShadow: '0 0 12px rgba(212,175,55,0.35)' }}>黑羽乘客</div>
        {error && <div className="bg-red-50/80 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">電話號碼</label>
            <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full px-4 py-3 border border-[#D4AF37]/50 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent" placeholder="請輸入您的手機號碼" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">密碼</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full px-4 py-3 border border-[#D4AF37]/50 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent" placeholder="請輸入您的密碼" required />
          </div>
          <button type="submit" disabled={isLoading} className="w-full py-4 px-4 rounded-2xl disabled:opacity-50 font-bold text-black text-lg" style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}>
            {isLoading ? '登入中...' : '登入'}
          </button>
        </form>
        <div className="mt-6 text-center">
          <button onClick={() => navigate('/register')} className="text-yellow-300 hover:text-yellow-200 font-medium">立即註冊</button>
        </div>
      </div>
    </div>
  )
}
