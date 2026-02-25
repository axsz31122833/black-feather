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
  const mapElRef = useRef<HTMLDivElement | null>(null)

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
        const { data: profs } = await supabase.from('driver_profiles').select('id').eq('status','pending')
        setPendingCount((profs || []).length)
      } catch { setPendingCount(0) }
      try {
        const { data } = await supabase.from('drivers').select('*').order('last_seen_at',{ ascending:false })
        setDrivers(data || [])
      } catch { setDrivers([]) }
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
        <aside className="w-64 min-h-screen p-4" style={{ background:'#121212', borderRight:'1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-xl font-bold mb-4" style={{ color:'#00FFFF' }}>指揮中心</div>
          <div className="space-y-2">
            <button onClick={()=>navigate('/passenger')} className="w-full text-left px-3 py-2 rounded" style={{ color:'#e5e7eb' }}>乘客視角</button>
            <button onClick={()=>navigate('/driver')} className="w-full text-left px-3 py-2 rounded" style={{ color:'#e5e7eb' }}>司機視角</button>
            <button onClick={async ()=>{ await signOut(); navigate('/admin/login') }} className="w-full text-left px-3 py-2 rounded" style={{ color:'#e5e7eb' }}>登出</button>
          </div>
        </aside>
        <main className="flex-1 p-6">
          <div className="grid grid-cols-4 gap-4 mb-6">
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
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)' }}>
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
        </main>
      </div>
    </div>
  )
}
