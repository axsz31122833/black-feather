import React, { useState } from 'react'
import { startRide, finishRide, cancelRide, supabase } from '../lib/rideApi'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'

export default function PassengerRidePage() {
  const [rideId, setRideId] = useState('')
  const [dropoff, setDropoff] = useState({ lat: 25.047, lng: 121.517 })
  const [res, setRes] = useState(null)
  const [rating, setRating] = useState(5)
  const [notes, setNotes] = useState('')
  const [rated, setRated] = useState(false)

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

  async function doCancel() {
    if (!rideId) return
    const r = await cancelRide({ ride_id: rideId })
    setRes(r.data)
  }

  async function submitRating() {
    try {
      const { error } = await supabase.rpc('secure_submit_rating', { p_trip_id: rideId, p_score: rating, p_notes: notes })
      if (error) throw error
      setRated(true)
      alert('評分已送出，感謝您的回饋！')
    } catch (e) {
      alert('評分送出失敗')
    }
  }

  function printReceipt() {
    const w = window.open('', '_blank')
    if (!w) return
    const now = new Date().toLocaleString('zh-TW')
    const html = `<!doctype html>
    <html lang="zh-Hant"><head><meta charset="utf-8"/><title>行程收據</title>
    <style>body{font-family:system-ui; padding:24px;} .card{border:1px solid #e5e7eb;border-radius:12px;padding:16px} .row{display:flex;justify-content:space-between;margin:6px 0} .muted{color:#6b7280;font-size:12px}</style>
    </head><body>
      <h2>Black Feather 行程收據</h2>
      <div class="muted">${now}</div>
      <div class="card">
        <div class="row"><span>行程編號</span><span>${rideId || '-'}</span></div>
        <div class="row"><span>目的地</span><span>${dropoff.lat}, ${dropoff.lng}</span></div>
        <div class="row"><span>評分</span><span>${rating} / 5</span></div>
        <div class="row"><span>回饋</span><span>${notes || '-'}</span></div>
      </div>
      <p class="muted">感謝您的搭乘，祝您旅途愉快！</p>
      <script>window.print();</script>
    </body></html>`
    w.document.write(html)
    w.document.close()
  }

  return (
    <div className="bg-transparent text-white" style={{ position:'relative', height:'70vh' }}>
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
          <div className="title">乘客行程</div>
          <span className="badge">設定與控制</span>
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
        <button className="btn" onClick={doCancel}>取消</button>
      </div>
      <div className="grid" style={{ marginTop:12 }}>
        <div className="form-group">
          <div className="label">行程評分（1-5）</div>
          <input className="input" type="number" min="1" max="5" value={rating} onChange={e => setRating(parseInt(e.target.value||'5')||5)} />
        </div>
        <div className="form-group">
          <div className="label">回饋</div>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="可選填" />
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" onClick={submitRating} disabled={!rideId || rated}>送出評分</button>
          <button className="btn" onClick={printReceipt}>列印收據</button>
          <button className="btn" onClick={() => {
            const now = new Date().toLocaleString('zh-TW')
            const html = `<!doctype html><html lang='zh-Hant'><head><meta charset='utf-8'/><title>行程收據</title></head><body><h2>Black Feather 行程收據</h2><div>${now}</div><div>行程編號：${rideId||'-'}</div><div>目的地：${dropoff.lat}, ${dropoff.lng}</div><div>評分：${rating}/5</div><div>回饋：${notes||'-'}</div></body></html>`
            const blob = new Blob([html], { type: 'text/html' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `receipt-${rideId||'unknown'}.html`
            a.click()
            setTimeout(() => URL.revokeObjectURL(url), 2000)
          }}>下載收據HTML</button>
        
        </div>
      </div>
      <pre className="muted" style={{ marginTop:12 }}>{res ? JSON.stringify(res, null, 2) : null}</pre>
      </div>
    </div>
  )
}
