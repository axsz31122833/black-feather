import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ChatPanel from '../components/ChatPanel'
import { supabase } from '../lib/supabaseClient'
import { cancelRide } from '../lib/rideApi'
import { loadGoogleMaps } from '../lib/googleMaps'

// 修正 Leaflet 圖示
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function PassengerHome() {
  const [origin, setOrigin] = useState({ lat: 24.1508, lng: 120.6853 })
  const [destination, setDestination] = useState({ lat: 24.16, lng: 120.69 })
  const [originAddress, setOriginAddress] = useState('')
  const [destAddress, setDestAddress] = useState('')
  const [originPred, setOriginPred] = useState([])
  const [destPred, setDestPred] = useState([])
  const [routeInfo, setRouteInfo] = useState({ distance: 0, duration: 0, fare: 0 })
  const [showEstimate, setShowEstimate] = useState(false)
  const [useHighway, setUseHighway] = useState(false) 
  const [showChat, setShowChat] = useState(false)
  const [showFavs, setShowFavs] = useState(false)
  const [isReserving, setIsReserving] = useState(false)
  const [reserveTime, setReserveTime] = useState('')
  const [rideId, setRideId] = useState('')
  
  const mapRef = useRef(null)
  const hasGoogleKey = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  const gmapRef = useRef(null)
  const directionsRef = useRef(null)
  const originInputRef = useRef(null)
  const destInputRef = useRef(null)
  const [arrivedOverlay, setArrivedOverlay] = useState(false)
  const [acceptedOverlay, setAcceptedOverlay] = useState(false)
  const [driverInfo, setDriverInfo] = useState({ name:'', car:'' })
  const [driverId, setDriverId] = useState('')
  const beepRef = useRef(null)
  const driverMarkerRef = useRef(null)

  // 1. 地址格式化：名稱 縣市區路號
  const formatTaiwanAddress = (item) => {
    if (item.display_name && item.display_name.includes('金錢豹')) {
      return "金錢豹 臺中市西屯區臺灣大道二段960號";
    }
    const addr = item.address || {};
    const city = addr.city || addr.town || addr.state || "";
    const suburb = addr.suburb || addr.district || "";
    const road = addr.road || "";
    const houseNumber = addr.house_number ? `${addr.house_number}號` : "";
    const name = item.name !== road ? `${item.name} ` : "";
    return `${name}${city}${suburb}${road}${houseNumber}`.replace(/undefined/g, '').trim();
  }

  // 2. 搜尋邏輯 (支持門牌回退)
  const searchAddress = async (q, setter) => {
    if (q.length < 1) { setter([]); return; }
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&accept-language=zh-TW&countrycodes=tw&addressdetails=1&limit=10&viewbox=120.4,24.4,120.8,24.0`;
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'BlackFeather' } });
      let data = await resp.json();
      if (data.length === 0 && /\d/.test(q)) {
        const fallback = q.replace(/\d+/g, '').trim();
        const resp2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallback)}&accept-language=zh-TW&countrycodes=tw&addressdetails=1&limit=5`, { headers: { 'User-Agent': 'BlackFeather' } });
        data = await resp2.json();
      }
      const list = data.map(item => ({ name: formatTaiwanAddress(item), lat: parseFloat(item.lat), lon: parseFloat(item.lon) }))
      if (/金錢豹/.test(q)) {
        if (list.length > 0) list[0].name = '金錢豹 臺中市西屯區臺灣大道二段960號'
        else list.unshift({ name: '金錢豹 臺中市西屯區臺灣大道二段960號', lat: 24.1635, lon: 120.6406 })
      }
      setter(list)
    } catch (e) { setter([]); }
  }

  useEffect(() => {
    ;(async ()=>{
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const uid = user?.id || ''
        if (!uid) return
        const ch = supabase
          .channel('rides-passenger-' + uid)
          .on('postgres_changes', { event:'UPDATE', schema:'public', table:'rides', filter:`passenger_id=eq.${uid}` }, (payload) => {
            try {
              const row = payload.new
              if (row?.driver_id) {
                ;(async ()=>{
                  try {
                    const { data: prof } = await supabase.from('profiles').select('full_name,car_model,car_plate,car_color').eq('id', row.driver_id).limit(1).single()
                    const name = prof?.full_name || '司機'
                    const car = `${prof?.car_color || ''} ${prof?.car_model || ''} (${prof?.car_plate || ''})`.trim()
                    setDriverInfo({ name, car })
                    setDriverId(row.driver_id || '')
                    setAcceptedOverlay(true)
                  } catch {}
                })()
              }
              if (row?.sop_status === 'arrived') {
                setArrivedOverlay(true)
                try {
                  const AC = window.AudioContext || (window).webkitAudioContext
                  const ctx = AC ? new AC() : null
                  if (ctx) {
                    const o = ctx.createOscillator()
                    const g = ctx.createGain()
                    o.connect(g); g.connect(ctx.destination)
                    o.type = 'sine'; o.frequency.value = 880
                    g.gain.setValueAtTime(0.0001, ctx.currentTime)
                    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01)
                    o.start()
                    setTimeout(() => { o.stop(); ctx.close().catch(()=>{}) }, 1200)
                  }
                } catch {}
              }
            } catch {}
          })
          .subscribe()
        beepRef.current = ch
      } catch {}
    })()
    return () => { try { beepRef.current?.unsubscribe?.() } catch {} }
  }, [])

  useEffect(() => {
    ;(async ()=>{
      try {
        const google = await loadGoogleMaps(['places'])
        if (originInputRef.current) {
          const ac = new google.maps.places.Autocomplete(originInputRef.current, { fields:['geometry','formatted_address','name'] })
          ac.addListener('place_changed', () => {
            const p = ac.getPlace()
            const loc = p?.geometry?.location
            if (loc) {
              const lat = loc.lat()
              const lng = loc.lng()
              setOrigin({ lat, lng })
              setOriginAddress(p?.formatted_address || p?.name || '')
            }
          })
        }
        if (destInputRef.current) {
          const ac2 = new google.maps.places.Autocomplete(destInputRef.current, { fields:['geometry','formatted_address','name'] })
          ac2.addListener('place_changed', () => {
            const p = ac2.getPlace()
            const loc = p?.geometry?.location
            if (loc) {
              const lat = loc.lat()
              const lng = loc.lng()
              setDestination({ lat, lng })
              setDestAddress(p?.formatted_address || p?.name || '')
              setShowEstimate(true)
            }
          })
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    if (!driverId) return
    try {
      const ch = supabase
        .channel('drivers-' + driverId)
        .on('postgres_changes', { event:'UPDATE', schema:'public', table:'drivers', filter:`user_id=eq.${driverId}` }, (payload) => {
          try {
            const row = payload.new
            const lat = Number(row?.lat || 0)
            const lng = Number(row?.lng || 0)
            if (lat && lng && gmapRef.current) {
              const google = window.google
              if (!driverMarkerRef.current) {
                driverMarkerRef.current = new google.maps.Marker({ position:{ lat, lng }, map: gmapRef.current, icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale:4, strokeColor:'#1e88e5' } })
              } else {
                driverMarkerRef.current.setPosition({ lat, lng })
              }
            }
          } catch {}
        })
        .subscribe()
      return () => { try { ch.unsubscribe() } catch {} }
    } catch {}
  }, [driverId])

  useEffect(() => {
    ;(async ()=>{
      try {
        const google = await loadGoogleMaps(['places'])
        const mapEl = document.getElementById('gmap')
        const map = new google.maps.Map(mapEl, {
          center: { lat: origin.lat, lng: origin.lng },
          zoom: 15,
          mapId: 'BF_MAP',
        })
        gmapRef.current = map
        try { console.log('Map Instance Created:', map) } catch {}
        directionsRef.current = new google.maps.DirectionsRenderer({ map })
        const svc = new google.maps.DirectionsService()
        function drawRoute() {
          if (!destAddress) return
          const req = {
            origin: { lat: origin.lat, lng: origin.lng },
            destination: { lat: destination.lat, lng: destination.lng },
            travelMode: google.maps.TravelMode.DRIVING,
            avoidHighways: !useHighway,
          }
          svc.route(req, (res, status) => {
            if (status === 'OK' && res) {
              directionsRef.current?.setDirections(res)
            }
          })
        }
        drawRoute()
      } catch {}
    })()
  }, [origin, destination, destAddress, useHighway])

  // 3. 定位
  const handleLocate = () => {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      setOrigin({ lat: latitude, lng: longitude });
      mapRef.current?.flyTo([latitude, longitude], 16);
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=zh-TW&addressdetails=1`);
      const data = await resp.json();
      setOriginAddress(formatTaiwanAddress(data));
    });
  }

  // 4. 預估金額
  const calculateEstimate = () => {
    if (!destAddress) return;
    const R = 6371;
    const dLat = (destination.lat - origin.lat) * Math.PI / 180;
    const dLon = (destination.lng - (origin.lng || origin.lon)) * Math.PI / 180;
    const h = Math.sin(dLat/2)**2 + Math.cos(origin.lat*Math.PI/180)*Math.cos(destination.lat*Math.PI/180)*Math.sin(dLon/2)**2;
    const dist = 2 * R * Math.asin(Math.sqrt(h)) * (useHighway ? 1.15 : 1.3);
    const dur = Math.max(5, Math.round(dist * 2.5));
    let fare = 70 + (dist * 15) + (dur * 3);
    if (useHighway) fare += 40;
    setRouteInfo({ distance: dist.toFixed(1), duration: dur, fare: Math.round(fare) });
    setShowEstimate(true);
  }

  // 5. 確認叫車
  async function confirmRide() {
    if (!originAddress) return alert('請填寫上車地點');
    try {
      const { data, error } = await supabase.from('rides').insert([{
        origin_address: originAddress,
        dest_address: destAddress || '現場跳表',
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        dest_lat: destAddress ? destination.lat : null,
        dest_lng: destAddress ? destination.lng : null,
        status: 'searching',
        is_reservation: isReserving,
        scheduled_time: isReserving && reserveTime ? new Date(reserveTime).toISOString() : null,
      }]).select('id').single();
      if (error) throw error;
      setRideId(data?.id || '')
      alert(isReserving ? '預約成功！' : '叫車請求已發送！');
    } catch (err) {
      alert('叫車失敗：' + err.message);
    }
  }

  return (
    <div style={{ height: '100vh', background: '#000', color: '#fff', position: 'relative' }}>
      {hasGoogleKey ? (
        <div id="gmap" style={{ width:'100%', height:'100vh', minHeight:'400px', backgroundColor:'#555' }} />
      ) : (
        <MapContainer center={[origin.lat, origin.lng]} zoom={15} style={{ height: '500px', width:'100%' }} whenCreated={m => mapRef.current = m}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[origin.lat, origin.lng]} />
          {destAddress && <Marker position={[destination.lat, destination.lng]} />}
        </MapContainer>
      )}
      {acceptedOverlay && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#111', border:'1px solid rgba(212,175,55,0.35)', borderRadius:12, padding:16, width:'92%', maxWidth:520, textAlign:'center' }}>
            <div style={{ fontSize:24, fontWeight:900, color:'#D4AF37', marginBottom:8 }}>司機已接單</div>
            <div style={{ color:'#e5e7eb', marginBottom:6 }}>{driverInfo.name}</div>
            <div style={{ color:'#D4AF37', fontWeight:700, marginBottom:16 }}>{driverInfo.car}</div>
            <button onClick={()=>setAcceptedOverlay(false)} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid rgba(212,175,55,0.35)', color:'#e5e7eb' }}>關閉</button>
          </div>
        </div>
      )}
      {arrivedOverlay && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#111', border:'1px solid rgba(212,175,55,0.35)', borderRadius:12, padding:16, width:'92%', maxWidth:520, textAlign:'center' }}>
            <div style={{ fontSize:24, fontWeight:900, color:'#D4AF37', marginBottom:8 }}>司機已抵達</div>
            <div style={{ color:'#e5e7eb', marginBottom:6 }}>{driverInfo.name}</div>
            <div style={{ color:'#D4AF37', fontWeight:700, marginBottom:16 }}>{driverInfo.car}</div>
            <div style={{ color:'#e5e7eb', marginBottom:16 }}>請確認周邊安全並準備上車</div>
            <button onClick={()=>setArrivedOverlay(false)} style={{ padding:'10px 14px', borderRadius:10, border:'1px solid rgba(212,175,55,0.35)', color:'#e5e7eb' }}>關閉</button>
          </div>
        </div>
      )}

      {/* 控制面板 */}
      <div style={{ position: 'fixed', bottom: 20, left: '5%', right: '5%', zIndex: 1000 }}>
        <div style={{ background: 'rgba(20,20,20,0.95)', borderRadius: 25, padding: 20, border: '1.5px solid #D4AF37' }}>
          
          <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
            <button onClick={() => setIsReserving(false)} style={{ flex: 1, padding: 12, borderRadius: 12, background: !isReserving ? '#D4AF37' : '#333', color: !isReserving ? '#000' : '#fff', fontWeight: 'bold', border: 'none' }}>即時</button>
            <button onClick={() => setIsReserving(true)} style={{ flex: 1, padding: 12, borderRadius: 12, background: isReserving ? '#D4AF37' : '#333', color: isReserving ? '#000' : '#fff', fontWeight: 'bold', border: 'none' }}>預約</button>
          </div>

          {isReserving && <input type="datetime-local" value={reserveTime} onChange={(e) => setReserveTime(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 12, background: '#111', color: '#fff', border: '1px solid #D4AF37', marginBottom: 15 }} />}

          <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
            <input ref={originInputRef} value={originAddress} onChange={(e) => { setOriginAddress(e.target.value); searchAddress(e.target.value, setOriginPred); }} placeholder="📍 上車地點" style={{ flex: 1, padding: 14, borderRadius: 12, background: '#222', color: '#fff', border: 'none' }} />
            <button onClick={handleLocate} style={{ background: '#333', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: 12, padding: '0 12px' }}>📍</button>
            <button onClick={() => setShowFavs(true)} style={{ background: '#333', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: 12, padding: '0 12px' }}>⭐</button>
          </div>
          {originPred.length > 0 && <div style={{ background: '#111', borderRadius: 10, marginBottom: 10, maxHeight: 150, overflowY: 'auto' }}>
            {originPred.map((p, i) => <div key={i} onClick={() => { setOrigin({ lat: p.lat, lng: p.lon }); setOriginAddress(p.name); setOriginPred([]); }} style={{ padding: 15, borderBottom: '1px solid #222' }}>{p.name}</div>)}
          </div>}

          <div style={{ marginBottom: 15, display: 'flex', gap: 8 }}>
            <input ref={destInputRef} value={destAddress} onChange={(e) => { setDestAddress(e.target.value); searchAddress(e.target.value, setDestPred); }} placeholder="🏁 下車地點" style={{ flex: 1, padding: 14, borderRadius: 12, background: '#222', color: '#fff', border: 'none' }} />
            <button onClick={() => setShowChat(true)} style={{ background: '#333', color: '#D4AF37', border: '1px solid #D4AF37', borderRadius: 12, padding: '0 12px' }}>💬</button>
          </div>
          {destPred.length > 0 && <div style={{ background: '#111', borderRadius: 10, marginBottom: 10, maxHeight: 150, overflowY: 'auto' }}>
            {destPred.map((p, i) => <div key={i} onClick={() => { setDestination({ lat: p.lat, lng: p.lon }); setDestAddress(p.name); setDestPred([]); }} style={{ padding: 15, borderBottom: '1px solid #222' }}>{p.name}</div>)}
          </div>}

          <label style={{ display: 'flex', alignItems: 'center', marginBottom: 15, color: '#D4AF37', fontSize: 13 }}>
            <input type="checkbox" checked={useHighway} onChange={(e) => setUseHighway(e.target.checked)} style={{ marginRight: 10 }} /> 行經高速公路
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: destAddress ? '1fr 1fr' : '1fr', gap: 10 }}>
            {destAddress && <button onClick={calculateEstimate} style={{ padding: 15, borderRadius: 15, background: '#333', color: '#D4AF37', border: '1px solid #D4AF37', fontWeight: 'bold' }}>預估金額</button>}
            <button onClick={confirmRide} style={{ padding: 18, borderRadius: 15, background: 'linear-gradient(135deg, #D4AF37, #B8860B)', color: '#000', fontWeight: '900', border: 'none' }}>確認{isReserving ? '預約' : '叫車'}</button>
          </div>
          <div style={{ marginTop: 10 }}>
            <button
              onClick={async ()=>{
                try {
                  if (!rideId) { alert('尚未建立行程'); return }
                  const r = await cancelRide({ ride_id: rideId, reason: 'user_cancel' })
                  alert('已取消行程（取消費 NT$100）')
                  setRideId('')
                  setShowEstimate(false)
                } catch {
                  alert('取消失敗，請稍後再試')
                }
              }}
              disabled={!rideId}
              style={{ padding:12, borderRadius:10, border:'1px solid rgba(212,175,55,0.35)', color:'#e5e7eb', background:'#1a1a1a', opacity: rideId ? 1 : 0.6 }}
            >
              取消行程（NT$100）
            </button>
          </div>

          {showEstimate && (
            <div style={{ textAlign: 'center', marginTop: 15, padding: 15, background: 'rgba(212,175,55,0.1)', borderRadius: 15, border: '1px solid #D4AF37' }}>
              <div style={{ color: '#D4AF37', fontSize: 24, fontWeight: 'bold' }}>約 NT$ {routeInfo.fare}</div>
              <div style={{ color: '#aaa', fontSize: 12 }}>{routeInfo.distance} km / {routeInfo.duration} min</div>
            </div>
          )}
        </div>
      </div>

      {/* 常用地點彈窗 */}
      {showFavs && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '85%', background: '#1a1a1a', borderRadius: 20, padding: 20, border: '1.5px solid #D4AF37' }}>
            <h3 style={{ color: '#D4AF37' }}>常用地點</h3>
            <div onClick={() => { setOriginAddress("金錢豹 臺中市西屯區臺灣大道二段960號"); setOrigin({lat:24.1643, lng:120.6436}); setShowFavs(false); }} style={{ padding: 15, borderBottom: '1px solid #333' }}>🐆 金錢豹</div>
            <div onClick={() => { setOriginAddress("臺中火車站"); setOrigin({lat:24.1373, lng:120.6856}); setShowFavs(false); }} style={{ padding: 15, borderBottom: '1px solid #333' }}>🚂 臺中火車站</div>
            <button onClick={() => setShowFavs(false)} style={{ width: '100%', marginTop: 15, padding: 12, background: '#D4AF37', border: 'none', borderRadius: 10 }}>關閉</button>
          </div>
        </div>
      )}

      {showChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2001 }}>
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '85%', background: '#111', borderLeft: '1px solid #D4AF37' }}>
            <div style={{ padding: 15, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#D4AF37' }}>即時對話</span>
              <button onClick={() => setShowChat(false)} style={{ color: '#fff', background: 'none', border: 'none', fontSize: 24 }}>✕</button>
            </div>
            <ChatPanel />
          </div>
        </div>
      )}
    </div>
  )
}
