import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { getMapsKey } from '../config/env'

let mapInstance: google.maps.Map | null = null
let geocoderInstance: google.maps.Geocoder | null = null
let placesServiceInstance: google.maps.places.PlacesService | null = null

// Initialize Google Maps API
export const initGoogleMaps = async (): Promise<void> => {
  try {
    setOptions({ 
      key: getMapsKey(),
      libraries: ['places', 'geocoding']
    })
    await importLibrary('core')
  } catch (error) {
    console.error('Failed to load Google Maps API:', error)
    throw error
  }
}

// Initialize map
export const createMap = async (
  element: HTMLElement,
  options: google.maps.MapOptions = {}
): Promise<google.maps.Map> => {
  await initGoogleMaps()
  
  const defaultOptions: google.maps.MapOptions = {
    center: { lat: 25.0330, lng: 121.5654 }, // Taipei
    zoom: 13,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  }

  const { Map } = await importLibrary('maps')
  mapInstance = new Map(element, {
    ...defaultOptions,
    ...options
  })

  return mapInstance
}

// Get geocoder instance
export const getGeocoder = async (): Promise<google.maps.Geocoder> => {
  if (!geocoderInstance) {
    await initGoogleMaps()
    const { Geocoder } = await importLibrary('geocoding')
    geocoderInstance = new Geocoder()
  }
  return geocoderInstance
}

// Get places service instance
export const getPlacesService = async (): Promise<google.maps.places.PlacesService> => {
  if (!placesServiceInstance && mapInstance) {
    await initGoogleMaps()
    const { PlacesService } = await importLibrary('places')
    placesServiceInstance = new PlacesService(mapInstance)
  }
  return placesServiceInstance!
}

// Geocode address to coordinates
export const geocodeAddress = async (address: string): Promise<google.maps.LatLngLiteral> => {
  try {
    const geocoder = await getGeocoder()
    
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location
          resolve({
            lat: location.lat(),
            lng: location.lng()
          })
        } else {
          reject(new Error(`Geocoding failed: ${status}`))
        }
      })
    })
  } catch (error) {
    console.error('Geocoding error:', error)
    throw error
  }
}

// Reverse geocode coordinates to address
export const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const geocoder = await getGeocoder()
    
    return new Promise((resolve, reject) => {
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          resolve(results[0].formatted_address)
        } else {
          reject(new Error(`Reverse geocoding failed: ${status}`))
        }
      })
    })
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    throw error
  }
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
export const createMarker = async (
  position: google.maps.LatLngLiteral,
  title?: string,
  icon?: string | google.maps.Icon
): Promise<google.maps.Marker> => {
  await initGoogleMaps()
  const { Marker } = await importLibrary('marker')
  
  return new Marker({
    position,
    title,
    icon,
    map: mapInstance!
  })
}

// Create route between two points
export const createRoute = async (
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral
): Promise<{
  distance: number
  duration: number
  directions: google.maps.DirectionsResult
}> => {
  await initGoogleMaps()
  const { DirectionsService } = await importLibrary('routes')
  
  const directionsService = new DirectionsService()
  
  return new Promise((resolve, reject) => {
    directionsService.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
      drivingOptions: {
        departureTime: new Date(),
        trafficModel: google.maps.TrafficModel.BEST_GUESS
      }
    }, (result, status) => {
      if (status === 'OK' && result) {
        const route = result.routes[0]
        const leg = route.legs[0]
        resolve({
          distance: leg.distance?.value ? leg.distance.value / 1000 : 0, // Convert to km
          duration: leg.duration?.value ? Math.round(leg.duration.value / 60) : 0, // Convert to minutes
          directions: result
        })
      } else {
        reject(new Error(`Directions request failed: ${status}`))
      }
    })
  })
}

const routeCache: Record<string, { ts: number; distanceKm: number; durationMin: number; source: string }> = {}
let lastGoogleTs = 0

export const getRouteWithFallbacks = async (
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number }
): Promise<{ distanceKm: number; durationMin: number; source: 'google' | 'osrm' | 'heuristic', path?: google.maps.LatLngLiteral[] }> => {
  const key = `${origin.lat},${origin.lng}-${destination.lat},${destination.lng}`
  const now = Date.now()
  const cached = routeCache[key]
  if (cached && now - cached.ts < 60_000) return { distanceKm: cached.distanceKm, durationMin: cached.durationMin, source: cached.source as any }
  // Try Google
  try {
    if (now - lastGoogleTs > 1500) {
      const r = await createRoute(origin, destination)
      lastGoogleTs = now
      const res = { distanceKm: r.distance, durationMin: r.duration, source: 'google' as const }
      routeCache[key] = { ts: now, ...res }
      return res
    }
  } catch {}
  // Try OSRM public API
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&steps=true&annotations=false&alternatives=false&geometries=geojson`
    const resp = await fetch(url)
    const json = await resp.json()
    if (json && json.routes && json.routes[0]) {
      const dKm = (json.routes[0].distance || 0) / 1000
      const dMin = Math.round((json.routes[0].duration || 0) / 60)
      const coords = (json.routes[0].geometry?.coordinates || []).map((c: any) => ({ lng: c[0], lat: c[1] }))
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
  center: google.maps.LatLngLiteral,
  radiusMeters: number = 400
): Promise<Array<{ name: string; location: google.maps.LatLngLiteral; place_id?: string }>> => {
  await initGoogleMaps()
  if (!mapInstance) {
    const dummy = document.createElement('div')
    await createMap(dummy, { center, zoom: 15 })
  }
  const svc = await getPlacesService()
  const request: google.maps.places.PlaceSearchRequest = {
    location: center as any,
    radius: radiusMeters,
    keyword: '上車 集合點 入口 便利商店 捷運站',
    type: 'establishment'
  }
  return new Promise((resolve) => {
    try {
      svc.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const list = results
            .filter(r => !!r.geometry?.location)
            .map(r => ({
              name: r.name || '推薦地點',
              location: { lat: r.geometry!.location!.lat(), lng: r.geometry!.location!.lng() },
              place_id: r.place_id
            }))
            .slice(0, 6)
          resolve(list)
        } else {
          resolve([])
        }
      })
    } catch {
      resolve([])
    }
  })
}

