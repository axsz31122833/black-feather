import React, { useState } from 'react'
import { requestRide, assignDriver } from '../lib/rideApi'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

function ClickToSet({ setPoint }) {
  useMapEvents({
    click(e) {
      setPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
    }
  })
  return null
}

export default function PassengerHome() {
  const [passengerId, setPassengerId] = useState('')
  const [origin, setOrigin] = useState({ lat: 25.033, lng: 121.565 })
  const [destination, setDestination] = useState({ lat: 25.047, lng: 121.517 })
  const [rideId, setRideId] = useState('')
  const [res, setRes] = useState(null)
  const [selecting, setSelecting] = useState('origin')

  async function callRide() {
    const r = await requestRide({ passenger_id: passengerId, origin, destination })
    setRes(r.data)
    const id = r?.data?.ride_id || ''
    setRideId(id)
  }

  async function doAssign() {
    if (!rideId) return
    const a = await assignDriver({ ride_id: rideId })
    setRes(a.data)
  }

  return (
    <div style={{ position: 'relative', height: '70vh' }}>
      <MapContainer center={[origin.lat, origin.lng]} zoom={13} style={{ height: '100%', borderRadius: 12, overflow: 'hidden' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickToSet setPoint={selecting === 'origin' ? setOrigin : setDestination} />
        <Marker position={[origin.lat, origin.lng]} />
        <Marker position={[destination.lat, destination.lng]} />
      </MapContainer>
      <div className="card" style={{ position: 'relative', marginTop: 16 }}>
        <div className="title">設定行程</div>
        <div className="grid">
          <div className="form-group">
            <div className="label">乘客 ID</div>
            <input className="input" value={passengerId} onChange={e => setPassengerId(e.target.value)} placeholder="輸入乘客 ID" />
          </div>
          <div className="form-group">
            <div className="label">選擇點</div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn" onClick={() => setSelecting('origin')}>選擇上車</button>
              <button className="btn" onClick={() => setSelecting('destination')}>選擇下車</button>
            </div>
          </div>
        </div>
        <div className="grid">
          <div className="form-group">
            <div className="label">上車座標</div>
            <div style={{ display:'flex', gap:8 }}>
              <input className="input" type="number" step="0.000001" value={origin.lat} onChange={e => setOrigin({ ...origin, lat: parseFloat(e.target.value) })} />
              <input className="input" type="number" step="0.000001" value={origin.lng} onChange={e => setOrigin({ ...origin, lng: parseFloat(e.target.value) })} />
            </div>
          </div>
          <div className="form-group">
            <div className="label">下車座標</div>
            <div style={{ display:'flex', gap:8 }}>
              <input className="input" type="number" step="0.000001" value={destination.lat} onChange={e => setDestination({ ...destination, lat: parseFloat(e.target.value) })} />
              <input className="input" type="number" step="0.000001" value={destination.lng} onChange={e => setDestination({ ...destination, lng: parseFloat(e.target.value) })} />
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary" onClick={callRide}>叫車</button>
          <input className="input" placeholder="ride_id" value={rideId} onChange={e => setRideId(e.target.value)} />
          <button className="btn" onClick={doAssign}>派單</button>
        </div>
        <pre className="muted" style={{ marginTop:12 }}>{res ? JSON.stringify(res, null, 2) : null}</pre>
      </div>
    </div>
  )
}
