import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { User, Car, Shield } from 'lucide-react'

type UserType = 'passenger' | 'driver' | 'admin'

export default function Login() {
  const navigate = useNavigate()
  const { isLoading, signIn } = useAuthStore()
  const [fadeIn, setFadeIn] = useState(false)
  useEffect(() => { setFadeIn(true) }, [])
  
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [userType, setUserType] = useState<UserType>('passenger')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await signIn(phone, password, userType)
      navigate('/admin')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err || 'Login failed')
      setError(msg)
      try { alert(msg) } catch {}
    }
  }

  const userTypeOptions = [
    { value: 'passenger', label: '乘客', icon: User, color: 'text-blue-600' },
    { value: 'driver', label: '司機', icon: Car, color: 'text-green-600' },
    { value: 'admin', label: '管理員', icon: Shield, color: 'text-purple-600' }
  ]

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #0d0d0d 100%)' }}
    >
      <div className="w-full max-w-6xl px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className={`rounded-2xl p-8 text-white transition-all duration-700 ease-out ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`} style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #121212 100%)', border: '1px solid rgba(212,175,55,0.3)', boxShadow: '0 0 30px rgba(212,175,55,0.08)' }}>
            <div className="text-4xl md:text-5xl font-extrabold mb-4" style={{ color: '#D4AF37', textShadow: '0 0 12px rgba(212,175,55,0.35)' }}>
              黑羽車隊 Black Feather
            </div>
            <div className="space-y-3 text-sm md:text-base text-gray-300">
              <div>🛡️ 嚴格審核：每一位司機皆由管理端人工面試通過。</div>
              <div>✉️ 尊榮邀請：僅限邀請制，輸入推薦人電話即可加入。</div>
              <div>💎 透明計費：標準化費率，四捨五入至十位數。</div>
            </div>
          </div>
          <div className={`rounded-2xl p-8 text-white transition-all duration-700 ease-out ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`} style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)', border: '1px solid rgba(212,175,55,0.25)', boxShadow: '0 0 24px rgba(212,175,55,0.15)' }}>
            <div className="text-2xl font-bold mb-2" style={{ color:'#D4AF37' }}>登入</div>
            <div className="text-sm text-gray-300 mb-6">歡迎回來！請選擇您的身份並登入。</div>
            <div className="mb-4 rounded-xl p-4" style={{ background:'linear-gradient(180deg, rgba(10,10,10,0.8) 0%, rgba(18,18,18,0.8) 100%)', border:'1px solid rgba(212,175,55,0.25)' }}>
              <div className="text-xl font-extrabold mb-1" style={{ color:'#D4AF37' }}>黑羽車隊 Black Feather</div>
              <div className="text-sm text-gray-300">頂級移動美學，僅限受邀嘉賓。</div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50/80 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-200 mb-2">用戶類型</label>
                <div className="grid grid-cols-3 gap-2">
                  {userTypeOptions.map((option) => {
                    const Icon = option.icon
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setUserType(option.value as UserType)}
                        className={`p-3 rounded-2xl border-2 transition-all ${userType === option.value ? 'border-[#D4AF37] bg-[#1a1a1a]' : 'border-[#D4AF37]/30 hover:border-[#D4AF37]/50'}`}
                      >
                        <Icon className="w-6 h-6 mx-auto mb-1" />
                        <span className="text-xs text-gray-200">{option.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-200 mb-2">電話號碼</label>
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
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2">密碼</label>
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
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-black text-lg"
                style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
              >
                {isLoading ? '登入中...' : '登入'}
              </button>
            </form>
            <div className="mt-6 text-center">
              <p className="text-gray-300">
                還沒有帳號？{' '}
                <button onClick={() => navigate('/register')} className="text-yellow-300 hover:text-yellow-200 font-medium">
                  立即註冊
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
