import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { User, Car } from 'lucide-react'

type UserType = 'passenger' | 'driver'

export default function Register() {
  const navigate = useNavigate()
  const { signUp, isLoading } = useAuthStore()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [userType, setUserType] = useState<UserType>('passenger')
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
      if (true) {
        const { supabase } = await import('../lib/supabase')
        const { data: inviter } = await supabase.from('users').select('id').eq('phone', inviteCode).limit(1)
        if (!inviter || inviter.length === 0) {
          setError('無效的邀請碼，請聯繫您的推薦人。')
          return
        }
      }
      await signUp(email, password, phone, 'passenger')
      
      // Redirect to appropriate dashboard
      navigate(userType === 'passenger' ? '/' : '/driver')
    } catch (err) {
      setError(err instanceof Error ? err.message : '註冊失敗')
    }
  }

  const userTypeOptions = [
    { value: 'passenger', label: '乘客', icon: User, color: 'text-blue-600' },
    { value: 'driver', label: '司機', icon: Car, color: 'text-green-600' }
  ]

  return (
    <div className="min-h-screen bg-transparent text-white flex items-center justify-center p-4">
      <div className="bg-transparent rounded-2xl shadow-2xl border border-[#D4AF37]/30 w-full max-w-md p-8">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              用戶類型
            </label>
            <div className="grid grid-cols-2 gap-2">
              {userTypeOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setUserType(option.value as UserType)}
                    className={`p-3 rounded-2xl border-2 transition-all ${
                      userType === option.value
                        ? 'border-[#D4AF37] bg-[#1a1a1a]'
                        : 'border-[#D4AF37]/30 hover:border-[#D4AF37]/50'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mx-auto mb-1`} />
                    <span className="text-xs text-gray-200">{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              電子郵件
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-[#D4AF37]/50 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="請輸入您的電子郵件"
              required
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              手機號碼
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-[#D4AF37]/50 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="請輸入您的手機號碼"
              required
            />
          </div>
          
          {userType === 'passenger' && (
            <div>
              <label htmlFor="invite" className="block text-sm font-medium text-gray-200 mb-2">
                邀請碼
              </label>
              <input
                id="invite"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full px-4 py-3 border border-[#D4AF37]/50 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                placeholder="請輸入您的邀請碼（推薦人手機號碼）"
                required
              />
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              密碼
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-[#D4AF37]/50 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="請輸入您的密碼"
              required
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              確認密碼
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-[#D4AF37]/50 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="請再次輸入您的密碼"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 px-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-black text-lg"
            style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
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
