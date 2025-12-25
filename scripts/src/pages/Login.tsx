import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { User, Car, Shield } from 'lucide-react'

type UserType = 'passenger' | 'driver' | 'admin'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, isLoading } = useAuthStore()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userType, setUserType] = useState<UserType>('passenger')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await signIn(email, password, userType)
      
      // Redirect based on user type
      switch (userType) {
        case 'passenger':
          navigate('/')
          break
        case 'driver':
          navigate('/driver')
          break
        case 'admin':
          navigate('/admin')
          break
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

  const userTypeOptions = [
    { value: 'passenger', label: '乘客', icon: User, color: 'text-blue-600' },
    { value: 'driver', label: '司機', icon: Car, color: 'text-green-600' },
    { value: 'admin', label: '管理員', icon: Shield, color: 'text-purple-600' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">登入</h1>
          <p className="text-gray-600">歡迎回來！請選擇您的身份</p>
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
            <div className="grid grid-cols-3 gap-2">
              {userTypeOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setUserType(option.value as UserType)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      userType === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mx-auto mb-1 ${option.color}`} />
                    <span className="text-xs text-gray-700">{option.label}</span>
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="請輸入您的電子郵件"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              密碼
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="請輸入您的密碼"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? '登入中...' : '登入'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-600">
            還沒有帳號？{' '}
            <button
              onClick={() => navigate('/register')}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              立即註冊
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}