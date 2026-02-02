import React, { useState } from 'react'
import { requestRide, assignDriver } from '../lib/rideApi'
import { supabase } from '../lib/supabaseClient'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'

function ClickToSet({ setPoint }) {
  useMapEvents({
    click(e) {
      setPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
  })
  return null
}

export default function PassengerHome() {
  const [origin, setOrigin] = useState({ lat: 25.033, lng: 121.565 })
  const [destination, setDestination] = useState({ lat: 25.047, lng: 121.517 })
  const [rideId, setRideId] = useState('')
  const [res, setRes] = useState(null)
  const [selecting, setSelecting] = useState('origin')
  const [noSmoking, setNoSmoking] = useState(false)
  const [pets, setPets] = useState(false)
  const assigned = res && (res.assigned_driver || res.nearest || res.driver)

  async function callRide() {
    const { data: u } = await supabase.auth.getUser()
    const pid = u?.user?.id
    if (!pid) { alert('請先登入'); return }
    const r = await requestRide({ passenger_id: pid, origin, destination })
    setRes(r.data)
    const id = r?.data?.ride_id || ''
    setRideId(id)
    try {
      const notes = `禁菸:${noSmoking ? '是' : '否'}; 攜帶寵物:${pets ? '是' : '否'}`
      if (id) await supabase.from('rides').update({ notes }).eq('id', id)
    } catch {}
  }

  async function doAssign() {
    if (!rideId) return
    const a = await assignDriver({ ride_id: rideId })
    setRes(a.data)
  }

  return (
    <div style={{ position: 'relative', height: '70vh' }}>
      <MapContainer center={[origin.lat, origin.lng]} zoom={13} style={{ height: '100%', borderRadius: 12, overflow: 'hidden' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO &copy; OpenStreetMap contributors"
        />
        <ClickToSet setPoint={selecting === 'origin' ? setOrigin : setDestination} />
        <Marker position={[origin.lat, origin.lng]} />
        <Marker position={[destination.lat, destination.lng]} />
      </MapContainer>
      <div className="card" style={{ position: 'relative', marginTop: 16 }}>
        <div className="title">設定行程</div>
        <div className="grid">
          <div className="form-group">
            <div className="label">選擇點</div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn" onClick={() => setSelecting('origin')}>選擇上車</button>
              <button className="btn" onClick={() => setSelecting('destination')}>選擇下車</button>
            </div>
          </div>
        </div>
        <div className="grid" style={{ marginTop: 8 }}>
          <label><input type="checkbox" checked={noSmoking} onChange={e=>setNoSmoking(e.target.checked)} /> 🚭 禁菸</label>
          <label><input type="checkbox" checked={pets} onChange={e=>setPets(e.target.checked)} /> 🐾 攜帶寵物</label>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary" onClick={callRide}>叫車</button>
          <input className="input" placeholder="ride_id" value={rideId} onChange={e => setRideId(e.target.value)} />
          <button className="btn" onClick={doAssign}>派單</button>
        </div>
        {assigned && (
          <div className="grid" style={{ marginTop:12 }}>
            <div className="form-group">
              <div className="label">司機</div>
              <div className="input" style={{ display:'flex', gap:8 }}>
                <div>車牌：{assigned.plate_number || '未提供'}</div>
                <div>車型：{assigned.car_model || '未提供'}</div>
                <div>顏色：{assigned.car_color || '未提供'}</div>
              </div>
            </div>
            <div className="form-group">
              <div className="label">距離/ETA</div>
              <div className="input">約 {assigned.distance_km?.toFixed?.(1) || '—'} 公里，{assigned.eta_min || '—'} 分</div>
            </div>
          </div>
        )}
        <pre className="muted" style={{ marginTop:12 }}>{res ? JSON.stringify(res, null, 2) : null}</pre>
      </div>
    </div>
  )
}
