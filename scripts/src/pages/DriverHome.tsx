import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { useTripStore } from '../stores/trips'
import RideLeafletMap from '../components/RideLeafletMap'
import { getRouteWithFallbacks } from '../utils/maps'
import { supabase } from '../lib/supabaseClient'
import { MapPin, Navigation, DollarSign, Clock, User, Power, Menu, Car, TrendingUp } from 'lucide-react'
import TripChat from '../components/TripChat'
import { confirmPaymentRPC, recordPayment } from '../utils/payments'
import { sendOpsEvent } from '../utils/ops'
import { env } from '../config/env'
import { sendPush, requestPrebook, storeRoute } from '../lib/rideApi'

export default function DriverHome() {
  const navigate = useNavigate()
  const { user, driverProfile, signOut } = useAuthStore()
  const { currentTrip, updateTripStatus, subscribeToTrips, updateDriverLocation, subscribeToDriverLocation, driverLocation } = useTripStore()
  
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 25.033, lng: 121.565 })
  const [routePath, setRoutePath] = useState<Array<{ lat: number; lng: number }>>([])
  const [isOnline, setIsOnline] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [todayEarnings, setTodayEarnings] = useState(0)
  const [todayTrips, setTodayTrips] = useState(0)
  const [opsOpen, setOpsOpen] = useState(false)
  const [weekly, setWeekly] = useState<{ revenue: number; distance: number }>({ revenue: 0, distance: 0 })
  const [monthly, setMonthly] = useState<{ revenue: number; distance: number }>({ revenue: 0, distance: 0 })
  const [fuelAmount, setFuelAmount] = useState<number>(0)
  const [fuelLiters, setFuelLiters] = useState<number>(0)
  const [scheduledList, setScheduledList] = useState<any[]>([])
  const [postFlowStep, setPostFlowStep] = useState<number>(0)
  const [driverMarker, setDriverMarker] = useState<any>(null)
  const watchIdRef = useRef<number | null>(null)
  const [showAccept, setShowAccept] = useState(false)
  const [nextHint, setNextHint] = useState<string>('')
  const [steps, setSteps] = useState<Array<{ instruction: string; distance: number }>>([])
  const [waitCountdownSec, setWaitCountdownSec] = useState<number>(0)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [supportText, setSupportText] = useState('')
  const [incomingOffer, setIncomingOffer] = useState<any>(null)
  const [offerCountdown, setOfferCountdown] = useState<number>(0)
  const prebookTriggeredRef = useRef(false)
  const [showBidOverlay, setShowBidOverlay] = useState(false)
  const [bidCountdown, setBidCountdown] = useState(0)
  const bidTimerRef = useRef<any>(null)
  const [lockUntil, setLockUntil] = useState<number | null>(null)
  const [adminUntil, setAdminUntil] = useState<number | null>(null)
  const [showSupportChat, setShowSupportChat] = useState(false)
  const [pendingRequestedTrip, setPendingRequestedTrip] = useState<any>(null)
  const [broadcastConnected, setBroadcastConnected] = useState(false)
  const [opsConnected, setOpsConnected] = useState(false)

  useEffect(() => {
    if (user) {
      subscribeToTrips(user.id, 'driver')
    }
  }, [user])
  useEffect(() => {
    try {
      const ch = supabase
        .channel('any')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trips' }, (payload: any) => {
          const nv = payload?.new
          if (nv && nv.status === 'requested') setPendingRequestedTrip(nv)
        })
      ch.subscribe((status: any) => { if (status === 'SUBSCRIBED') setBroadcastConnected(true) })
      return () => { ch.unsubscribe() }
    } catch {}
  }, [])
  useEffect(() => {
    try {
      const ch2 = supabase
        .channel('ops-broadcast')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_events', filter: 'event_type=eq.big_order' }, (_p:any)=>{})
      ch2.subscribe((status:any)=>{ if (status==='SUBSCRIBED') setOpsConnected(true) })
      return () => { ch2.unsubscribe() }
    } catch {}
  }, [])

  useEffect(() => {
    if (currentTrip) {
      const unsubscribe = subscribeToDriverLocation(currentTrip.id)
      return unsubscribe
    }
  }, [currentTrip])

  useEffect(() => {
    initializeMap()
  }, [])

  useEffect(() => {
    try { localStorage.setItem('bf_driver_online', isOnline ? '1' : '0') } catch {}
  }, [isOnline])

  useEffect(() => {
    if (!isOnline) return
    const id = setInterval(async () => {
      try {
        const pos = driverLocation || null
        if (user && pos) {
          try { await supabase.from('driver_profiles').upsert({ user_id: user.id, current_lat: pos.lat, current_lng: pos.lng, last_seen_at: new Date().toISOString() }, { onConflict: 'user_id' } as any) } catch {}
        }
      } catch {}
    }, 30000)
    return () => clearInterval(id)
  }, [isOnline, driverLocation])

  useEffect(() => {
    if (currentTrip) {
      displayTripRoute()
    }
  }, [currentTrip])
  // Auto trigger prebook when distance to dropoff < 2km
  useEffect(() => {
    try {
      const trip = currentTrip
      if (!trip || !driverLocation || !trip.dropoff_location) return
      const toRad = (v: number) => (v * Math.PI) / 180
      const R = 6371
      const dLat = toRad(trip.dropoff_location.lat - (driverLocation as any).lat)
      const dLng = toRad(trip.dropoff_location.lng - (driverLocation as any).lng)
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad((driverLocation as any).lat)) * Math.cos(toRad(trip.dropoff_location.lat)) * Math.sin(dLng/2)**2
      const distKm = 2 * R * Math.asin(Math.sqrt(a))
      if (distKm < 2 && !prebookTriggeredRef.current) {
        prebookTriggeredRef.current = true
        ;(async () => { try { await requestPrebook({ trip_id: trip.id }) } catch {} })()
      }
    } catch {}
  }, [driverLocation?.lat, driverLocation?.lng, currentTrip?.dropoff_location])
  useEffect(() => {
    if (!waitCountdownSec) return
    const t = setInterval(() => {
      setWaitCountdownSec(v => v > 0 ? v - 1 : 0)
    }, 1000)
    return () => clearInterval(t)
  }, [waitCountdownSec])
  useEffect(() => {
    if (!user) return
    const ch = supabase
      .channel('driver-offers')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_events', filter: `event_type=eq.dispatch_offer` }, (payload: any) => {
        const ev = payload.new
        if (ev?.payload?.driver_id === user.id) {
          setIncomingOffer(ev.payload)
          try {
            const exp = new Date(ev.payload.expires_at).getTime()
            const left = Math.max(0, Math.floor((exp - Date.now()) / 1000))
            setOfferCountdown(left || 30)
          } catch { setOfferCountdown(30) }
          try {
            if (document.visibilityState !== 'visible' && Notification.permission === 'granted') {
              const n = new Notification('新訂單', { body: '有新的派單邀請，請回到黑羽車隊頁面處理', tag: 'bf-offer' })
              setTimeout(() => n.close(), 4000)
            }
            try {
              const u = new (window as any).SpeechSynthesisUtterance('新訂單，請儘速接單')
              ;(window as any).speechSynthesis?.speak?.(u)
            } catch {}
          } catch {}
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_events', filter: `event_type=eq.overlay_offer` }, (payload: any) => {
        const ev = payload.new
        if (ev?.payload?.driver_id === user.id) {
          setIncomingOffer(ev.payload)
          try {
            const exp = new Date(ev.payload.expires_at).getTime()
            const left = Math.max(0, Math.floor((exp - Date.now()) / 1000))
            setOfferCountdown(left || 30)
          } catch { setOfferCountdown(30) }
        }
      })
      .subscribe()
    const timer = setInterval(() => {
      setOfferCountdown(v => v > 0 ? v - 1 : 0)
    }, 1000)
    return () => { ch.unsubscribe(); clearInterval(timer) }
  }, [user?.id])
  // Listen for prebook offers → show 10s bid overlay
  useEffect(() => {
    if (!user) return
    const ch = supabase
      .channel('driver-prebook-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_events', filter: 'event_type=eq.prebook_offer' }, (payload: any) => {
        const exp = payload?.new?.payload?.expires_in_sec || 10
        setShowBidOverlay(true)
        setBidCountdown(exp)
        if (bidTimerRef.current) clearInterval(bidTimerRef.current)
        bidTimerRef.current = setInterval(() => {
          setBidCountdown((c) => {
            if (c <= 1) {
              clearInterval(bidTimerRef.current)
              bidTimerRef.current = null
              setShowBidOverlay(false)
              return 0
            }
            return c - 1
          })
        }, 1000)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_events', filter: 'event_type=eq.priority_lock' }, (payload: any) => {
        const p = payload?.new?.payload
        try {
          const lu = p?.lock_until ? new Date(p.lock_until).getTime() : null
          const au = p?.admin_until ? new Date(p.admin_until).getTime() : null
          setLockUntil(lu)
          setAdminUntil(au)
        } catch {}
      })
      .subscribe()
    return () => { ch.unsubscribe(); if (bidTimerRef.current) clearInterval(bidTimerRef.current) }
  }, [user?.id])
  useEffect(() => {
    if (offerCountdown !== 0 || !incomingOffer || !user) return
    ;(async () => {
      setIncomingOffer(null)
      try {
        // 暫停依賴 ops_events 歷史統計的自動離線邏輯
      } catch {}
    })()
  }, [offerCountdown, incomingOffer, user?.id])
  // Store route when trip completed
  useEffect(() => {
    try {
      const trip = currentTrip
      if (!trip || trip.status !== 'completed') return
      const price = (trip as any).final_price || (trip as any).estimated_price || 0
      ;(async () => { try { await storeRoute({ trip_id: trip.id, path: routePath, price }) } catch {} })()
    } catch {}
  }, [currentTrip?.status])
  useEffect(() => {
    if (currentTrip?.status === 'completed') setPostFlowStep(1)
    else setPostFlowStep(0)
  }, [currentTrip?.status])

  const initializeMap = async () => {
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude }
          setMapCenter(coords)
          try { setTimeout(() => { const el = document.getElementById('driver-map'); if (el) window.dispatchEvent(new Event('resize')) }, 300) } catch {}
        },
        () => {
          const defaultCoords = { lat: 25.033, lng: 121.565 }
          setMapCenter(defaultCoords)
          try { setTimeout(() => { const el = document.getElementById('driver-map'); if (el) window.dispatchEvent(new Event('resize')) }, 300) } catch {}
        }
      )
    } catch {}
  }

  const displayTripRoute = async () => {
    if (!currentTrip) return
    try {
      const pickupCoords = currentTrip.pickup_location
      const dropoffCoords = currentTrip.dropoff_location
      const google: any = (window as any).google
      if (google?.maps) {
        const svc = new google.maps.DirectionsService()
        const req = {
          origin: pickupCoords,
          destination: dropoffCoords,
          travelMode: google.maps.TravelMode.DRIVING,
          avoidHighways: false
        }
        const res = await new Promise<any>((resolve, reject) => {
          try {
            svc.route(req, (r: any, status: string) => {
              if (status === 'OK' && r) resolve(r)
              else reject(new Error(status))
            })
          } catch (e) { reject(e) }
        })
        const pts: Array<{ lat: number; lng: number }> = []
        try {
          const legs = res.routes?.[0]?.legs || []
          for (const leg of legs) {
            const steps = leg.steps || []
            for (const st of steps) {
              const path = st.path || []
              for (const p of path) pts.push({ lat: p.lat(), lng: p.lng() })
            }
          }
        } catch {}
        setRoutePath(pts)
        setMapCenter({ lat: (pickupCoords.lat + dropoffCoords.lat) / 2, lng: (pickupCoords.lng + dropoffCoords.lng) / 2 })
      } else {
        const r = await getRouteWithFallbacks(pickupCoords, dropoffCoords)
        setRoutePath(r.path || [])
        setMapCenter({ lat: (pickupCoords.lat + dropoffCoords.lat) / 2, lng: (pickupCoords.lng + dropoffCoords.lng) / 2 })
      }
    } catch {}
  }

  const showRidePath = async () => {
    if (!currentTrip) return
    try {
      alert('軌跡功能暫時停用')
    } catch {}
  }

  const distPointToSegmentMeters = (p: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const toRad = (v: number) => (v * Math.PI) / 180
    const R = 6371000
    // project to plane (approx small distances)
    const ax = toRad(a.lng) * Math.cos(toRad(a.lat)), ay = toRad(a.lat)
    const bx = toRad(b.lng) * Math.cos(toRad(b.lat)), by = toRad(b.lat)
    const px = toRad(p.lng) * Math.cos(toRad(p.lat)), py = toRad(p.lat)
    const vx = bx - ax, vy = by - ay
    const wx = px - ax, wy = py - ay
    const c1 = vx * wx + vy * wy
    const c2 = vx * vx + vy * vy
    const t = c2 > 0 ? Math.max(0, Math.min(1, c1 / c2)) : 0
    const cx = ax + t * vx, cy = ay + t * vy
    const dx = px - cx, dy = py - cy
    const d = Math.sqrt(dx * dx + dy * dy)
    return d * R
  }

  useEffect(() => {
    // Foreground/background location strategy with battery awareness
    let interval: any = null
    const startWatch = (highAccuracy: boolean) => {
      try {
        if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = navigator.geolocation.watchPosition(
          async (pos) => {
            const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
            setMapCenter(coords)
            await updateDriverLocation(currentTrip?.id || '', coords.lat, coords.lng)
            try {
            await sendOpsEvent('driver_location', currentTrip?.id || user?.id, coords)
            } catch {}
            // advance hint if near next step
            if (steps.length > 0) {
              setNextHint(steps[0]?.instruction || '')
            }
            // speak next hint
            try {
              if ('speechSynthesis' in window && nextHint) {
                const u = new SpeechSynthesisUtterance(nextHint.replace(/<[^>]+>/g, ''))
                u.lang = 'zh-TW'
                window.speechSynthesis.cancel()
                window.speechSynthesis.speak(u)
              }
            } catch {}
            // off-route heuristic: if far from path, recompute steps
            try {
              const trip = currentTrip
              if (trip && trip.pickup_location && trip.dropoff_location) {
                let off = 0
                if (steps.length > 1) {
                  for (let i = 1; i < steps.length; i++) {
                    const a = steps[i - 1] as any
                    const b = steps[i] as any
                    if (a.location && b.location) {
                      off = Math.max(off, distPointToSegmentMeters(coords, a.location, b.location))
                    }
                  }
                }
                // threshold 50m
                if (off > 50) {
                  const r = await getRouteWithFallbacks(coords, trip.dropoff_location)
                  setRoutePath(r.path || [])
                }
              }
            } catch {}
          },
          (err) => {},
          { enableHighAccuracy: highAccuracy, maximumAge: highAccuracy ? 1000 : 10000, timeout: highAccuracy ? 3000 : 8000 }
        )
      } catch {}
    }
    const applyStrategy = async () => {
      let highAccuracy = true
      try {
        // Battery API may not be supported
        const navAny = navigator as any
        if (navAny.getBattery) {
          const b = await navAny.getBattery()
          highAccuracy = b.level > 0.2 && !b.saving
        }
      } catch {}
      const hidden = document.hidden
      startWatch(!hidden && highAccuracy)
      if (interval) clearInterval(interval)
      interval = setInterval(async () => {
        // ping less frequently in background
        if (hidden) {
          try {
            await supabase.from('ops_events').insert({ event_type: 'driver_ping', payload: {} })
          } catch {}
        }
      }, hidden ? 60000 : 30000)
    }
    const onVis = () => applyStrategy()
    document.addEventListener('visibilitychange', onVis)
    applyStrategy()
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (interval) clearInterval(interval)
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [currentTrip?.id, driverMarker, steps.length])

  const openOpsReport = async () => {
    if (!user) return
    try {
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - 7)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const toIso = (d: Date) => d.toISOString()
      const { data: weekTrips } = await supabase
        .from('trips')
        .select('final_price, distance_km, created_at')
        .eq('driver_id', user.id)
        .gte('created_at', toIso(startOfWeek))
      const { data: monthTrips } = await supabase
        .from('trips')
        .select('final_price, distance_km, created_at')
        .eq('driver_id', user.id)
        .gte('created_at', toIso(startOfMonth))
      const sumRevenue = (arr: any[]) => (arr || []).reduce((s, t) => s + (t.final_price || 0), 0)
      const sumDistance = (arr: any[]) => (arr || []).reduce((s, t) => s + (t.distance_km || 0), 0)
      setWeekly({ revenue: sumRevenue(weekTrips || []), distance: sumDistance(weekTrips || []) })
      setMonthly({ revenue: sumRevenue(monthTrips || []), distance: sumDistance(monthTrips || []) })
      setOpsOpen(true)
    } catch {}
  }

  const loadScheduled = async () => {
    try {
      const nowIso = new Date().toISOString()
      const { data } = await supabase
        .from('scheduled_rides')
        .select('id, passenger_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, scheduled_time, processed, status')
        .gte('scheduled_time', nowIso)
        .eq('processed', false)
        .order('scheduled_time', { ascending: true })
      setScheduledList(data || [])
    } catch {
      setScheduledList([])
    }
  }

  useEffect(() => {
    loadScheduled()
    const ch = supabase
      .channel('scheduled-rides')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_rides' }, () => loadScheduled())
      .subscribe()
    return () => { ch.unsubscribe() }
  }, [])

  const addFuelLog = async () => {
    if (!user) return
    try {
      await supabase.from('ops_events').insert({
        event_type: 'fuel_log',
        ref_id: user.id,
        payload: { amount: fuelAmount, liters: fuelLiters }
      })
      alert('已記錄加油')
      setFuelAmount(0)
      setFuelLiters(0)
    } catch {}
  }

  const handleToggleOnline = async () => {
    const newOnlineStatus = !isOnline
    setIsOnline(newOnlineStatus)
    
    if (newOnlineStatus && currentTrip) {
      // Start tracking location when online and on a trip
      startLocationTracking()
    } else {
      // Stop tracking when offline
      stopLocationTracking()
    }
    try {
      await supabase.from('ops_events').insert({ event_type: newOnlineStatus ? 'driver_online' : 'driver_offline', payload: {} })
      if (user?.id) {
        await supabase.from('drivers').update({ is_online: newOnlineStatus, status: newOnlineStatus ? 'idle' : 'offline' }).eq('id', user.id)
      }
    } catch {}
  }

  const startLocationTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        
        // Update driver marker on map
        if (driverMarker) {
          driverMarker.setPosition(coords)
        }
        
        // Update driver location in database if on a trip
        if (currentTrip) {
          updateDriverLocation(currentTrip.id, coords.lat, coords.lng)
        }
      },
      (error) => {
        console.error('Error tracking location:', error)
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    )
  }

  const stopLocationTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }

  const handleAcceptTrip = async () => {
    if (!currentTrip || !user) return
    
    try {
      await updateTripStatus(currentTrip.id, 'accepted', user.id)
      // Start location tracking when trip is accepted
      if (isOnline) {
        startLocationTracking()
      }
      openNavigation()
      setShowAccept(false)
    } catch (error) {
      console.error('Error accepting trip:', error)
      alert('接受訂單失敗，請稍後再試')
    }
  }
  const handleDriverCancel = async () => {
    if (!currentTrip) return
    try {
      await updateTripStatus(currentTrip.id, 'cancelled', user?.id || '')
      alert('已取消本次行程')
    } catch {
      alert('取消失敗')
    }
  }
  const handleRejectTrip = async () => {
    if (!currentTrip || !user) return
    try {
      await updateTripStatus(currentTrip.id, 'cancelled', user.id)
      setShowAccept(false)
    } catch (error) {
      console.error('Error rejecting trip:', error)
      alert('拒絕訂單失敗，請稍後再試')
    }
  }
  const openNavigation = () => {
    if (!currentTrip) return
    const dest = currentTrip.pickup_location || currentTrip.dropoff_location
    if (!dest) return
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest.lat},${dest.lng}`
    window.open(url, '_blank')
  }

  const handleStartTrip = async () => {
    if (!currentTrip) return
    
    try {
      await updateTripStatus(currentTrip.id, 'in_progress')
    } catch (error) {
      console.error('Error starting trip:', error)
      alert('開始行程失敗，請稍後再試')
    }
  }

  const handleArrived = async () => {
    if (!currentTrip) return
    try {
      await supabase.from('ops_events').insert({ event_type: 'driver_arrived', ref_id: currentTrip.id })
      try { await supabase.from('trips').update({ arrived_at: new Date().toISOString() }).eq('id', currentTrip.id) } catch {}
      alert('已標記：到達上車地點')
      setWaitCountdownSec(300)
    } catch (error) {
      console.error('Error marking arrived:', error)
      alert('標記到達失敗，請稍後再試')
    }
  }

  const handlePickedUp = async () => {
    if (!currentTrip) return
    try {
      await supabase.from('ops_events').insert({ event_type: 'passenger_picked_up', ref_id: currentTrip.id })
      alert('已標記：乘客上車')
    } catch (error) {
      console.error('Error marking picked up:', error)
      alert('標記上車失敗，請稍後再試')
    }
  }

  const handleCompleteTrip = async () => {
    if (!currentTrip) return
    
    try {
      await updateTripStatus(currentTrip.id, 'completed')
      try {
        const amt = currentTrip.final_price || currentTrip.estimated_price
        await recordPayment(currentTrip.id, amt, 'cash', 'pending')
        try {
          await supabase.from('ops_events').insert({ event_type: 'payment_pending', ref_id: currentTrip.id, payload: { amount: amt } })
        } catch {}
      } catch {}
      // Update earnings
      setTodayEarnings(prev => prev + (currentTrip.final_price || currentTrip.estimated_price))
      setTodayTrips(prev => prev + 1)
      // Stop location tracking when trip is completed
      stopLocationTracking()
      try {
        const passengerId = (currentTrip as any).passenger_id
        let storeAddon = 0
        if (passengerId) {
          const { data: pu } = await supabase.from('users').select('phone').eq('id', passengerId).limit(1)
          const phone = pu && pu[0]?.phone
          if (phone) {
            const { data: merch } = await supabase.from('partner_merchants').select('phone').eq('phone', phone).limit(1)
            if (merch && merch.length > 0) storeAddon = 50
          }
        }
        alert(`請回金 ${20 + storeAddon} 元至車隊街口：904851974`)
        // 首叫獎勵：乘客第一次完成叫車
        if (passengerId) {
          const { data: cntData } = await supabase
            .from('trips')
            .select('id', { count: 'exact' } as any)
            .eq('passenger_id', passengerId)
            .eq('status','completed')
          const count = (cntData as any)?.length != null ? (cntData as any).length : ((cntData as any)?.count ?? 0)
          if (count === 1) {
            const { data: prof } = await supabase.from('profiles').select('recommended_by_phone').eq('user_id', passengerId).limit(1)
            const refPhone = prof && prof[0]?.recommended_by_phone
            if (refPhone) {
              const { data: drv } = await supabase.from('users').select('id').eq('phone', refPhone).eq('user_type','driver').limit(1)
              const driverId = drv && drv[0]?.id
              if (driverId) {
                await supabase.from('driver_rewards').insert({
                  driver_id: driverId,
                  passenger_id: passengerId,
                  trip_id: currentTrip.id,
                  amount: 20,
                  reason: 'first_ride_bonus',
                  created_at: new Date().toISOString()
                } as any)
              } else {
                const { data: shopEv } = await supabase.from('ops_events').select('payload').eq('event_type','shop_order').eq('ref_id', currentTrip.id).limit(1)
                const mid = shopEv && shopEv[0]?.payload?.merchant_id
                if (mid) {
                  await supabase.from('ops_events').insert({ event_type: 'merchant_reward', ref_id: currentTrip.id, payload: { merchant_id: mid, amount: 20 } })
                }
              }
            }
          }
        }
      } catch {}
    } catch (error) {
      console.error('Error completing trip:', error)
      alert('完成行程失敗，請稍後再試')
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/driver/login')
  }

  if (driverProfile && (driverProfile as any).status && (driverProfile as any).status !== 'approved') {
    navigate('/driver/pending')
    return null
  }
  return (
    <div className="h-screen relative" style={{ background:'#121212', color:'#e5e7eb' }}>
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4" style={{ background:'#121212', borderBottom:'1px solid rgba(0,255,255,0.15)' }}>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold" style={{ color:'#00FFFF' }}>司機儀表板</h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/driver/trips')}
                className="hover:opacity-80"
                style={{ color:'#00FFFF' }}
              >
                我的行程
              </button>
              <button
                onClick={() => { try { window.open('mailto:support@blackfeather.com?subject=Driver%20Support','_blank') } catch {} }}
                className="px-3 py-2 rounded-2xl"
                style={{ background:'#00FFFF', color:'#121212', border:'1px solid rgba(0,255,255,0.35)' }}
              >
                聯繫客服
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center space-x-2 hover:opacity-80"
                  style={{ color:'#e5e7eb' }}
                >
                  <User className="w-5 h-5" />
                  <span className="text-sm">{user?.email}</span>
              </button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg py-2" style={{ background:'#1a1a1a', border:'1px solid rgba(0,255,255,0.25)' }}>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-4 py-2 text-sm hover:opacity-80"
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
      <div id="driver-map" style={{ height: '60vh', width: '100vw', position:'relative' }}>
      <RideLeafletMap
        center={mapCenter}
        pickup={currentTrip?.pickup_location || undefined}
        dropoff={currentTrip?.dropoff_location || undefined}
        driver={driverLocation || undefined}
        path={routePath}
        suggestions={[]}
      />
      <div style={{ position:'absolute', inset:0, pointerEvents:'none' }}>
        {/* 簡易推薦點覆蓋（示意熱力） */}
        <div style={{ position:'absolute', left:'30%', top:'40%', width:36, height:36, borderRadius:'50%', background:'rgba(0,255,255,0.15)', border:'1px solid rgba(0,255,255,0.35)' }} />
        <div style={{ position:'absolute', left:'60%', top:'50%', width:28, height:28, borderRadius:'50%', background:'rgba(0,255,255,0.12)', border:'1px solid rgba(0,255,255,0.25)' }} />
        <div style={{ position:'absolute', left:'45%', top:'30%', width:42, height:42, borderRadius:'50%', background:'rgba(0,255,255,0.18)', border:'1px solid rgba(0,255,255,0.35)' }} />
      </div>
      </div>

      {/* Support Chat */}
      {user && (
        <button
          onClick={()=>setShowSupportChat(true)}
          className="fixed bottom-40 right-6 z-30 px-4 py-3 rounded-full"
          style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}
        >
          🛎️ 聯繫客服
        </button>
      )}
      {user && showSupportChat && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="rounded-2xl p-4 w-full max-w-lg" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold" style={{ color:'#DAA520' }}>客服聊天室（連線管理端）</div>
              <button onClick={()=>setShowSupportChat(false)} className="px-2 py-1 rounded" style={{ background:'#2A2A2A', color:'#e5e7eb' }}>關閉</button>
            </div>
            <TripChat tripId={`support_driver_${user.id}`} userId={user.id} role="driver" />
          </div>
        </div>
      )}

      {pendingRequestedTrip && !currentTrip && (
        <div style={{ position:'fixed', top:56, left:12, right:12, zIndex:9999 }}>
          <div className="rounded-2xl p-4" style={{ background:'#111', border:'1px solid rgba(0,255,255,0.25)', color:'#e5e7eb' }}>
            <div className="text-sm mb-1" style={{ color:'#00FFFF' }}>新訂單（全域廣播）</div>
            <div className="text-xs mb-2" style={{ color:'#9ca3af' }}>
              {(pendingRequestedTrip as any).pickup_location?.address || '—'} → {(pendingRequestedTrip as any).dropoff_location?.address || '—'}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={async () => {
                  try {
                    if (!user?.id) return
                    await supabase.from('trips').update({ driver_id: user.id, status: 'accepted' }).eq('id', pendingRequestedTrip.id)
                    setPendingRequestedTrip(null)
                  } catch { alert('接單失敗') }
                }}
                className="px-4 py-2 rounded-2xl bg-green-600 text-white hover:bg-green-700"
              >接單</button>
              <button onClick={()=>setPendingRequestedTrip(null)} className="px-4 py-2 rounded-2xl bg-gray-700 text-white hover:bg-gray-600">忽略</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ position:'fixed', left:12, bottom:12, zIndex:9999, display:'flex', alignItems:'center', gap:12, padding:'6px 10px', borderRadius:10, background:'rgba(0,0,0,0.4)', border:'1px solid rgba(147,197,253,0.4)' }}>
        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:10, height:10, borderRadius:'50%', background: broadcastConnected ? '#10B981' : '#ef4444' }} />
          <span style={{ fontSize:12, color:'#e5e7eb' }}>{broadcastConnected ? 'trips 廣播' : 'trips 未連線'}</span>
        </span>
        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ width:10, height:10, borderRadius:'50%', background: opsConnected ? '#10B981' : '#ef4444' }} />
          <span style={{ fontSize:12, color:'#e5e7eb' }}>{opsConnected ? 'ops 廣播' : 'ops 未連線'}</span>
        </span>
      </div>

      <button
        onClick={handleToggleOnline}
        style={{ position:'fixed', top:12, right:12, zIndex:11000, borderRadius:9999, padding:'10px 14px', boxShadow:'0 6px 20px rgba(0,0,0,0.35)', background: isOnline ? '#10B981' : '#4B5563', color:'#fff' }}
      >
        {isOnline ? '上線中' : '離線'}
      </button>
      {showBidOverlay && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#111', border:'1px solid rgba(212,175,55,0.35)', borderRadius:14, padding:16, width:'92%', maxWidth:460, textAlign:'center' }}>
            <div style={{ color:'#D4AF37', fontSize:20, fontWeight:900, marginBottom:10 }}>預派單搶單倒數</div>
            <div style={{ color:'#e5e7eb', fontSize:48, fontWeight:900, marginBottom:12 }}>{bidCountdown}</div>
            <div style={{ color:'#aaa', fontSize:12, marginBottom:12 }}>附近 5km 內可搶單，倒數結束後自動關閉</div>
            <button
              disabled={lockUntil != null && Date.now() < lockUntil}
              onClick={()=>{ setShowBidOverlay(false) }}
              style={{ padding:'10px 14px', borderRadius:10, border:'1px solid rgba(212,175,55,0.35)', background:'#D4AF37', color:'#111', fontWeight:700, opacity: (lockUntil != null && Date.now() < lockUntil) ? 0.6 : 1 }}
            >搶單</button>
          </div>
        </div>
      )}

        {/* Driver Status Panel */}
        <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl shadow-lg p-6" style={{ background:'#121212', border:'1px solid rgba(0,255,255,0.25)' }}>
        {/* Online Status Toggle */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">接單狀態</h3>
            <p className="text-sm text-gray-600">
              {isOnline ? '正在接收訂單' : '已停止接單'}
            </p>
          </div>
          <button
            onClick={handleToggleOnline}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              isOnline
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
            }`}
          >
            <Power className="w-5 h-5" />
            <span>{isOnline ? '上線中' : '離線'}</span>
          </button>
          <button onClick={handleDriverCancel} className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700">司機取消</button>
        </div>

        {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="rounded-lg p-4" style={{ background:'#0f172a', border:'1px solid rgba(0,255,255,0.15)' }}>
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-5 h-5" style={{ color:'#00FFFF' }} />
                <span className="text-sm font-medium" style={{ color:'#e5e7eb' }}>今日收益</span>
              </div>
              <p className="text-2xl font-bold" style={{ color:'#00FFFF' }}>${todayEarnings}</p>
              <svg width="160" height="40">
                <polyline points="0,30 20,25 40,28 60,20 80,22 100,18 120,24 140,12 160,16" fill="none" stroke="#00FFFF" strokeWidth="2" />
              </svg>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 sm:col-span-2 col-span-1">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-yellow-900">預約單專區</div>
                <button onClick={loadScheduled} className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700">刷新</button>
              </div>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {scheduledList.length > 0 ? scheduledList.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 bg-white rounded border border-yellow-200">
                    <div className="text-sm text-gray-800">
                      <div className="font-medium">{new Date(s.scheduled_time).toLocaleString('zh-TW')}</div>
                      <div className="text-xs text-gray-600">{s.pickup_lat?.toFixed(4)}, {s.pickup_lng?.toFixed(4)} → {s.dropoff_lat?.toFixed(4)}, {s.dropoff_lng?.toFixed(4)}</div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await supabase.from('scheduled_rides').update({ driver_id: user?.id || null }).eq('id', s.id)
                          await supabase.from('ops_events').insert({ event_type: 'scheduled_accept', ref_id: s.id, payload: { driver_id: user?.id || null } })
                          alert('已接下預約單')
                        } catch { alert('操作失敗') }
                      }}
                      className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      接單
                    </button>
                  </div>
                )) : <div className="text-xs text-gray-600">尚無即將到來的預約單</div>}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Car className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-900">今日行程</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{todayTrips}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 sm:col-span-2 col-span-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">運營報表</span>
                </div>
                <button onClick={openOpsReport} className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700">查看</button>
              </div>
              {opsOpen && (
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-800">
                  <div className="rounded p-3 border border-[#DAA520]/30" style={{ background:'#1A1A1A', color:'#e5e7eb' }}>
                    <div className="font-semibold mb-1">週報</div>
                    <div>收入：${weekly.revenue}</div>
                    <div>里程：{weekly.distance.toFixed(1)} km</div>
                  </div>
                  <div className="rounded p-3 border border-[#DAA520]/30" style={{ background:'#1A1A1A', color:'#e5e7eb' }}>
                    <div className="font-semibold mb-1">月報</div>
                    <div>收入：${monthly.revenue}</div>
                    <div>里程：{monthly.distance.toFixed(1)} km</div>
                  </div>
                  <div className="rounded p-3 border border-[#DAA520]/30 col-span-2" style={{ background:'#1A1A1A', color:'#e5e7eb' }}>
                    <div className="font-semibold mb-2">加油記錄</div>
                    <div className="flex items-center space-x-2">
                      <input type="number" value={fuelLiters} onChange={e=>setFuelLiters(parseFloat(e.target.value||'0')||0)} placeholder="公升" className="px-2 py-1 border border-gray-300 rounded w-24" />
                      <input type="number" value={fuelAmount} onChange={e=>setFuelAmount(parseFloat(e.target.value||'0')||0)} placeholder="金額" className="px-2 py-1 border border-gray-300 rounded w-24" />
                      <button onClick={addFuelLog} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">記錄</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        {/* Current Trip */}
        {currentTrip && (
          <div className="rounded-lg p-4 mb-6" style={{ background:'#121212', border:'1px solid rgba(0,255,255,0.15)' }}>
            <h4 className="text-lg font-semibold mb-4" style={{ color:'#e5e7eb' }}>當前訂單</h4>
            {currentTrip?.direct_payment_amount ? (
              <div className="mb-3 px-3 py-2 rounded-2xl" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}>
                直收單：NT${currentTrip.direct_payment_amount}
              </div>
            ) : null}
            
            <div className="space-y-3 mb-4">
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 mt-0.5" style={{ color:'#10B981' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color:'#e5e7eb' }}>上車地點</p>
                  <p className="text-sm" style={{ color:'#9ca3af' }}>{currentTrip.pickup_address}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 mt-0.5" style={{ color:'#EF4444' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color:'#e5e7eb' }}>目的地</p>
                  <p className="text-sm" style={{ color:'#9ca3af' }}>{currentTrip.dropoff_address}</p>
                </div>
              </div>
            </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-4 h-4" style={{ color:'#00FFFF' }} />
              <span className="font-bold" style={{ color:'#e5e7eb' }}>
                ${currentTrip.final_price || currentTrip.estimated_price}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" style={{ color:'#e5e7eb' }} />
              <span className="text-sm" style={{ color:'#9ca3af' }}>
                {currentTrip.distance_km ? `${currentTrip.distance_km.toFixed(1)} 公里` : '計算中...'}
              </span>
            </div>
          </div>
          {nextHint && (
            <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-800">
              路口提示：{nextHint.replace(/<[^>]+>/g, '')}
            </div>
          )}

            {/* Action Buttons */}
            <div className="flex space-x-2 mt-4">
              {waitCountdownSec > 0 && (
                <div className="px-3 py-2 rounded-2xl bg-[#1a1a1a] border border-[#D4AF37]/30 text-white">
                  等候倒數：{Math.floor(waitCountdownSec / 60)} 分 {waitCountdownSec % 60} 秒
                </div>
              )}
              {currentTrip && (
                <>
                  <button
                    onClick={async () => {
                      if (!currentTrip || !user) return
                      try { await supabase.from('ops_events').insert({ event_type: 'chat', ref_id: currentTrip.id, payload: { from: 'driver', text: '我尿急，稍後 3 分鐘' } }) } catch {}
                    }}
                    className="px-3 py-2 rounded-2xl text-black"
                    style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
                  >
                    尿急
                  </button>
                  <button
                    onClick={async () => {
                      if (!currentTrip || !user) return
                      try { await supabase.from('ops_events').insert({ event_type: 'chat', ref_id: currentTrip.id, payload: { from: 'driver', text: '我已抵達上車地點' } }) } catch {}
                    }}
                    className="px-3 py-2 rounded-2xl text-black"
                    style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
                  >
                    已抵達
                  </button>
                </>
              )}
              {incomingOffer && offerCountdown > 0 && (
                <div className="absolute left-0 right-0 bottom-0 z-50">
              <div className="w-full rounded-t-2xl p-6" style={{ background:'#121212', borderTop:'2px solid rgba(0,255,255,0.35)', color: '#e5e7eb' }}>
                <div className="text-xl font-bold mb-1">{incomingOffer?.remain_min != null ? '順風單推薦' : '新訂單'}</div>
                <div className="text-xs mb-3">倒數 {offerCountdown} 秒</div>
                <div className="space-y-2 text-sm">
                  <div>上車：{incomingOffer.pickup?.lat?.toFixed(4)}, {incomingOffer.pickup?.lng?.toFixed(4)}</div>
                  {incomingOffer?.dist_km > 40
                    ? <div>目的地：{incomingOffer.dropoff?.lat?.toFixed(4)}, {incomingOffer.dropoff?.lng?.toFixed(4)}</div>
                    : <div>目的地：接單後解鎖</div>}
                  {incomingOffer?.remain_min != null && (
                    <div>距離您結束當前行程僅剩 {incomingOffer.remain_min} 分鐘，是否接續下一單？</div>
                  )}
                  <div>預估車資：${incomingOffer.price}</div>
                  <div>司機實收（扣佣10%）：${Math.round(incomingOffer.price * 0.9)}</div>
                  {incomingOffer?.dist_km && <div>預計距離：{incomingOffer.dist_km.toFixed(1)} 公里</div>}
                  {incomingOffer?.eta_min && <div>預計前往時間：{incomingOffer.eta_min} 分鐘</div>}
                </div>
                <div className="mt-4 flex justify-between space-x-2">
                  <button
                    onClick={async () => {
                          setIncomingOffer(null)
                          try { await supabase.from('ops_events').insert({ event_type: 'dispatch_reject', payload: { driver_id: user?.id } }) } catch {}
                        }}
                        className="px-4 py-2 rounded-2xl hover:opacity-80" style={{ background: '#374151', color: '#e5e7eb', border:'1px solid rgba(0,255,255,0.25)' }}
                      >
                        拒絕
                      </button>
                      <button
                        onClick={async () => {
                          if (!incomingOffer) return
                          try {
                            const { assignDriver } = await import('../lib/rideApi.js') as any
                            await assignDriver({ ride_id: incomingOffer.trip_id, driver_id: user?.id })
                            try { await supabase.from('drivers').update({ status: incomingOffer?.remain_min != null ? 'busy_overlay' : 'on_trip' }).eq('id', user?.id) } catch {}
                            setIncomingOffer(null)
                          } catch { setIncomingOffer(null) }
                        }}
                        className="flex-1 px-6 py-4 rounded-2xl text-center font-bold hover:opacity-90" style={{ background: '#00FFFF', color: '#121212' }}
                      >
                        點擊接單{incomingOffer?.remain_min != null ? '（疊單）' : ''}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {currentTrip.status === 'requested' && (
                <button
                  onClick={handleAcceptTrip}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  接受訂單
                </button>
              )}
              {currentTrip.status === 'accepted' && (
                <button
                  onClick={handleStartTrip}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  開始行程
                </button>
              )}
            {currentTrip.status === 'accepted' && (
              <button
                onClick={handleArrived}
                className="px-4 py-3 rounded-2xl text-black font-semibold"
                style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
              >
                到達上車地點
              </button>
            )}
              {currentTrip.status === 'accepted' && (
                <button
                  onClick={handlePickedUp}
                  className="px-4 py-2 rounded-2xl text-black"
                  style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
                >
                  乘客上車
                </button>
              )}
              {currentTrip.status === 'accepted' && (
                <button
                  onClick={openNavigation}
                  className="px-4 py-2 rounded-2xl text-black"
                  style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
                >
                  導航至上車地點
                </button>
              )}
              {currentTrip && (
                <button
                  onClick={showRidePath}
                  className="px-4 py-2 rounded-2xl text-black"
                  style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
                >
                  查看行程軌跡
                </button>
              )}
              {currentTrip.status === 'in_progress' && (
                <button
                  onClick={handleCompleteTrip}
                  className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  完成行程
                </button>
              )}
              {currentTrip?.status === 'completed' && (
                <div className="w-full bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  {postFlowStep === 1 && (
                    <div>
                      <div className="text-sm text-yellow-900 mb-2">請向乘客收取現金</div>
                      <div className="text-lg font-bold text-gray-900 mb-3">
                        應收：${currentTrip.final_price || currentTrip.estimated_price}
                      </div>
                      <button
                        onClick={async () => {
                          if (!currentTrip) return
                          const amount = currentTrip.final_price || currentTrip.estimated_price || 0
                          const res = await recordPayment(currentTrip.id, amount, 'cash', 'completed')
                          if (res.success) {
                            try { await supabase.from('ops_events').insert({ event_type: 'cash_collected', ref_id: currentTrip.id, payload: { amount } }) } catch {}
                            setPostFlowStep(2)
                            alert('已記錄收現金')
                          } else {
                            alert(res.error || '記錄失敗')
                          }
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      >
                        已向乘客收現金
                      </button>
                    </div>
                  )}
                  {postFlowStep === 2 && (
                    <div>
                      <div className="text-sm text-yellow-900 mb-2">請匯回 20 元至平台帳戶</div>
                      <div className="text-xs text-gray-700 mb-3">
                        街口帳戶：{env.PLATFORM_JKOPAY_ACCOUNT || '請於管理端查看平台帳戶資訊'}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={async () => {
                            if (!currentTrip) return
                            try {
                              await supabase.from('ops_events').insert({ event_type: 'platform_fee_remitted', ref_id: currentTrip.id, payload: { amount: 20, method: 'jkopay' } })
                              alert('已記錄匯回 20 元')
                            } catch {
                              alert('記錄失敗')
                            }
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          已匯回 20 元
                        </button>
                        <button
                          onClick={async () => {
                            if (!currentTrip) return
                            try { await updateTripStatus(currentTrip.id, 'completed') } catch {}
                            alert('訂單流程完成，等待下一單')
                          }}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          完成訂單
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => navigate('/driver/trips')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                詳情
              </button>
            </div>
            <div className="mt-4">
              {user && currentTrip && <TripChat tripId={currentTrip.id} userId={user.id} role="driver" />}
            </div>
          </div>
        )}

        {/* No Current Trip */}
        {!currentTrip && (
          <div className="text-center py-8">
            <Car className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">尚無訂單</h4>
            <p className="text-gray-600">
              {isOnline ? '請等待新的訂單...' : '請先開啟接單狀態'}
            </p>
          </div>
        )}
      </div>
      {showAccept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">新訂單</h3>
            <div className="space-y-2 text-sm text-gray-700 mb-4">
              <div>上車：{currentTrip?.pickup_address || '計算中...'}</div>
              <div>目的地：{currentTrip?.dropoff_address || '計算中...'}</div>
              <div>預估費用：${currentTrip?.estimated_price || '—'}</div>
            </div>
            <div className="flex space-x-3">
              <button onClick={handleAcceptTrip} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">接受</button>
              <button onClick={handleRejectTrip} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">拒絕</button>
            </div>
          </div>
        </div>
      )}
    </div>
    
  )
}
