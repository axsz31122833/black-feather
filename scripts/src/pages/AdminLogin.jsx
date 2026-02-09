import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { supabase } from '../lib/supabaseClient'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { isLoading, signIn } = useAuthStore()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await signIn(phone, password, 'admin')
      const { data: { user } } = await supabase.auth.getUser()
      const id = user?.id || ''
      if (!id) throw new Error('未登入')
      const { data } = await supabase.from('profiles').select('role').eq('id', id).limit(1).single()
      if (data?.role !== 'admin') throw new Error('非管理員帳號')
      navigate('/admin')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || 'Login failed')
      setError(msg)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center" style={{ background: '#000' }}>
      <div className="w-full max-w-xl px-6 py-10 rounded-2xl" style={{ background: '#0b0b0b', border: '1px solid rgba(255,255,255,0.12)' }}>
        <div className="text-3xl font-extrabold mb-6" style={{ color: '#ffffff' }}>黑羽管理登入</div>
        {error && <div className="bg-red-50/80 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">電話號碼</label>
            <input type="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full px-4 py-3 border border-gray-700 bg-[#111] text-white rounded-2xl focus:ring-2 focus:ring-gray-600 focus:border-transparent" placeholder="請輸入手機號碼" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">密碼</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full px-4 py-3 border border-gray-700 bg-[#111] text-white rounded-2xl focus:ring-2 focus:ring-gray-600 focus:border-transparent" placeholder="請輸入密碼" required />
          </div>
          <button type="submit" disabled={isLoading} className="w-full py-4 px-4 rounded-2xl disabled:opacity-50 font-bold text-white text-lg" style={{ background: '#1e1e1e' }}>
            {isLoading ? '登入中...' : '登入'}
          </button>
        </form>
      </div>
    </div>
  )
}
