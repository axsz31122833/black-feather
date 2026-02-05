import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ChatPanel from '../components/ChatPanel'
import { supabase } from '../lib/supabaseClient'

export default function PassengerHome() {
  const [origin, setOrigin] = useState({ lat: 24.1508, lng: 120.6853 })
  const [destination, setDestination] = useState({ lat: 24.16, lng: 120.69 })
  const [originAddress, setOriginAddress] = useState('')
  const [destAddress, setDestAddress] = useState('')
  const [originPred, setOriginPred] = useState([])
  const [destPred, setDestPred] = useState([])
  const [routeInfo, setRouteInfo] = useState({ distance: 0, duration: 0, fare: 0 })
  const [showEstimate, setShowEstimate] = useState(false)
  const [useHighway, setUseHighway] = useState(true) // 預設行經高速道路
  const [favorites, setFavorites] = useState([{name: '台中火車站', lat: 24.1373, lng: 120.6856}])
  const [showFavs, setShowFavs] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const mapRef = useRef(null)

  // 1. 台灣限定搜尋 (排除中國，過濾英文)
  async function searchPhoton(q) {
    if (q.length < 2) return []
    // 強制加入台灣座標偏好與國家過濾
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=24.15&lon=120.68&limit=10&location_bias_scale=1.0`
    const resp = await fetch(url).catch(() => null)
    if (!resp) return []
    const json = await resp.json()
    const feats = (json?.features || [])
      .filter(f => f.properties.country === 'Taiwan') // 嚴格台灣
      .map(f => {
        const p = f.properties || {}
        const city = p.city || p.town || p.village || '台中市'
        const district = p.district || ''
        const street = p.street || p.name || ''
        const house = p.housenumber ? p.housenumber + '號' : ''
        const name = `${city}${district}${street}${house}`
        return { name, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0] }
      })
      .filter(i => !/[A-Za-z]/.test(i.name))
    return feats
  }

  // Haversine 計算距離（km）
  function distanceKm(a, b) {
    const toRad = v => (v * Math.PI) / 180
    const R = 6371
    const dLat = toRad((b.lat || 0) - (a.lat || 0))
    const dLon = toRad((b.lng || 0) - (a.lng || 0))
    const lat1 = toRad(a.lat || 0)
    const lat2 = toRad(b.lat || 0)
    const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
  }
  // 模擬 Google 預估（里程×時速40km/h）
  const getRoute = async () => {
    const baseKm = distanceKm(origin, destination)
    const km = useHighway ? baseKm * 1.1 : baseKm
    const mins = Math.round((km / 40) * 60)
    let fare = 70 + (km * 15) + (mins * 3)
    if (km > 20) fare += (km - 20) * 10
    if (useHighway) fare += 40
    setRouteInfo({ distance: km.toFixed(1), duration: mins, fare: Math.round(fare) })
    setShowEstimate(true)
  }

  // 送單（預留 route_history 欄位）
  async function confirmRide() {
    try {
      await supabase.from('rides').insert({
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        dest_lat: destAddress ? destination.lat : null,
        dest_lng: destAddress ? destination.lng : null,
        route_history: []
      })
      alert('正在尋找司機...')
    } catch {
      alert('送單失敗，請稍後再試')
    }
  }

  return (
    <div style={{ position: 'relative', height: '100vh', background: '#000' }}>
      <MapContainer center={[origin.lat, origin.lng]} zoom={15} style={{ height: '100%' }} whenCreated={m => mapRef.current = m}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[origin.lat, origin.lng]}><Popup>起點</Popup></Marker>
        {destAddress && <Marker position={[destination.lat, destination.lng]}><Popup>終點</Popup></Marker>}
      </MapContainer>

      {/* 右側常用地點面板 */}
      {showFavs && (
        <div style={{ position:'fixed', right:0, top:0, bottom:0, width:250, background:'#1a1a1a', zIndex:2000, padding:20, borderLeft:'2px solid #D4AF37' }}>
          <h3 style={{ color:'#D4AF37' }}>⭐ 常用地點</h3>
          {favorites.map((f, i) => (
            <div key={i} style={{ padding:'10px 0', borderBottom:'1px solid #333' }}>
              <div>{f.name}</div>
              <button onClick={()=>{setOrigin({lat:f.lat, lng:f.lng}); setOriginAddress(f.name); setShowFavs(false)}} style={{fontSize:10, marginRight:5}}>設為起點</button>
              <button onClick={()=>{setDestination({lat:f.lat, lng:f.lng}); setDestAddress(f.name); setShowFavs(false)}} style={{fontSize:10}}>設為終點</button>
            </div>
          ))}
          <button onClick={()=>setShowFavs(false)} style={{ width:'100%', marginTop:20 }}>關閉</button>
        </div>
      )}

      {/* 控制面板 */}
      <div style={{ position: 'fixed', bottom: 20, left: '5%', right: '5%', zIndex: 1000 }}>
        <div style={{ background: 'rgba(20,20,20,0.95)', borderRadius: 20, padding: 15, border: '1.5px solid #D4AF37' }}>
          
          <div style={{ display:'flex', gap:5, marginBottom:10 }}>
            <input value={originAddress} onChange={async (e)=>{setOriginAddress(e.target.value); setOriginPred(await searchPhoton(e.target.value))}} placeholder="📍 起點" style={{ flex:1, padding:10, borderRadius:8, background:'#333', color:'#fff', border:'none' }} />
            <button onClick={()=>{
              navigator.geolocation.getCurrentPosition(pos=>{
                const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                setOrigin(c)
                mapRef.current?.flyTo([c.lat, c.lng], 16)
              })
            }} style={{ background:'#444', color:'#D4AF37', border:'none', borderRadius:8, padding:'0 10px' }}>📍 精準定位</button>
            <button onClick={()=>setShowFavs(true)} style={{ background:'#444', color:'#D4AF37', border:'none', borderRadius:8, padding:'0 10px' }}>⭐ 常用地點</button>
            <button onClick={()=>setShowChat(true)} style={{ background:'#444', color:'#D4AF37', border:'none', borderRadius:8, padding:'0 10px' }}>💬 即時對話</button>
          </div>
          {originPred.map((p,i)=>(<div key={i} onClick={()=>{setOrigin({lat:p.lat,lng:p.lon});setOriginAddress(p.name);setOriginPred([])}} style={{padding:8, background:'#222'}}>{p.name}</div>))}

          <div style={{ display:'flex', gap:5, marginBottom:10 }}>
            <input value={destAddress} onChange={async (e)=>{setDestAddress(e.target.value); setDestPred(await searchPhoton(e.target.value))}} placeholder="🏁 目的地(選填)" style={{ flex:1, padding:10, borderRadius:8, background:'#333', color:'#fff', border:'none' }} />
            <label style={{ color:'#aaa', fontSize:12, display:'flex', alignItems:'center' }}>
              <input type="checkbox" checked={useHighway} onChange={(e)=>setUseHighway(e.target.checked)} /> 行經高速/快速道路
            </label>
          </div>
          {destPred.map((p,i)=>(<div key={i} onClick={()=>{setDestination({lat:p.lat,lng:p.lon});setDestAddress(p.name);setDestPred([])}} style={{padding:8, background:'#222'}}>{p.name}</div>))}

          <div style={{ display:'grid', gap:8 }}>
            <button onClick={getRoute} disabled={!destAddress} style={{ width:'100%', padding:15, borderRadius:12, background:'#D4AF37', fontWeight:'bold', border:'none', opacity: destAddress ? 1 : 0.7 }}>計算預估金額與時間</button>
            <button onClick={confirmRide} style={{ width:'100%', padding:15, borderRadius:12, background:'linear-gradient(to right, #D4AF37, #B8860B)', fontWeight:'bold', border:'none' }}>確認叫車</button>
            <button onClick={()=>{
              if (!destAddress) return
              const url = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&travelmode=driving`
              window.open(url, '_blank')
            }} disabled={!destAddress} style={{ width:'100%', padding:12, borderRadius:10, background:'#444', color:'#fff', border:'none', opacity: destAddress ? 1 : 0.7 }}>🗺️ 在 Google 地圖查看預估路線</button>
          </div>
          
          {showEstimate && (
            <div style={{ textAlign:'center', marginTop:10 }}>
              <div style={{ background:'#222', padding:10, borderRadius:10, marginBottom:10 }}>
                <span style={{ color:'#D4AF37', fontSize:22, fontWeight:'bold' }}>NT$ {routeInfo.fare}</span>
                <div style={{ color:'#aaa', fontSize:12 }}>距離：{routeInfo.distance} km | 時間：{routeInfo.duration} 分鐘</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
