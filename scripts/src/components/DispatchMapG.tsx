import React from 'react'
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
export default function DispatchMapG({
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
  const divRef = React.useRef<HTMLDivElement>(null)
  const [map, setMap] = React.useState<google.maps.Map | null>(null)
  const [markers, setMarkers] = React.useState<google.maps.Marker[]>([])
  const [circle, setCircle] = React.useState<google.maps.Circle | null>(null)
  const defaultCenter = pickup ? (pickup as any) : ({ lat: 24.147736, lng: 120.673648 } as any)
  const colorFor = (d: Driver) => {
    if (d.is_online && d.status !== 'on_trip') return '#22c55e'
    if (d.status === 'on_trip') return '#ef4444'
    return '#9ca3af'
  }
  const isCand = (id: string) => candidateIds.includes(id)
  React.useEffect(() => {
    ;(async () => {
      try {
        const { loadGoogleMaps } = await import('../lib/googleMaps')
        const { getMapId } = await import('../config/env')
        const g = await loadGoogleMaps()
        if (!divRef.current) return
        const m = new g.maps.Map(divRef.current, {
          center: defaultCenter,
          zoom: 13,
          mapId: getMapId(),
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        })
        setMap(m)
      } catch {}
    })()
    return () => {
      try {
        markers.forEach(mm => mm.setMap(null))
        setMarkers([])
        circle?.setMap(null)
        setCircle(null)
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  React.useEffect(() => {
    try {
      if (!map) return
      const c = center || pickup || null
      if (c) map.setCenter(c as any)
      circle?.setMap(null)
      if (center && radiusKm > 0) {
        const cc = new (window as any).google.maps.Circle({
          center: center as any,
          radius: radiusKm * 1000,
          strokeColor: '#D4AF37',
          strokeOpacity: 0.7,
          fillColor: '#D4AF37',
          fillOpacity: 0.1,
          map
        })
        setCircle(cc)
      }
    } catch {}
  }, [map, center?.lat, center?.lng, radiusKm])
  React.useEffect(() => {
    try {
      if (!map) return
      markers.forEach(mm => { (mm as any).map = null })
      const next: any[] = []
      const add = (pos?: { lat: number; lng: number }, label?: string) => {
        if (!pos) return
        const mk = new (window as any).google.maps.Marker({ position: pos, map, title: label || '' })
        next.push(mk)
      }
      add(pickup || undefined, '上車地點')
      drivers
        .filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
        .slice(0, 50)
        .forEach(d => {
          const mk = new (window as any).google.maps.Marker({
            position: { lat: d.current_lat as number, lng: d.current_lng as number },
            map,
            title: `${d.name || d.phone} ${d.plate_number || ''} ${d.car_model || ''} ${d.car_color || ''}`
          })
          mk.addListener('click', () => {
            try { onAssign(d.id) } catch {}
          })
          next.push(mk)
        })
      setMarkers(next)
    } catch {}
  }, [map, pickup?.lat, pickup?.lng, drivers?.length, candidateIds?.length])
  return <div ref={divRef} style={{ width: '100%', height: '100vh' }} />
}
