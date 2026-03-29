import React, { useEffect, Suspense, lazy, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
const Login = lazy(() => import('./pages/PassengerLogin.jsx'))
const PassengerLogin = lazy(() => import('./pages/PassengerLogin.jsx'))
const DriverLogin = lazy(() => import('./pages/DriverLogin.jsx'))
const AdminLogin = lazy(() => import('./pages/AdminLogin.jsx'))
const Register = lazy(() => import('./pages/Register.tsx'))
const PassengerHome = lazy(() => import('./pages/PassengerHome'))
// const PassengerRidePage = lazy(() => import('./pages/PassengerRidePage'))
const DriverHome = lazy(() => import('./pages/DriverHome'))
// const DriverRidePage = lazy(() => import('./pages/DriverRidePage'))
const AdminDashboard = lazy(() => import('./pages/AdminCommandCenter'))
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
import { installFetchPatch } from './lib/fetchPatch'

function AuthRouter({ onInitDone }: { onInitDone: () => void }) {
  const navigate = useNavigate()
  const { isAuthenticated, userType, checkAuth } = useAuthStore() as any
  const [initializing, setInitializing] = useState(true)
  useEffect(() => {
    let firstHandled = false
    const sub = supabase.auth.onAuthStateChange(async (event, _session) => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user?.id) {
          try {
            const { data: sess } = await supabase.auth.getSession()
            if (sess?.session) {
              try { await supabase.auth.refreshSession() } catch {}
            }
          } catch {}
        }
        let prof: any = null
        try {
          if (user?.id) {
            const { data } = await supabase.from('profiles').select('id,role,full_name,phone').eq('id', user.id).limit(1).maybeSingle()
            prof = data || null
            if (user && !prof) {
              try {
                const payload: any = { id: user.id, user_id: user.id, role: 'passenger', full_name: '新乘客', name: '新乘客' }
                const { error: upErr } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' } as any)
                if (upErr) { try { console.error('【自動補建 Profile 失敗】', upErr) } catch {} }
                else {
                  const { data: d2 } = await supabase.from('profiles').select('id,role,full_name,phone').eq('id', user.id).limit(1).maybeSingle()
                  prof = d2 || payload
                }
              } catch {}
            }
            try {
              const role = (prof?.role as any) || (localStorage.getItem('bf_role') as any) || 'passenger'
              useAuthStore.getState().setUser({
                id: user.id,
                email: (user as any)?.email || '',
                phone: (user as any)?.phone || '',
                user_type: role
              })
              try { localStorage.setItem('bf_role', String(role)) } catch {}
            } catch {}
            if (event === 'SIGNED_IN' && !prof) {
              let tries = 0
              const timer = setInterval(async () => {
                try {
                  const { data: d3 } = await supabase.from('profiles').select('id,role,full_name,phone').eq('id', user.id).limit(1).maybeSingle()
                  if (d3) {
                    try { console.log('【補建輪詢】已取得 Profile:', d3) } catch {}
                    clearInterval(timer)
                  }
                } catch {}
                tries++
                if (tries >= 5) {
                  try { console.warn('【補建輪詢】超時，仍未取得 Profile') } catch {}
                  clearInterval(timer)
                }
              }, 1000)
            }
          }
        } catch {}
        try { console.log('【登入狀態檢查】User:', user, 'Profile:', prof); console.log(`【身分檢查】UID: ${user?.id || '—'}, 是否有 Profile: ${!!prof}`) } catch {}
      } catch {}
      checkAuth()
      if (!firstHandled) {
        firstHandled = true
        setInitializing(false)
        try { onInitDone && onInitDone() } catch {}
      }
    })
    return () => { try { (sub as any).data?.subscription?.unsubscribe?.() } catch {} }
  }, [])
  useEffect(() => {
    ;(async ()=>{
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (initializing) return
        if (isAuthenticated) {
          // 留在當前頁或由其他路由控制
        } else {
          if (!user?.id) {
            const path = window.location.pathname
            if (path.startsWith('/admin')) navigate('/admin/login')
            else if (path.startsWith('/driver')) navigate('/driver/login')
            else navigate('/passenger/login')
          } // 有 user 時不跳轉，等待補建/緩衝
        }
      } catch {}
    })()
  }, [isAuthenticated, userType, initializing])
  return null
}

function App() {
  const { checkAuth, isAuthenticated, userType } = useAuthStore() as any
  const [errorBanner, setErrorBanner] = useState<{ message: string; code?: string; details?: string } | null>(null)
  const [authInitDone, setAuthInitDone] = useState(false)
  useEffect(() => {
    try { installFetchPatch() } catch {}
    if (window.location.search.includes('dev=1')) return
    checkAuth()
  }, [])
  useEffect(() => {
    const onErr = (e: any) => {
      try { setErrorBanner(e?.detail || (window as any).__bf_last_error || null) } catch {}
    }
    window.addEventListener('bf_error', onErr)
    return () => { window.removeEventListener('bf_error', onErr) }
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
        {!authInitDone && (
          <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0a0a', zIndex:99999 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:28, fontWeight:900, color:'#D4AF37', marginBottom:12 }}>Black Feather</div>
              <div style={{ width:48, height:48, borderRadius:'50%', border:'3px solid #D4AF37', borderTopColor:'transparent', margin:'0 auto', animation:'spin 1s linear infinite' }} />
              <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
              <div style={{ color:'#9ca3af', marginTop:8 }}>初始化登入狀態…</div>
            </div>
          </div>
        )}
        <header className="app-header">
          {/* deploy trigger: 2026-01-29 */}
          <div className="brand flex items-center gap-3" style={{ color: '#FFD700', textShadow: '0 0 10px rgba(255,215,0,0.6)' }}>
            Black Feather 車隊
            <span style={{ fontSize: 12, color:'#93c5fd', opacity: 0.9 }}>v1.9.10-UUID-Syntax-Safety-Guard</span>
          </div>
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
          {errorBanner && (
            <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:9999, background:'#7f1d1d', color:'#fff', padding:'8px 12px', borderBottom:'2px solid #dc2626' }}>
              <strong>錯誤</strong>：{errorBanner.message} {errorBanner.code ? `(code: ${errorBanner.code})` : ''} {errorBanner.details ? `· ${errorBanner.details}` : ''}
            </div>
          )}
          <ConnectionChecker />
          <PushInit />
          <ManifestManager />
          <AuthRouter onInitDone={() => setAuthInitDone(true)} />
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
                  <PassengerHome />
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
                  <DriverHome />
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
          <div style={{ position:'fixed', right:12, bottom:10, fontSize:12, color:'#93c5fd', opacity:0.9, background:'rgba(0,0,0,0.35)', padding:'4px 8px', borderRadius:8, border:'1px solid rgba(147,197,253,0.4)' }}>
            v1.9.10-UUID-Syntax-Safety-Guard
          </div>
        </main>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
