import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'

type Driver = {
  id: string
  name?: string
  phone?: string
  plate_number?: string
  car_model?: string
  car_color?: string
  is_online?: boolean
  status?: string
  current_lat?: number
  current_lng?: number
  last_seen_at?: string
}

export default function DispatchMap({
  pickup,
  center,
  radiusKm,
  drivers,
  candidateIds,
  onAssign
}: {
  pickup?: { lat: number; lng: number } | null
  center?: { lat: number; lng: number } | null
  radiusKm: number
  drivers: Driver[]
  candidateIds: string[]
  onAssign: (driverId: string) => void
}) {
  const defaultCenter = pickup ? [pickup.lat, pickup.lng] : [24.147736, 120.673648]
  const colorFor = (d: Driver) => {
    if (d.is_online && d.status !== 'on_trip') return '#22c55e' // 綠色：空車
    if (d.status === 'on_trip') return '#ef4444' // 紅色：載客中
    return '#9ca3af' // 灰色：離線
  }
  const isCand = (id: string) => candidateIds.includes(id)
  const MapInvalidator = () => {
    const map = useMap()
    React.useEffect(() => {
      try { map.invalidateSize() } catch {}
      const t = setTimeout(() => { try { map.invalidateSize() } catch {} }, 300)
      const onResize = () => { try { map.invalidateSize() } catch {} }
      window.addEventListener('resize', onResize)
      return () => { clearTimeout(t); window.removeEventListener('resize', onResize) }
    }, [map])
    return null
  }
  const CenterFlyer = ({ c }: { c?: { lat: number; lng: number } | null }) => {
    const map = useMap()
    React.useEffect(() => {
      if (c && map) {
        try { (map as any).flyTo([c.lat, c.lng], (map as any).getZoom?.() || 12, { duration: 0.8 }) } catch {}
      }
    }, [c, map])
    return null
  }
  return (
    <MapContainer {...({ center: defaultCenter as any, zoom: 13, style: { height: '100%', width: '100%' } } as any)}>
      <MapInvalidator />
      <CenterFlyer c={center || null} />
      <TileLayer {...({ url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href=\"https://carto.com/attributions\">CARTO</a> &copy; OpenStreetMap contributors', crossOrigin: 'anonymous' } as any)} />
      {pickup && (
        <Marker position={[pickup.lat, pickup.lng]}>
          <Popup>上車地點</Popup>
        </Marker>
      )}
      {center && (
        <Circle {...({ center: [center.lat, center.lng], radius: radiusKm * 1000 } as any)} />
      )}
      {drivers
        .filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
        .slice(0, 50)
        .map(d => {
          const label = (d.plate_number || d.name || d.phone || '').toString()
          const badge = isCand(d.id) ? '<span style="background:#ede9fe;color:#6d28d9;border:1px solid #c4b5fd;padding:0 6px;border-radius:8px;font-weight:700;margin-left:6px">候補</span>' : ''
          const html = `<div style="display:inline-flex;align-items:center;gap:6px;background:${isCand(d.id) ? '#0f0f0f' : '#111'};border:1px solid ${isCand(d.id) ? '#c4b5fd' : '#222'};border-radius:12px;padding:2px 8px;box-shadow:0 2px 6px rgba(0,0,0,.15);font-size:12px;color:#fff"><span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:${isCand(d.id) ? '#7c3aed' : colorFor(d)}"></span><span>${label}</span>${badge}</div>`
          const icon = (window as any).L?.divIcon ? (window as any).L.divIcon({ html, className: '', iconSize: [1, 1] }) : undefined
          return (
            <Marker key={d.id} position={[d.current_lat as number, d.current_lng as number]} {...({ icon } as any)}>
              <Popup>
                <div style={{ fontSize: 12 }}>
                  <div><strong>{d.name || d.phone}</strong></div>
                  <div>{d.plate_number || '未提供'} {d.car_model || ''} {d.car_color || ''}</div>
                  <div className="mt-2">
                    <button onClick={() => onAssign(d.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">指派此司機</button>
                  </div>
                  <div>最後上線：{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString('zh-TW') : '無'}</div>
                </div>
              </Popup>
            </Marker>
          )
        })}
    </MapContainer>
  )
}
