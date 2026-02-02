import React, { useState, useEffect } from 'react'
import { updateDriverLocation } from '../lib/rideApi'
import { supabase } from '../lib/supabaseClient'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export default function DriverHome() {
  const [driverId, setDriverId] = useState('')
  const [coords, setCoords] = useState({ lat: 25.033, lng: 121.565 })
  const [res, setRes] = useState(null)
  const [online, setOnline] = useState(false)
  const [ok, setOk] = useState(true)

  useEffect(() => {
    try {
      const role = localStorage.getItem('bf_role') || 'passenger'
      if (role !== 'driver') {
        setOk(true)
      }
    } catch {}
  }, [])

  async function sendLocation() {
    if (!driverId) return
    const r = await updateDriverLocation({ driver_id: driverId, lat: coords.lat, lng: coords.lng })
    setRes(r.data)
  }

  async function setDriverOnline(v) {
    if (!driverId) return
    const { data, error } = await supabase.from('drivers').update({ is_online: v, status: v ? 'online' : 'offline' }).eq('id', driverId).select('*')
    setOnline(!!v)
    setRes(error ? { error } : { data })
  }

  return (
    <div style={{ position:'relative', height:'70vh' }}>
      <MapContainer center={[coords.lat, coords.lng]} zoom={13} style={{ height:'100%', borderRadius:12, overflow:'hidden' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[coords.lat, coords.lng]} />
      </MapContainer>
      <div className="sheet">
        <div className="sheet-header">
          <div className="title">司機控制面板</div>
          <span className="badge">{online ? '上線中' : '離線'}</span>
        </div>
        <div className="grid">
          <div className="form-group">
            <div className="label">司機 ID</div>
            <input className="input" value={driverId} onChange={e => setDriverId(e.target.value)} placeholder="輸入司機 ID" />
          </div>
          <div className="form-group">
            <div className="label">手動座標</div>
            <div style={{ display:'flex', gap:8 }}>
              <input className="input" type="number" step="0.000001" value={coords.lat} onChange={e => setCoords({ ...coords, lat: parseFloat(e.target.value) })} />
              <input className="input" type="number" step="0.000001" value={coords.lng} onChange={e => setCoords({ ...coords, lng: parseFloat(e.target.value) })} />
            </div>
          </div>
        </div>
        <div className="sheet-actions">
          <button className="btn btn-primary" onClick={sendLocation}>上傳位置</button>
          <button className="btn" onClick={() => setDriverOnline(true)}>上線</button>
          <button className="btn" onClick={() => setDriverOnline(false)}>下線</button>
        </div>
        <pre className="muted" style={{ marginTop:12 }}>{res ? JSON.stringify(res, null, 2) : null}</pre>
      </div>
    </div>
  )
}
