import React, { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

export default function DevBypass() {
  const navigate = useNavigate()
  const loc = useLocation()
  useEffect(() => {
    const params = new URLSearchParams(loc.search)
    const roleParam = params.get('role') as any
    const to = params.get('to') || '/'
    const role = (roleParam === 'driver' || roleParam === 'passenger' || roleParam === 'admin') ? roleParam : 'admin'
    const now = new Date().toISOString()
    useAuthStore.setState({
      user: { id: 'dev-user', email: 'dev@bf.test', phone: '', user_type: role, status: 'active', created_at: now, updated_at: now },
      isAuthenticated: true,
      userType: role,
      isLoading: false
    })
    navigate(to, { replace: true })
  }, [loc.search, navigate])
  return <div className="p-6 text-center text-gray-700">Dev bypass set. Redirecting...</div>
}
