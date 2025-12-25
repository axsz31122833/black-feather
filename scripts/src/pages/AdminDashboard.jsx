import React, { useEffect, useState } from 'react'
import { supabase, subscribeDriverLocations, subscribeRides, runScheduleChecker } from '../lib/rideApi'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export default function AdminDashboard() {
  const [ok, setOk] = useState(true)
  useEffect(() => {
    try {
      const adminEnv = import.meta.env.VITE_ADMIN_PHONE || ''
      const phone = localStorage.getItem('bf_auth_phone') || ''
      if (adminEnv && phone !== adminEnv) {
        alert('此頁僅限管理員')
        window.location.href = '/login'
        setOk(false)
      }
    } catch {}
  }, [])
  const [drivers, setDrivers] = useState([])
  const [rides, setRides] = useState([])
  const [schedules, setSchedules] = useState([])
  const [newPassenger, setNewPassenger] = useState({ phone: '', name: '' })
  const [newDriver, setNewDriver] = useState({ phone: '', name: '' })
  const [pricing, setPricing] = useState({ base_fare_cents: 500, per_km_cents: 800, per_minute_cents: 200 })
  const [res, setRes] = useState(null)
  const [onlineToggleId, setOnlineToggleId] = useState('')
  const [mapCenter, setMapCenter] = useState([25.033, 121.565])
  const [lastScheduleRun, setLastScheduleRun] = useState(null)
  const [stats, setStats] = useState({ total: 0, active: 0, completedToday: 0, driversOnline: 0 })

  async function load() {
    const d = await supabase.from('drivers').select('id, name, phone, status, is_online, current_lat, current_lng')
    const r = await supabase.from('rides').select('id, passenger_id, driver_id, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, started_at, finished_at, final_price_cents')
    const s = await supabase.from('scheduled_rides').select('id, passenger_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, scheduled_time, processed')
    setDrivers(d.data || [])
    setRides(r.data || [])
    setSchedules(s.data || [])
    const active = (r.data || []).filter(x => ['assigned','in_progress','waiting_assignment'].includes(x.status)).length
    const completedToday = (r.data || []).filter(x => x.finished_at && new Date(x.finished_at).toDateString() === new Date().toDateString()).length
    const driversOnline = (d.data || []).filter(x => x.is_online).length
    setStats({ total: (r.data||[]).length, active, completedToday, driversOnline })
  }

  useEffect(() => {
    load()
    const ch1 = subscribeDriverLocations(() => { load() })
    const ch2 = subscribeRides(() => { load() })
    return () => { try { supabase.removeChannel(ch1) } catch {} try { supabase.removeChannel(ch2) } catch {} }
  }, [])

  useEffect(() => {
    const first = (drivers || []).find(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
    if (first) setMapCenter([first.current_lat, first.current_lng])
  }, [drivers])

  async function createPassenger() {
    const { data, error } = await supabase.from('passengers').insert(newPassenger).select('*')
    setRes(error ? { error } : { data })
    await load()
  }

  async function createDriver() {
    const { data, error } = await supabase.from('drivers').insert(newDriver).select('*')
    setRes(error ? { error } : { data })
    await load()
  }

  async function toggleDriverOnline(v) {
    if (!onlineToggleId) return
    const { data, error } = await supabase.from('drivers').update({ is_online: v, status: v ? 'online' : 'offline' }).eq('id', onlineToggleId).select('*')
    setRes(error ? { error } : { data })
    await load()
  }

  async function createPricingRule() {
    const { data, error } = await supabase.from('pricing_rules').insert({
      base_fare_cents: pricing.base_fare_cents,
      per_km_cents: pricing.per_km_cents,
      per_minute_cents: pricing.per_minute_cents,
      active: true,
    }).select('*')
    setRes(error ? { error } : { data })
  }

  async function runSchedulerNow() {
    const r = await runScheduleChecker()
    setLastScheduleRun(r.data)
    await load()
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>管理後台</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12, marginBottom:12 }}>
        <div className='card'><div className='title'>總行程</div><div style={{ fontSize:24, fontWeight:800 }}>{stats.total}</div></div>
        <div className='card'><div className='title'>進行中</div><div style={{ fontSize:24, fontWeight:800 }}>{stats.active}</div></div>
        <div className='card'><div className='title'>今日完成</div><div style={{ fontSize:24, fontWeight:800 }}>{stats.completedToday}</div></div>
        <div className='card'><div className='title'>在線司機</div><div style={{ fontSize:24, fontWeight:800 }}>{stats.driversOnline}</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h3>新增乘客</h3>
          <input placeholder="phone" value={newPassenger.phone} onChange={e => setNewPassenger({ ...newPassenger, phone: e.target.value })} />
          <input placeholder="name" value={newPassenger.name} onChange={e => setNewPassenger({ ...newPassenger, name: e.target.value })} />
          <button onClick={createPassenger}>建立乘客</button>
        </div>
        <div>
          <h3>新增司機</h3>
          <input placeholder="phone" value={newDriver.phone} onChange={e => setNewDriver({ ...newDriver, phone: e.target.value })} />
          <input placeholder="name" value={newDriver.name} onChange={e => setNewDriver({ ...newDriver, name: e.target.value })} />
          <button onClick={createDriver}>建立司機</button>
        </div>
        <div>
          <h3>司機上線/下線</h3>
          <input placeholder="driver id" value={onlineToggleId} onChange={e => setOnlineToggleId(e.target.value)} />
          <button onClick={() => toggleDriverOnline(true)}>上線</button>
          <button onClick={() => toggleDriverOnline(false)}>下線</button>
        </div>
        <div>
          <h3>計價規則</h3>
          <label>Base (¢): </label>
          <input type="number" value={pricing.base_fare_cents} onChange={e => setPricing({ ...pricing, base_fare_cents: parseInt(e.target.value || '0', 10) })} />
          <label>Per KM (¢): </label>
          <input type="number" value={pricing.per_km_cents} onChange={e => setPricing({ ...pricing, per_km_cents: parseInt(e.target.value || '0', 10) })} />
          <label>Per Min (¢): </label>
          <input type="number" value={pricing.per_minute_cents} onChange={e => setPricing({ ...pricing, per_minute_cents: parseInt(e.target.value || '0', 10) })} />
          <button onClick={createPricingRule}>建立/啟用計價規則</button>
        </div>
      </div>
      <h3>司機</h3>
      <div style={{ height: 360, borderRadius:12, overflow:'hidden', marginBottom:12 }}>
        <MapContainer center={mapCenter} zoom={12} style={{ height:'100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {(drivers||[]).filter(d => typeof d.current_lat==='number' && typeof d.current_lng==='number').map(d => (
            <Marker key={d.id} position={[d.current_lat, d.current_lng]} />
          ))}
        </MapContainer>
      </div>
      <pre>{JSON.stringify(drivers, null, 2)}</pre>
      <div style={{ marginTop: 12 }}>
        <button onClick={runSchedulerNow}>立即執行排程（schedule_checker）</button>
        <pre>{lastScheduleRun ? JSON.stringify(lastScheduleRun, null, 2) : null}</pre>
      </div>
      <h3>Rides</h3>
      <pre>{JSON.stringify(rides, null, 2)}</pre>
      <h3>預約單</h3>
      <pre>{JSON.stringify(schedules, null, 2)}</pre>
      <pre>{res ? JSON.stringify(res, null, 2) : null}</pre>
    </div>
  )
}
