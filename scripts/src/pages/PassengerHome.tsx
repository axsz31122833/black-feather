import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { useTripStore } from '../stores/trips'
import { estimateTripPrice, getRouteWithFallbacks, initGoogleMaps, createMap, geocodeAddress as gGeocode, reverseGeocode as gReverseGeocode } from '../utils/maps'
import { calculateFare, fareBreakdown } from '../utils/fare'
import RideLeafletMap from '../components/RideLeafletMap'
import { env } from '../config/env'
import { recordPayment } from '../utils/payments'
import { supabase, ensureAuth } from '../lib/supabaseClient'
import { MapPin, Search, Car, Clock, DollarSign, Navigation, Menu, User } from 'lucide-react'
import TripChat from '../components/TripChat'

interface CarType {
  id: 'economy' | 'comfort' | 'business'
  name: string
  price: number
  estimatedTime: string
  icon: React.ComponentType<any>
}

export default function PassengerHome() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const { createTrip, currentTrip, getCurrentTrip, subscribeToDriverLocation, driverLocation, processTripPayment } = useTripStore()
  
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedCarType, setSelectedCarType] = useState<'economy' | 'comfort' | 'business'>('economy')
  const [estimatedPrice, setEstimatedPrice] = useState(0)
  const [fareDetail, setFareDetail] = useState<{ distanceFee: number; timeFee: number; longFee: number; storeFee?: number } | null>(null)
  const [isStoreOrder, setIsStoreOrder] = useState(false)
  const [isLongTrip, setIsLongTrip] = useState(false)
  const [estimatedTime, setEstimatedTime] = useState('')
  const [distance, setDistance] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{ name: string; location: { lat: number; lng: number } }>>([])
  const [suggestionMarkers, setSuggestionMarkers] = useState<google.maps.Marker[]>([])
  const [routeInfoWindow, setRouteInfoWindow] = useState<google.maps.InfoWindow | null>(null)
  const [routePolyline, setRoutePolyline] = useState<google.maps.Polyline | null>(null)
  const [driverMarker, setDriverMarker] = useState<google.maps.Marker | null>(null)
  const createMarker = (mapInst: any, position: any, options?: any) => {
    return new google.maps.Marker({ position, map: mapInst, draggable: !!options?.gmpDraggable, title: options?.title })
  }
  const removeMarker = (mk: any) => {
    try {
      if (!mk) return
      if (typeof mk.setMap === 'function') mk.setMap(null)
      else mk.map = null
    } catch {}
  }
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [ratingScore, setRatingScore] = useState(5)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [showSupportChat, setShowSupportChat] = useState(false)
  const [supportText, setSupportText] = useState('')
  const [arrivalSeconds, setArrivalSeconds] = useState<number | null>(null)
  const [driverArrivedAt, setDriverArrivedAt] = useState<number | null>(null)
  const [searchInfoModal, setSearchInfoModal] = useState<{ show: boolean; type: 'far' | 'timeout' }>({ show:false, type:'far' })
  const [homeFavorite, setHomeFavorite] = useState<{ address: string; lat: number; lng: number } | null>(null)
  const [workFavorite, setWorkFavorite] = useState<{ address: string; lat: number; lng: number } | null>(null)
  const [surgeMultiplier, setSurgeMultiplier] = useState(1)
  const [rideMode, setRideMode] = useState<'immediate' | 'scheduled'>('immediate')
  const [scheduledTime, setScheduledTime] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledClock, setScheduledClock] = useState('')
  const useGoogle = true
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 25.033, lng: 121.565 })
  const [routePath, setRoutePath] = useState<Array<{ lat: number; lng: number }>>([])
  const [mapSuggestions, setMapSuggestions] = useState<Array<{ name: string; location: { lat: number; lng: number }; etaMin?: number }>>([])
  const [preferHighway, setPreferHighway] = useState(false)
  const [activeField, setActiveField] = useState<'pickup' | 'dropoff'>('pickup')
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null)
  const dropoffMarkerRef = useRef<google.maps.Marker | null>(null)
  const [showHighwayAlert, setShowHighwayAlert] = useState(false)
  const [placePredPickup, setPlacePredPickup] = useState<Array<{ description: string; place_id: string }>>([])
  const [placePredDrop, setPlacePredDrop] = useState<Array<{ description: string; place_id: string }>>([])
  const placesSvcRef = useRef<any>(null)
  const autoSvcRef = useRef<any>(null)
  const [qrShopId, setQrShopId] = useState<string | null>(null)
  const [lockPickup, setLockPickup] = useState(false)
  const [noteNoSmoking, setNoteNoSmoking] = useState(false)
  const [notePets, setNotePets] = useState(false)
  const [driverMeta, setDriverMeta] = useState<{ plate?: string; color?: string; model?: string } | null>(null)
  const formatMMSS = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0')
    const s = Math.floor(sec % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }
  const geocodeOSM = async (address: string): Promise<{ lat: number; lng: number }> => {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}`
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } })
    const json = await resp.json()
    const first = json && json[0]
    if (!first) throw new Error('not_found')
    return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) }
  }
  const reverseOSM = async (lat: number, lng: number): Promise<string> => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } })
    const json = await resp.json()
    return json?.display_name || '位置'
  }
  const pickupSuggestionsOSM = async (center: { lat: number; lng: number }, radiusMeters = 400): Promise<Array<{ name: string; location: { lat: number; lng: number } }>> => {
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

  const carTypes: CarType[] = [
    {
      id: 'economy',
      name: '經濟型',
      price: 0,
      estimatedTime: '5-10分鐘',
      icon: Car
    },
    {
      id: 'comfort',
      name: '舒適型',
      price: 0,
      estimatedTime: '3-8分鐘',
      icon: Car
    },
    {
      id: 'business',
      name: '商務型',
      price: 0,
      estimatedTime: '2-5分鐘',
      icon: Car
    }
  ]

  useEffect(() => {
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setCurrentLocation(loc)
          setMapCenter(loc)
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      )
    } catch {}
  }, [])
  const handleLeafletClick = async (lat: number, lng: number) => {
    try {
      const addr = await reverseOSM(lat, lng).catch(()=> '位置')
      if (activeField === 'pickup') {
        setPickupCoords({ lat, lng })
        setPickupAddress(addr)
        if (dropoffCoords) calculateRoute({ lat, lng }, dropoffCoords)
      } else {
        setDropoffCoords({ lat, lng })
        setDropoffAddress(addr)
        if (pickupCoords) calculateRoute(pickupCoords, { lat, lng })
      }
    } catch {}
  }
  useEffect(() => {
    try {
      if (!(window as any).google) return
      autoSvcRef.current = new (window as any).google.maps.places.AutocompleteService()
      placesSvcRef.current = new (window as any).google.maps.places.PlacesService(document.createElement('div'))
    } catch {}
  }, [])
  useEffect(() => {
    const id = setInterval(() => {
      if (!currentTrip || currentTrip.status !== 'requested') return
      const createdMs = new Date(currentTrip.created_at).getTime()
      const elapsedMin = Math.floor((Date.now() - createdMs) / 60000)
      if (elapsedMin >= 7 && elapsedMin < 10) {
        setSearchInfoModal({ show: true, type: 'far' })
      } else if (elapsedMin >= 10) {
        setSearchInfoModal({ show: true, type: 'timeout' })
      }
    }, 30000)
    return () => clearInterval(id)
  }, [currentTrip?.id, currentTrip?.status, currentTrip?.created_at])
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const sid = params.get('shop_id')
      if (sid) {
        setQrShopId(sid)
        ;(async () => {
          try {
            const { data: ms } = await supabase.from('partner_merchants').select('id,name,address,phone').eq('id', sid).limit(1)
            const m = ms && ms[0]
            if (m?.address) {
              const result = await geocodeOSM(m.address)
              setPickupCoords(result)
              setPickupAddress(m.address)
              setIsStoreOrder(true)
              setLockPickup(true)
              if (useGoogle && map) map.setCenter(result as any)
              else setMapCenter(result)
            }
          } catch {}
        })()
      }
    } catch {}
  }, [])

  useEffect(() => {
    const run = async () => {
      if (!autoSvcRef.current || activeField !== 'pickup') return
      const q = pickupAddress.trim()
      if (!q) { setPlacePredPickup([]); return }
      try {
        autoSvcRef.current.getPlacePredictions({ input: q, componentRestrictions: { country: 'tw' } }, (preds: any[]) => {
          setPlacePredPickup((preds || []).map(p => ({ description: p.description, place_id: p.place_id })))
        })
      } catch { setPlacePredPickup([]) }
    }
    const t = setTimeout(run, 200)
    return () => clearTimeout(t)
  }, [pickupAddress, activeField])

  useEffect(() => {
    const run = async () => {
      if (!autoSvcRef.current || activeField !== 'dropoff') return
      const q = dropoffAddress.trim()
      if (!q) { setPlacePredDrop([]); return }
      try {
        autoSvcRef.current.getPlacePredictions({ input: q, componentRestrictions: { country: 'tw' } }, (preds: any[]) => {
          setPlacePredDrop((preds || []).map(p => ({ description: p.description, place_id: p.place_id })))
        })
      } catch { setPlacePredDrop([]) }
    }
    const t = setTimeout(run, 200)
    return () => clearTimeout(t)
  }, [dropoffAddress, activeField])

  const selectPlace = async (placeId: string, description: string, field: 'pickup' | 'dropoff') => {
    try {
      if (!placesSvcRef.current) return
      placesSvcRef.current.getDetails({ placeId, fields: ['geometry','formatted_address','name'] }, async (res: any) => {
        try {
          const loc = res?.geometry?.location
          if (loc) {
            const coords = { lat: loc.lat(), lng: loc.lng() }
            if (field === 'pickup') {
              setPickupAddress(res.formatted_address || description)
              setPickupCoords(coords)
              setPlacePredPickup([])
              if (dropoffCoords) calculateRoute(coords, dropoffCoords)
            } else {
              setDropoffAddress(res.formatted_address || description)
              setDropoffCoords(coords)
              setPlacePredDrop([])
              if (pickupCoords) calculateRoute(pickupCoords, coords)
            }
            if (useGoogle && map) map.setCenter(coords as any)
            else setMapCenter(coords)
          }
        } catch {}
      })
    } catch {}
  }

  useEffect(() => {
    if (user) {
      getCurrentTrip(user.id, 'passenger')
    }
  }, [user])

  useEffect(() => {
    if (currentTrip && currentTrip.status === 'accepted') {
      const unsubscribe = subscribeToDriverLocation(currentTrip.id)
      return unsubscribe
    }
  }, [currentTrip])
  useEffect(() => {
    try {
      const ch = supabase
        .channel('passenger-events')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_events' }, (payload: any) => {
          const ev = payload.new
          if (!ev) return
          if (ev.ref_id === currentTrip?.id && ev.event_type === 'driver_arrived') {
            setDriverArrivedAt(Date.now())
          }
          if (ev.ref_id === currentTrip?.id && ev.event_type === 'chat') {
            // TripChat component will reflect realtime; no-op here
          }
        })
        .subscribe()
      return () => { ch.unsubscribe() }
    } catch {}
  }, [currentTrip?.id])

  useEffect(() => {
    initializeMap()
  }, [])

  useEffect(() => {
    try {
      const h = localStorage.getItem('bf_fav_home')
      const w = localStorage.getItem('bf_fav_work')
      if (h) {
        const p = JSON.parse(h)
        setHomeFavorite(p)
      }
      if (w) {
        const p = JSON.parse(w)
        setWorkFavorite(p)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (currentTrip && map) {
      displayTripRoute()
    }
  }, [currentTrip, map])
  useEffect(() => {
    ;(async () => {
      try {
        if (!currentTrip?.driver_id) { setDriverMeta(null); return }
        const { data } = await supabase.from('driver_profiles').select('plate_number,car_color,car_model').eq('user_id', currentTrip.driver_id).limit(1)
        const d = data?.[0] || null
        setDriverMeta(d ? { plate: d.plate_number, color: d.car_color, model: d.car_model } : null)
      } catch { setDriverMeta(null) }
    })()
  }, [currentTrip?.driver_id])

  useEffect(() => {
    if (driverLocation && map && currentTrip && currentTrip.status === 'accepted') {
      // Update driver location marker
      try {
        if (driverMarker) {
          if (typeof (driverMarker as any).setPosition === 'function') (driverMarker as any).setPosition(driverLocation as any)
          else (driverMarker as any).position = driverLocation as any
        } else {
          const mk: any = new google.maps.Marker({ position: driverLocation as any, map, title: '司機位置' })
          setDriverMarker(mk)
        }
      } catch {}
      if (pickupCoords) {
        const toRad = (v: number) => (v * Math.PI) / 180
        const R = 6371
        const dLat = toRad(pickupCoords.lat - driverLocation.lat)
        const dLng = toRad(pickupCoords.lng - driverLocation.lng)
        const sa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(driverLocation.lat)) * Math.cos(toRad(pickupCoords.lat)) * Math.sin(dLng / 2) ** 2
        const c = 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa))
        const distKm = R * c
        const speedKmh = 30
        const etaSec = Math.max(30, Math.round((distKm / speedKmh) * 3600))
        setArrivalSeconds(etaSec)
        try {
          (async () => {
            const r = await getRouteWithFallbacks(driverLocation, pickupCoords)
            setArrivalSeconds(r.durationMin * 60)
          })()
        } catch {}
        try {
          if (useGoogle) {
            const svc = new (google.maps as any).DistanceMatrixService()
            svc.getDistanceMatrix(
              { origins: [driverLocation as any], destinations: [pickupCoords as any], travelMode: 'DRIVING' },
              (res: any) => {
                const elem = res?.rows?.[0]?.elements?.[0]
                const sec = elem?.duration?.value || null
                if (sec) setArrivalSeconds(sec)
              }
            )
          }
        } catch {}
      }
    }
  }, [driverLocation, map, currentTrip, driverMarker])

  useEffect(() => {
    if (arrivalSeconds == null) return
    const timer = setInterval(() => {
      setArrivalSeconds(prev => {
        if (prev == null) return prev
        return prev > 0 ? prev - 1 : 0
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [arrivalSeconds])

  useEffect(() => {
    if (arrivalSeconds == null) return
    if (arrivalSeconds > 600) setSurgeMultiplier(1.5)
    else if (arrivalSeconds > 300) setSurgeMultiplier(1.2)
    else setSurgeMultiplier(1.0)
  }, [arrivalSeconds])

  const initializeMap = async () => {
    try {
      if (useGoogle) {
        await initGoogleMaps()
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const coords = { lat: position.coords.latitude, lng: position.coords.longitude }
            setCurrentLocation(coords)
            if (mapRef.current) {
              const mapInstance = await createMap(mapRef.current, { center: coords, zoom: 15 })
              setMap(mapInstance)
              new google.maps.Marker({ position: coords as any, map: mapInstance, title: '您的位置' })
              gReverseGeocode(coords.lat, coords.lng).then(address => {
                setPickupAddress(address)
                setPickupCoords(coords)
              })
              try { (google.maps as any).event.trigger(mapInstance, 'resize') } catch {}
              setTimeout(() => { try { (google.maps as any).event.trigger(mapInstance, 'resize') } catch {} }, 300)
              const onResize = () => { try { (google.maps as any).event.trigger(mapInstance, 'resize') } catch {} }
              window.addEventListener('resize', onResize)
              setTimeout(() => { window.removeEventListener('resize', onResize) }, 60000)
              try {
                const bounds = new google.maps.Circle({ center: coords as any, radius: 20000 }).getBounds()
                const pickupEl = document.getElementById('pickup-input')
                if (pickupEl && pickupEl instanceof HTMLInputElement) {
                  const acPickup = new (google.maps as any).places.Autocomplete(pickupEl, { bounds, strictBounds: true })
                  acPickup.addListener('place_changed', () => {
                    const p = acPickup.getPlace()
                    if (p && p.geometry && p.geometry.location) {
                      const loc = { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() }
                      setPickupCoords(loc)
                      setPickupAddress(p.formatted_address || p.name || '')
                      mapInstance.setCenter(loc as any)
                      mapInstance.setZoom(15)
                      if (pickupMarkerRef.current) { (pickupMarkerRef.current as any).map = null }
                      const m = new google.maps.Marker({ position: loc as any, map: mapInstance, draggable: true })
                      m.addListener('dragend', async () => {
                        const pos = m.getPosition()!
                        const addr = await gReverseGeocode(pos.lat(), pos.lng())
                        setPickupCoords({ lat: pos.lat(), lng: pos.lng() })
                        setPickupAddress(addr)
                      })
                      pickupMarkerRef.current = m
                    }
                  })
                }
                const dropEl = document.getElementById('dropoff-input')
                if (dropEl && dropEl instanceof HTMLInputElement) {
                  const acDrop = new (google.maps as any).places.Autocomplete(dropEl, { bounds, strictBounds: true })
                  acDrop.addListener('place_changed', () => {
                    const p = acDrop.getPlace()
                    if (p && p.geometry && p.geometry.location) {
                      const loc = { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() }
                      setDropoffCoords(loc)
                      setDropoffAddress(p.formatted_address || p.name || '')
                      mapInstance.setCenter(loc as any)
                      mapInstance.setZoom(15)
                      if (pickupCoords) calculateRoute(pickupCoords, loc)
                      if (dropoffMarkerRef.current) { (dropoffMarkerRef.current as any).map = null }
                      const m = new google.maps.Marker({ position: loc as any, map: mapInstance, draggable: true })
                      m.addListener('dragend', async () => {
                        const pos = m.getPosition()!
                        const addr = await gReverseGeocode(pos.lat(), pos.lng())
                        setDropoffCoords({ lat: pos.lat(), lng: pos.lng() })
                        setDropoffAddress(addr)
                      })
                      dropoffMarkerRef.current = m
                    }
                  })
                }
                const pickupEl2 = document.getElementById('pickup-input-ux')
                if (pickupEl2 && pickupEl2 instanceof HTMLInputElement) {
                  const acPickup2 = new (google.maps as any).places.Autocomplete(pickupEl2, { bounds, strictBounds: true })
                  acPickup2.addListener('place_changed', () => {
                    const p = acPickup2.getPlace()
                    if (p && p.geometry && p.geometry.location) {
                      const loc = { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() }
                      setPickupCoords(loc)
                      setPickupAddress(p.formatted_address || p.name || '')
                      mapInstance.setCenter(loc as any)
                      mapInstance.setZoom(15)
                      if (pickupMarkerRef.current) { (pickupMarkerRef.current as any).map = null }
                      const m = new google.maps.Marker({ position: loc as any, map: mapInstance, draggable: true })
                      m.addListener('dragend', async () => {
                        const pos = m.getPosition()!
                        const a = await gReverseGeocode(pos.lat(), pos.lng())
                        setPickupCoords({ lat: pos.lat(), lng: pos.lng() })
                        setPickupAddress(a)
                      })
                      pickupMarkerRef.current = m
                    }
                  })
                }
                const dropEl2 = document.getElementById('dropoff-input-ux')
                if (dropEl2 && dropEl2 instanceof HTMLInputElement) {
                  const acDrop2 = new (google.maps as any).places.Autocomplete(dropEl2, { bounds, strictBounds: true })
                  acDrop2.addListener('place_changed', () => {
                    const p = acDrop2.getPlace()
                    if (p && p.geometry && p.geometry.location) {
                      const loc = { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() }
                      setDropoffCoords(loc)
                      setDropoffAddress(p.formatted_address || p.name || '')
                      mapInstance.setCenter(loc as any)
                      mapInstance.setZoom(15)
                      if (pickupCoords) calculateRoute(pickupCoords, loc)
                      if (dropoffMarkerRef.current) { (dropoffMarkerRef.current as any).map = null }
                      const m = new google.maps.Marker({ position: loc as any, map: mapInstance, draggable: true })
                      m.addListener('dragend', async () => {
                        const pos = m.getPosition()!
                        const addr = await gReverseGeocode(pos.lat(), pos.lng())
                        setDropoffCoords({ lat: pos.lat(), lng: pos.lng() })
                        setDropoffAddress(addr)
                      })
                      dropoffMarkerRef.current = m
                    }
                  })
                }
                mapInstance.addListener('click', async (e: any) => {
                  const loc = { lat: e.latLng.lat(), lng: e.latLng.lng() }
                  const addr = await gReverseGeocode(loc.lat, loc.lng)
                  if (activeField === 'pickup') {
                    setPickupCoords(loc)
                    setPickupAddress(addr)
                    if (pickupMarkerRef.current) { (pickupMarkerRef.current as any).map = null }
                    const m = new google.maps.Marker({ position: loc as any, map: mapInstance, draggable: true })
                    m.addListener('dragend', async () => {
                      const pos = m.getPosition()!
                      const a = await gReverseGeocode(pos.lat(), pos.lng())
                      setPickupCoords({ lat: pos.lat(), lng: pos.lng() })
                      setPickupAddress(a)
                    })
                    pickupMarkerRef.current = m
                  } else {
                    setDropoffCoords(loc)
                    setDropoffAddress(addr)
                    if (dropoffMarkerRef.current) { (dropoffMarkerRef.current as any).map = null }
                    const m = new google.maps.Marker({ position: loc as any, map: mapInstance, draggable: true })
                    m.addListener('dragend', async () => {
                      const pos = m.getPosition()!
                      const a = await gReverseGeocode(pos.lat(), pos.lng())
                      setDropoffCoords({ lat: pos.lat(), lng: pos.lng() })
                      setDropoffAddress(a)
                    })
                    dropoffMarkerRef.current = m
                  }
                })
              } catch {}
            }
          },
          async () => {
            const defaultCoords = { lat: 25.033, lng: 121.565 }
            setCurrentLocation(defaultCoords)
            if (mapRef.current) {
              const mapInstance = await createMap(mapRef.current, { center: defaultCoords, zoom: 13 })
              setMap(mapInstance)
              try { (google.maps as any).event.trigger(mapInstance, 'resize') } catch {}
              setTimeout(() => { try { (google.maps as any).event.trigger(mapInstance, 'resize') } catch {} }, 300)
            }
          }
        )
      } else {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const coords = { lat: position.coords.latitude, lng: position.coords.longitude }
            setCurrentLocation(coords)
            setMapCenter(coords)
            try {
              const addr = await reverseOSM(coords.lat, coords.lng)
              setPickupAddress(addr)
              setPickupCoords(coords)
            } catch {}
          },
          async () => {
            const defaultCoords = { lat: 25.033, lng: 121.565 }
            setCurrentLocation(defaultCoords)
            setMapCenter(defaultCoords)
          }
        )
      }
    } catch (error) {
      console.error('Error initializing map:', error)
    }
  }

  const displayTripRoute = async () => {
    try {
      if (!currentTrip) return
      const pickupCoords = currentTrip.pickup_location
      const dropoffCoords = currentTrip.dropoff_location
      const r = await getRouteWithFallbacks(pickupCoords, dropoffCoords)
      setRoutePath(r.path || [])
    } catch (error) {
      console.error('Error displaying trip route:', error)
    }
  }

  const handlePickupSearch = async () => {
    if (!pickupAddress.trim()) return
    
    try {
      const result = useGoogle ? await gGeocode(pickupAddress) : await geocodeOSM(pickupAddress)
      if (result) {
        setPickupCoords(result)
        if (useGoogle && map) {
          map.setCenter(result as any)
          map.setZoom(15)
        } else {
          setMapCenter(result)
        }
        if (dropoffCoords) {
          calculateRoute(result, dropoffCoords)
        }
      }
    } catch (error) {
      console.error('Error searching pickup location:', error)
      alert('找不到該地址，請重新輸入')
    }
  }

  const handleDropoffSearch = async () => {
    if (!dropoffAddress.trim()) return
    
    try {
      const result = useGoogle ? await gGeocode(dropoffAddress) : await geocodeOSM(dropoffAddress)
      if (result) {
        setDropoffCoords(result)
        if (useGoogle && map) {
          map.setCenter(result as any)
          map.setZoom(15)
        } else {
          setMapCenter(result)
        }
        if (pickupCoords) {
          calculateRoute(pickupCoords, result)
        }
      }
    } catch (error) {
      console.error('Error searching dropoff location:', error)
      alert('找不到該地址，請重新輸入')
    }
  }

  const isPeakHour = () => {
    const h = new Date().getHours()
    return (h >= 7 && h <= 9) || (h >= 17 && h <= 20)
  }

  const recommendPickup = async () => {
    if (!pickupCoords) return
    try {
      const list = await pickupSuggestionsOSM(pickupCoords, 500)
      setSuggestions(list)
      // Compute ETA to the entered pickup for each suggestion
      const etas: Record<string, number> = {}
      for (const s of list) {
        try {
          const r = await getRouteWithFallbacks(s.location, pickupCoords)
          etas[`${s.location.lat},${s.location.lng}`] = r.durationMin
        } catch {}
      }
      setMapSuggestions(list.map(s => ({ ...s, etaMin: etas[`${s.location.lat},${s.location.lng}`] })))
    } catch {
      setSuggestions([])
    }
  }

  const useSuggestionAsPickup = async (loc: { lat: number; lng: number }, name?: string) => {
    try {
      setPickupCoords(loc)
      const addr = useGoogle ? await gReverseGeocode(loc.lat, loc.lng).catch(() => name || '推薦集合點') : await reverseOSM(loc.lat, loc.lng).catch(() => name || '推薦集合點')
      setPickupAddress(addr)
      if (useGoogle && map) {
        map.setCenter(loc as any)
        map.setZoom(16)
      } else {
        setMapCenter(loc)
      }
      if (dropoffCoords) calculateRoute(loc, dropoffCoords)
    } catch {}
  }

  const calculateRoute = async (pickup: { lat: number; lng: number }, dropoff: { lat: number; lng: number }) => {
    try {
      const r = await getRouteWithFallbacks(pickup, dropoff)
      const adjKm = preferHighway ? r.distanceKm * 1.1 : r.distanceKm
      let price = calculateFare(r.durationMin, adjKm)
      const bd = fareBreakdown(r.durationMin, adjKm)
      let storeFee = 0
      setIsLongTrip(adjKm > 40)
      try {
        const { data: merch } = await supabase.from('partner_merchants').select('phone').eq('phone', user?.phone || '').limit(1)
        const isStore = !!(merch && merch.length > 0)
        setIsStoreOrder(isStore)
        if (isStore) {
          storeFee = 50
          price = Math.max(100, Math.round((price + storeFee) / 10) * 10)
        }
      } catch {}
      
      setDistance(r.distanceKm)
      setEstimatedTime(`${r.durationMin} 分鐘`)
      setEstimatedPrice(price)
      setFareDetail({ distanceFee: bd.distanceFee, timeFee: bd.timeFee, longFee: bd.longFee, storeFee })
      
      // Update car type prices
      carTypes.forEach(carType => {
        const carPrice = calculateFare(r.durationMin, adjKm)
        carType.price = carPrice
      })
      if (!useGoogle) {
        setRoutePath(r.path || [])
      }
    } catch (error) {
      console.error('Error calculating route:', error)
    }
  }

  const handleCancelTrip = async () => {
    if (!currentTrip || !user) return
    try {
      const waitedMs = driverArrivedAt ? (Date.now() - driverArrivedAt) : 0
      const waitedMin = Math.floor(waitedMs / 60000)
      if (waitedMin >= 5) {
        const ok = window.confirm('司機已等候超過 5 分鐘，取消需支付 $100 取消費。是否確認取消？')
        if (!ok) return
        await supabase.from('trips').update({ status: 'cancelled_with_fee' }).eq('id', currentTrip.id)
        try { await supabase.from('ops_events').insert({ event_type: 'cancelled_with_fee', ref_id: currentTrip.id, payload: { fee: 100 } }) } catch {}
        alert('已取消行程（需支付 $100 取消費）')
      } else {
        const ok = window.confirm('確認取消行程？')
        if (!ok) return
        await supabase.from('trips').update({ status: 'cancelled' }).eq('id', currentTrip.id)
        try { await supabase.from('ops_events').insert({ event_type: 'cancelled', ref_id: currentTrip.id }) } catch {}
        alert('已取消行程')
      }
    } catch {
      alert('取消失敗，請稍後再試')
    }
  }

  const handleBookRide = async () => {
    if (!pickupCoords || !dropoffCoords || !user) return
    
    setIsLoading(true)
    
    try {
      await ensureAuth()
      if (rideMode === 'scheduled') {
        if (!scheduledDate || !scheduledClock) {
          alert('請輸入預約日期與時間')
        } else {
          const whenIso = new Date(`${scheduledDate}T${scheduledClock}:00`).toISOString()
          const whenTs = new Date(`${scheduledDate}T${scheduledClock}:00`).getTime()
          const nowTs = Date.now()
          if (isNaN(whenTs) || whenTs < nowTs + 10 * 60 * 1000) {
            alert('預約時間需至少晚於現在 10 分鐘')
            setIsLoading(false)
            return
          }
          const { error } = await supabase.from('scheduled_rides').insert({
            passenger_id: user.id,
            scheduled_time: whenIso,
            pickup_lat: pickupCoords.lat,
            pickup_lng: pickupCoords.lng,
            dropoff_lat: dropoffCoords.lat,
            dropoff_lng: dropoffCoords.lng,
            status: 'PENDING_PREORDER',
            processed: false
          } as any)
          if (error) throw error
          alert('預約已建立，系統將於預約時間前指派司機')
        }
      } else {
        await createTrip({
          passenger_id: user.id,
          passenger_name: user.email,
          pickup_location: pickupCoords,
          dropoff_location: dropoffCoords,
          pickup_address: pickupAddress,
          dropoff_address: dropoffAddress,
          car_type: selectedCarType,
          estimated_price: estimatedPrice,
          status: 'requested'
        })
        try {
          const { data: latest } = await supabase
            .from('trips')
            .select('id,created_at')
            .eq('passenger_id', user.id)
            .eq('status', 'requested')
            .order('created_at', { ascending: false })
            .limit(1)
          const tripId = (latest && latest[0]?.id) || currentTrip?.id || null
          if (tripId) {
            try {
              const noteText = `禁菸:${noteNoSmoking?'是':'否'}; 攜帶寵物:${notePets?'是':'否'}`
              await supabase.from('trip_status').insert({ trip_id: tripId, status: 'requested', location: pickupCoords as any, notes: noteText })
              try {
                await supabase.from('rides').insert({
                  passenger_id: user.id,
                  pickup_lat: pickupCoords?.lat,
                  pickup_lng: pickupCoords?.lng,
                  dropoff_lat: dropoffCoords?.lat ?? null,
                  dropoff_lng: dropoffCoords?.lng ?? null,
                  status: 'requested',
                  notes: noteText
                } as any)
              } catch {}
            } catch {}
          }
          if (tripId && isLongTrip) {
            try { await supabase.from('ops_events').insert({ event_type: 'long_distance_request', ref_id: tripId, payload: { pickup: pickupCoords, threshold: 40 } }) } catch {}
          }
          if (tripId && qrShopId) {
            try { await supabase.from('ops_events').insert({ event_type: 'shop_order', ref_id: tripId, payload: { merchant_id: qrShopId } }) } catch {}
          }
          const { data: drivers } = await supabase
            .from('drivers')
            .select('id,name,phone,is_online,current_lat,current_lng,status,last_seen_at')
          const within5km = (drivers || []).filter(d => {
            if (!d?.is_online || d?.status === 'on_trip') return false
            if (typeof d?.current_lat !== 'number' || typeof d?.current_lng !== 'number') return false
            const toRad = (v: number) => (v * Math.PI) / 180
            const R = 6371
            const dLat = toRad((pickupCoords as any).lat - d.current_lat)
            const dLng = toRad((pickupCoords as any).lng - d.current_lng)
            const sa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(d.current_lat)) * Math.cos(toRad((pickupCoords as any).lat)) * Math.sin(dLng / 2) ** 2
            const c = 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa))
            const distKm = R * c
            return distKm <= 5
          }).slice(0, 5)
          const expiresAt = new Date(Date.now() + 30000).toISOString()
          for (const d of within5km) {
            try {
              await supabase.from('ops_events').insert({
                event_type: 'dispatch_offer',
                ref_id: tripId,
                payload: {
                  driver_id: d.id,
                  pickup: pickupCoords,
                  dropoff: dropoffCoords,
                  price: estimatedPrice,
                  expires_at: expiresAt
                }
              })
            } catch {}
          }
        } catch {}
        try {
          const distKm = distance
          if (distKm > 30) {
            const { data: latest } = await supabase
              .from('trips')
              .select('id,created_at')
              .eq('passenger_id', user.id)
              .eq('status', 'requested')
              .order('created_at', { ascending: false })
              .limit(1)
            const tripId = (latest && latest[0]?.id) || currentTrip?.id || null
            if (tripId) {
              await supabase.from('ops_events').insert({ event_type: 'long_distance_request', ref_id: tripId, payload: { distance_km: distKm } })
            }
          }
        } catch {}
        alert('叫車成功！正在為您尋找附近的司機...')
      }
    } catch (error) {
      console.error('Error booking ride:', error)
      alert('叫車失敗，請稍後再試')
    } finally {
      setIsLoading(false)
    }
  }

  const saveHome = () => {
    if (!pickupCoords) return
    const fav = { address: pickupAddress, lat: pickupCoords.lat, lng: pickupCoords.lng }
    setHomeFavorite(fav)
    try { localStorage.setItem('bf_fav_home', JSON.stringify(fav)) } catch {}
  }

  const saveWork = () => {
    if (!dropoffCoords) return
    const fav = { address: dropoffAddress, lat: dropoffCoords.lat, lng: dropoffCoords.lng }
    setWorkFavorite(fav)
    try { localStorage.setItem('bf_fav_work', JSON.stringify(fav)) } catch {}
  }

  const useHomeAsPickup = () => {
    if (!homeFavorite) return
    setPickupAddress(homeFavorite.address)
    setPickupCoords({ lat: homeFavorite.lat, lng: homeFavorite.lng })
    if (map) map.setCenter({ lat: homeFavorite.lat, lng: homeFavorite.lng })
  }

  const useWorkAsDropoff = () => {
    if (!workFavorite) return
    setDropoffAddress(workFavorite.address)
    setDropoffCoords({ lat: workFavorite.lat, lng: workFavorite.lng })
    if (map) map.setCenter({ lat: workFavorite.lat, lng: workFavorite.lng })
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/passenger/login')
  }

  const [payMethod] = useState<'cash'>('cash')

  const handlePayment = async () => {
    if (!currentTrip) return
    
    try {
      setIsLoading(true)
      const amount = currentTrip.final_price || currentTrip.estimated_price
      const result = await recordPayment(currentTrip.id, amount, 'cash', 'pending')
      if (result.success) {
        alert('已記錄現金付款（待司機確認）。請於車上或下車時以現金支付給司機。')
        setShowPaymentModal(false)
      } else {
        alert('記錄付款失敗，請稍後再試')
      }
    } catch (error) {
      console.error('Payment error:', error)
      alert('付款處理失敗')
    } finally {
      setIsLoading(false)
    }
  }

  if (currentTrip && ['requested', 'accepted', 'in_progress'].includes(currentTrip.status)) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-4">
        <div className="rounded-2xl p-8 text-center max-w-md" style={{ background:'#2A2A2A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}>
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {currentTrip.status === 'requested' && '正在尋找司機...'}
            {currentTrip.status === 'accepted' && '司機已接單'}
            {currentTrip.status === 'in_progress' && '行程進行中'}
          </h2>
          <p className="text-gray-600 mb-6">
            {currentTrip.status === 'requested' && '請稍候，系統正在為您匹配附近的司機'}
            {currentTrip.status === 'accepted' && '司機正在前往您的上車地點'}
            {currentTrip.status === 'in_progress' && '祝您旅途愉快！'}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/trips')}
              className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              查看行程詳情
            </button>
            {['requested','accepted'].includes(currentTrip.status) && (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full px-6 py-2 rounded-2xl"
                style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}
              >
                取消行程
              </button>
            )}
            <button
              onClick={() => setShowSupportModal(true)}
              className="w-full px-6 py-2 rounded-2xl text-black"
              style={{ backgroundImage: 'linear-gradient(to right, #FFD700, #B8860B)' }}
            >
              聯繫客服
            </button>
            {currentTrip.status === 'completed' && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full bg-green-600 text白 px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
              >
                <span>現金付款</span>
              </button>
            )}
            {currentTrip.status === 'completed' && (
              <button
                onClick={() => setShowRatingModal(true)}
                className="w-full bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2"
              >
                <span>評分（1-5）</span>
              </button>
            )}
          </div>
          <div className="mt-6 text-left">
            {user && currentTrip && <div id="chat-panel"><TripChat tripId={currentTrip.id} userId={user.id} role="passenger" /></div>}
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="rounded-2xl p-6 max-w-sm w-full mx-4" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}>
              <h3 className="text-lg font-semibold mb-4" style={{ color:'#DAA520' }}>付款資訊（現金）</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <span style={{ color:'#9ca3af' }}>行程費用</span>
                  <span className="font-bold" style={{ color:'#DAA520' }}>${currentTrip?.final_price || currentTrip?.estimated_price}</span>
                </div>
                <div className="text-xs" style={{ color:'#9ca3af' }}>
                  請於車上或下車時以現金支付給司機；司機確認後系統將標記付款完成。
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg hover:bg-[#333]"
                  style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}
                >
                  取消
                </button>
                <button
                  onClick={handlePayment}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 rounded-lg disabled:opacity-50"
                  style={{ backgroundImage:'linear-gradient(to right, #22c55e, #16a34a)', color:'#111' }}
                >
                  {isLoading ? '處理中...' : '確認付款'}
                </button>
              </div>
            </div>
          </div>
        )}
        {showRatingModal && currentTrip && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="rounded-2xl p-6 max-w-sm w-full mx-4" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">本次行程評分</h3>
              <div className="mb-4">
                <input type="number" min={1} max={5} value={ratingScore} onChange={e=>setRatingScore(Math.max(1, Math.min(5, parseInt(e.target.value||'5')||5)))} className="w-full px-3 py-2 border border-gray-300 rounded" />
                <div className="text-xs text-gray-600 mt-1">1-5 分</div>
              </div>
              <div className="flex space-x-3">
                <button onClick={()=>setShowRatingModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">取消</button>
                <button
                  onClick={async ()=>{
                    try {
                      await supabase.from('ops_events').insert({ event_type: 'rating', ref_id: currentTrip.id, payload: { driver_id: currentTrip.driver_id, score: ratingScore } })
                      alert('已送出評分，感謝您的回饋')
                      setShowRatingModal(false)
                    } catch { alert('送出失敗') }
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  送出
                </button>
              </div>
            </div>
          </div>
        )}
        {searchInfoModal.show && currentTrip?.status==='requested' && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="rounded-2xl p-6 max-w-sm w-full mx-4" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color:'#DAA520' }}>{searchInfoModal.type==='far' ? '正在為您尋找較遠司機' : '目前該區域司機忙碌中'}</h3>
              <p className="text-sm mb-4" style={{ color:'#9ca3af' }}>{searchInfoModal.type==='far' ? '已擴大搜索範圍，請稍候' : '10 分鐘內無人接單，是否繼續等待或取消訂單？'}</p>
              <div className="flex space-x-3">
                {searchInfoModal.type==='timeout' && (
                  <button
                    onClick={async ()=>{
                      try {
                        const { cancelRide } = await import('../lib/rideApi.js')
                        await cancelRide({ ride_id: currentTrip.id, reason: 'passenger_cancel' })
                        setSearchInfoModal({ show:false, type:'far' })
                        alert('已取消訂單；若司機已接單將收取 NT$100 手續費')
                      } catch { alert('取消失敗') }
                    }}
                    className="flex-1 px-4 py-2 rounded-lg"
                    style={{ backgroundImage:'linear-gradient(to right, #ef4444, #dc2626)', color:'#111' }}
                  >
                    取消訂單
                  </button>
                )}
                <button onClick={()=>setSearchInfoModal({ show:false, type:'far' })} className="flex-1 px-4 py-2 rounded-lg hover:bg-[#333]" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}>繼續等待</button>
              </div>
            </div>
          </div>
        )}
        {showCancelConfirm && currentTrip && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
            <div className="rounded-2xl p-6 max-w-sm w-full mx-4" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}>
              <div className="text-sm mb-3" style={{ color:'#DAA520' }}>
                司機已接單，現在取消將產生 NT$100 手續費
              </div>
              <div className="flex space-x-3">
                <button onClick={()=>setShowCancelConfirm(false)} className="flex-1 px-4 py-2 rounded-lg hover:bg-[#333]" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}>保留行程</button>
                <button
                  onClick={async ()=>{
                    try {
                      const { cancelRide } = await import('../lib/rideApi.js')
                      await cancelRide({ ride_id: currentTrip.id, reason: 'passenger_cancel' })
                      alert('已取消行程，將收取 NT$100 手續費')
                      setShowCancelConfirm(false)
                      navigate('/trips')
                    } catch { alert('取消失敗') }
                  }}
                  className="flex-1 px-4 py-2 rounded-lg"
                  style={{ backgroundImage:'linear-gradient(to right, #ef4444, #dc2626)', color:'#111' }}
                >
                  確認取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
    <div className="h-screen bg-[#1A1A1A] relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-[#1A1A1A] border-b border-[#DAA520]/40 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color:'#DAA520' }}>叫車服務</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/trips')}
              className="hover:text-white"
              style={{ color:'#DAA520' }}
            >
              我的行程
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center space-x-2 hover:text-white"
                style={{ color:'#DAA520' }}
              >
                <User className="w-5 h-5" />
                <span className="text-sm">{user?.email}</span>
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg py-2" style={{ background:'#2A2A2A', border:'1px solid rgba(218,165,32,0.35)' }}>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-[#333]"
                    style={{ color:'#e5e7eb' }}
                  >
                    登出
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      {useGoogle ? (
        <div id="map" ref={mapRef} className="absolute inset-0" />
      ) : (
        <div className="h-full w-full">
          <RideLeafletMap
            center={mapCenter}
            pickup={pickupCoords || undefined}
            dropoff={dropoffCoords || undefined}
            driver={driverLocation || undefined}
            path={routePath}
            suggestions={mapSuggestions}
            onMapClick={handleLeafletClick}
          />
        </div>
      )}
      {/* 搜尋浮層移除，改由底部抽屜呈現 */}
      {/* <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-2xl z-20">
        <div className="rounded-2xl shadow-2xl border border-[#D4AF37]/50 bg-[#1a1a1a] p-4">
          <div className="mb-3">
            <label className="block text-sm text-gray-300 mb-2">🔍 您的位置（上車地點）</label>
              <input
                type="text"
                value={pickupAddress}
                onChange={(e) => setPickupAddress(e.target.value)}
                onFocus={() => setActiveField('pickup')}
                id="pickup-input-ux"
                className="w-full px-3 py-3 border border-[#D4AF37]/50 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                disabled={lockPickup}
                placeholder="例如：台中市西屯區..."
              />
            {placePredPickup.length > 0 && activeField === 'pickup' && (
              <div className="mt-2 rounded-2xl border border-[#D4AF37]/30 bg-[#111] text-white shadow-2xl">
                {placePredPickup.map(p => (
                  <button
                    key={p.place_id}
                    onClick={() => selectPlace(p.place_id, p.description, 'pickup')}
                    className="w-full text-left px-4 py-2 hover:bg-[#1a1a1a]"
                  >
                    {p.description}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2">📍 您要去哪？（目的地點）</label>
            <input
              type="text"
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              onFocus={() => setActiveField('dropoff')}
              id="dropoff-input-ux"
              className="w-full px-3 py-3 border border-[#D4AF37]/50 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="例如：台中火車站..."
            />
            {placePredDrop.length > 0 && activeField === 'dropoff' && (
              <div className="mt-2 rounded-2xl border border-[#D4AF37]/30 bg-[#111] text白 shadow-2xl">
                {placePredDrop.map(p => (
                  <button
                    key={p.place_id}
                    onClick={() => selectPlace(p.place_id, p.description, 'dropoff')}
                    className="w-full text-left px-4 py-2 hover:bg-[#1a1a1a]"
                  >
                    {p.description}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="inline-flex items-center text-sm text-gray-200">
              <input type="checkbox" checked={noteNoSmoking} onChange={e=>setNoteNoSmoking(e.target.checked)} className="mr-2" />
              🚭 禁菸
            </label>
            <label className="inline-flex items-center text-sm text-gray-200">
              <input type="checkbox" checked={notePets} onChange={e=>setNotePets(e.target.checked)} className="mr-2" />
              🐾 攜帶寵物
            </label>
          </div>
        </div>
      </div> */}

      {/* Booking Panel */}
      <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-6 max-h-96 overflow-y-auto z-20 bottom-sheet-elevate" style={{ background:'#2A2A2A', border:'1px solid rgba(218,165,32,0.35)' }}>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">預約行程</h2>
        
        {/* Pickup Location */}
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
          <button
            onClick={() => setRideMode('immediate')}
              className={`px-3 py-2 rounded-2xl ${rideMode==='immediate' ? 'text-black' : 'text-gray-700'}`}
              style={{ backgroundImage: rideMode==='immediate' ? 'linear-gradient(to right, #D4AF37, #B8860B)' : 'none', border: '1px solid rgba(212,175,55,0.3)' }}
            >
              即時行程
            </button>
          <button
            onClick={() => setRideMode('scheduled')}
              className={`px-3 py-2 rounded-2xl ${rideMode==='scheduled' ? 'text-black' : 'text-gray-700'}`}
              style={{ backgroundImage: rideMode==='scheduled' ? 'linear-gradient(to right, #D4AF37, #B8860B)' : 'none', border: '1px solid rgba(212,175,55,0.3)' }}
            >
              預約行程
            </button>
          </div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="w-4 h-4 inline mr-1 text-green-600" />
            上車地點
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              id="pickup-input"
              className="flex-1 px-3 py-2 border border-[#D4AF37]/30 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              disabled={lockPickup}
              placeholder="輸入上車地址"
            />
            <button onClick={()=>saveFavorite('pickup')} className="px-3 rounded-2xl" style={{ border:'1px solid rgba(218,165,32,0.35)', color:'#DAA520' }}>⭐</button>
            <button
              onClick={handlePickupSearch}
              className="px-4 py-2 rounded-2xl text-black transition-colors"
              style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.geolocation.getCurrentPosition(async (pos) => {
                    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                    setPickupCoords(coords)
                    const addr = useGoogle ? await gReverseGeocode(coords.lat, coords.lng) : await reverseOSM(coords.lat, coords.lng)
                    setPickupAddress(addr)
                    if (useGoogle && map) map.setCenter(coords as any)
                    else setMapCenter(coords)
                  })
                } catch {}
              }}
              className="px-4 py-2 rounded-2xl text-black transition-colors"
              style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
            >
              📍 使用當前位置
            </button>
            <button onClick={saveHome} className="px-3 py-2 bg-gray-200 rounded">存為住家</button>
            {homeFavorite && (
              <button onClick={useHomeAsPickup} className="px-3 py-2 bg-gray-200 rounded">住家一鍵設為上車</button>
            )}
            <button onClick={recommendPickup} className="px-3 py-2 bg-purple-600 text-white rounded">推薦集合點</button>
          </div>
          {isPeakHour() && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              高峰時段建議使用安全便利的上車集合點，減少臨停風險
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-xs font-semibold text-gray-700">附近建議集合點：</div>
              {suggestions.map((s, idx) => (
                <div key={`${s.location.lat}-${s.location.lng}-${idx}`} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="text-sm text-gray-800">
                    <div className="font-medium">{s.name}</div>
                    {pickupCoords && <div className="text-xs text-gray-600">距離上車輸入點：約 {((Math.hypot(s.location.lat - pickupCoords.lat, s.location.lng - pickupCoords.lng)) * 111).toFixed(2)} 公里</div>}
                  </div>
                  <button onClick={() => useSuggestionAsPickup(s.location, s.name)} className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">設為上車</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dropoff Location */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="w-4 h-4 inline mr-1 text-red-600" />
            目的地
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              id="dropoff-input"
              className="flex-1 px-3 py-2 border border-[#D4AF37]/30 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="輸入目的地地址"
            />
            <button onClick={()=>saveFavorite('dropoff')} className="px-3 rounded-2xl" style={{ border:'1px solid rgba(218,165,32,0.35)', color:'#DAA520' }}>⭐</button>
            <button
              onClick={handleDropoffSearch}
              className="px-4 py-2 rounded-2xl text-black transition-colors"
              style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
            >
              <Search className="w-5 h-5" />
            </button>
            <button onClick={saveWork} className="px-3 py-2 bg-gray-200 rounded">存為公司</button>
            {workFavorite && (
              <button onClick={useWorkAsDropoff} className="px-3 py-2 bg-gray-200 rounded">公司一鍵設為目的地</button>
            )}
          </div>
        </div>
        {rideMode === 'scheduled' && (
          <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">日期</label>
              <input type="date" value={scheduledDate} onChange={e=>setScheduledDate(e.target.value)} className="w-full px-3 py-2 border border-[#D4AF37]/30 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">時間</label>
              <input type="time" value={scheduledClock} onChange={e=>setScheduledClock(e.target.value)} className="w-full px-3 py-2 border border-[#D4AF37]/30 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent" />
            </div>
          </div>
        )}

        {/* Car Type Selection */}
        {distance > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">選擇車型</label>
            <div className="grid grid-cols-3 gap-3">
              {carTypes.map((carType) => {
                const Icon = carType.icon
                return (
                  <button
                    key={carType.id}
                    onClick={() => setSelectedCarType(carType.id)}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      selectedCarType === carType.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-6 h-6 mx-auto mb-1 text-gray-700" />
                    <div className="text-xs font-medium text-gray-900">{carType.name}</div>
                    <div className="text-xs text-gray-600">{carType.estimatedTime}</div>
                    <div className="text-sm font-bold text-blue-600">${carType.price}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Trip Summary */}
        {distance > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-700 mb-1">單別</div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input type="radio" checked={rideMode==='immediate'} onChange={()=>setRideMode('immediate')} />
                  <span>即時單</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="radio" checked={rideMode==='scheduled'} onChange={()=>setRideMode('scheduled')} />
                  <span>預約單</span>
                </label>
                {rideMode==='scheduled' && (
                  <input type="datetime-local" value={scheduledTime} onChange={e=>setScheduledTime(e.target.value)} className="px-2 py-1 border border-gray-300 rounded" />
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">
                <Navigation className="w-4 h-4 inline mr-1" />
                距離
              </span>
              <span className="font-medium">{distance.toFixed(1)} 公里</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">
                <Clock className="w-4 h-4 inline mr-1" />
                預估時間
              </span>
              <span className="font-medium">{estimatedTime}</span>
            </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              <DollarSign className="w-4 h-4 inline mr-1" />
              預估費用
            </span>
            <span className="font-bold text-lg text-blue-600">${Math.round(estimatedPrice * surgeMultiplier)}</span>
          </div>
          {fareDetail && (
            <div className="mt-2 text-xs text-gray-700">
              <div>里程費：${fareDetail.distanceFee}</div>
              <div>時間費：${fareDetail.timeFee}</div>
              <div>長途費：${fareDetail.longFee}</div>
              {fareDetail.storeFee ? <div>店家加價：${fareDetail.storeFee}</div> : null}
            </div>
          )}
            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={preferHighway}
                  onChange={(e) => {
                    const v = e.target.checked
                    setPreferHighway(v)
                    if (v) setShowHighwayAlert(true)
                    if (pickupCoords && dropoffCoords) calculateRoute(pickupCoords, dropoffCoords)
                  }}
                />
                <span>行經高速/快速道路</span>
              </label>
              {driverArrivedAt && (
                <span className="text-sm">司機已等候 {formatMMSS(((Date.now() - driverArrivedAt) / 1000))}</span>
              )}
            </div>
            {surgeMultiplier > 1 && (
              <div className="mt-1 text-xs text-yellow-700">動態加價 x{surgeMultiplier.toFixed(1)}（依司機供給與抵達時間）</div>
            )}
          {currentTrip && currentTrip.status === 'accepted' && arrivalSeconds != null && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">司機抵達倒數</span>
              <span className="font-medium">{Math.floor(arrivalSeconds / 60)} 分 {arrivalSeconds % 60} 秒</span>
            </div>
          )}
          {currentTrip && currentTrip.status === 'accepted' && (
            <div className="mt-3 rounded-2xl p-3" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)' }}>
              <div className="text-sm font-semibold mb-2" style={{ color:'#DAA520' }}>車輛資訊</div>
              <div className="text-sm" style={{ color:'#e5e7eb' }}>
                車牌：{driverMeta?.plate || '待同步'}　顏色：{driverMeta?.color || '待同步'}　車型：{driverMeta?.model || '待同步'}
              </div>
            </div>
          )}
            {currentTrip && currentTrip.status === 'accepted' && arrivalSeconds != null && arrivalSeconds <= 180 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <div className="text-sm text-yellow-800 font-medium">請在安全的集合點等候司機</div>
                <div className="text-xs text-yellow-700">避免佔用車道，可在路邊臨停區或地標旁等候，司機到達後請注意周邊車流。</div>
              </div>
            )}
          </div>
        )}

        {/* Book Button */}
        <button
          onClick={handleBookRide}
          disabled={!pickupCoords || !dropoffCoords || isLoading}
          className="w-full py-4 px-4 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-bold text-black text-lg"
          style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
        >
          {isLoading ? '預約中...' : '立即叫車'}
        </button>
        {currentTrip && ['requested','accepted'].includes(currentTrip.status) && (
          <button
            onClick={handleCancelTrip}
            className="w-full mt-3 py-3 px-4 rounded-2xl text-black"
            style={{ backgroundImage: 'linear-gradient(to right, #FFD700, #B8860B)' }}
          >
            取消行程
          </button>
        )}
      </div>
      {user && (
        <button
          onClick={() => setShowSupportChat(true)}
          className="fixed bottom-40 right-6 z-30 px-4 py-3 rounded-full"
          style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}
          aria-label="聯繫客服"
        >
          🛎️ 聯繫客服
        </button>
      )}
      {user && currentTrip && (
        <button
          onClick={() => {
            try {
              const el = document.getElementById('chat-panel')
              el?.scrollIntoView({ behavior: 'smooth' })
            } catch {}
          }}
          className="fixed bottom-24 right-6 z-30 px-4 py-3 rounded-full text-black"
          style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
          aria-label="即時聊天"
        >
          💬 即時聊天
        </button>
      )}
    </div>
    {showSupportModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#1a1a1a] border border-[#D4AF37]/30 rounded-2xl p-6 w-full max-w-md text-white">
          <div className="text-lg font-bold mb-2" style={{ color:'#D4AF37' }}>聯繫客服</div>
          <textarea value={supportText} onChange={e=>setSupportText(e.target.value)} className="w-full h-32 px-3 py-2 border border-[#D4AF37]/50 bg-[#0f0f0f] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent" placeholder="請輸入您的問題與需求" />
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={()=>setShowSupportModal(false)} className="px-4 py-2 rounded-2xl border border-[#D4AF37]/30 text-white">取消</button>
            <button onClick={async ()=>{
              if (!user || !supportText.trim()) return
              try {
                await supabase.from('messages').insert({ from_user_id: user.id, role: 'passenger', text: supportText.trim(), created_at: new Date().toISOString() })
                setSupportText('')
                setShowSupportModal(false)
                alert('已送出訊息')
              } catch { alert('送出失敗，稍後重試') }
            }} className="px-4 py-2 rounded-2xl text-black" style={{ backgroundImage: 'linear-gradient(to right, #FFD700, #B8860B)' }}>送出</button>
          </div>
        </div>
      </div>
    )}
    {showHighwayAlert && (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundImage: 'linear-gradient(180deg, #FFD700 0%, #B8860B 100%)', color: '#111' }}>
          <div className="text-lg font-bold mb-2">提醒</div>
          <div className="text-sm mb-4">選擇高速道路可能縮短行程時間，但預估金額將包含里程增加與潛在通行費。</div>
          <div className="flex justify-end space-x-2">
            <button onClick={() => setShowHighwayAlert(false)} className="px-4 py-2 rounded-2xl" style={{ background: '#111', color: '#FFD700' }}>知道了</button>
          </div>
        </div>
      </div>
    )}
    {showSupportChat && user && (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="rounded-2xl p-4 w-full max-w-lg" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold" style={{ color:'#DAA520' }}>客服聊天室（連線管理端）</div>
            <button onClick={()=>setShowSupportChat(false)} className="px-2 py-1 rounded" style={{ background:'#2A2A2A', color:'#e5e7eb' }}>關閉</button>
          </div>
          <div>
            <TripChat tripId={`support_${user.id}`} userId={user.id} role="passenger" />
          </div>
          <div className="mt-2 text-xs" style={{ color:'#9ca3af' }}>
            外派單進行時將自動由管理員與您連線安撫與告知後續安排。
          </div>
        </div>
      </div>
    )}
    </>
  )
}
