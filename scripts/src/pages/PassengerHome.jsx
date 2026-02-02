import React, { useEffect, useRef, useState } from 'react'
import { requestRide, assignDriver } from '../lib/rideApi'
import { supabase } from '../lib/supabaseClient'
import { MapContainer, TileLayer, Marker, useMapEvents, Popup } from 'react-leaflet'
import L from 'leaflet'

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
  const [originAddress, setOriginAddress] = useState('')
  const [destAddress, setDestAddress] = useState('')
  const [originPred, setOriginPred] = useState([])
  const [destPred, setDestPred] = useState([])
  const originTimer = useRef(null)
  const destTimer = useRef(null)
  const assigned = res && (res.assigned_driver || res.nearest || res.driver)

  useEffect(() => {
    try {
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
      })
    } catch {}
  }, [])

  useEffect(() => {
    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setOrigin(c)
          const addr = await reverseOSM(c.lat, c.lng).catch(()=>'')
          setOriginAddress(addr || '')
        },
        async () => {
          const c = { lat: 25.033, lng: 121.565 }
          setOrigin(c)
          const addr = await reverseOSM(c.lat, c.lng).catch(()=>'')
          setOriginAddress(addr || '')
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      )
    } catch {}
  }, [])

  async function reverseOSM(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } })
    const json = await resp.json()
    return json?.display_name || ''
  }

  async function searchOSM(q) {
    if (!q || q.trim().length < 2) return []
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}`
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } })
    const json = await resp.json()
    return (json || []).map(r => ({ name: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }))
  }

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
    <div style={{ position: 'relative', height: '100vh', background:'#000' }}>
      <div style={{ position:'absolute', top:12, left:'50%', transform:'translateX(-50%)', width:'clamp(300px, 90vw, 820px)', zIndex:30 }}>
        <div style={{ background:'#111', border:'1px solid rgba(212,175,55,0.3)', borderRadius:16, padding:12 }}>
          <div style={{ display:'grid', gap:8 }}>
            <div>
              <div style={{ color:'#e5e7eb', fontSize:13, marginBottom:4 }}>📍 起點（預設為當前位置）</div>
              <input
                value={originAddress}
                onChange={(e)=>{
                  const v = e.target.value
                  setOriginAddress(v)
                  if (originTimer.current) clearTimeout(originTimer.current)
                  originTimer.current = setTimeout(async ()=>{
                    const list = await searchOSM(v)
                    setOriginPred(list.slice(0,6))
                  }, 250)
                }}
                placeholder="輸入地址或地標"
                style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:'1px solid rgba(212,175,55,0.3)', background:'#0b0b0b', color:'#fff' }}
              />
              {originPred.length > 0 && (
                <div style={{ marginTop:6, background:'#0b0b0b', border:'1px solid rgba(212,175,55,0.25)', borderRadius:12 }}>
                  {originPred.map((p,i)=>(
                    <button key={i} onClick={async ()=>{
                      setOrigin({ lat:p.lat, lng:p.lng }); setOriginAddress(p.name); setOriginPred([])
                    }} style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 12px', color:'#e5e7eb' }}>{p.name}</button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div style={{ color:'#e5e7eb', fontSize:13, marginBottom:4 }}>🏁 終點</div>
              <input
                value={destAddress}
                onChange={(e)=>{
                  const v = e.target.value
                  setDestAddress(v)
                  if (destTimer.current) clearTimeout(destTimer.current)
                  destTimer.current = setTimeout(async ()=>{
                    const list = await searchOSM(v)
                    setDestPred(list.slice(0,6))
                  }, 250)
                }}
                placeholder="輸入目的地地址或地標"
                style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:'1px solid rgba(212,175,55,0.3)', background:'#0b0b0b', color:'#fff' }}
              />
              {destPred.length > 0 && (
                <div style={{ marginTop:6, background:'#0b0b0b', border:'1px solid rgba(212,175,55,0.25)', borderRadius:12 }}>
                  {destPred.map((p,i)=>(
                    <button key={i} onClick={async ()=>{
                      setDestination({ lat:p.lat, lng:p.lng }); setDestAddress(p.name); setDestPred([])
                    }} style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 12px', color:'#e5e7eb' }}>{p.name}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <MapContainer center={[origin.lat, origin.lng]} zoom={13} style={{ height: '100%', width:'100%' }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution="&copy; CARTO &copy; OpenStreetMap contributors"
        />
        <Marker position={[origin.lat, origin.lng]}>
          <Popup>上車地點</Popup>
        </Marker>
        <Marker position={[destination.lat, destination.lng]}>
          <Popup>目的地</Popup>
        </Marker>
      </MapContainer>
      <div style={{ position:'fixed', left:0, right:0, bottom:0, zIndex:40 }}>
        <div style={{ width:'100%', maxWidth:820, margin:'0 auto', padding:'12px' }}>
          <div style={{ background:'#111', border:'1px solid rgba(212,175,55,0.35)', borderRadius:16, padding:12 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <label style={{ color:'#e5e7eb' }}><input type="checkbox" checked={noSmoking} onChange={e=>setNoSmoking(e.target.checked)} /> 🚭 禁菸</label>
                <label style={{ color:'#e5e7eb' }}><input type="checkbox" checked={pets} onChange={e=>setPets(e.target.checked)} /> 🐾 攜帶寵物</label>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={callRide} style={{ padding:'10px 14px', borderRadius:12, backgroundImage:'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111', fontWeight:600 }}>立即叫車</button>
                <button onClick={doAssign} style={{ padding:'10px 14px', borderRadius:12, border:'1px solid rgba(212,175,55,0.35)', color:'#e5e7eb' }}>派單</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
