// OSM/Nominatim helpers (Leaflet-friendly)
export const geocodeAddress = async (address: string): Promise<{ lat: number; lng: number }> => {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}`
  const resp = await fetch(url, { headers: { 'Accept': 'application/json' } })
  const json = await resp.json()
  if (json && json[0]) return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) }
  throw new Error('not_found')
}

export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
  const resp = await fetch(url, { headers: { 'Accept': 'application/json' } })
  const json = await resp.json()
  return json?.display_name || '位置'
}

// Calculate distance between two points
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Estimate trip price based on distance and car type
export const estimateTripPrice = (
  distanceKm: number,
  carType: 'economy' | 'comfort' | 'business',
  baseFare: number = 35,
  perKmRate: number = 15
): number => {
  // Price calculation based on distance and car type
  const carTypeMultiplier = carType === 'economy' ? 1 : carType === 'comfort' ? 1.5 : 2
  return Math.round(baseFare + (distanceKm * perKmRate * carTypeMultiplier))
}

// Create marker on map
export const createMarker = async () => undefined as any

// Create route between two points
export const createRoute = async (
  origin?: any,
  destination?: any
) => undefined as any

const routeCache: Record<string, { ts: number; distanceKm: number; durationMin: number; source: string }> = {}
let lastGoogleTs = 0

export const getRouteWithFallbacks = async (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ distanceKm: number; durationMin: number; source: 'osrm' | 'heuristic', path?: Array<{ lat: number; lng: number }> }> => {
  const key = `${origin.lat},${origin.lng}-${destination.lat},${destination.lng}`
  const now = Date.now()
  const cached = routeCache[key]
  if (cached && now - cached.ts < 60_000) return { distanceKm: cached.distanceKm, durationMin: cached.durationMin, source: cached.source as any }
  // Try OSRM public API
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&steps=true&annotations=false&alternatives=false&geometries=geojson`
    const resp = await fetch(url)
    const json = await resp.json()
    if (json && json.routes && json.routes[0]) {
      const dKm = (json.routes[0].distance || 0) / 1000
      const dMin = Math.round((json.routes[0].duration || 0) / 60)
      const coords = (json.routes[0].geometry?.coordinates || []).map((c: any) => ({ lng: c[0], lat: c[1] })).map((p: any) => ({ lat: p.lat, lng: p.lng }))
      const res = { distanceKm: dKm, durationMin: dMin, source: 'osrm' as const, path: coords }
      routeCache[key] = { ts: now, ...res }
      return res
    }
  } catch {}
  // Heuristic fallback
  const dKm = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng)
  const dMin = Math.max(1, Math.round((dKm / 30) * 60))
  const res = { distanceKm: dKm, durationMin: dMin, source: 'heuristic' as const, path: [origin, destination] }
  routeCache[key] = { ts: now, ...res }
  return res
}

// Get current location
export const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    )
  })
}

// Recommend safer pickup points near a location
export const getPickupSuggestions = async (
  center: { lat: number; lng: number },
  radiusMeters: number = 400
): Promise<Array<{ name: string; location: { lat: number; lng: number } }>> => {
  const delta = radiusMeters / 111000
  const viewbox = `${center.lng - delta},${center.lat - delta},${center.lng + delta},${center.lat + delta}`
  const keywords = ['entrance', 'store', 'station', 'pickup', 'meeting']
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&bounded=1&viewbox=${viewbox}&q=${encodeURIComponent(keywords.join(' '))}&limit=6`
  try {
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } })
    const json = await resp.json()
    return (json || []).map((r: any) => ({ name: r.display_name || '推薦地點', location: { lat: parseFloat(r.lat), lng: parseFloat(r.lon) } }))
  } catch { return [] }
}

let _gmapsReady: Promise<typeof google> | null = null
export const initGoogleMaps = async (): Promise<void> => {
  if (typeof window !== 'undefined' && (window as any).google?.maps?.places) return
  if (!_gmapsReady) {
    _gmapsReady = (async () => {
      const { Loader } = await import('@googlemaps/js-api-loader')
      const { getMapsKey } = await import('../config/env')
      const apiKey = getMapsKey()
      const loader = new Loader({
        apiKey,
        version: 'weekly',
        libraries: ['places']
      })
      await loader.importLibrary('maps')
      await loader.importLibrary('places')
      return (window as any).google
    })()
  }
  await _gmapsReady
}
export const createMap = async (element?: HTMLElement, options?: google.maps.MapOptions): Promise<google.maps.Map> => {
  await initGoogleMaps()
  return new (window as any).google.maps.Map(element, options)
}

