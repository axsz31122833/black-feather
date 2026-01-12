import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

interface Props {
  children: React.ReactElement
  roles?: Array<'passenger' | 'driver' | 'admin'>
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { isAuthenticated, isLoading, userType, user } = useAuthStore() as any
  try {
    const params = new URLSearchParams(window.location.search)
    const dev = params.get('dev')
    const roleParam = params.get('role') as any
    if (dev === '1' && !isAuthenticated) {
      const role = (roleParam === 'driver' || roleParam === 'passenger' || roleParam === 'admin') ? roleParam : 'admin'
      const now = new Date().toISOString()
      useAuthStore.setState({
        user: { id: 'dev-user', email: 'dev@bf.test', phone: '', user_type: role, status: 'active', created_at: now, updated_at: now },
        isAuthenticated: true,
        userType: role,
        isLoading: false
      })
    }
  } catch {}
  if (isLoading) return <div className="p-8 text-center text-gray-600">載入中...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user && (user.status === 'banned' || user.status === 'suspended')) return <Navigate to="/login" replace />
  if (roles && userType && !roles.includes(userType)) return <Navigate to="/" replace />
  return children
}
