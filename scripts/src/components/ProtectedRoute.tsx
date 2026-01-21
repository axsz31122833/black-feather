import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

interface Props {
  children: React.ReactElement
  roles?: Array<'passenger' | 'driver' | 'admin'>
}

export default function ProtectedRoute({ children, roles }: Props) {
  const { isAuthenticated, isLoading, userType, user } = useAuthStore() as any
  if (isLoading) return <div className="p-8 text-center text-gray-600">載入中...</div>
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user && (user.status === 'banned' || user.status === 'suspended')) return <Navigate to="/login" replace />
  if (roles && userType && !roles.includes(userType)) return <Navigate to="/" replace />
  return children
}
