import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register.jsx'))
const PassengerHome = lazy(() => import('./pages/PassengerHome'))
const PassengerRidePage = lazy(() => import('./pages/PassengerRidePage'))
const DriverHome = lazy(() => import('./pages/DriverHome'))
const DriverRidePage = lazy(() => import('./pages/DriverRidePage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const DevBypass = lazy(() => import('./pages/DevBypass'))
const DriverPending = lazy(() => import('./pages/DriverPending'))
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './stores/auth'
import GlobalMonitor from './components/GlobalMonitor'
import PushInit from './components/PushInit'
import { supabase } from './lib/supabase'

function AuthRouter() {
  const navigate = useNavigate()
  const { isAuthenticated, userType, checkAuth } = useAuthStore() as any
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_event, _session) => {
      checkAuth()
    })
    return () => { try { (sub as any).data?.subscription?.unsubscribe?.() } catch {} }
  }, [])
  useEffect(() => {
    if (isAuthenticated && userType) {
      if (userType === 'passenger') navigate('/passenger')
      else if (userType === 'driver') navigate('/driver')
      else navigate('/admin')
    } else {
      try { localStorage.clear(); sessionStorage.clear() } catch {}
      navigate('/login')
    }
  }, [isAuthenticated, userType])
  return null
}

function App() {
  const { checkAuth, isAuthenticated } = useAuthStore() as any
  useEffect(() => {
    if (window.location.search.includes('dev=1')) return
    checkAuth()
  }, [])
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const data: any = e.data
      if (data && data.type === 'flush_ops' && data.item) {
        const it = data.item
        ;(async () => {
          try { await supabase.from('ops_events').insert({ event_type: it.event_type, ref_id: it.ref_id || null, payload: it.payload || null }) } catch {}
        })()
      }
    }
    navigator.serviceWorker?.addEventListener?.('message', onMsg as any)
    return () => { navigator.serviceWorker?.removeEventListener?.('message', onMsg as any) }
  }, [])
  useEffect(() => {
    const onOnline = () => {
      try { navigator.serviceWorker.controller?.postMessage({ type: 'request_flush' }) } catch {}
    }
    window.addEventListener('online', onOnline)
    const timer = setInterval(() => {
      try { navigator.serviceWorker.controller?.postMessage({ type: 'request_flush' }) } catch {}
    }, 60000)
    return () => { window.removeEventListener('online', onOnline); clearInterval(timer) }
  }, [])
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <header className="app-header">
          <div className="brand" style={{ color: '#FFD700', textShadow: '0 0 10px rgba(255,215,0,0.6)' }}>Black Feather 車隊</div>
          {isAuthenticated && (
            <nav className="nav flex items-center gap-12" style={{ color: '#FFD700', textShadow: '0 0 10px rgba(255,215,0,0.6)' }}>
              <Link to="/passenger" className="hover:text-white">乘客</Link>
              <Link to="/passenger/ride" className="hover:text-white">乘客行程</Link>
              <Link to="/driver" className="hover:text-white">司機</Link>
              <Link to="/driver/ride" className="hover:text-white">司機行程</Link>
              <Link to="/admin" className="hover:text-white">管理端</Link>
            </nav>
          )}
        </header>
        <main className="container">
          <PushInit />
          <AuthRouter />
          <Suspense fallback={<div style={{ padding: 24 }}>載入中...</div>}>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/passenger" element={
                <ProtectedRoute roles={['passenger','driver','admin']}>
                  <PassengerHome />
                </ProtectedRoute>
              } />
              <Route path="/passenger/home" element={
                <ProtectedRoute roles={['passenger','driver','admin']}>
                  <PassengerHome />
                </ProtectedRoute>
              } />
              <Route path="/passenger/ride" element={
                <ProtectedRoute roles={['passenger','driver','admin']}>
                  <PassengerRidePage />
                </ProtectedRoute>
              } />
              <Route path="/driver" element={
                <ProtectedRoute roles={['driver','admin']}>
                  <DriverHome />
                </ProtectedRoute>
              } />
              <Route path="/driver/home" element={
                <ProtectedRoute roles={['driver','admin']}>
                  <DriverHome />
                </ProtectedRoute>
              } />
              <Route path="/driver/ride" element={
                <ProtectedRoute roles={['driver','admin']}>
                  <DriverRidePage />
                </ProtectedRoute>
              } />
              <Route path="/driver/pending" element={
                <ProtectedRoute roles={['driver']}>
                  <DriverPending />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/home" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
            </Routes>
          </Suspense>
          <GlobalMonitor />
        </main>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
