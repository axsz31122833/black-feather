import React, { useEffect, useRef, useState } from 'react'
import DriverHome from '../pages/DriverHome'
import { supabase } from '../lib/supabaseClient'
import { calcFare, floorToTen } from '../lib/calculator'

export default function DriverApp() {
  const [online, setOnline] = useState(false)
  const [pos, setPos] = useState({ lat: null, lng: null })
  const [activeRide, setActiveRide] = useState(null)
  const [sop, setSop] = useState('idle') // idle|arrived|started|ended
  const [settlementLock, setSettlementLock] = useState(false)
  const [settlementAmount, setSettlementAmount] = useState(0)
  const [rebateAmount, setRebateAmount] = useState(0)
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

  async function setRideStatus(status) {
    if (!activeRide) return
    const now = new Date().toISOString()
    const patch = { sop_status: status }
    if (status === 'arrived') patch['arrived_at'] = now
    if (status === 'started') patch['started_at'] = now
    if (status === 'ended') patch['ended_at'] = now
    await supabase.from('rides').update(patch).eq('id', activeRide.id)
    setSop(status)
    if (status === 'ended') {
      const km = Number(activeRide.distance_km || 0)
      const min = Number(activeRide.duration_min || 0)
      const fare = calcFare(km, min)
      const rebate = floorToTen(Math.floor(fare / 100) * 10 + 10)
      setSettlementAmount(fare)
      setRebateAmount(rebate)
      await supabase.from('rides').update({ fare_final: fare, settlement_required: true, settlement_done: false, settlement_amount: fare, rebate_amount: rebate }).eq('id', activeRide.id)
      setSettlementLock(true)
    }
  }

  function SettlementModal() {
    if (!settlementLock) return null
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ background:'#111', border:'1px solid rgba(212,175,55,0.35)', borderRadius:12, padding:16, width:'92%', maxWidth:520 }}>
          <div style={{ fontSize:20, fontWeight:900, color:'#D4AF37', marginBottom:8 }}>結算</div>
          <div style={{ color:'#e5e7eb', marginBottom:8 }}>收取乘客：NT$ {settlementAmount}</div>
          <div style={{ color:'#e5e7eb', marginBottom:16 }}>本單回金：NT$ {rebateAmount}</div>
          <a href="https://jkos.com/pay?account=904851974" target="_blank" rel="noreferrer" style={{ display:'inline-block', padding:'10px 14px', borderRadius:10, background:'#2e7d32', color:'#fff', fontWeight:700, marginRight:8 }}>跳轉街口支付</a>
          <button onClick={async ()=>{
            try {
              await supabase.from('rides').update({ settlement_done: true }).eq('id', activeRide.id)
              setSettlementLock(false)
              setActiveRide(null)
              setSop('idle')
            } catch {}
          }} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid rgba(212,175,55,0.35)', color:'#e5e7eb' }}>我已完成回金</button>
        </div>
      </div>
    )
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
      {activeRide && (
        <div style={{ padding:12, display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={()=>setRideStatus('arrived')} disabled={sop!=='idle'} style={{ padding:'8px 12px', borderRadius:8, background:'#37474f', color:'#fff' }}>已抵達</button>
          <button onClick={()=>setRideStatus('started')} disabled={sop!=='arrived'} style={{ padding:'8px 12px', borderRadius:8, background:'#455a64', color:'#fff' }}>行程開始</button>
          <button onClick={()=>setRideStatus('ended')} disabled={sop!=='started'} style={{ padding:'8px 12px', borderRadius:8, background:'#1e88e5', color:'#fff' }}>行程結束</button>
        </div>
      )}
      <DriverHome />
      <SettlementModal />
    </div>
  )
}
