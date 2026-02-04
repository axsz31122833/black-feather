import React, { useEffect, useRef, useState } from 'react'
import { requestRide, assignDriver } from '../lib/rideApi'
import { supabase } from '../lib/supabaseClient'
import { MapContainer, TileLayer, Marker, useMapEvents, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import ChatPanel from '../components/ChatPanel'

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
  const [senderId, setSenderId] = useState('')
  const [showChat, setShowChat] = useState(false)
  const mapRef = useRef(null)
  const [isBooking, setIsBooking] = useState(false)
  const [favorites, setFavorites] = useState([])
  const [otherEnabled, setOtherEnabled] = useState(false)
  const [otherText, setOtherText] = useState('')

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
    ;(async ()=>{
      try {
        const { data: u } = await supabase.auth.getUser()
        const uid = u?.user?.id || (typeof localStorage!=='undefined' ? localStorage.getItem('bf_guest_id') : '') || ''
        setSenderId(uid || '')
      } catch {
        try {
          const gid = (typeof localStorage!=='undefined' ? localStorage.getItem('bf_guest_id') : '') || ''
          setSenderId(gid || '')
        } catch {}
      }
    })()
  }, [])

  useEffect(() => {
    try {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setOrigin(c)
          const addr = await reversePhoton(c.lat, c.lng).catch(()=> '')
          setOriginAddress(addr || '')
          try { mapRef.current?.flyTo([c.lat, c.lng], 16, { duration: 0.8 }) } catch {}
        },
        async () => {
          const c = { lat: 25.033, lng: 121.565 }
          setOrigin(c)
          const addr = await reversePhoton(c.lat, c.lng).catch(()=> '')
          setOriginAddress(addr || '')
          try { mapRef.current?.flyTo([c.lat, c.lng], 13, { duration: 0.8 }) } catch {}
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      )
    } catch {}
  }, [])

  async function reversePhoton(lat, lng) {
    try {
      const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=zh`
      const resp = await fetch(url)
      const json = await resp.json()
      const f = json?.features?.[0]
      const p = f?.properties || {}
      const city = p.city || p.town || p.village || ''
      const district = p.district || ''
      const street = p.street || p.name || ''
      const num = p.housenumber || ''
      const parts = [city, district, street + (num ? num : '')].filter(x => x && String(x).trim().length > 0)
      return parts.join('')
    } catch { return '' }
  }

  // use Photon-only search (no Nominatim)

  async function searchPhoton(q) {
    if (!q || q.trim().length < 2) return []
    let query = q.trim()
    if (/\\d+$/.test(query) && !/號$/.test(query)) query = query + '號'
    const useLat = origin?.lat ?? 24.15
    const useLon = origin?.lng ?? 120.68
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=zh&limit=5&lat=${useLat}&lon=${useLon}`
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } }).catch(()=>null)
    if (!resp) return []
    const json = await resp.json().catch(()=>({}))
    const feats = json?.features || []
    return feats
      .filter(f => (f?.properties?.country || '').includes('台灣') || (f?.properties?.country || '').includes('Taiwan') || !f?.properties?.country)
      .map(f => {
        const p = f.properties || {}
        const nameParts = [p.city || p.town || p.village || '', p.district || '', (p.street || p.name || '') + (p.housenumber ? p.housenumber : '')].filter(x=>x&&String(x).trim().length>0)
        const display = nameParts.join('')
        return { name: display || p.name || '', lat: f.geometry?.coordinates?.[1], lng: f.geometry?.coordinates?.[0], housenumber: p.housenumber || '' }
      })
      .filter(e => typeof e.lat === 'number' && typeof e.lng === 'number')
  }

  async function searchPlaces(q) {
    const photon = await searchPhoton(q)
    const all = [...photon]
    const seen = new Set()
    const merged = []
    for (const e of all) {
      const key = `${e.lat.toFixed(6)},${e.lng.toFixed(6)}:${e.name}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(e)
      }
    }
    merged.sort((a,b)=>{
      const da = Math.hypot((a.lat-origin.lat),(a.lng-origin.lng))
      const db = Math.hypot((b.lat-origin.lat),(b.lng-origin.lng))
      const ha = a.housenumber ? 0 : 1
      const hb = b.housenumber ? 0 : 1
      if (ha !== hb) return ha - hb
      return da - db
    })
    return merged.slice(0,8)
  }

  async function callRide() {
    setIsBooking(true)
    setRes({ loading: true })
    const { data: u } = await supabase.auth.getUser()
    let pid = u?.user?.id
    if (!pid) {
      try {
        pid = localStorage.getItem('bf_guest_id')
        if (!pid && window.crypto?.randomUUID) {
          pid = window.crypto.randomUUID()
          localStorage.setItem('bf_guest_id', pid)
        }
      } catch {}
      if (!pid) {
        window.location.href = '/login'
        return
      }
    }
    const r = await requestRide({ passenger_id: pid, origin, destination })
    setRes(r.data)
    const id = r?.data?.ride_id || ''
    setRideId(id)
    try { setShowChat(true) } catch {}
    try {
      const extra = otherEnabled && otherText ? `; 其他:${otherText}` : ''
      const notes = `禁菸:${noSmoking ? '是' : '否'}; 攜帶寵物:${pets ? '是' : '否'}${extra}`
      if (id) await supabase.from('rides').update({ notes }).eq('id', id)
    } catch {}
  }

  async function doAssign() {
    if (!rideId) return
    const a = await assignDriver({ ride_id: rideId })
    setRes(a.data)
  }

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      <MapContainer
        center={[origin.lat, origin.lng]}
        zoom={13}
        dragging={true}
        whenCreated={(m)=>{ 
          try { 
            mapRef.current = m
            m.dragging.enable(); 
            m.touchZoom.enable(); 
            m.scrollWheelZoom.enable(); 
            setTimeout(()=>{ try { m.invalidateSize(); } catch {} }, 50)
            setTimeout(()=>{ try { m.invalidateSize(); } catch {} }, 300)
            window.addEventListener('resize', ()=>{ try { m.invalidateSize(); } catch {} })
          } catch {} 
        }}
        style={{ height: '100%', width:'100%', zIndex:0 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <Marker position={[origin.lat, origin.lng]}>
          <Popup>上車地點</Popup>
        </Marker>
        <Marker position={[destination.lat, destination.lng]}>
          <Popup>目的地</Popup>
        </Marker>
      </MapContainer>
      <div style={{ position:'fixed', left:0, right:0, bottom:0, zIndex:9999 }}>
        <div style={{ width:'100%', maxWidth:820, margin:'0 auto', padding:'12px' }}>
          <div style={{ background:'#111', border:'1px solid rgba(212,175,55,0.35)', borderRadius:16, padding:12 }}>
            <div style={{ display:'grid', gap:10 }}>
              <div>
                <div style={{ color:'#e5e7eb', fontSize:13, marginBottom:4 }}>📍 起點（預設為當前位置）</div>
                <input
                  value={originAddress}
                  onChange={(e)=>{
                    const v = e.target.value
                    setOriginAddress(v)
                    if (originTimer.current) clearTimeout(originTimer.current)
                    originTimer.current = setTimeout(async ()=>{
                    const list = await searchPlaces(v)
                    setOriginPred(list.slice(0,6))
                  }, 250)
                }}
                placeholder="輸入地址或地標"
                style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:'1px solid rgba(212,175,55,0.3)', background:'#0b0b0b', color:'#fff' }}
              />
              <div style={{ marginTop:6 }}>
                <button onClick={()=>{
                  try {
                    navigator.geolocation.getCurrentPosition(async (pos)=>{
                      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                      setOrigin(c)
                      const addr = await reversePhoton(c.lat, c.lng).catch(()=> '')
                      setOriginAddress(addr || '')
                      mapRef.current?.flyTo([c.lat, c.lng], 16, { duration: 0.8 })
                    })
                  } catch {}
                }} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(212,175,55,0.25)', color:'#e5e7eb' }}>📍 精準定位</button>
                <button onClick={async ()=>{
                  try {
                    const label = (originAddress || '常用地址').slice(0,50)
                    await supabase.from('favorite_addresses').insert({ user_id: senderId || null, label, address: originAddress || '', lat: origin.lat, lng: origin.lng })
                    const { data } = await supabase.from('favorite_addresses').select('*').eq('user_id', senderId).order('created_at', { ascending:false }).limit(10)
                    setFavorites(data || [])
                  } catch {}
                }} style={{ marginLeft:8, padding:'6px 10px', borderRadius:8, border:'1px solid rgba(212,175,55,0.25)', color:'#111', backgroundImage:'linear-gradient(to right, #D4AF37, #B8860B)' }}>⭐</button>
              </div>
              {originPred.length > 0 && (
                <div style={{ marginTop:6, background:'#0b0b0b', border:'1px solid rgba(212,175,55,0.25)', borderRadius:12 }}>
                  {originPred.map((p,i)=>(
                    <button key={i} onClick={async ()=>{
                      setOrigin({ lat:p.lat, lng:p.lng }); setOriginAddress(p.name); setOriginPred([]); try { mapRef.current?.flyTo([p.lat, p.lng], 16, { duration: 0.8 }) } catch {}
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
                    const list = await searchPlaces(v)
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
                      setDestination({ lat:p.lat, lng:p.lng }); setDestAddress(p.name); setDestPred([]); try { mapRef.current?.flyTo([p.lat, p.lng], 16, { duration: 0.8 }) } catch {}
                    }} style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 12px', color:'#e5e7eb' }}>{p.name}</button>
                  ))}
                </div>
              )}
              <div style={{ marginTop:6, display:'flex', gap:8 }}>
                <button onClick={async ()=>{
                  try {
                    const label = (destAddress || '常用地址').slice(0,50)
                    await supabase.from('favorite_addresses').insert({ user_id: senderId || null, label, address: destAddress || '', lat: destination.lat, lng: destination.lng })
                    const { data } = await supabase.from('favorite_addresses').select('*').eq('user_id', senderId).order('created_at', { ascending:false }).limit(10)
                    setFavorites(data || [])
                  } catch {}
                }} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid rgba(212,175,55,0.25)', color:'#111', backgroundImage:'linear-gradient(to right, #D4AF37, #B8860B)' }}>⭐</button>
              </div>
              {favorites.length > 0 && (
                <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:8 }}>
                  {favorites.map((f)=>(
                    <button key={f.id} onClick={()=>{
                      try {
                        setDestination({ lat:f.lat, lng:f.lng })
                        setDestAddress(f.address || f.label || '')
                        mapRef.current?.flyTo([f.lat, f.lng], 16, { duration: 0.8 })
                      } catch {}
                    }} style={{ padding:'6px 10px', borderRadius:9999, border:'1px solid rgba(212,175,55,0.25)', color:'#e5e7eb' }}>{f.label || f.address || '常用地址'}</button>
                  ))}
                </div>
              )}
            </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <label style={{ color:'#e5e7eb' }}><input type="checkbox" checked={noSmoking} onChange={e=>setNoSmoking(e.target.checked)} /> 🚭 禁菸</label>
                  <label style={{ color:'#e5e7eb' }}><input type="checkbox" checked={pets} onChange={e=>setPets(e.target.checked)} /> 🐾 攜帶寵物</label>
                  <label style={{ color:'#e5e7eb' }}>
                    <input type="checkbox" checked={otherEnabled} onChange={e=>setOtherEnabled(e.target.checked)} /> 其他
                  </label>
                  {otherEnabled && (
                    <input value={otherText} onChange={e=>setOtherText(e.target.value)} placeholder="請輸入備註..." style={{ padding:'8px 10px', borderRadius:8, border:'1px solid rgba(212,175,55,0.25)', background:'#0b0b0b', color:'#fff', minWidth:180 }} />
                  )}
                </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={callRide} disabled={isBooking} style={{ padding:'10px 14px', borderRadius:12, backgroundImage:'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111', fontWeight:600, opacity: isBooking ? 0.6 : 1 }}>
                  {isBooking ? '尋找司機中...' : '立即叫車'}
                </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <button onClick={()=>{
        try {
          setShowChat(v => !v)
        } catch {}
      }} style={{ position:'fixed', right:12, bottom:96, zIndex:10000, width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%', backgroundImage:'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111', fontWeight:700 }}>
        💬
      </button>
      {showChat && (
        <ChatPanel rideId={rideId || 'admin'} senderId={senderId} role="passenger" />
      )}
    </div>
  )
}
