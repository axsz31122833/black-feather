import React from 'react'

export default function RideLeafletMap({
  center,
  pickup,
  dropoff,
  driver,
  path,
  suggestions,
  onMapClick
}: {
  center: { lat: number; lng: number }
  pickup?: { lat: number; lng: number }
  dropoff?: { lat: number; lng: number }
  driver?: { lat: number; lng: number }
  path?: Array<{ lat: number; lng: number }>
  suggestions?: Array<{ name: string; location: { lat: number; lng: number }; etaMin?: number }>
  onMapClick?: (lat: number, lng: number) => void
}) {
  const divRef = React.useRef<HTMLDivElement>(null)
  const [gmap, setGmap] = React.useState<google.maps.Map | null>(null)
  const [markers, setMarkers] = React.useState<google.maps.Marker[]>([])
  const [polyline, setPolyline] = React.useState<google.maps.Polyline | null>(null)

  React.useEffect(() => {
    let clickListener: google.maps.MapsEventListener | null = null
    ;(async () => {
      try {
        const { initGoogleMaps, createMap } = await import('../utils/maps')
        await initGoogleMaps()
        if (!divRef.current) return
        const map = await createMap(divRef.current, {
          center,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false
        } as any)
        clickListener = map.addListener('click', (ev: any) => {
          try {
            const lat = ev.latLng.lat()
            const lng = ev.latLng.lng()
            onMapClick && onMapClick(lat, lng)
          } catch {}
        })
        setGmap(map)
      } catch {}
    })()
    return () => {
      try {
        markers.forEach(m => m.setMap(null))
        setMarkers([])
        polyline?.setMap(null)
        setPolyline(null)
        clickListener?.remove?.()
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    try {
      if (!gmap) return
      gmap.setCenter(center as any)
    } catch {}
  }, [center.lat, center.lng, gmap])

  React.useEffect(() => {
    try {
      if (!gmap) return
      markers.forEach(m => { (m as any).map = null })
      const nextMarkers: any[] = []
      const add = (pos?: { lat: number; lng: number }, label?: string, emoji?: string) => {
        if (!pos) return
        const m = new (window as any).google.maps.Marker({
          position: pos,
          map: gmap,
          title: label || ''
        })
        nextMarkers.push(m)
      }
      add(pickup, '上車地點', '🅿️')
      add(dropoff, '下車地點', '🏁')
      add(driver, '司機位置', '🚖')
      for (const s of (suggestions || [])) add(s.location, s.name)
      setMarkers(nextMarkers)
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gmap, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, driver?.lat, driver?.lng, suggestions?.length])

  React.useEffect(() => {
    try {
      if (!gmap) return
      polyline?.setMap(null)
      if (path && path.length > 0) {
        const pl = new (window as any).google.maps.Polyline({
          path,
          strokeColor: '#2563eb',
          strokeOpacity: 1,
          strokeWeight: 4,
          map: gmap
        })
        setPolyline(pl)
        const bounds = new (window as any).google.maps.LatLngBounds()
        path.forEach(p => bounds.extend(p as any))
        if (pickup) bounds.extend(pickup as any)
        if (dropoff) bounds.extend(dropoff as any)
        gmap.fitBounds(bounds, 40)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gmap, path?.length])

  return <div ref={divRef} style={{ width: '100%', height: '100vh' }} />
}
