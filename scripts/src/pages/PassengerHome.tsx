import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { useTripStore } from '../stores/trips'
import { initGoogleMaps, createMap, geocodeAddress, reverseGeocode, createRoute, estimateTripPrice, getPickupSuggestions, getRouteWithFallbacks } from '../utils/maps'
import { recordPayment } from '../utils/payments'
import { supabase } from '../lib/supabase'
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
  const [estimatedTime, setEstimatedTime] = useState('')
  const [distance, setDistance] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{ name: string; location: { lat: number; lng: number } }>>([])
  const [suggestionMarkers, setSuggestionMarkers] = useState<google.maps.Marker[]>([])
  const [routeInfoWindow, setRouteInfoWindow] = useState<google.maps.InfoWindow | null>(null)
  const [routePolyline, setRoutePolyline] = useState<google.maps.Polyline | null>(null)
  const [driverMarker, setDriverMarker] = useState<google.maps.Marker | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [arrivalSeconds, setArrivalSeconds] = useState<number | null>(null)
  const [homeFavorite, setHomeFavorite] = useState<{ address: string; lat: number; lng: number } | null>(null)
  const [workFavorite, setWorkFavorite] = useState<{ address: string; lat: number; lng: number } | null>(null)
  const [surgeMultiplier, setSurgeMultiplier] = useState(1)
  const [rideMode, setRideMode] = useState<'immediate' | 'scheduled'>('immediate')
  const [scheduledTime, setScheduledTime] = useState('')

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
    if (driverLocation && map && currentTrip && currentTrip.status === 'accepted') {
      // Update driver location marker
      if (driverMarker) {
        driverMarker.setPosition(driverLocation)
      } else {
        const marker = new google.maps.Marker({
          position: driverLocation,
          map,
          title: '司機位置',
          icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
          }
        })
        setDriverMarker(marker)
      }
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
      await initGoogleMaps()
      
      // Get current location
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          setCurrentLocation(coords)
          
          if (mapRef.current) {
            const mapInstance = await createMap(mapRef.current, {
              center: coords,
              zoom: 15
            })
            setMap(mapInstance)
            
            // Add current location marker
            new google.maps.Marker({
              position: coords,
              map: mapInstance,
              title: '您的位置',
              icon: {
                url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
              }
            })
            
            // Get address for current location
            reverseGeocode(coords.lat, coords.lng).then(address => {
              setPickupAddress(address)
              setPickupCoords(coords)
            })
          }
        },
        async (error) => {
          console.error('Error getting location:', error)
          // Default to Taipei
          const defaultCoords = { lat: 25.0330, lng: 121.5654 }
          setCurrentLocation(defaultCoords)
          if (mapRef.current) {
            const mapInstance = await createMap(mapRef.current, {
              center: defaultCoords,
              zoom: 13
            })
            setMap(mapInstance)
          }
        }
      )
    } catch (error) {
      console.error('Error initializing map:', error)
    }
  }

  const displayTripRoute = async () => {
    if (!currentTrip || !map) return
    
    try {
      const pickupCoords = currentTrip.pickup_location
      const dropoffCoords = currentTrip.dropoff_location
      
      // Add pickup marker
      new google.maps.Marker({
        position: pickupCoords,
        map,
        title: '上車地點',
        icon: {
          url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
        }
      })
      
      // Add dropoff marker
      new google.maps.Marker({
        position: dropoffCoords,
        map,
        title: '下車地點',
        icon: {
          url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
        }
      })
      
      // Create route
      const route = await createRoute(pickupCoords, dropoffCoords)
      
      // Draw route on map
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true
      })
      directionsRenderer.setDirections(route.directions)
      
      // Fit map to show both points
      const bounds = new google.maps.LatLngBounds()
      bounds.extend(pickupCoords)
      bounds.extend(dropoffCoords)
      map.fitBounds(bounds)
    } catch (error) {
      console.error('Error displaying trip route:', error)
    }
  }

  const handlePickupSearch = async () => {
    if (!pickupAddress.trim()) return
    
    try {
      const result = await geocodeAddress(pickupAddress)
      if (result) {
        setPickupCoords(result)
        if (map) {
          map.setCenter(result)
          map.setZoom(15)
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
      const result = await geocodeAddress(dropoffAddress)
      if (result) {
        setDropoffCoords(result)
        if (map) {
          map.setCenter(result)
          map.setZoom(15)
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
      const list = await getPickupSuggestions(pickupCoords, 500)
      setSuggestions(list)
      // Compute ETA to the entered pickup for each suggestion
      const etas: Record<string, number> = {}
      for (const s of list) {
        try {
          const r = await getRouteWithFallbacks(s.location, pickupCoords)
          etas[`${s.location.lat},${s.location.lng}`] = r.durationMin
        } catch {}
      }
      // attach popup markers
      if (map) {
        // Clear previous markers
        suggestionMarkers.forEach(m => m.setMap(null))
        const markers: google.maps.Marker[] = []
        list.forEach(s => {
          const marker = new google.maps.Marker({
            position: s.location,
            map,
            title: s.name,
            icon: { url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' }
          })
          const key = `${s.location.lat},${s.location.lng}`
          const etaMin = etas[key]
          const iw = new google.maps.InfoWindow({ content: `${s.name}｜ETA 至輸入上車：約 ${etaMin != null ? etaMin : '—'} 分` })
          marker.addListener('click', () => {
            iw.open(map, marker)
            useSuggestionAsPickup(s.location, s.name)
          })
          markers.push(marker)
        })
        setSuggestionMarkers(markers)
      }
    } catch {
      setSuggestions([])
    }
  }

  const useSuggestionAsPickup = async (loc: { lat: number; lng: number }, name?: string) => {
    try {
      setPickupCoords(loc)
      const addr = await reverseGeocode(loc.lat, loc.lng).catch(() => name || '推薦集合點')
      setPickupAddress(addr)
      if (map) {
        map.setCenter(loc)
        map.setZoom(16)
        new google.maps.Marker({
          position: loc,
          map,
          title: name || '推薦集合點',
          icon: { url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png' }
        })
      }
      if (dropoffCoords) calculateRoute(loc, dropoffCoords)
    } catch {}
  }

  const calculateRoute = async (pickup: { lat: number; lng: number }, dropoff: { lat: number; lng: number }) => {
    try {
      const r = await getRouteWithFallbacks(pickup, dropoff)
      const price = estimateTripPrice(r.distanceKm, selectedCarType)
      
      setDistance(r.distanceKm)
      setEstimatedTime(`${r.durationMin} 分鐘`)
      setEstimatedPrice(price)
      
      // Update car type prices
      carTypes.forEach(carType => {
        const carPrice = estimateTripPrice(r.distanceKm, carType.id)
        carType.price = carPrice
      })
      if (map) {
        const center = { lat: (pickup.lat + dropoff.lat) / 2, lng: (pickup.lng + dropoff.lng) / 2 }
        const content = `距離：約 ${r.distanceKm.toFixed(1)} 公里｜時間：約 ${r.durationMin} 分鐘（${r.source}）`
        if (!routeInfoWindow) {
          const iw = new google.maps.InfoWindow({ content })
          iw.setPosition(center)
          iw.open(map)
          setRouteInfoWindow(iw)
        } else {
          routeInfoWindow.setContent(content)
          routeInfoWindow.setPosition(center)
          routeInfoWindow.open(map)
        }
        if (routePolyline) {
          routePolyline.setMap(null)
          setRoutePolyline(null)
        }
        try {
          const g = await getRouteWithFallbacks(pickup, dropoff)
          const path = g.path || []
          const latlngs = path.map(p => new google.maps.LatLng(p.lat, p.lng))
          const poly = new google.maps.Polyline({
            path: latlngs.length ? latlngs : [new google.maps.LatLng(pickup.lat, pickup.lng), new google.maps.LatLng(dropoff.lat, dropoff.lng)],
            geodesic: true,
            strokeColor: g.source === 'google' ? '#2563eb' : (g.source === 'osrm' ? '#10b981' : '#6b7280'),
            strokeOpacity: 0.8,
            strokeWeight: 4
          })
          poly.setMap(map)
          setRoutePolyline(poly)
        } catch {}
      }
    } catch (error) {
      console.error('Error calculating route:', error)
    }
  }

  const handleBookRide = async () => {
    if (!pickupCoords || !dropoffCoords || !user) return
    
    setIsLoading(true)
    
    try {
      if (rideMode === 'scheduled') {
        if (!scheduledTime) {
          alert('請選擇預約時間')
        } else {
          const whenIso = new Date(scheduledTime).toISOString()
          const whenTs = new Date(scheduledTime).getTime()
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
            status: 'scheduled',
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
    navigate('/login')
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md">
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
            {currentTrip.status === 'completed' && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
              >
                <span>現金付款</span>
              </button>
            )}
          </div>
          <div className="mt-6 text-left">
            {user && currentTrip && <TripChat tripId={currentTrip.id} userId={user.id} role="passenger" />}
          </div>
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">付款資訊（現金）</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">行程費用</span>
                  <span className="font-bold">${currentTrip?.final_price || currentTrip?.estimated_price}</span>
                </div>
                <div className="text-xs text-gray-600">
                  請於車上或下車時以現金支付給司機；司機確認後系統將標記付款完成。
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handlePayment}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {isLoading ? '處理中...' : '確認付款'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-screen bg-gray-100 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white shadow-md p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">叫車服務</h1>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/trips')}
              className="text-blue-600 hover:text-blue-800"
            >
              我的行程
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
              >
                <User className="w-5 h-5" />
                <span className="text-sm">{user?.email}</span>
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2">
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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
      <div ref={mapRef} className="h-full w-full" />

      {/* Booking Panel */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-lg p-6 max-h-96 overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">預約行程</h2>
        
        {/* Pickup Location */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <MapPin className="w-4 h-4 inline mr-1 text-green-600" />
            上車地點
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="輸入上車地址"
            />
            <button
              onClick={handlePickupSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Search className="w-5 h-5" />
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
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="輸入目的地地址"
            />
            <button
              onClick={handleDropoffSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <button onClick={saveWork} className="px-3 py-2 bg-gray-200 rounded">存為公司</button>
            {workFavorite && (
              <button onClick={useWorkAsDropoff} className="px-3 py-2 bg-gray-200 rounded">公司一鍵設為目的地</button>
            )}
          </div>
        </div>

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
            {surgeMultiplier > 1 && (
              <div className="mt-1 text-xs text-yellow-700">動態加價 x{surgeMultiplier.toFixed(1)}（依司機供給與抵達時間）</div>
            )}
            {currentTrip && currentTrip.status === 'accepted' && arrivalSeconds != null && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">司機抵達倒數</span>
                <span className="font-medium">{Math.floor(arrivalSeconds / 60)} 分 {arrivalSeconds % 60} 秒</span>
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
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {isLoading ? '預約中...' : '立即叫車'}
        </button>
      </div>
    </div>
  )
}
