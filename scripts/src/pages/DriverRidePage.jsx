import React, { useState, useEffect } from 'react'
import { startRide, finishRide } from '../lib/rideApi'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'

export default function DriverRidePage() {
  const [rideId, setRideId] = useState('')
  const [dropoff, setDropoff] = useState({ lat: 25.047, lng: 121.517 })
  const [res, setRes] = useState(null)
  const [ok, setOk] = useState(true)

  useEffect(() => {
    try {
      const role = localStorage.getItem('bf_role') || 'passenger'
      if (role !== 'driver') {
        alert('此頁僅限司機使用')
        window.location.href = '/login'
        setOk(false)
      }
    } catch {}
  }, [])

  async function doStart() {
    if (!rideId) return
    const r = await startRide({ ride_id: rideId })
    setRes(r.data)
  }

  async function doFinish() {
    if (!rideId) return
    const r = await finishRide({ ride_id: rideId, dropoff })
    setRes(r.data)
  }

  return (
    <div style={{ position:'relative', height:'70vh' }}>
      <MapContainer center={[dropoff.lat, dropoff.lng]} zoom={13} style={{ height:'100%', borderRadius:12, overflow:'hidden' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YFJxWcAAAAASUVORK5CYII="
          crossOrigin="anonymous"
          eventHandlers={{ tileerror: (e) => console.warn('tile error', e?.tile?.src) }}
        />
        <Marker position={[dropoff.lat, dropoff.lng]} />
      </MapContainer>
      <div className="sheet">
        <div className="sheet-header">
          <div className="title">司機行程</div>
          <span className="badge">操作</span>
        </div>
        <div className="grid">
          <div className="form-group">
            <div className="label">Ride ID</div>
            <input className="input" value={rideId} onChange={e => setRideId(e.target.value)} />
          </div>
          <div className="form-group">
            <div className="label">下車座標</div>
            <div style={{ display:'flex', gap:8 }}>
              <input className="input" type="number" step="0.000001" value={dropoff.lat} onChange={e => setDropoff({ ...dropoff, lat: parseFloat(e.target.value) })} />
              <input className="input" type="number" step="0.000001" value={dropoff.lng} onChange={e => setDropoff({ ...dropoff, lng: parseFloat(e.target.value) })} />
            </div>
          </div>
        </div>
        <div className="sheet-actions">
          <button className="btn btn-primary" onClick={doStart}>開始</button>
          <button className="btn" onClick={doFinish}>結束</button>
        </div>
        <pre className="muted" style={{ marginTop:12 }}>{res ? JSON.stringify(res, null, 2) : null}</pre>
      </div>
    </div>
  )
}
