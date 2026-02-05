import React, { useEffect, useRef, useState } from 'react'
import DriverHome from '../pages/DriverHome'
import { supabase } from '../lib/supabaseClient'

export default function DriverApp() {
  const [online, setOnline] = useState(false)
  const [pos, setPos] = useState({ lat: null, lng: null })
  const watchIdRef = useRef(null)
  const timerRef = useRef(null)
  const uidRef = useRef('')

  useEffect(() => {
    ;(async ()=>{
      try {
        const { data: { user } } = await supabase.auth.getUser()
        uidRef.current = user?.id || ''
      } catch {}
    })()
  }, [])

  async function pushDriver(lat, lng, status) {
    const payload = { user_id: uidRef.current || null, lat, lng, status, last_seen: new Date().toISOString() }
    try {
      const { error } = await supabase.from('drivers').upsert(payload, { onConflict: 'user_id' })
      if (error) throw error
      return true
    } catch {
      try {
        await supabase.from('driver_profiles').update({ is_online: status === 'online', current_location: { lat, lng }, updated_at: new Date().toISOString() }).eq('user_id', uidRef.current)
      } catch {}
      return false
    }
  }

  function goOnline() {
    if (online) return
    setOnline(true)
    try {
      watchIdRef.current = navigator.geolocation.watchPosition((p) => {
        const lat = p.coords.latitude
        const lng = p.coords.longitude
        setPos({ lat, lng })
      }, () => {}, { enableHighAccuracy: true, maximumAge: 3000 })
    } catch {}
    timerRef.current = setInterval(() => {
      const { lat, lng } = pos
      if (lat && lng) pushDriver(lat, lng, 'online')
    }, 10000)
  }

  async function goOffline() {
    setOnline(false)
    try { if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current) } catch {}
    watchIdRef.current = null
    try { if (timerRef.current) clearInterval(timerRef.current) } catch {}
    timerRef.current = null
    const { lat, lng } = pos
    await pushDriver(lat, lng, 'offline')
  }

  useEffect(() => {
    return () => { try { if (timerRef.current) clearInterval(timerRef.current) } catch {} }
  }, [])

  return (
    <div>
      <div style={{ padding: 12, display:'flex', gap:8 }}>
        <button onClick={goOnline} disabled={online} style={{ padding:'8px 12px', borderRadius:8, background:'#2e7d32', color:'#fff' }}>{online ? '已上線' : '上線 (Go Online)'}</button>
        <button onClick={goOffline} disabled={!online} style={{ padding:'8px 12px', borderRadius:8, background:'#b71c1c', color:'#fff' }}>{!online ? '已下線' : '下線 (Go Offline)'}</button>
        <div style={{ color:'#9ca3af' }}>{pos.lat && pos.lng ? `定位：${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : '尚未定位'}</div>
      </div>
      <DriverHome />
    </div>
  )
}
