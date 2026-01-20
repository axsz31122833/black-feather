import React from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

export default function RideLeafletMap({
  center,
  pickup,
  dropoff,
  driver,
  path,
  suggestions
}: {
  center: { lat: number; lng: number }
  pickup?: { lat: number; lng: number }
  dropoff?: { lat: number; lng: number }
  driver?: { lat: number; lng: number }
  path?: Array<{ lat: number; lng: number }>
  suggestions?: Array<{ name: string; location: { lat: number; lng: number }; etaMin?: number }>
}) {
  const polyPoints = (path || []).map(p => [p.lat, p.lng]) as any
  const M: any = MapContainer
  const T: any = TileLayer
  const Mk: any = Marker
  const Pl: any = Polyline
  const Pp: any = Popup
  const carIcon = L.divIcon({ html: '<span style="font-size:18px">🚖</span>' })
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
  return (
    <M center={[center.lat, center.lng]} zoom={13} style={{ width: '100%', height: '100%' }}>
      <MapInvalidator />
      <T url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {pickup && (
        <Mk position={[pickup.lat, pickup.lng]}>
          <Pp>上車地點</Pp>
        </Mk>
      )}
      {dropoff && (
        <Mk position={[dropoff.lat, dropoff.lng]}>
          <Pp>下車地點</Pp>
        </Mk>
      )}
      {driver && (
        <Mk position={[driver.lat, driver.lng]} icon={carIcon}>
          <Pp>司機位置</Pp>
        </Mk>
      )}
      {polyPoints.length > 0 && (
        <Pl positions={polyPoints} pathOptions={{ color: '#2563eb', weight: 4 }} />
      )}
      {(suggestions || []).map((s, i) => (
        <Mk key={i} position={[s.location.lat, s.location.lng]}>
          <Pp>{s.name}{s.etaMin != null ? `｜ETA 約 ${s.etaMin} 分` : ''}</Pp>
        </Mk>
      ))}
    </M>
  )
}
