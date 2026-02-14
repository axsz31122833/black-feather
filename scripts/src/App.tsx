import React, { useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
const Login = lazy(() => import('./pages/PassengerLogin.jsx'))
const PassengerLogin = lazy(() => import('./pages/PassengerLogin.jsx'))
const DriverLogin = lazy(() => import('./pages/DriverLogin.jsx'))
const AdminLogin = lazy(() => import('./pages/AdminLogin.jsx'))
const Register = lazy(() => import('./pages/Register.tsx'))
const PassengerHome = lazy(() => import('./pages/PassengerHome'))
const PassengerRidePage = lazy(() => import('./pages/PassengerRidePage'))
const DriverHome = lazy(() => import('./pages/DriverHome'))
const DriverRidePage = lazy(() => import('./pages/DriverRidePage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const DevBypass = lazy(() => import('./pages/DevBypass'))
import AppSelector from './AppSelector.jsx'
import PassengerApp from './PassengerApp/index.jsx'
import DriverApp from './DriverApp/index.jsx'
// import AdminApp from './AdminApp/index.jsx'
const DriverPending = lazy(() => import('./pages/DriverPending'))
import ErrorBoundary from './components/ErrorBoundary'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './stores/auth'
import GlobalMonitor from './components/GlobalMonitor'
import PushInit from './components/PushInit'
import { supabase } from './lib/supabaseClient'
import ConnectionChecker from './components/ConnectionChecker'
import ManifestManager from './components/ManifestManager'

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
    if (isAuthenticated) {
      navigate('/apps')
    } else {
      try { localStorage.clear(); sessionStorage.clear() } catch {}
      navigate('/login')
    }
  }, [isAuthenticated, userType])
  return null
}

function App() {
  const { checkAuth, isAuthenticated, userType } = useAuthStore() as any
  useEffect(() => {
    if (window.location.search.includes('dev=1')) return
    checkAuth()
  }, [])
  useEffect(() => {
    return () => {}
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
  useEffect(() => {
    if (!isAuthenticated) return
    let watchId: number | null = null
    try {
      if (Notification.permission === 'default') { Notification.requestPermission().catch(()=>{}) }
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          try {
            localStorage.setItem('bf_last_lat', String(pos.coords.latitude))
            localStorage.setItem('bf_last_lng', String(pos.coords.longitude))
          } catch {}
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 }
      ) as any
    } catch {}
    return () => { try { if (watchId != null) navigator.geolocation.clearWatch(watchId) } catch {} }
  }, [isAuthenticated])
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <header className="app-header">
          {/* deploy trigger: 2026-01-29 */}
          <div className="brand" style={{ color: '#FFD700', textShadow: '0 0 10px rgba(255,215,0,0.6)' }}>Black Feather 車隊</div>
          {isAuthenticated && userType && (userType === 'admin' || userType === 'driver') && !window.location.pathname.startsWith('/passenger') && (
            <nav className="nav flex items-center gap-12" style={{ color: '#FFD700', textShadow: '0 0 10px rgba(255,215,0,0.6)' }}>
              <Link to="/passenger" className="hover:text-white">乘客</Link>
              {userType === 'driver' && (
                <>
                  <Link to="/driver" className="hover:text-white">司機</Link>
                  <Link to="/driver/scheduled" className="hover:text-white">預約大廳</Link>
                </>
              )}
              {userType === 'admin' && (
                <>
                  <Link to="/driver" className="hover:text-white">司機</Link>
                  <Link to="/driver/scheduled" className="hover:text白">預約大廳</Link>
                  <Link to="/admin" className="hover:text-white">管理端</Link>
                </>
              )}
            </nav>
          )}
        </header>
        <main className="container" style={{ background: 'transparent', position: 'relative', overflow: 'visible' }}>
          <ConnectionChecker />
          <PushInit />
          <ManifestManager />
          
          <Suspense fallback={<div style={{ padding: 24 }}>載入中...</div>}>
            <Routes>
              <Route path="/" element={<PassengerApp />} />
              <Route path="/login" element={<PassengerLogin />} />
              <Route path="/register" element={<Register />} />
              <Route path="/passenger/login" element={<PassengerLogin />} />
              <Route path="/driver/login" element={<DriverLogin />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/passenger/*" element={<PassengerApp />} />
              <Route path="/driver/*" element={
                <ProtectedRoute roles={['driver','admin']}>
                  <DriverApp />
                </ProtectedRoute>
              } />
              <Route path="/admin/*" element={
                <ProtectedRoute roles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
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
              <Route path="/driver/scheduled" element={
                <ProtectedRoute roles={['driver','admin']}>
                  {React.createElement(lazy(() => import('./pages/DriverScheduled')))}
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
