import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register.jsx'))
const PassengerHome = lazy(() => import('./pages/PassengerHome'))
const PassengerRidePage = lazy(() => import('./pages/PassengerRidePage'))
const DriverHome = lazy(() => import('./pages/DriverHome'))
const DriverRidePage = lazy(() => import('./pages/DriverRidePage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const DevBypass = lazy(() => import('./pages/DevBypass'))
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './stores/auth'
import GlobalMonitor from './components/GlobalMonitor'
import PushInit from './components/PushInit'
import { supabase } from './lib/supabase'

function App() {
  const { checkAuth } = useAuthStore()
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
          <div className="brand text-yellow-300">Black Feather 車隊</div>
          <nav className="nav flex items-center gap-6 text-yellow-300">
            <Link to="/login" className="hover:text-white">登入</Link>
            <Link to="/register" className="hover:text-white">註冊</Link>
            <Link to="/passenger" className="hover:text-white">乘客</Link>
            <Link to="/passenger/ride" className="hover:text-white">乘客行程</Link>
            <Link to="/driver" className="hover:text-white">司機</Link>
            <Link to="/driver/ride" className="hover:text-white">司機行程</Link>
            <Link to="/admin" className="hover:text-white">管理端</Link>
          </nav>
        </header>
        <main className="container">
          <PushInit />
          <Suspense fallback={<div style={{ padding: 24 }}>載入中...</div>}>
            <Routes>
              <Route path="/dev-login" element={<DevBypass />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={
                <ProtectedRoute roles={['passenger','driver','admin']}>
                  <PassengerHome />
                </ProtectedRoute>
              } />
              <Route path="/passenger" element={
                <ProtectedRoute roles={['passenger']}>
                  <PassengerHome />
                </ProtectedRoute>
              } />
              <Route path="/passenger/home" element={
                <ProtectedRoute roles={['passenger']}>
                  <PassengerHome />
                </ProtectedRoute>
              } />
              <Route path="/passenger/ride" element={
                <ProtectedRoute roles={['passenger']}>
                  <PassengerRidePage />
                </ProtectedRoute>
              } />
              <Route path="/driver" element={
                <ProtectedRoute roles={['driver']}>
                  <DriverHome />
                </ProtectedRoute>
              } />
              <Route path="/driver/home" element={
                <ProtectedRoute roles={['driver']}>
                  <DriverHome />
                </ProtectedRoute>
              } />
              <Route path="/driver/ride" element={
                <ProtectedRoute roles={['driver']}>
                  <DriverRidePage />
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
