import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, ensureAuth } from '../lib/supabaseClient'
import { useAuthStore } from '../stores/auth'

type DriverRow = {
  id: string
  name?: string
  phone?: string
  status?: string
  current_lat?: number
  current_lng?: number
  last_seen_at?: string
}

export default function AdminCommandCenter() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [tripsToday, setTripsToday] = useState(0)
  const [revenueToday, setRevenueToday] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [fareBase, setFareBase] = useState<number>(70)
  const [farePerKm, setFarePerKm] = useState<number>(15)
  const [farePerMin, setFarePerMin] = useState<number>(3)
  const [longThreshold, setLongThreshold] = useState<number>(20)
  const [longRate, setLongRate] = useState<number>(10)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const orderMarkerRef = useRef<any>(null)
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const [requestedTrips, setRequestedTrips] = useState<Array<{ id: string; pickup_location?: { address?: string; lat?: number; lng?: number }; estimated_price?: number; passenger_id?: string; created_at?: string }>>([])
  const [selectedTrip, setSelectedTrip] = useState<any>(null)
  const [onlineDrivers, setOnlineDrivers] = useState<any[]>([])
  const [usersPassengers, setUsersPassengers] = useState<any[]>([])
  const [usersDrivers, setUsersDrivers] = useState<any[]>([])
  const [usersAdmins, setUsersAdmins] = useState<any[]>([])
  const [vehicleEdit, setVehicleEdit] = useState<Record<string, { plate?: string; model?: string; color?: string }>>({})

  useEffect(() => {
    ;(async () => {
      try {
        await ensureAuth()
        const start = new Date()
        start.setHours(0,0,0,0)
        const startIso = start.toISOString()
        const { data: tripsData } = await supabase.from('trips').select('id,final_price,status,created_at').gte('created_at', startIso)
        setTripsToday((tripsData || []).length)
        setRevenueToday((tripsData || []).filter(t=>t.status==='completed').reduce((s: number, t:any)=> s + Number(t.final_price||0), 0))
      } catch {}
      try {
        const { data: req } = await supabase.from('trips').select('id,pickup_location,estimated_price,passenger_id,created_at').eq('status','requested').order('created_at',{ ascending:false }).limit(100)
        setRequestedTrips(req || [])
      } catch {}
      try {
        const { data: profs } = await supabase.from('driver_profiles').select('id').eq('status','pending')
        setPendingCount((profs || []).length)
      } catch { setPendingCount(0) }
      try {
        const { data } = await supabase.from('drivers').select('*').order('last_seen_at',{ ascending:false })
        setDrivers(data || [])
      } catch { setDrivers([]) }
      try {
        const { data } = await supabase.from('drivers').select('*').eq('is_online', true)
        setOnlineDrivers(data || [])
      } catch {}
      try {
        const { data: users } = await supabase.from('users').select('id,phone,name,user_type')
        setUsersPassengers((users || []).filter((u:any)=>u.user_type==='passenger'))
        setUsersDrivers((users || []).filter((u:any)=>u.user_type==='driver'))
        setUsersAdmins((users || []).filter((u:any)=>u.user_type==='admin'))
      } catch {}
      try {
        const { data } = await supabase.from('fare_config').select('*').eq('id','global').single()
        if (data) {
          setFareBase(Number(data.base||70))
          setFarePerKm(Number(data.per_km||15))
          setFarePerMin(Number(data.per_min||3))
          setLongThreshold(Number(data.long_threshold||20))
          setLongRate(Number(data.long_rate||10))
        } else {
          const s = localStorage.getItem('bf_fare_config')
          if (s) {
            const cfg = JSON.parse(s)
            setFareBase(Number(cfg.base||70))
            setFarePerKm(Number(cfg.per_km||15))
            setFarePerMin(Number(cfg.per_min||3))
            setLongThreshold(Number(cfg.long_threshold||20))
            setLongRate(Number(cfg.long_rate||10))
          }
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    const ch1 = supabase.channel('admin-cc-drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload: any) => {
        const d = payload.new || payload.old
        if (!d?.id) return
        setDrivers(prev => {
          const idx = prev.findIndex(x => x.id === d.id)
          const list = [...prev]
          if (idx >= 0) list[idx] = { ...list[idx], ...d }
          else list.unshift(d)
          return list
        })
      }).subscribe()
    const ch2 = supabase.channel('admin-cc-trips')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        const start = new Date()
        start.setHours(0,0,0,0)
        const startIso = start.toISOString()
        supabase.from('trips').select('id,final_price,status,created_at').gte('created_at', startIso).then((res:any)=>{
          const arr = res.data || []
          setTripsToday(arr.length)
          setRevenueToday(arr.filter((t:any)=>t.status==='completed').reduce((s:number,t:any)=>s+Number(t.final_price||0),0))
        })
        supabase.from('trips').select('id,pickup_location,estimated_price,passenger_id,created_at').eq('status','requested').order('created_at',{ ascending:false }).limit(100).then((res:any)=>{
          setRequestedTrips(res.data || [])
        })
        supabase.from('drivers').select('*').eq('is_online', true).then((res:any)=> setOnlineDrivers(res.data || []))
      }).subscribe()
    return () => { ch1.unsubscribe(); ch2.unsubscribe() }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const g = await (await import('../lib/googleMaps')).loadGoogleMaps()
        if (!g?.maps) return
        if (!mapElRef.current) return
        if (!mapRef.current) {
          const center = { lat: 25.0418, lng: 121.5651 }
          mapRef.current = new g.maps.Map(mapElRef.current, { center, zoom: 11 })
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    try {
      const g: any = (window as any).google
      if (!g || !g.maps || !mapRef.current) return
      const m = mapRef.current
      const mk = markersRef.current
      drivers.forEach(d => {
        if (typeof d.current_lat !== 'number' || typeof d.current_lng !== 'number') return
        const key = d.id
        const pos = { lat: d.current_lat!, lng: d.current_lng! }
        const color = d.status === 'on_trip' ? '#EF4444' : '#10B981'
        if (mk[key]) {
          try { mk[key].setPosition(pos) } catch {}
          try { mk[key].setIcon({ path: g.maps.SymbolPath.CIRCLE, scale: 6, fillColor: color, fillOpacity: 1, strokeColor: color, strokeWeight: 1 }) } catch {}
        } else {
          mk[key] = new g.maps.Marker({ position: pos, map: m, icon: { path: g.maps.SymbolPath.CIRCLE, scale: 6, fillColor: color, fillOpacity: 1, strokeColor: color, strokeWeight: 1 } })
        }
      })
    } catch {}
  }, [drivers])

  const saveFare = async () => {
    const payload = { id: 'global', base: fareBase, per_km: farePerKm, per_min: farePerMin, long_threshold: longThreshold, long_rate: longRate }
    try {
      await ensureAuth()
      await supabase.from('fare_config').upsert(payload, { onConflict: 'id' } as any)
      try { await supabase.from('ops_events').insert({ event_type: 'fare_config_updated', ref_id: 'global', payload }) } catch {}
      try { localStorage.setItem('bf_fare_config', JSON.stringify(payload)) } catch {}
      alert('費率設定已更新')
    } catch (e) {
      alert(`儲存失敗：${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const focusTrip = (t: any) => {
    try {
      const g: any = (window as any).google
      if (!g || !mapRef.current) return
      const pick = t?.pickup_location
      if (!pick || typeof pick.lat !== 'number' || typeof pick.lng !== 'number') return
      mapRef.current.setCenter({ lat: pick.lat, lng: pick.lng })
      mapRef.current.setZoom(14)
      if (orderMarkerRef.current) {
        try { orderMarkerRef.current.setMap(null) } catch {}
        orderMarkerRef.current = null
      }
      orderMarkerRef.current = new g.maps.Marker({
        position: { lat: pick.lat, lng: pick.lng },
        map: mapRef.current,
        icon: { path: g.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 5, fillColor: '#60a5fa', fillOpacity: 1, strokeColor: '#60a5fa', strokeWeight: 1 },
        title: (t?.pickup_location?.address || '待派訂單') + (t?.estimated_price ? ` · $${t.estimated_price}` : '')
      })
      setSelectedTrip(t)
    } catch {}
  }
  const assignToDriver = async (tripId: string, driverId: string) => {
    try {
      await supabase.from('trips').update({ driver_id: driverId, status: 'accepted' }).eq('id', tripId)
      try { await supabase.from('ops_events').insert({ event_type:'manual_assign', ref_id: tripId, payload:{ driver_id: driverId } }) } catch {}
      alert('已手動指派')
      setSelectedTrip(null)
    } catch { alert('指派失敗') }
  }
  const pushExternalAssign = async (tripId: string, info: { plate?: string; color?: string; phone?: string }) => {
    try {
      await supabase.from('ops_events').insert({ event_type:'external_assign', ref_id: tripId, payload: info } as any)
      alert('已推送外部車隊資訊給乘客')
      setSelectedTrip(null)
    } catch { alert('推送失敗') }
  }
  const promoteToDriver = async (userId: string) => {
    try {
      await supabase.from('users').update({ user_type:'driver' }).eq('id', userId)
      await supabase.from('driver_profiles').upsert({ user_id: userId }, { onConflict:'user_id' } as any)
      alert('已升等為司機')
    } catch { alert('操作失敗') }
  }
  const saveVehicle = async (userId: string) => {
    try {
      const val = vehicleEdit[userId] || {}
      await supabase.from('driver_profiles').upsert({ user_id: userId, car_plate: val.plate || null, car_model: val.model || null, car_color: val.color || null }, { onConflict:'user_id' } as any)
      alert('已保存車輛資料')
    } catch { alert('保存失敗') }
  }
  const diagnoseTrips = async () => {
    try {
      await ensureAuth()
      const { data, error } = await supabase.from('trips').select('*').limit(1)
      if (error) throw error
      if (data && data[0]) {
        console.log('trips 欄位推斷：', Object.keys(data[0]))
        alert('已在 Console 輸出 trips 欄位')
      } else {
        console.log('trips 目前無資料，無法直接推斷欄位')
        alert('trips 無資料，請先建立一筆或使用空物件測試')
      }
    } catch (e) {
      console.log('診斷 trips 欄位失敗', e)
      alert(`診斷失敗：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div className="min-h-screen" style={{ background:'#121212' }}>
      <div className="flex">
        <aside className={`min-h-screen p-4 ${menuOpen ? 'block' : 'hidden md:block'}`} style={{ width:256, background:'#121212', borderRight:'1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-xl font-bold mb-4" style={{ color:'#00FFFF' }}>指揮中心</div>
          <div className="space-y-2">
            <button onClick={()=>navigate('/passenger')} className="w-full text-left px-3 py-2 rounded" style={{ color:'#e5e7eb' }}>乘客視角</button>
            <button onClick={()=>navigate('/driver')} className="w-full text-left px-3 py-2 rounded" style={{ color:'#e5e7eb' }}>司機視角</button>
            <button onClick={async ()=>{ await signOut(); navigate('/admin/login') }} className="w-full text-left px-3 py-2 rounded" style={{ color:'#e5e7eb' }}>登出</button>
          </div>
        </aside>
        <main className="flex-1 p-4 md:p-6">
          <div className="md:hidden flex items-center justify-between mb-3">
            <button onClick={()=>setMenuOpen(v=>!v)} className="px-3 py-2 rounded" style={{ border:'1px solid rgba(255,255,255,0.15)', color:'#e5e7eb' }}>☰</button>
            <div className="text-sm" style={{ color:'#9ca3af' }}>管理儀表板</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(0,255,255,0.2)' }}>
              <div className="text-sm" style={{ color:'#9ca3af' }}>今日營收</div>
              <div className="text-3xl font-bold" style={{ color:'#00FFFF' }}>${revenueToday}</div>
            </div>
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(0,255,255,0.2)' }}>
              <div className="text-sm" style={{ color:'#9ca3af' }}>總單數</div>
              <div className="text-3xl font-bold" style={{ color:'#00FFFF' }}>{tripsToday}</div>
            </div>
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(16,185,129,0.25)' }}>
              <div className="text-sm" style={{ color:'#9ca3af' }}>在線司機</div>
              <div className="text-3xl font-bold" style={{ color:'#10B981' }}>{drivers.filter(d => d.status !== 'offline').length}</div>
            </div>
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(239,68,68,0.25)' }}>
              <div className="text-sm" style={{ color:'#9ca3af' }}>待審核身分</div>
              <div className="text-3xl font-bold" style={{ color:'#EF4444' }}>{pendingCount}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm" style={{ color:'#9ca3af' }}>全域即時地圖</div>
              </div>
              <div ref={mapElRef} style={{ height:'55vh', width:'100%' }} />
              <div className="mt-2 text-xs" style={{ color:'#9ca3af' }}>空車：綠色點；載客中：紅色點</div>
            </div>
            <div className="rounded-lg p-4 space-y-4" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div>
                <div className="text-sm mb-2" style={{ color:'#e5e7eb' }}>即時訂單監控（待派 Requested）</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {requestedTrips.length === 0 ? (
                    <div className="text-xs" style={{ color:'#9ca3af' }}>目前無待派訂單</div>
                  ) : requestedTrips.map(t => (
                    <button key={t.id} onClick={()=>focusTrip(t)} className="w-full text-left px-3 py-2 rounded-md hover:bg-[#2A2A2A]" style={{ border:'1px solid rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
                      <div className="text-xs" style={{ color:'#9ca3af' }}>{new Date(t.created_at || '').toLocaleString('zh-TW')}</div>
                      <div className="text-sm truncate">{(t as any).pickup_location?.address || '—'}</div>
                      <div className="text-xs" style={{ color:'#9ca3af' }}>{t.estimated_price ? `$${t.estimated_price}` : ''}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="text-sm mb-2" style={{ color:'#e5e7eb' }}>費率即時設定</div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={fareBase} onChange={e=>setFareBase(Number(e.target.value||'0'))} placeholder="基礎費" className="px-2 py-2 rounded" style={{ background:'#121212', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.1)' }} />
                <input type="number" value={farePerKm} onChange={e=>setFarePerKm(Number(e.target.value||'0'))} placeholder="每公里" className="px-2 py-2 rounded" style={{ background:'#121212', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.1)' }} />
                <input type="number" value={farePerMin} onChange={e=>setFarePerMin(Number(e.target.value||'0'))} placeholder="每分鐘" className="px-2 py-2 rounded" style={{ background:'#121212', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.1)' }} />
                <input type="number" value={longThreshold} onChange={e=>setLongThreshold(Number(e.target.value||'0'))} placeholder="長途門檻" className="px-2 py-2 rounded" style={{ background:'#121212', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.1)' }} />
                <input type="number" value={longRate} onChange={e=>setLongRate(Number(e.target.value||'0'))} placeholder="長途加成(每公里)" className="px-2 py-2 rounded" style={{ background:'#121212', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div className="mt-3">
                <button onClick={saveFare} className="px-4 py-2 rounded" style={{ background:'#00FFFF', color:'#121212' }}>儲存</button>
                <button onClick={diagnoseTrips} className="ml-2 px-4 py-2 rounded" style={{ background:'#10B981', color:'#121212' }}>資料庫欄位診斷</button>
              </div>
            </div>
          </div>
          {/* User Management */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-sm font-semibold mb-2" style={{ color:'#e5e7eb' }}>乘客</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {usersPassengers.map(u=>(
                  <div key={u.id} className="p-2 rounded border" style={{ borderColor:'rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
                    <div className="text-sm">{u.name || '—'} · {u.phone || '—'}</div>
                    <div className="mt-1">
                      <button onClick={()=>promoteToDriver(u.id)} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded">升等為司機</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-sm font-semibold mb-2" style={{ color:'#e5e7eb' }}>司機</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {usersDrivers.map(u=>(
                  <div key={u.id} className="p-2 rounded border space-y-2" style={{ borderColor:'rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
                    <div className="text-sm">{u.name || '—'} · {u.phone || '—'}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <input placeholder="車牌" value={vehicleEdit[u.id]?.plate || ''} onChange={e=>setVehicleEdit(v=>({ ...v, [u.id]: { ...v[u.id], plate:e.target.value } }))} className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                      <input placeholder="車型" value={vehicleEdit[u.id]?.model || ''} onChange={e=>setVehicleEdit(v=>({ ...v, [u.id]: { ...v[u.id], model:e.target.value } }))} className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                      <input placeholder="車色" value={vehicleEdit[u.id]?.color || ''} onChange={e=>setVehicleEdit(v=>({ ...v, [u.id]: { ...v[u.id], color:e.target.value } }))} className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                    </div>
                    <button onClick={()=>saveVehicle(u.id)} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded">保存車輛資料</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-sm font-semibold mb-2" style={{ color:'#e5e7eb' }}>管理員</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {usersAdmins.map(u=>(
                  <div key={u.id} className="p-2 rounded border" style={{ borderColor:'rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
                    <div className="text-sm">{u.name || '—'} · {u.phone || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Order Detail Modal */}
          {selectedTrip && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="rounded-2xl p-6 w-full max-w-lg" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
                <div className="text-lg font-semibold mb-2" style={{ color:'#00FFFF' }}>訂單詳情</div>
                <div className="text-sm mb-1">上車：{selectedTrip?.pickup_location?.address || '—'}</div>
                <div className="text-sm mb-1">下車：{selectedTrip?.dropoff_location?.address || '—'}</div>
                <div className="text-sm mb-1">金額：${selectedTrip?.estimated_price || '—'}</div>
                <div className="text-sm mb-3">公里數：{(() => {
                  try {
                    const a = selectedTrip?.pickup_location, b = selectedTrip?.dropoff_location
                    if (a && b && typeof a.lat === 'number' && typeof a.lng === 'number' && typeof b.lat === 'number' && typeof b.lng === 'number') {
                      const R=6371, toRad=(v:number)=>(v*Math.PI)/180
                      const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng)
                      const h=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2
                      return (2*R*Math.asin(Math.sqrt(h))).toFixed(1)
                    }
                  } catch {}
                  return '—'
                })()} km</div>
                <div className="mt-2">
                  <div className="text-sm mb-1" style={{ color:'#9ca3af' }}>手動派單</div>
                  <div className="flex items-center space-x-2 mb-2">
                    <select id="assign-driver" className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>
                      {onlineDrivers.map(d => (<option key={d.id} value={d.id}>{d.name || d.phone || d.id}</option>))}
                    </select>
                    <button onClick={()=>{
                      const el = document.getElementById('assign-driver') as HTMLSelectElement
                      if (el && el.value) assignToDriver(selectedTrip.id, el.value)
                    }} className="px-3 py-1 rounded text-xs bg-indigo-600 text-white">指派在線司機</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <input id="ext-plate" placeholder="車牌" className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                    <input id="ext-color" placeholder="車色" className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                    <input id="ext-phone" placeholder="電話" className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                  </div>
                  <button onClick={()=>{
                    const plate = (document.getElementById('ext-plate') as HTMLInputElement)?.value || ''
                    const color = (document.getElementById('ext-color') as HTMLInputElement)?.value || ''
                    const phone = (document.getElementById('ext-phone') as HTMLInputElement)?.value || ''
                    pushExternalAssign(selectedTrip.id, { plate, color, phone })
                  }} className="px-3 py-2 rounded text-xs bg-emerald-600 text-white">外部車隊派單</button>
                </div>
                <div className="mt-4 text-right">
                  <button onClick={()=>setSelectedTrip(null)} className="px-3 py-2 rounded text-xs" style={{ border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>關閉</button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
