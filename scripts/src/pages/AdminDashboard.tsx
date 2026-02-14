import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import { supabase, ensureAuth } from '../lib/supabaseClient'
import { assignDriver, runScheduleChecker, sendPush } from '../lib/rideApi'
import { retry } from '../utils/retry'
import { Users, Car, DollarSign, TrendingUp, User, MapPin, Clock, Shield, ArrowLeft, LogOut } from 'lucide-react'
import { getRouteWithFallbacks } from '../utils/maps'
import { lazy, Suspense } from 'react'
const DispatchMap = lazy(() => import('../components/DispatchMapG'))
import DbMigrationsCheck from './components/DbMigrationsCheck'

interface DashboardStats {
  totalUsers: number
  totalTrips: number
  totalRevenue: number
  activeTrips: number
  passengers: number
  drivers: number
  admins: number
}

interface User {
  id: string
  email: string
  phone: string
  user_type: 'passenger' | 'driver' | 'admin'
  status: string
  created_at: string
}

interface Trip {
  id: string
  passenger_id: string
  driver_id: string
  pickup_address: string
  dropoff_address: string
  status: string
  estimated_price: number
  final_price: number
  created_at: string
}

interface Driver {
  id: string
  phone: string
  name: string
  plate_number?: string
  car_model?: string
  car_color?: string
  current_lat?: number
  current_lng?: number
  last_seen_at?: string
  rating?: number
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalTrips: 0,
    totalRevenue: 0,
    activeTrips: 0,
    passengers: 0,
    drivers: 0,
    admins: 0
  })
  const [users, setUsers] = useState<User[]>([])
  const [adminsList, setAdminsList] = useState<User[]>([])
  const [driversUsers, setDriversUsers] = useState<User[]>([])
  const [passengersUsers, setPassengersUsers] = useState<User[]>([])
  const [trips, setTrips] = useState<Trip[]>([])
  const [tripRowsLimit, setTripRowsLimit] = useState(50)
  const [driversList, setDriversList] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'trips' | 'dispatch' | 'ops' | 'addPassenger' | 'addDriver' | 'pricing'>('overview')
  const [dispatchRideId, setDispatchRideId] = useState('')
  const [dispatchRes, setDispatchRes] = useState<any>(null)
  const [radiusKm, setRadiusKm] = useState(5)
  const [radiusCenter, setRadiusCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [rectStart, setRectStart] = useState<{ lat: number; lng: number } | null>(null)
  const [rectEnd, setRectEnd] = useState<{ lat: number; lng: number } | null>(null)
  const [sortMode, setSortMode] = useState<'distance' | 'recent' | 'smart'>('distance')
  const [onlyOnline, setOnlyOnline] = useState(false)
  const [latestEvents, setLatestEvents] = useState<Record<string, { type: string; time: string }>>({})
  const [longDistance, setLongDistance] = useState<Array<{ id: string; distance: number; created_at: string }>>([])
  const [candidatePool, setCandidatePool] = useState<Driver[]>([])
  const [driverRatings, setDriverRatings] = useState<Record<string, number>>({})
  const [etaCache, setEtaCache] = useState<Record<string, number>>({})
  const [weights, setWeights] = useState<{ wDist: number; wEta: number; wRecency: number; wCar: number; wRating: number }>(() => ({ wDist: 0.4, wEta: 0.3, wRecency: 0.2, wCar: 0.05, wRating: 0.05 }))
  const [pendingDrivers, setPendingDrivers] = useState<Array<{ id: string; name?: string; phone?: string }>>([])
  const [requestedTags, setRequestedTags] = useState<Record<string, { noSmoking: boolean; pets: boolean }>>({})
  const [chatLog, setChatLog] = useState<Array<{ id: string; text: string; from: string; time: string; ref?: string }>>([])
  const [broadcastText, setBroadcastText] = useState('')
  const [manualTripId, setManualTripId] = useState<string | null>(null)
  const [manualPlate, setManualPlate] = useState('')
  const [manualModel, setManualModel] = useState('')
  const [manualEta, setManualEta] = useState<number>(0)
  useEffect(() => {
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setRadiusCenter(loc)
        },
        () => {
          const fallback = { lat: 24.147736, lng: 120.673648 }
          setRadiusCenter(fallback)
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 8000 }
      )
    } catch {
      setRadiusCenter({ lat: 24.147736, lng: 120.673648 })
    }
  }, [])
  useEffect(() => {
    const ch = supabase
      .channel('admin-chat-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_events', filter: `event_type=eq.chat` }, (payload: any) => {
        const ev = payload.new
        if (!ev) return
        const txt = (ev.payload?.text || '').toString()
        const from = (ev.payload?.from_role || 'system').toString()
        const time = ev.created_at
        const ref = (ev.ref_id || '')
        setChatLog(prev => [{ id: ev.id, text: txt, from, time, ref }, ...prev].slice(0, 100))
      })
      .subscribe()
    ;(async () => {
      try {
        const { data } = await supabase
          .from('ops_events')
          .select('id,event_type,payload,created_at,ref_id')
          .eq('event_type','chat')
          .order('created_at', { ascending: false })
          .limit(50)
        const rows = (data || []).map((ev: any) => ({
          id: ev.id,
          text: (ev.payload?.text || '').toString(),
          from: (ev.payload?.from_role || 'system').toString(),
          time: ev.created_at,
          ref: (ev.ref_id || ''),
        }))
        setChatLog(rows)
      } catch {}
    })()
    return () => { try { ch.unsubscribe() } catch {} }
  }, [])
  useEffect(() => {
    (async () => {
      try {
        await ensureAuth()
        const { data } = await supabase.from('dispatch_settings').select('weights').eq('id', 'global').single()
        if (data?.weights) {
          setWeights(data.weights)
        } else {
          const s = localStorage.getItem('bf_dispatch_weights')
          if (s) setWeights(JSON.parse(s))
        }
      } catch {
        try {
          const s = localStorage.getItem('bf_dispatch_weights')
          if (s) setWeights(JSON.parse(s))
        } catch {}
      }
    })()
  }, [])
  const geocodeOSM = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}`
    try {
      const resp = await fetch(url, { headers: { 'Accept': 'application/json' } })
      const json = await resp.json()
      const first = json && json[0]
      if (!first) return null
      return { lat: parseFloat(first.lat), lng: parseFloat(first.lon) }
    } catch { return null }
  }
  const [promoteCandidates, setPromoteCandidates] = useState<Array<{ id: string; email: string; phone: string }>>([])
  useEffect(() => {
    (async () => {
      try {
        await ensureAuth()
        const { data: us } = await supabase.from('users').select('id,email,phone,user_type').eq('user_type','passenger').limit(50)
        setPromoteCandidates((us || []).map(u => ({ id: u.id, email: u.email, phone: (u as any).phone || '' })))
      } catch { setPromoteCandidates([]) }
    })()
  }, [])
  useEffect(() => {
    (async () => {
      try {
        const { data: a } = await supabase.from('users').select('*').eq('user_type','admin').limit(200)
        const { data: d } = await supabase.from('users').select('*').eq('user_type','driver').limit(200)
        const { data: p } = await supabase.from('users').select('*').eq('user_type','passenger').limit(200)
        setAdminsList(a || [])
        setDriversUsers(d || [])
        setPassengersUsers(p || [])
      } catch {
        setAdminsList([]); setDriversUsers([]); setPassengersUsers([])
      }
    })()
  }, [])
  useEffect(() => {
    (async () => {
      try {
        await ensureAuth()
        const { data: profs } = await supabase.from('driver_profiles').select('user_id,status').eq('status','pending')
        const ids = (profs || []).map(p => p.user_id)
        if (ids.length > 0) {
          const { data: us } = await supabase.from('users').select('id,name,phone').in('id', ids)
          setPendingDrivers((us || []).map(u=>({ id:u.id, name: u.name as any, phone: u.phone as any })))
        } else {
          setPendingDrivers([])
        }
      } catch { setPendingDrivers([]) }
    })()
  }, [])
  const [autoDispatchEnabled, setAutoDispatchEnabled] = useState(false)
  const [eventTypes, setEventTypes] = useState<string[]>([])
  const [merchants, setMerchants] = useState<Array<{ id: string; name: string; phone: string; address?: string; jkopay?: string }>>([])
  const [merchantStats, setMerchantStats] = useState<Record<string, { monthlyCount: number; monthlyReward: number }>>({})
  const [cashbackTotal, setCashbackTotal] = useState(0)
  useEffect(() => {
    (async () => {
      try {
        const { data: ms } = await supabase.from('partner_merchants').select('id,name,phone,address,jkopay').order('name',{ ascending:true })
        setMerchants(ms || [])
        const thisMonthStart = new Date()
        thisMonthStart.setDate(1); thisMonthStart.setHours(0,0,0,0)
        const startIso = thisMonthStart.toISOString()
        const stats: Record<string, { monthlyCount: number; monthlyReward: number }> = {}
        let cashbackSum = 0
        for (const m of (ms || [])) {
          const { data: tripsData } = await supabase
            .from('trips')
            .select('id,final_price,estimated_price')
            .eq('status','completed')
            .gte('created_at', startIso)
            .eq('passenger_phone', m.phone)
          const count = (tripsData || []).length
          for (const t of (tripsData || [])) {
            const price = (t as any).final_price || (t as any).estimated_price || 0
            cashbackSum += Math.floor(price / 100) * 10 + 20
          }
          stats[m.id] = { monthlyCount: count, monthlyReward: count * 20 }
        }
        setMerchantStats(stats)
        setCashbackTotal(cashbackSum)
      } catch {
        setMerchants([]); setMerchantStats({}); setCashbackTotal(0)
      }
    })()
  }, [])
  const [messages, setMessages] = useState<Array<{ id: string; from_user_id: string; role: string; text: string; reply_text?: string; created_at: string; reply_at?: string }>>([])
  const [priorityLock, setPriorityLock] = useState<{ lockUntil?: number; adminUntil?: number }>({})
  useEffect(() => {
    try {
      const ch = supabase
        .channel('messages-center')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload: any) => {
          const m = payload.new
          if (m) {
            setMessages(prev => {
              const idx = prev.findIndex(x => x.id === m.id)
              if (idx >= 0) {
                const cp = prev.slice()
                cp[idx] = m
                return cp
              }
              return [m, ...prev].slice(0, 200)
            })
          }
        })
        .subscribe()
      ;(async () => {
        const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50)
        setMessages(data || [])
      })()
      return () => { ch.unsubscribe() }
    } catch {}
  }, [])
  useEffect(() => {
    try {
      const ride = trips.find(t => t.id === dispatchRideId) as any
      if (!ride) return
      const a = ride?.pickup_location, b = ride?.dropoff_location
      if (a && b && typeof a.lat==='number' && typeof b.lat==='number') {
        const toRad = (v: number) => (v * Math.PI) / 180
        const R = 6371
        const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
        const h = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2
        const distKm = 2 * R * Math.asin(Math.sqrt(h))
        if (distKm >= 40) {
          ;(async () => { try { await setPriorityLock({ trip_id: dispatchRideId, lock_sec: 15, admin_sec: 90 }) } catch {} })()
        }
      }
    } catch {}
  }, [dispatchRideId])
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [eventsResult, setEventsResult] = useState<any[]>([])
  const [riskTripId, setRiskTripId] = useState('')
  const [userModerationId, setUserModerationId] = useState('')
  const [moderationAction, setModerationAction] = useState<'ban' | 'suspend' | 'activate'>('ban')
  const [alertCounts, setAlertCounts] = useState<{ frontErrors: number; risk: number }>({ frontErrors: 0, risk: 0 })
  const [metrics, setMetrics] = useState<{ avgLoadMs: number; driverPings: number }>({ avgLoadMs: 0, driverPings: 0 })
  const [driverRewards, setDriverRewards] = useState<Record<string, { firstRideCount: number; totalBonus: number }>>({})
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('driver_rewards').select('driver_id,amount').order('created_at',{ ascending:false }).limit(1000)
        const map: Record<string, { firstRideCount: number; totalBonus: number }> = {}
        ;(data || []).forEach((r: any) => {
          const id = r.driver_id
          if (!map[id]) map[id] = { firstRideCount: 0, totalBonus: 0 }
          map[id].firstRideCount += 1
          map[id].totalBonus += Number(r.amount || 0)
        })
        setDriverRewards(map)
      } catch { setDriverRewards({}) }
    })()
  }, [])
  const [longDist, setLongDist] = useState<{ tripId: string; pickup?: { lat: number; lng: number } } | null>(null)
  const [longDistCountdown, setLongDistCountdown] = useState<number>(0)
  useEffect(() => {
    const ch = supabase
      .channel('long-distance')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_events', filter: `event_type=eq.long_distance_request` }, (payload: any) => {
        const ev = payload.new
        if (ev?.ref_id) {
          setLongDist({ tripId: ev.ref_id, pickup: ev.payload?.pickup })
          setLongDistCountdown(90)
        }
      })
      .subscribe()
    const t = setInterval(() => setLongDistCountdown(v => v > 0 ? v - 1 : 0), 1000)
    return () => { ch.unsubscribe(); clearInterval(t) }
  }, [])
  useEffect(() => {
    const broadcast = async () => {
      if (!longDist || longDistCountdown > 0) return
      try {
        const ride = trips.find(t => t.id === longDist.tripId) as any
        const pick = longDist.pickup || ride?.pickup_location
        if (!pick) { setLongDist(null); return }
        const list = (driversList || [])
          .filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
          .map(d => ({ d, dist: haversine(d.current_lat!, d.current_lng!, pick.lat, pick.lng) }))
          .sort((a,b) => a.dist - b.dist)
          .slice(0, 12)
        const price = ride?.estimated_price || 0
        for (const x of list) {
          try {
            await supabase.from('ops_events').insert({
              event_type: 'dispatch_offer',
              ref_id: longDist.tripId,
              payload: {
                driver_id: x.d.id,
                trip_id: longDist.tripId,
                pickup: pick,
                dropoff: ride?.dropoff_location || null,
                dist_km: x.dist,
                price,
                expires_at: new Date(Date.now() + 90_000).toISOString()
              }
            })
          } catch {}
        }
        try { await supabase.from('ops_events').insert({ event_type: 'long_distance_handle', ref_id: longDist.tripId, payload: { mode: 'auto_broadcast' } }) } catch {}
      } finally {
        setLongDist(null)
      }
    }
    broadcast()
  }, [longDistCountdown])
  const [pushUserId, setPushUserId] = useState('')
  const [pushTitle, setPushTitle] = useState('測試推播')
  const [pushBody, setPushBody] = useState('這是一則測試推播訊息')
  const [adminPickupAddress, setAdminPickupAddress] = useState('')
  const [adminDropoffAddress, setAdminDropoffAddress] = useState('')
  useEffect(() => {
    const run = async () => {
      try {
        const g = await (await import('../lib/googleMaps')).loadGoogleMaps()
        if (!g?.maps) return
        const center = radiusCenter || { lat: 24.147736, lng: 120.673648 }
        const bounds = new g.maps.Circle({ center, radius: 20000 }).getBounds()
        const ap = new g.maps.places.Autocomplete(document.getElementById('admin-pickup-input') as HTMLInputElement, { bounds, strictBounds: true })
        ap.addListener('place_changed', () => {
          const p = ap.getPlace()
          if (p && p.geometry && p.geometry.location) {
            const loc = { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() }
            setAdminPickupAddress(p.formatted_address || p.name || '')
            setRadiusCenter(loc)
          }
        })
        const ad = new g.maps.places.Autocomplete(document.getElementById('admin-dropoff-input') as HTMLInputElement, { bounds, strictBounds: true })
        ad.addListener('place_changed', () => {
          const p = ad.getPlace()
          if (p && p.geometry && p.geometry.location) {
            const loc = { lat: p.geometry.location.lat(), lng: p.geometry.location.lng() }
            setAdminDropoffAddress(p.formatted_address || p.name || '')
          }
        })
      } catch {}
    }
    const t = setTimeout(run, 200)
    return () => clearTimeout(t)
  }, [radiusCenter])

  useEffect(() => {
    loadDashboardData()
  }, [])

  useEffect(() => {
    const chDrivers = supabase
      .channel('admin-drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, (payload: any) => {
        const d = payload.new || payload.old
        if (!d?.id) return
        setDriversList(prev => {
          const idx = prev.findIndex(x => x.id === d.id)
          const list = [...prev]
          if (idx >= 0) list[idx] = { ...list[idx], ...d }
          else list.unshift(d)
          return list
        })
      })
      .subscribe()
    const chTrips = supabase
      .channel('admin-trips')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (payload: any) => {
        const t = payload.new || payload.old
        if (!t?.id) return
        setTrips(prev => {
          const idx = prev.findIndex(x => x.id === t.id)
          const list = [...prev]
          if (idx >= 0) list[idx] = { ...list[idx], ...t }
          else list.unshift(t)
          return list
        })
      })
      .subscribe()
    const chEvents = supabase
      .channel('admin-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_events' }, (payload: any) => {
        const ev = payload.new
        if (!ev) return
        if (ev.ref_id && ev.event_type === 'candidate_pool' && ev.ref_id === dispatchRideId) {
          loadCandidatePool(dispatchRideId)
        }
      })
      .subscribe()
    return () => {
      chDrivers.unsubscribe()
      chTrips.unsubscribe()
      chEvents.unsubscribe()
    }
  }, [dispatchRideId])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      setUsers(usersError ? [] : (usersData || []))

      // Load trips
      const { data: tripsData, error: tripsError } = await supabase
        .from('trips')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      const tripsArr = tripsError ? [] : (tripsData || [])
      setTrips(tripsArr)
      try {
        const reqIds = tripsArr.filter(t => t.status === 'requested').map(t => t.id)
        if (reqIds.length) {
          const { data: statuses } = await supabase.from('trip_status').select('trip_id,notes,created_at').in('trip_id', reqIds).order('created_at', { ascending: false })
          const tags: Record<string, { noSmoking: boolean; pets: boolean }> = {};
          (statuses || []).forEach((s: any) => {
            const notes = String(s?.notes || '')
            const ns = /禁菸[:：]\s*是/.test(notes)
            const ps = /攜帶寵物[:：]\s*是/.test(notes)
            if (tags[s.trip_id] == null) tags[s.trip_id] = { noSmoking: ns, pets: ps }
          })
          setRequestedTags(tags)
        } else {
          setRequestedTags({})
        }
      } catch { setRequestedTags({}) }

      const { data: driversData } = await supabase
        .from('drivers')
        .select('*')
        .order('last_seen_at', { ascending: false })
      setDriversList(driversData || [])

      // Build ratings from driver_profiles via users(phone -> id)
      try {
        const driverUsers = (usersData || []).filter(u => u.user_type === 'driver')
        const phoneToUserId: Record<string, string> = {}
        driverUsers.forEach(u => { if (u.phone) phoneToUserId[u.phone] = u.id })
        const phones = (driversData || []).map(d => d.phone).filter(Boolean)
        const userIds = Array.from(new Set(phones.map(p => phoneToUserId[p]).filter(Boolean)))
        if (userIds.length > 0) {
          const { data: profs } = await supabase
            .from('driver_profiles')
            .select('user_id,rating')
            .in('user_id', userIds)
          const idToRating: Record<string, number> = {};
          ;(profs || []).forEach((row: any) => {
            if (row?.user_id) idToRating[row.user_id] = Number(row.rating ?? 4.0)
          })
          try {
            const { data: evRatings } = await supabase.from('ops_events').select('payload').eq('event_type','rating').limit(5000);
            const agg = {} as any
            (evRatings || []).forEach((ev: any) => {
              const did = ev?.payload?.driver_id
              const score = Number(ev?.payload?.score || 0)
              if (!did || !score) return
              if (!agg[did]) agg[did] = { sum: 0, cnt: 0 }
              agg[did].sum += score
              agg[did].cnt += 1
            })
            Object.keys(agg).forEach(did => {
              const avg = Math.round((agg[did].sum / Math.max(1, agg[did].cnt)) * 10) / 10
              idToRating[did] = avg
            })
          } catch {}
          const ratings: Record<string, number> = {};
          phones.forEach(p => {
            const uid = phoneToUserId[p]
            ratings[p] = uid && idToRating[uid] != null ? idToRating[uid] : 4.0
          })
          setDriverRatings(ratings)
        } else {
          setDriverRatings({})
        }
      } catch {
        setDriverRatings({})
      }

      // Load latest ops events per trip
      try {
        const tripIds = tripsArr.map(t => t.id)
        if (tripIds.length > 0) {
          const { data: eventsData } = await supabase
            .from('ops_events')
            .select('ref_id,event_type,created_at')
            .in('ref_id', tripIds)
            .order('created_at', { ascending: false });
          const map: Record<string, { type: string; time: string }> = {};
          (eventsData || []).forEach(ev => {
            const id = (ev as any).ref_id as string
            if (!map[id]) {
              map[id] = { type: (ev as any).event_type, time: (ev as any).created_at }
            }
          })
          setLatestEvents(map)
        } else {
          setLatestEvents({})
        }
      } catch {}

      // Calculate stats
      const passengers = usersData?.filter(u => u.user_type === 'passenger').length || 0
      const drivers = usersData?.filter(u => u.user_type === 'driver').length || 0
      const admins = usersData?.filter(u => u.user_type === 'admin').length || 0
      const totalUsers = usersData?.length || 0
      const totalTrips = tripsData?.length || 0
      const totalRevenue = tripsData?.reduce((sum, trip) => sum + (trip.final_price || 0), 0) || 0
      const activeTrips = tripsData?.filter(t => ['requested', 'accepted', 'in_progress'].includes(t.status)).length || 0

      setStats({
        totalUsers,
        totalTrips,
        totalRevenue,
        activeTrips,
        passengers,
        drivers,
        admins
      })
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCandidatePool = async (rideId: string) => {
    try {
      const { data } = await supabase
        .from('ops_events')
        .select('payload,created_at')
        .eq('ref_id', rideId)
        .eq('event_type', 'candidate_pool')
        .order('created_at', { ascending: false })
        .limit(1)
      const payload = (data && data[0]?.payload) || null
      const ids: string[] = payload?.candidates ? payload.candidates.map((c: any) => c.id) : []
      const pool = driversList.filter(d => ids.includes(d.id))
      setCandidatePool(pool)
    } catch {
      setCandidatePool([])
    }
  }

  const recomputeCandidatePool = async () => {
    const ride = trips.find(t => t.id === dispatchRideId) as any
    if (!ride || !ride.pickup_location) { setCandidatePool([]); return }
    const now = Date.now()
    const candidates = driversList
      .filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
      .filter(d => {
        const last = d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0
        const ageSec = last ? Math.floor((now - last) / 1000) : 9999
        return ageSec < 600
      })
      .map(d => ({ d, score: computeWeightedScore(ride, d, ride.pickup_location) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5)
      .map(x => x.d)
    setCandidatePool(candidates)
  }

  const refreshEtas = async () => {
    const ride = trips.find(t => t.id === dispatchRideId) as any
    if (!ride || !ride.pickup_location) return
    const list = driversList
      .filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
      .slice(0, 20)
    const updates: Record<string, number> = {}
    for (const d of list) {
      const minutes = await getRealtimeEtaMinutes({ lat: d.current_lat!, lng: d.current_lng! }, ride.pickup_location)
      updates[d.id] = minutes
    }
    setEtaCache(prev => ({ ...prev, ...updates }))
  }

  const assignCandidateTopN = async (n: number) => {
    if (!dispatchRideId || candidatePool.length === 0) return
    const selected = candidatePool.slice(0, n)
    for (const d of selected) {
      try { await manualAssign(d.id) } catch {}
    }
    try {
      await supabase.from('ops_events').insert({
        event_type: 'candidate_assign_batch',
        ref_id: dispatchRideId,
        payload: { count: selected.length, ids: selected.map(x => x.id) }
      })
    } catch {}
  }

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const accepted = trips.filter(t => t.status === 'accepted')
        for (const ride of accepted) {
          const { data: evAssign } = await supabase
            .from('ops_events')
            .select('created_at')
            .eq('ref_id', ride.id)
            .eq('event_type', 'assign_driver')
            .order('created_at', { ascending: false })
            .limit(1)
          const lastAssignAt = evAssign && evAssign[0]?.created_at ? new Date(evAssign[0].created_at).getTime() : 0
          const { data: evArrived } = await supabase
            .from('ops_events')
            .select('created_at')
            .eq('ref_id', ride.id)
            .eq('event_type', 'driver_arrived')
            .order('created_at', { ascending: false })
            .limit(1)
          const arrivedAt = evArrived && evArrived[0]?.created_at ? new Date(evArrived[0].created_at).getTime() : 0
          const tooOld = lastAssignAt && (Date.now() - lastAssignAt) > 5 * 60 * 1000
          const notArrived = !arrivedAt || arrivedAt < lastAssignAt
          if (tooOld && notArrived) {
            const pickup: any = (ride as any).pickup_location
            if (!pickup) continue
            const candidatesRaw = driversList
              .filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
              .map(d => ({ d, dist: haversine(d.current_lat!, d.current_lng!, pickup.lat, pickup.lng) }))
              .sort((a, b) => a.dist - b.dist)
              .slice(0, 8)
            const candidates = await Promise.all(candidatesRaw.map(async x => {
              const eta = await getRealtimeEtaMinutes({ lat: x.d.current_lat!, lng: x.d.current_lng! }, pickup)
              const score = computeWeightedScore(ride, x.d, pickup)
              return { ...x, eta, score }
            }))
            const target = candidates.sort((a, b) => a.eta - b.eta || a.score - b.score)[0]?.d
            if (target) {
              try {
                await retry(async () => assignDriver({ ride_id: ride.id, driver_id: target.id }) as any)
                await retry(async () => supabase.from('ops_events').insert({
                  event_type: 'auto_reassign',
                  ref_id: ride.id,
                  payload: { reason: 'timeout_no_arrival', assigned: target.id }
                }) as any)
              } catch {}
            }
          }
        }
      } catch {}
    }, 60000)
    return () => clearInterval(id)
  }, [trips, driversList, weights])

  const queryEvents = async () => {
    try {
      let q = supabase.from('ops_events').select('event_type,ref_id,payload,created_at')
      if (dispatchRideId) q = q.eq('ref_id', dispatchRideId)
      if (eventTypes.length > 0) q = q.in('event_type', eventTypes)
      if (fromDate) q = q.gte('created_at', `${fromDate}T00:00:00.000Z`)
      if (toDate) q = q.lte('created_at', `${toDate}T23:59:59.999Z`)
      const { data } = await q.order('created_at', { ascending: true })
      setEventsResult(data || [])
    } catch {
      setEventsResult([])
    }
  }

  const markRisk = async (type: 'risk_no_show' | 'risk_abnormal_cancel' | 'risk_dispute') => {
    if (!riskTripId) return
    try {
      await supabase.from('ops_events').insert({
        event_type: type,
        ref_id: riskTripId
      })
      alert('已紀錄風險事件')
    } catch {
      alert('紀錄失敗')
    }
  }

  const applyModeration = async () => {
    if (!userModerationId) return
    try {
      const status = moderationAction === 'ban' ? 'banned' : moderationAction === 'suspend' ? 'suspended' : 'active'
      await supabase.from('users').update({ status }).eq('id', userModerationId)
      await supabase.from('ops_events').insert({
        event_type: 'user_moderation',
        ref_id: userModerationId,
        payload: { action: moderationAction }
      })
      if (status !== 'active') {
        const { data: activeTrips } = await supabase
          .from('trips')
          .select('id')
          .or(`passenger_id.eq.${userModerationId},driver_id.eq.${userModerationId}`)
          .in('status', ['requested','accepted','in_progress'])
        const ids = (activeTrips || []).map((t: any) => t.id)
        if (ids.length) {
          await supabase.from('trips').update({ status: 'cancelled' }).in('id', ids)
          for (const tid of ids) {
            try { await supabase.from('ops_events').insert({ event_type: 'risk_abnormal_cancel', ref_id: tid, payload: { reason: 'user_moderation_'+status } }) } catch {}
          }
        }
      }
      alert('已套用')
    } catch {
      alert('套用失敗')
    }
  }

  const refreshAlerts = async () => {
    try {
      const d24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const d7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: err24 } = await supabase.from('ops_events').select('id').eq('event_type', 'frontend_error').gte('created_at', d24)
      const { data: risk7 } = await supabase.from('ops_events').select('id').in('event_type', ['risk_no_show','risk_abnormal_cancel','risk_dispute']).gte('created_at', d7)
      const { data: perf } = await supabase.from('ops_events').select('payload').eq('event_type', 'frontend_perf').gte('created_at', d24)
      const avgLoad = (perf || []).map((x: any) => x.payload?.loadTime || 0).filter((v: number) => v > 0)
      const avg = avgLoad.length ? Math.round(avgLoad.reduce((s: number, v: number) => s + v, 0) / avgLoad.length) : 0
      const { data: pings } = await supabase.from('ops_events').select('id').eq('event_type', 'driver_ping').gte('created_at', d24)
      setAlertCounts({ frontErrors: (err24 || []).length, risk: (risk7 || []).length })
      setMetrics({ avgLoadMs: avg, driverPings: (pings || []).length })
    } catch {
      setAlertCounts({ frontErrors: 0, risk: 0 })
      setMetrics({ avgLoadMs: 0, driverPings: 0 })
    }
  }

  const retryAssign = async () => {
    if (!dispatchRideId) return
    try {
      const r = await assignDriver({ ride_id: dispatchRideId })
      setDispatchRes(r.data)
      await loadDashboardData()
      alert('已重試派單')
    } catch (e) {
      console.error('retry assign error', e)
      alert('重試派單失敗')
    }
  }

  const [minutesBefore, setMinutesBefore] = useState(15)
  const runSchedule = async () => {
    try {
      const r = await runScheduleChecker(minutesBefore as any)
      setDispatchRes(r.data)
      alert('已執行排程')
    } catch (e) {
      console.error('run schedule error', e)
      alert('執行排程失敗')
    }
  }
  const saveSchedulerMinutes = async () => {
    try {
      await supabase.from('scheduler_config').upsert({ id: 'global', minutes_before: minutesBefore, updated_at: new Date().toISOString() })
      alert('已保存雲端提前分鐘配置')
    } catch {
      alert('保存失敗')
    }
  }

  const haversine = (aLat: number, aLng: number, bLat: number, bLng: number) => {
    const toRad = (v: number) => (v * Math.PI) / 180
    const R = 6371
    const dLat = toRad(bLat - aLat)
    const dLng = toRad(bLng - aLng)
    const sa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
    const c = 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa))
    return R * c
  }

  const deriveDriverType = (d: Driver): 'economy' | 'comfort' | 'business' => {
    const model = (d.car_model || '').toLowerCase()
    if (model.includes('benz') || model.includes('bmw') || model.includes('lexus') || model.includes('volvo')) return 'business'
    if (model.includes('camry') || model.includes('altis') || model.includes('civic') || model.includes('accord')) return 'comfort'
    return 'economy'
  }
  useEffect(() => {
    const list = trips
      .filter(t => t.status === 'requested')
      .filter(t => (t as any).pickup_location && (t as any).dropoff_location)
      .map(t => {
        const p: any = (t as any).pickup_location
        const d: any = (t as any).dropoff_location
        const dist = haversine(p.lat, p.lng, d.lat, d.lng)
        return { id: t.id, distance: dist, created_at: t.created_at }
      })
      .filter(x => x.distance > 30)
    setLongDistance(list)
  }, [trips])

  const computeWeightedScore = (ride: any, d: Driver, base?: { lat: number; lng: number }) => {
    const pickup = base || ride?.pickup_location
    const distKm = pickup ? haversine(d.current_lat!, d.current_lng!, pickup.lat, pickup.lng) : Infinity
    const etaMin = distKm === Infinity ? 9999 : (distKm / 30) * 60
    const last = d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0
    const recencySec = last ? Math.floor((Date.now() - last) / 1000) : 9999
    const driverType = deriveDriverType(d)
    const rideType = ride?.car_type || 'economy'
    const carPenalty = driverType === rideType ? 0 : 5
    const rating = d.rating != null ? d.rating : (d.phone && driverRatings[d.phone] != null ? driverRatings[d.phone] : 4.0)
    const ratingPenalty = Math.max(0, 5 - rating)
    const { wDist, wEta, wRecency, wCar, wRating } = weights
    return wDist * distKm + wEta * etaMin + wRecency * (recencySec / 300) + wCar * carPenalty + wRating * ratingPenalty
  }

  const getRealtimeEtaMinutes = async (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) => {
    try {
      const r = await getRouteWithFallbacks(origin, destination)
      return Math.max(1, r.durationMin)
    } catch {
      const distKm = haversine(origin.lat, origin.lng, destination.lat, destination.lng)
      return Math.max(1, Math.round((distKm / 30) * 60))
    }
  }

  const saveWeights = async () => {
    try {
      localStorage.setItem('bf_dispatch_weights', JSON.stringify(weights))
      await supabase.from('dispatch_settings').upsert({ id: 'global', weights, updated_by: user?.id || null, updated_at: new Date().toISOString() })
      await retry(async () => supabase.from('ops_events').insert({
        event_type: 'dispatch_settings_update',
        payload: { weights }
      }) as any)
      alert('已保存權重設定')
    } catch {}
  }

  const manualAssign = async (driverId: string) => {
    if (!dispatchRideId) return
    try {
      const r = await assignDriver({ ride_id: dispatchRideId, driver_id: driverId })
      setDispatchRes(r.data)
      await loadDashboardData()
      alert('已手動指派司機')
    } catch (e) {
      console.error('manual assign error', e)
      alert('手動指派失敗')
    }
  }

  const assignNearest = async () => {
    const ride = trips.find(t => t.id === dispatchRideId) as any
    if (!ride || !ride.pickup_location) return
    const near = driversList
      .filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
      .map(d => ({ d, dist: haversine(d.current_lat!, d.current_lng!, ride.pickup_location.lat, ride.pickup_location.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8)
    const withEta = await Promise.all(near.map(async x => {
      const eta = await getRealtimeEtaMinutes({ lat: x.d.current_lat!, lng: x.d.current_lng! }, ride.pickup_location)
      const score = computeWeightedScore(ride, x.d, ride.pickup_location)
      return { ...x, eta, score }
    }))
    const target = withEta.sort((a, b) => a.eta - b.eta || a.score - b.score)[0]?.d
    if (!target) return
    await manualAssign(target.id)
  }

  const assignNearestInSelection = async () => {
    const ride = trips.find(t => t.id === dispatchRideId) as any
    const bounds = rectStart && rectEnd ? {
      minLat: Math.min(rectStart.lat, rectEnd.lat),
      maxLat: Math.max(rectStart.lat, rectEnd.lat),
      minLng: Math.min(rectStart.lng, rectEnd.lng),
      maxLng: Math.max(rectStart.lng, rectEnd.lng),
    } : null
    const filtered = driversList
      .filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
      .filter(d => bounds ? (d.current_lat! >= bounds.minLat && d.current_lat! <= bounds.maxLat && d.current_lng! >= bounds.minLng && d.current_lng! <= bounds.maxLng) : true)
      .map(d => ({ d, dist: ride?.pickup_location ? haversine(d.current_lat!, d.current_lng!, ride.pickup_location.lat, ride.pickup_location.lng) : Infinity }))
      .sort((a, b) => a.dist - b.dist)
    const target = filtered[0]?.d
    if (!target) return
    await manualAssign(target.id)
  }

  const assignTopNInSelection = async (n: number) => {
    const ride = trips.find(t => t.id === dispatchRideId) as any
    const bounds = rectStart && rectEnd ? {
      minLat: Math.min(rectStart.lat, rectEnd.lat),
      maxLat: Math.max(rectStart.lat, rectEnd.lat),
      minLng: Math.min(rectStart.lng, rectEnd.lng),
      maxLng: Math.max(rectStart.lng, rectEnd.lng),
    } : null
    const filtered = driversList
      .filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
      .filter(d => bounds ? (d.current_lat! >= bounds.minLat && d.current_lat! <= bounds.maxLat && d.current_lng! >= bounds.minLng && d.current_lng! <= bounds.maxLng) : true)
      .map(d => ({ d, dist: ride?.pickup_location ? haversine(d.current_lat!, d.current_lng!, ride.pickup_location.lat, ride.pickup_location.lng) : Infinity }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, n)
    for (const item of filtered) {
      await manualAssign(item.d.id)
    }
    alert(`已批量指派 ${filtered.length} 位司機`)
  }

  useEffect(() => {
    if (!autoDispatchEnabled) return
    const id = setInterval(async () => {
      try {
        const pending = trips.filter(t => t.status === 'requested')
        for (const ride of pending) {
          const pickup: any = (ride as any).pickup_location
          if (!pickup) continue
          const createdAt = new Date(ride.created_at).getTime()
          const elapsedMin = Math.floor((Date.now() - createdAt) / 60000)
          const radiusKm = elapsedMin < 3 ? 5 : elapsedMin < 7 ? 15 : 999
          if (elapsedMin >= 10) continue
          try {
            const drop: any = (ride as any).dropoff_location
            if (drop) {
              const dist = haversine(pickup.lat, pickup.lng, drop.lat, drop.lng)
              if (dist > 30) {
                const { data: respEv } = await supabase.from('ops_events').select('created_at,payload').eq('ref_id', ride.id).eq('event_type', 'long_distance_handle').order('created_at', { ascending: false }).limit(1)
                const allowAuto = respEv && respEv[0]?.payload?.mode === 'auto'
                if (!allowAuto && elapsedMin < 1.5) continue
              }
            }
          } catch {}
          const candidatesRaw = driversList
            .filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
            .filter(d => {
              const last = d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0
              const ageSec = last ? Math.floor((Date.now() - last) / 1000) : Infinity
              return ageSec < 600
            })
            .map(d => ({ d, dist: haversine(d.current_lat!, d.current_lng!, pickup.lat, pickup.lng) }))
            .filter(x => x.dist <= radiusKm || radiusKm >= 900)
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 10)
          const candidates = await Promise.all(candidatesRaw.map(async x => {
            const eta = await getRealtimeEtaMinutes({ lat: x.d.current_lat!, lng: x.d.current_lng! }, pickup)
            const score = computeWeightedScore(ride, x.d, pickup)
            return { ...x, eta, score }
          }))
          const target = candidates.sort((a, b) => a.eta - b.eta || a.score - b.score)[0]?.d
          if (!target) {
            try {
              await retry(async () => supabase.from('ops_events').insert({
                event_type: 'candidate_pool',
                ref_id: ride.id,
                payload: { candidates: candidates.slice(0, 5).map(c => ({ id: c.d.id })) }
              }) as any)
            } catch {}
            continue
          }
          try {
            const r = await retry(async () => assignDriver({ ride_id: ride.id, driver_id: target.id }) as any)
            setDispatchRes((r as any).data)
            await loadDashboardData()
          } catch {
            try {
              await retry(async () => supabase.from('ops_events').insert({
                event_type: 'candidate_pool',
                ref_id: ride.id,
                payload: { candidates: candidates.slice(0, 5).map(c => ({ id: c.d.id })) }
              }) as any)
            } catch {}
          }
          // 疊單推薦
          try {
            const activeTrips = trips.filter(t => t.status === 'in_progress')
            for (const at of activeTrips) {
              const drvId = (at as any).driver_id
              const drv = driversList.find(d => d.id === drvId)
              const drop = (at as any).dropoff_location
              if (!drv || !drop) continue
              const remainMin = await getRealtimeEtaMinutes({ lat: drv.current_lat!, lng: drv.current_lng! }, drop)
              const distToNewPickup = haversine(drop.lat, drop.lng, pickup.lat, pickup.lng)
              if (remainMin <= 10 && distToNewPickup < 2) {
                await supabase.from('ops_events').insert({
                  event_type: 'overlay_offer',
                  ref_id: ride.id,
                  payload: { driver_id: drvId, trip_id: ride.id, remain_min: remainMin, distance_km: distToNewPickup, pickup, dropoff: (ride as any).dropoff_location || null, expires_at: new Date(Date.now()+60_000).toISOString() }
                })
              }
            }
          } catch {}
        }
      } catch {}
    }, 30000)
    return () => clearInterval(id)
  }, [autoDispatchEnabled, trips, driversList])
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const nowTs = Date.now()
        const t15 = nowTs + 15 * 60 * 1000
        const { data: sched } = await supabase
          .from('scheduled_rides')
          .select('id,scheduled_time,pickup_lat,pickup_lng,accepted_driver_id,processed')
          .eq('processed', false)
        for (const s of (sched || [])) {
          const ts = new Date(s.scheduled_time).getTime()
          if (ts <= t15 && !s.accepted_driver_id) {
            const pick = { lat: s.pickup_lat, lng: s.pickup_lng }
            const nearby = driversList
              .filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
              .map(d => ({ d, dist: haversine(d.current_lat!, d.current_lng!, pick.lat, pick.lng) }))
              .sort((a,b) => a.dist - b.dist)
              .slice(0, 12)
            for (const x of nearby) {
              try {
                await supabase.from('ops_events').insert({
                  event_type: 'dispatch_offer',
                  ref_id: s.id,
                  payload: {
                    driver_id: x.d.id,
                    trip_id: s.id,
                    pickup: pick,
                    dropoff: null,
                    dist_km: x.dist,
                    price: 0,
                    expires_at: new Date(Date.now() + 60_000).toISOString()
                  }
                })
              } catch {}
            }
          }
        }
      } catch {}
    }, 60_000)
    return () => clearInterval(id)
  }, [driversList])

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested':
        return 'bg-yellow-100 text-yellow-800'
      case 'accepted':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'requested':
        return '等待接單'
      case 'accepted':
        return '司機已接單'
      case 'in_progress':
        return '行程進行中'
      case 'completed':
        return '已完成'
      case 'cancelled':
        return '已取消'
      default:
        return '未知狀態'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  const copyTripAddress = async (trip: any) => {
    const text = `${trip.pickup_address || ''} ${trip.dropoff_address || ''}`.trim()
    try { await navigator.clipboard.writeText(text); alert('已複製地址到剪貼簿') } catch { alert(text) }
  }
  const [manualForm, setManualForm] = useState<Record<string, { plate?: string; model?: string; etaMin?: number }>>({})
  const updateManualForm = (id: string, k: 'plate' | 'model' | 'etaMin', v: any) => {
    setManualForm(prev => ({ ...prev, [id]: { ...(prev[id]||{}), [k]: v } }))
  }
  const confirmManualAssign = async (trip: any) => {
    try {
      await supabase.from('trips').update({ status: 'accepted' }).eq('id', trip.id)
      const info = manualForm[trip.id] || {}
      await supabase.from('ops_events').insert({
        event_type: 'manual_support',
        ref_id: trip.id,
        payload: { ...info, text: '管理員手動外調已接單' }
      })
      alert('已更新為已接單並通知乘客')
    } catch { alert('更新失敗') }
  }
  const openManualModal = (tripId: string) => {
    setManualTripId(tripId)
    const cur = manualForm[tripId] || {}
    setManualPlate(cur.plate || '')
    setManualModel(cur.model || '')
    setManualEta(Number(cur.etaMin || 0))
  }
  const submitManualModal = async () => {
    if (!manualTripId) return
    const trip = trips.find(t => t.id === manualTripId) as any
    if (!trip) { setManualTripId(null); return }
    setManualForm(prev => ({ ...prev, [manualTripId]: { plate: manualPlate, model: manualModel, etaMin: manualEta } }))
    await confirmManualAssign(trip)
    setManualTripId(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* 左側導覽暫不固定，使用上方導航 */}
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">管理後台</h1>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Shield className="w-4 h-4" />
                <span>管理員: {user?.email}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 text-red-600 hover:text-red-800"
            >
              <LogOut className="w-5 h-5" />
              <span>登出</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              總覽
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              用戶管理
            </button>
          <button
            onClick={() => setActiveTab('trips')}
            className={`py-4 px-2 border-b-2 font-medium text-sm ${
              activeTab === 'trips'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            行程監控
          </button>
            <button
              onClick={() => setActiveTab('dispatch')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'dispatch'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              派單
            </button>
            <button
              onClick={() => setActiveTab('ops')}
              className={`py-4 px-2 border-b-2 font-medium text-sm ${
                activeTab === 'ops'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              事件與風控
            </button>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            {longDist && (
              <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
                <div className="w-full max-w-lg rounded-2xl p-6" style={{ backgroundImage: 'linear-gradient(180deg, #FFD700 0%, #B8860B 100%)', color: '#111' }}>
                  <div className="text-xl font-bold mb-1">長途單派送</div>
                  <div className="text-xs mb-3">倒數 {longDistCountdown} 秒</div>
                  <div className="space-y-2 text-sm">
                    <div>Trip：{longDist.tripId}</div>
                  </div>
                  <div className="mt-4 flex justify-end space-x-2">
                    <button
                      onClick={async () => {
                        try {
                          const list = (driversList || []).filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
                          const pick = longDist?.pickup
                          let nearest = list[0]
                          let best = Number.POSITIVE_INFINITY
                          list.forEach(d => {
                            const dx = d.current_lat - (pick?.lat || 0)
                            const dy = d.current_lng - (pick?.lng || 0)
                            const dist = Math.hypot(dx, dy)
                            if (dist < best) { best = dist; nearest = d }
                          })
                          if (nearest) await assignDriver({ ride_id: longDist.tripId, driver_id: nearest.id })
                          setLongDist(null)
                        } catch { setLongDist(null) }
                      }}
                      className="px-4 py-2 rounded-2xl" style={{ background: '#111', color: '#FFD700' }}
                    >
                      自動派單（最近司機）
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const pick = longDist?.pickup
                          const list = (driversList || []).filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
                          const sorted = list.sort((a,b) => Math.hypot(a.current_lat-(pick?.lat||0), a.current_lng-(pick?.lng||0)) - Math.hypot(b.current_lat-(pick?.lat||0), b.current_lng-(pick?.lng||0)))
                          const chosen = sorted[0]
                          if (chosen) await assignDriver({ ride_id: longDist.tripId, driver_id: chosen.id })
                          setLongDist(null)
                        } catch { setLongDist(null) }
                      }}
                      className="px-4 py-2 rounded-2xl" style={{ background: '#111', color: '#FFD700' }}
                    >
                      手動（先選最近）
                    </button>
                    <button onClick={() => setLongDist(null)} className="px-4 py-2 rounded-2xl border border-gray-300">關閉</button>
                  </div>
                </div>
              </div>
            )}
            <div className="mb-6 rounded-2xl shadow-2xl border border-[#D4AF37]/30 bg-[#1a1a1a] p-4 text-white">
              <div className="text-lg font-semibold mb-3">司機推薦獎勵</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(driversList || []).map(d => {
                  const stat = driverRewards[d.id] || { firstRideCount: 0, totalBonus: 0 }
                  return (
                    <div key={d.id} className="rounded-2xl border border-[#D4AF37]/30 p-3 flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">{d.name || '未提供姓名'}</div>
                        <div className="text-gray-300">{d.phone || '未提供電話'}</div>
                      </div>
                      <div className="text-sm text-gray-200">
                        <div>推薦叫車數：{stat.firstRideCount}</div>
                        <div>累積獎勵金：${stat.totalBonus}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mb-6 rounded-2xl shadow-2xl border border-[#D4AF37]/30 bg-[#1a1a1a] p-4 text-white">
              <div className="text-lg font-semibold mb-3">合作店家管理</div>
              {merchants.length === 0 ? (
                <div className="text-sm text-gray-300">尚未建立店家資料</div>
              ) : (
                <div className="space-y-3">
                  {merchants.map(m => {
                    const st = merchantStats[m.id] || { monthlyCount: 0, monthlyReward: 0 }
                    return (
                      <div key={m.id} className="rounded-2xl border border-[#D4AF37]/30 p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="text-sm">
                          <div className="font-medium">{m.name}</div>
                          <div className="text-gray-300">{m.address || '未提供地址'}</div>
                        </div>
                        <div className="text-sm">
                          <div>電話：{m.phone}</div>
                          <div>街口：{m.jkopay || '未提供'}</div>
                        </div>
                        <div className="text-sm">
                          <div>本月叫車數：{st.monthlyCount}</div>
                          <div>店家分潤：${st.monthlyReward}</div>
                        </div>
                        <div className="flex justify-end">
                          <button className="px-3 py-2 rounded-2xl text-black" style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}>編輯</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="mb-6 rounded-2xl shadow-2xl border border-[#D4AF37]/30 bg-[#1a1a1a] p-4 text-white">
              <div className="text-lg font-semibold mb-3">司機推薦獎勵</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(driversList || []).map(d => {
                  const stat = driverRewards[d.id] || { firstRideCount: 0, totalBonus: 0 }
                  return (
                    <div key={d.id} className="rounded-2xl border border-[#D4AF37]/30 p-3 flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">{d.name || '未提供姓名'}</div>
                        <div className="text-gray-300">{d.phone || '未提供電話'}</div>
                      </div>
                      <div className="text-sm text-gray-200">
                        <div>推薦叫車數：{stat.firstRideCount}</div>
                        <div>累積獎勵金：${stat.totalBonus}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="mb-6 rounded-2xl shadow-2xl border border-[#D4AF37]/30 bg-[#1a1a1a] p-4 text-white">
              <div className="text-lg font-semibold mb-3">訊息中心</div>
              {messages.length === 0 ? (
                <div className="text-sm text-gray-300">目前沒有訊息</div>
              ) : (
                <div className="space-y-3">
                  {messages.map(m => (
                    <div key={m.id} className="rounded-2xl border border-[#D4AF37]/30 p-3">
                      <div className="text-xs text-gray-400">{new Date(m.created_at).toLocaleString('zh-TW')}</div>
                      <div className="text-sm font-medium">來自：{m.role}（{m.from_user_id}）</div>
                      <div className="text-sm text-gray-200 mt-1">{m.text}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          defaultValue={m.reply_text || ''}
                          onChange={e=>{
                            const val = e.target.value
                            setMessages(prev => prev.map(x => x.id===m.id ? { ...x, reply_text: val } : x))
                          }}
                          className="flex-1 px-3 py-2 border border-[#D4AF37]/50 bg-[#0f0f0f] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          placeholder="回覆內容"
                        />
                        <button
                          onClick={async () => {
                            try {
                              const item = messages.find(x => x.id===m.id)
                              await supabase.from('messages').update({ reply_text: item?.reply_text || '', reply_at: new Date().toISOString() }).eq('id', m.id)
                            } catch {}
                          }}
                          className="px-3 py-2 rounded-2xl text-black"
                          style={{ backgroundImage: 'linear-gradient(to right, #FFD700, #B8860B)' }}
                        >
                          回覆
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mb-6 rounded-2xl shadow-2xl border border-[#D4AF37]/30 bg-[#1a1a1a] p-4 text-white">
              <div className="text-lg font-semibold mb-3">用戶升級為司機</div>
              {promoteCandidates.length === 0 ? (
                <div className="text-sm text-gray-300">目前沒有可升級的乘客</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {promoteCandidates.map(pd => (
                    <div key={pd.id} className="rounded-2xl border border-[#D4AF37]/30 p-3 flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">{pd.email}</div>
                        <div className="text-gray-300">{pd.phone || '未提供電話'}</div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await supabase.from('users').update({ user_type: 'driver' }).eq('id', pd.id)
                            await supabase.from('driver_profiles').upsert({ user_id: pd.id, status: 'approved' }, { onConflict: 'user_id' } as any)
                            setPromoteCandidates(list => list.filter(x => x.id !== pd.id))
                          } catch {}
                        }}
                        className="px-3 py-2 rounded-2xl text-black"
                        style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
                      >
                        升為司機
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mb-6 rounded-2xl shadow-2xl border border-[#D4AF37]/30 bg-[#1a1a1a] p-4 text-white">
              <div className="text-lg font-semibold mb-3">司機審核</div>
              {pendingDrivers.length === 0 ? (
                <div className="text-sm text-gray-300">目前沒有待審核的司機</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {pendingDrivers.map(pd => (
                    <div key={pd.id} className="rounded-2xl border border-[#D4AF37]/30 p-3 flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">{pd.name || '未提供姓名'}</div>
                        <div className="text-gray-300">{pd.phone || '未提供電話'}</div>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await supabase.from('driver_profiles').update({ status: 'approved' }).eq('user_id', pd.id)
                            setPendingDrivers(list => list.filter(x => x.id !== pd.id))
                          } catch {}
                        }}
                        className="px-3 py-2 rounded-2xl text-black"
                        style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
                      >
                        同意加入
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mb-6">
              <button
                onClick={() => setActiveTab('overview')}
                className="px-4 py-2 rounded-2xl text-black"
                style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)' }}
              >
                設定面板
              </button>
              <div className="mt-3 rounded-2xl bg-[#1a1a1a] border border-[#D4AF37]/30 shadow-2xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-gray-300 mb-4">基本費</label>
                    <input className="w-full px-3 py-2 rounded-2xl bg-[#1a1a1a] text-white border border-[#D4AF37]/30" placeholder="70" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-4">每分鐘</label>
                    <input className="w-full px-3 py-2 rounded-2xl bg-[#1a1a1a] text-white border border-[#D4AF37]/30" placeholder="3" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300 mb-4">每公里</label>
                    <input className="w-full px-3 py-2 rounded-2xl bg-[#1a1a1a] text-white border border-[#D4AF37]/30" placeholder="15" />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl border border-[#D4AF37]/30 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-300">總用戶數</p>
                    <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
                  </div>
                  <Users className="w-8 h-8" />
                </div>
                <div className="mt-4 flex items-center text-sm text-gray-300">
                  <span>乘客: {stats.passengers}</span>
                  <span className="mx-2">|</span>
                  <span>司機: {stats.drivers}</span>
                  <span className="mx-2">|</span>
                  <span>管理員: {stats.admins}</span>
                </div>
              </div>
              <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl border border-[#D4AF37]/30 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-300">總行程數</p>
                    <p className="text-3xl font-bold text-white">{stats.totalTrips}</p>
                  </div>
                  <Car className="w-8 h-8" />
                </div>
                <div className="mt-4 flex items-center">
                  <span className="text-sm text-gray-300">
                    進行中: {stats.activeTrips} 筆
                  </span>
                </div>
              </div>
              <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl border border-[#D4AF37]/30 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-300">總收入</p>
                    <p className="text-3xl font-bold text-white">${stats.totalRevenue}</p>
                  </div>
                  <DollarSign className="w-8 h-8" />
                </div>
                <div className="mt-4 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  <span className="text-sm text-gray-300">+12% 本月</span>
                </div>
              </div>
              <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl border border-[#D4AF37]/30 p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-300">活躍行程</p>
                    <p className="text-3xl font-bold text-white">{stats.activeTrips}</p>
                  </div>
                  <MapPin className="w-8 h-8" />
                </div>
                <div className="mt-4 flex items-center">
                  <span className="text-sm text-gray-300">
                    即時監控中
                  </span>
                </div>
              </div>
            </div>

            {/* Pricing Config */}
            <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl border border-[#D4AF37]/30 p-6 text-white mb-8">
              <h3 className="text-lg font-semibold mb-4">計費規則</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input id="pricingBase" type="number" placeholder="Base ($)" className="px-3 py-2 bg-[#111] border border-[#D4AF37]/30 rounded-2xl" />
                <input id="pricingKm" type="number" placeholder="Per KM ($)" className="px-3 py-2 bg-[#111] border border-[#D4AF37]/30 rounded-2xl" />
                <input id="pricingMin" type="number" placeholder="Per Min ($)" className="px-3 py-2 bg-[#111] border border-[#D4AF37]/30 rounded-2xl" />
              </div>
              <div className="mt-3">
                <button onClick={async ()=>{
                  const base = parseFloat((document.getElementById('pricingBase') as HTMLInputElement)?.value || '0') || 0
                  const perKm = parseFloat((document.getElementById('pricingKm') as HTMLInputElement)?.value || '0') || 0
                  const perMin = parseFloat((document.getElementById('pricingMin') as HTMLInputElement)?.value || '0') || 0
                  try {
                    await supabase.from('dispatch_settings').upsert({ id:'global', base_price: base, price_per_km: perKm, price_per_min: perMin, updated_at: new Date().toISOString() })
                    alert('已保存計費規則')
                  } catch { alert('保存失敗') }
                }} className="px-3 py-2 rounded-2xl" style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111' }}>保存</button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl border border-[#D4AF37]/30 p-6 text-white">
              <h3 className="text-lg font-semibold mb-4">最近活動</h3>
              <div className="space-y-4">
                {trips.slice(0, 5).map((trip) => (
                  <div key={trip.id} className="flex items-center justify-between p-4 bg-[#111111] rounded-2xl border border-[#D4AF37]/20">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-5 h-5" />
                        <span className="text-sm">{trip.pickup_address}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-5 h-5" />
                        <span className="text-sm">{trip.dropoff_address}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(trip.status)}`}>
                        {getStatusText(trip.status)}
                      </span>
                      <span className="text-sm font-medium">
                        ${trip.final_price || trip.estimated_price}
                      </span>
                      <span className="text-xs">
                        {formatDate(trip.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Chat Monitor & Broadcast */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl border border-[#D4AF37]/30 p-6 text-white">
                <div className="text-lg font-semibold mb-2">全域聊天監控</div>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {chatLog.map(m => (
                    <div key={m.id} className="p-2 rounded-2xl bg-[#111] border border-[#D4AF37]/20">
                      <div className="text-xs text-gray-400">{new Date(m.time).toLocaleString('zh-TW')}</div>
                      <div className="text-sm"><span className="text-gray-300">[{m.from}]</span> {m.text}</div>
                      {m.ref && <div className="text-xs text-gray-500">ref: {m.ref}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl border border-[#D4AF37]/30 p-6 text-white">
                <div className="text-lg font-semibold mb-2">廣播訊息給所有在線司機</div>
                <div className="flex items-center gap-3">
                  <input value={broadcastText} onChange={e=>setBroadcastText(e.target.value)} placeholder="輸入廣播內容" className="flex-1 px-3 py-2 bg-[#111] border border-[#D4AF37]/30 rounded-2xl" />
                  <button onClick={async ()=>{
                    const onlineDrivers = driversList.filter(d=> (d as any).is_online && (d as any).status!=='on_trip')
                    if (!broadcastText.trim() || onlineDrivers.length === 0) { alert('無在線司機或內容為空'); return }
                    let ok = 0, failed = 0
                    for (const d of onlineDrivers) {
                      try { 
                        await sendPush({ user_id: d.id, title: '系統廣播', body: broadcastText.trim() }) 
                        ok++
                      } catch { failed++ }
                    }
                    alert(`已發送：${ok}；失敗：${failed}`)
                  }} className="px-3 py-2 rounded-2xl" style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111' }}>發送</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Manual Dispatch Modal */}
        {manualTripId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <div className="w-full max-w-md bg-[#111] text-white rounded-2xl p-6 border border-[#D4AF37]/40">
              <div className="text-xl font-bold mb-4" style={{ color:'#FFD700' }}>手動外調</div>
              <div className="space-y-3">
                <input value={manualPlate} onChange={e=>setManualPlate(e.target.value)} className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" placeholder="支援車牌號碼（含顏色）" />
                <input value={manualModel} onChange={e=>setManualModel(e.target.value)} className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" placeholder="支援車款" />
                <input type="number" value={manualEta} onChange={e=>setManualEta(parseInt(e.target.value||'0')||0)} className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" placeholder="預計抵達時間（分鐘）" />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button onClick={()=>setManualTripId(null)} className="px-4 py-2 rounded-2xl border border-[#D4AF37]/40">取消</button>
                <button onClick={submitManualModal} className="px-4 py-2 rounded-2xl" style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111' }}>確認回報並接單</button>
              </div>
            </div>
          </div>
        )}
        {/* Users Tab */}
        {activeTab === 'users' && (
          <div>
            <div className="rounded-2xl overflow-hidden border border-[#DAA520]/40" style={{ background:'#1A1A1A', color:'#e5e7eb' }}>
              <div className="px-6 py-4 border-b border-[#DAA520]/30">
                <h3 className="text-lg font-semibold" style={{ color:'#DAA520' }}>用戶管理</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                <div className="rounded-2xl p-3 border border-[#DAA520]/30" style={{ background:'#2A2A2A' }}>
                  <div className="text-sm font-semibold mb-2" style={{ color:'#DAA520' }}>管理員</div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {adminsList.map(u => (<div key={u.id} className="text-xs">{u.phone} · {(u as any).name || u.email}</div>))}
                    {adminsList.length===0 && <div className="text-xs text-gray-400">無</div>}
                  </div>
                </div>
                <div className="rounded-2xl p-3 border border-[#DAA520]/30" style={{ background:'#2A2A2A' }}>
                  <div className="text-sm font-semibold mb-2" style={{ color:'#DAA520' }}>司機</div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {driversUsers.map(u => (<div key={u.id} className="text-xs">{u.phone} · {(u as any).name || u.email}</div>))}
                    {driversUsers.length===0 && <div className="text-xs text-gray-400">無</div>}
                  </div>
                </div>
                <div className="rounded-2xl p-3 border border-[#DAA520]/30" style={{ background:'#2A2A2A' }}>
                  <div className="text-sm font-semibold mb-2" style={{ color:'#DAA520' }}>乘客</div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {passengersUsers.map(u => (<div key={u.id} className="text-xs">{u.phone} · {(u as any).name || u.email}</div>))}
                    {passengersUsers.length===0 && <div className="text-xs text-gray-400">無</div>}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl shadow-md overflow-hidden mt-4 border border-[#DAA520]/40" style={{ background:'#1A1A1A' }}>
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold" style={{ color:'#DAA520' }}>用戶列表</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead style={{ background:'#2A2A2A' }}>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        用戶資訊
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        類型
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        狀態
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        註冊時間
                      </th>
                    </tr>
                  </thead>
                  <tbody style={{ background:'#1A1A1A' }}>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <User className="w-8 h-8 mr-3" style={{ color:'#DAA520' }} />
                            <div>
                              <div className="text-sm font-medium" style={{ color:'#e5e7eb' }}>{(user as any).name || user.email}</div>
                              <div className="text-sm" style={{ color:'#9ca3af' }}>{user.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.user_type === 'passenger' ? 'bg-blue-100 text-blue-800' :
                            user.user_type === 'driver' ? 'bg-green-100 text-green-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {user.user_type === 'passenger' && '乘客'}
                            {user.user_type === 'driver' && '司機'}
                            {user.user_type === 'admin' && '管理員'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {user.status === 'active' ? '活躍' : '停用'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color:'#9ca3af' }}>
                          {formatDate(user.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Trips Tab */}
        {activeTab === 'trips' && (
          <div>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">行程監控</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        行程資訊
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        狀態
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        最近事件
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        費用
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        時間
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {trips.slice(0, tripRowsLimit).map((trip) => (
                      <tr key={trip.id} className="cursor-pointer hover:bg-gray-50" onClick={()=>{
                        const pick: any = (trip as any).pickup_location
                        if (pick && typeof pick.lat==='number' && typeof pick.lng==='number') setRadiusCenter({ lat: pick.lat, lng: pick.lng })
                        setDispatchRideId(trip.id)
                      }}>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <MapPin className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-gray-900">{trip.pickup_address}</span>
                              <button onClick={()=>copyTripAddress(trip)} className="ml-2 px-2 py-1 text-xs rounded bg-gray-200">複製</button>
                            </div>
                            <div className="flex items-center space-x-2">
                              <MapPin className="w-4 h-4 text-red-600" />
                              <span className="text-sm text-gray-900">{trip.dropoff_address}</span>
                            </div>
                            {trip.status === 'requested' && (
                              <div className="grid grid-cols-3 gap-2 pt-2">
                                <input value={manualForm[trip.id]?.plate||''} onChange={e=>updateManualForm(trip.id,'plate',e.target.value)} placeholder="支援車牌號碼（含顏色）" className="px-2 py-1 border rounded text-xs" />
                                <input value={manualForm[trip.id]?.model||''} onChange={e=>updateManualForm(trip.id,'model',e.target.value)} placeholder="支援車款" className="px-2 py-1 border rounded text-xs" />
                                <input value={manualForm[trip.id]?.etaMin||''} onChange={e=>updateManualForm(trip.id,'etaMin',Number(e.target.value||0))} placeholder="預計抵達時間（分鐘）" className="px-2 py-1 border rounded text-xs" />
                                <button onClick={()=>openManualModal(trip.id)} className="col-span-3 px-2 py-1 rounded bg-blue-600 text-white text-xs">手動外調</button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(trip.status)}`}>
                            {getStatusText(trip.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {latestEvents[trip.id] ? (
                            <div>
                              <div className="font-medium">{latestEvents[trip.id].type}</div>
                              <div className="text-xs text-gray-500">{new Date(latestEvents[trip.id].time).toLocaleString('zh-TW')}</div>
                            </div>
                          ) : <span className="text-gray-500">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            ${trip.final_price || trip.estimated_price}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(trip.created_at)}
                        </td>
                      </tr>
                    ))}
                    {trips.length > tripRowsLimit && (
                      <tr>
                        <td colSpan={5} className="px-6 py-3">
                          <button onClick={()=>setTripRowsLimit(l=>l+50)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded">顯示更多</button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ops' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">事件查詢</h3>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Trip ID</label>
                <input value={dispatchRideId} onChange={e=>setDispatchRideId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="輸入行程 ID" />
                <label className="block text-sm font-medium text-gray-700">事件類型</label>
                <select multiple value={eventTypes} onChange={e => {
                  const opts = Array.from(e.target.selectedOptions).map(o => o.value)
                  setEventTypes(opts as any)
                }} className="w-full px-3 py-2 border border-gray-300 rounded-lg h-28">
                  {['assign_driver','driver_ping','driver_location','driver_arrived','passenger_picked_up','auto_reassign','candidate_pool','payment_confirmed','frontend_error','frontend_perf','rating'].map(t=>(
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="flex space-x-2">
                  <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                  <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <button onClick={queryEvents} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">查詢</button>
                <div className="mt-3">
                  <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto max-h-60">{eventsResult.length ? JSON.stringify(eventsResult, null, 2) : '尚無資料'}</pre>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">風險事件</h3>
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Trip ID</label>
                <input value={riskTripId} onChange={e=>setRiskTripId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="輸入行程 ID" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => markRisk('risk_no_show')} className="px-3 py-1 bg-red-600 text-white rounded">無到場</button>
                  <button onClick={() => markRisk('risk_abnormal_cancel')} className="px-3 py-1 bg-orange-600 text-white rounded">異常取消</button>
                  <button onClick={() => markRisk('risk_dispute')} className="px-3 py-1 bg-yellow-600 text-white rounded">糾紛</button>
                </div>
                <label className="block text-sm font-medium text-gray-700">封禁/降權</label>
                <div className="flex space-x-2">
                  <input value={userModerationId} onChange={e=>setUserModerationId(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg" placeholder="輸入用戶 ID" />
                  <select value={moderationAction} onChange={e=>setModerationAction(e.target.value as any)} className="px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="ban">封禁</option>
                    <option value="suspend">停權</option>
                    <option value="activate">恢復</option>
                  </select>
                  <button onClick={applyModeration} className="px-3 py-2 bg-purple-600 text-white rounded">套用</button>
                </div>
                <div className="mt-3 text-xs text-gray-600">所有操作會寫入 ops_events 以供審計</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">告警與指標</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 rounded p-3">
                  <div className="text-xs text-red-700">前端錯誤（24h）</div>
                  <div className="text-2xl font-bold text-red-700">{alertCounts.frontErrors}</div>
                </div>
                <div className="bg-yellow-50 rounded p-3">
                  <div className="text-xs text-yellow-700">風險事件（7d）</div>
                  <div className="text-2xl font-bold text-yellow-700">{alertCounts.risk}</div>
                </div>
                <div className="bg-blue-50 rounded p-3">
                  <div className="text-xs text-blue-700">平均載入時間（ms）</div>
                  <div className="text-2xl font-bold text-blue-700">{metrics.avgLoadMs}</div>
                </div>
                <div className="bg-green-50 rounded p-3">
                  <div className="text-xs text-green-700">心跳數（24h）</div>
                  <div className="text-2xl font-bold text-green-700">{metrics.driverPings}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center space-x-2">
                <button onClick={refreshAlerts} className="px-3 py-1 bg-gray-200 text-gray-700 rounded">刷新</button>
                <label className="text-xs text-gray-700">排程提前分鐘</label>
                <input type="number" min={5} max={60} value={minutesBefore} onChange={e=>setMinutesBefore(parseInt(e.target.value||'15')||15)} className="px-2 py-1 border border-gray-300 rounded w-16" />
                <button onClick={runSchedule} className="px-3 py-1 bg-indigo-600 text-white rounded">執行排程</button>
                <button onClick={saveSchedulerMinutes} className="px-3 py-1 bg-gray-200 text-gray-700 rounded">保存雲端</button>
                <div className="ml-3 text-xs text-gray-700">本月回金總額：<span className="font-bold" style={{ color:'#D4AF37' }}>NT$ {cashbackTotal}</span></div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">資料庫遷移檢查</h3>
              <DbMigrationsCheck />
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">推播測試</h3>
              <div className="space-y-2">
                <input value={pushUserId} onChange={e=>setPushUserId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded" placeholder="輸入目標用戶 ID" />
                <input value={pushTitle} onChange={e=>setPushTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded" placeholder="標題" />
                <input value={pushBody} onChange={e=>setPushBody(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded" placeholder="內容" />
                <button onClick={async () => {
                  if (!pushUserId) { alert('請輸入用戶 ID'); return }
                  try {
                    const r = await sendPush({ user_id: pushUserId, title: pushTitle, body: pushBody })
                    alert(r.ok ? `已送出：${r.data.sent}；失敗：${r.data.failed}` : '發送失敗')
                  } catch { alert('發送失敗') }
                }} className="px-3 py-1 bg-green-600 text-white rounded">發送推播</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'addPassenger' && (
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-[#111] rounded-2xl p-6 border border-[#D4AF37]/40">
              <div className="text-lg font-semibold mb-4" style={{ color:'#FFD700' }}>新增乘客</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input placeholder="姓名" className="px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" />
                <input placeholder="電話" className="px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" />
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input id="addPassengerAddress" placeholder="地址" className="px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" />
                <button onClick={async ()=>{
                  const el = document.getElementById('addPassengerAddress') as HTMLInputElement
                  const addr = el?.value?.trim()
                  if (!addr) return
                  const loc = await geocodeOSM(addr)
                  if (loc) setRadiusCenter(loc)
                }} className="px-3 py-2 rounded-2xl border border-[#D4AF37]/40 text-white">定位地址</button>
              </div>
              <div className="mt-4">
                <button className="px-4 py-2 rounded-2xl" style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111' }}>建立</button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'addDriver' && (
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-[#111] rounded-2xl p-6 border border-[#D4AF37]/40">
              <div className="text-lg font-semibold mb-4" style={{ color:'#FFD700' }}>新增司機</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input placeholder="姓名" className="px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" />
                <input placeholder="電話" className="px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" />
                <input placeholder="車牌/車款" className="px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" />
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input id="addDriverAddress" placeholder="地址" className="px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" />
                <button onClick={async ()=>{
                  const el = document.getElementById('addDriverAddress') as HTMLInputElement
                  const addr = el?.value?.trim()
                  if (!addr) return
                  const loc = await geocodeOSM(addr)
                  if (loc) setRadiusCenter(loc)
                }} className="px-3 py-2 rounded-2xl border border-[#D4AF37]/40 text白">定位地址</button>
              </div>
              <div className="mt-4">
                <button className="px-4 py-2 rounded-2xl" style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111' }}>建立</button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'pricing' && (
          <div className="grid grid-cols-1 gap-6">
            <div className="bg-[#111] rounded-2xl p-6 border border-[#D4AF37]/40">
              <div className="text-lg font-semibold mb-4" style={{ color:'#FFD700' }}>計價規則</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input placeholder="基本費" className="px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" />
                <input placeholder="每公里" className="px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" />
                <input placeholder="每分鐘" className="px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" />
                <input placeholder="服務費" className="px-3 py-2 bg-[#1a1a1a] border border-[#D4AF37]/40 rounded-2xl" />
              </div>
              <div className="mt-4">
                <button className="px-4 py-2 rounded-2xl" style={{ backgroundImage: 'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111' }}>保存</button>
              </div>
            </div>
          </div>
        )}

        {/* Dispatch Tab */}
        {activeTab === 'dispatch' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">待派單列表</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {trips.filter(t => t.status === 'requested').map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{t.id}</div>
                      <div className="text-xs text-gray-600">{t.pickup_address} → {t.dropoff_address}</div>
                    </div>
                    <button
                      onClick={() => setDispatchRideId(t.id)}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >選擇</button>
                  </div>
                ))}
                {trips.filter(t => t.status === 'requested').length === 0 && (
                  <div className="text-sm text-gray-600">目前沒有待派單的行程</div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">派單控制</h3>
                  <div className="space-y-4">
                    <div className="bg-red-50 rounded-lg p-3">
                      <div className="text-sm font-semibold text-red-900 mb-2">長距離行程（&gt;30km）待決定</div>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {longDistance.length > 0 ? longDistance.map(x => (
                          <div key={x.id} className="flex items-center justify-between p-2 bg-white rounded border border-red-200">
                            <div className="text-sm text-gray-800">
                              <div className="font-medium">{x.id}</div>
                              <div className="text-xs text-gray-600">{x.distance.toFixed(1)} 公里 · {new Date(x.created_at).toLocaleString('zh-TW')}</div>
                            </div>
                            <div className="flex space-x-2">
                              <button onClick={() => setDispatchRideId(x.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">手動指派</button>
                              <button onClick={async () => {
                                try { await supabase.from('ops_events').insert({ event_type: 'long_distance_handle', ref_id: x.id, payload: { mode: 'auto' } }); alert('已允許自動派單'); } catch { alert('操作失敗') }
                              }} className="px-2 py-1 text-xs bg-green-600 text-white rounded">允許自動派單</button>
                            </div>
                          </div>
                        )) : <div className="text-xs text-gray-600">目前無長距離行程</div>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Ride ID</label>
                      <input
                        value={dispatchRideId}
                        onChange={e => setDispatchRideId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="輸入或從左側選擇"
                      />
                    </div>
                    {dispatchRideId && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-semibold text-gray-900">候補池</div>
                          <div className="space-x-2">
                            <button onClick={() => loadCandidatePool(dispatchRideId)} className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300">載入</button>
                            <button onClick={recomputeCandidatePool} className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700">重算候選（智能排序）</button>
                            <button onClick={() => assignCandidateTopN(3)} className="px-2 py-1 text-xs bg-pink-600 text-white rounded hover:bg-pink-700">指派候補 Top3</button>
                            <button onClick={() => assignCandidateTopN(5)} className="px-2 py-1 text-xs bg-pink-600 text-white rounded hover:bg-pink-700">指派候補 Top5</button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          {candidatePool.length > 0 ? candidatePool.map(d => (
                            <div key={d.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                              <div className="text-sm text-gray-700">
                                <span className="font-medium">{d.name || d.phone}</span>
                                <span className="ml-2">{d.plate_number || '未提供'} {d.car_model || ''} {d.car_color || ''}</span>
                              </div>
                              {!((() => {
                                try {
                                  const ride = trips.find(t => t.id === dispatchRideId) as any
                                  const a = ride?.pickup_location, b = ride?.dropoff_location
                                  if (a && b) {
                                    const toRad = (v:number)=> (v*Math.PI)/180
                                    const R=6371; const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng)
                                    const h=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2
                                    const distKm=2*R*Math.asin(Math.sqrt(h))
                                    return distKm>=40
                                  }
                                  return false
                                } catch { return false }
                              })()) && (
                                <button onClick={() => manualAssign(d.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">指派此候選</button>
                              )}
                            </div>
                          )) : <div className="text-xs text-gray-600">尚無候補</div>}
                        </div>
                        <div className="mt-2 text-xs text-gray-600">管理優先權：{(() => {
                          const ride = trips.find(t => t.id === dispatchRideId) as any
                          if (!ride) return '—'
                          // 簡易顯示，詳見優先權定時器
                          return '前 15 秒 / 前 90 秒 / 一般模式'
                        })()}</div>
                      </div>
                    )}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-sm font-semibold text-gray-900 mb-2">權重調校</div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="text-xs text-gray-700">距離 <input type="number" step="0.01" value={weights.wDist} onChange={e=>setWeights(w=>({ ...w, wDist: parseFloat(e.target.value||'0')||0 }))} className="ml-2 px-2 py-1 border border-gray-300 rounded w-20" /></label>
                        <label className="text-xs text-gray-700">ETA <input type="number" step="0.01" value={weights.wEta} onChange={e=>setWeights(w=>({ ...w, wEta: parseFloat(e.target.value||'0')||0 }))} className="ml-2 px-2 py-1 border border-gray-300 rounded w-20" /></label>
                        <label className="text-xs text-gray-700">上線新鮮度 <input type="number" step="0.01" value={weights.wRecency} onChange={e=>setWeights(w=>({ ...w, wRecency: parseFloat(e.target.value||'0')||0 }))} className="ml-2 px-2 py-1 border border-gray-300 rounded w-20" /></label>
                        <label className="text-xs text-gray-700">車型匹配 <input type="number" step="0.01" value={weights.wCar} onChange={e=>setWeights(w=>({ ...w, wCar: parseFloat(e.target.value||'0')||0 }))} className="ml-2 px-2 py-1 border border-gray-300 rounded w-20" /></label>
                        <label className="text-xs text-gray-700">評分 <input type="number" step="0.01" value={weights.wRating} onChange={e=>setWeights(w=>({ ...w, wRating: parseFloat(e.target.value||'0')||0 }))} className="ml-2 px-2 py-1 border border-gray-300 rounded w-20" /></label>
                      </div>
                      <div className="mt-2">
                        <button onClick={saveWeights} className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">保存設定</button>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <label className="text-sm">框選模式</label>
                      <button onClick={() => setSelectMode(v => !v)} className={`px-3 py-1 rounded ${selectMode ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{selectMode ? '開啟' : '關閉'}</button>
                      <button onClick={() => { setRectStart(null); setRectEnd(null) }} className="px-3 py-1 rounded bg-gray-200 text-gray-700">清除選區</button>
                    </div>
                    <div className="flex items-center space-x-3">
                      <label className="text-sm">自動派單</label>
                      <button onClick={() => setAutoDispatchEnabled(v => !v)} className={`px-3 py-1 rounded ${autoDispatchEnabled ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{autoDispatchEnabled ? '開啟' : '關閉'}</button>
                      <span className="text-xs text-gray-500">每 30 秒為待派單指派最近在線司機</span>
                    </div>
                    <div className="flex space-x-3">
                      <button onClick={retryAssign} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">重試派單</button>
                      <button onClick={runSchedule} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">執行排程</button>
                      <button onClick={assignNearest} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">指派最近</button>
                      <button onClick={assignNearestInSelection} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">指派最近（選區）</button>
                      <button onClick={() => assignTopNInSelection(3)} className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700">批量指派 Top3</button>
                    </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">結果</label>
                  <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-x-auto">{dispatchRes ? JSON.stringify(dispatchRes, null, 2) : '尚無結果'}</pre>
                </div>
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-2">就近司機</h4>
                  <div className="mb-2">
                    <label className="text-xs text-gray-600 mr-2">半徑篩選（公里）</label>
                    <input type="number" value={radiusKm} onChange={e => setRadiusKm(parseFloat(e.target.value || '5') || 5)} className="px-2 py-1 border border-gray-300 rounded" style={{ width: 80 }} />
                    <span className="ml-3 text-xs text-gray-600">排序</span>
                    <select value={sortMode} onChange={e => setSortMode(e.target.value as any)} className="ml-1 px-2 py-1 border border-gray-300 rounded text-xs">
                      <option value="distance">距離最近</option>
                      <option value="recent">最近上線</option>
                      <option value="smart">智能（權重）</option>
                    </select>
                    <label className="ml-3 text-xs text-gray-600 inline-flex items-center">
                      <input type="checkbox" checked={onlyOnline} onChange={e => setOnlyOnline(e.target.checked)} className="mr-1" />
                      只顯示在線（&lt;10 分）
                    </label>
                    <button onClick={refreshEtas} className="ml-3 px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">更新 ETA</button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(() => {
                      const ride = trips.find(t => t.id === dispatchRideId)
                      const near = driversList
                        .filter(d => typeof d.current_lat === 'number' && typeof d.current_lng === 'number')
                        .filter(d => {
                          if (!onlyOnline) return true
                          const last = d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0
                          const ageSec = last ? Math.floor((Date.now() - last) / 1000) : Infinity
                          return ageSec < 600
                        })
                        .map(d => ({
                          d,
                          dist: (() => {
                            const base = radiusCenter || (ride as any)?.pickup_location
                            if (!base) return Infinity
                            return haversine(d.current_lat!, d.current_lng!, base.lat, base.lng)
                          })()
                        }))
                        .filter(x => x.dist <= radiusKm)
                        .sort((a, b) => {
                          if (sortMode === 'recent') {
                            const al = a.d.last_seen_at ? new Date(a.d.last_seen_at).getTime() : 0
                            const bl = b.d.last_seen_at ? new Date(b.d.last_seen_at).getTime() : 0
                            return bl - al
                          }
                          if (sortMode === 'smart') {
                            const ra = computeWeightedScore(ride, a.d, radiusCenter || (ride as any)?.pickup_location)
                            const rb = computeWeightedScore(ride, b.d, radiusCenter || (ride as any)?.pickup_location)
                            return ra - rb
                          }
                          return a.dist - b.dist
                        })
                        .slice(0, 10)
                      return near.length > 0 ? near.map(({ d, dist }) => (
                        <div key={d.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="text-sm text-gray-700">
                            <span className="inline-flex items-center font-medium">
                              <span style={{ display:'inline-block', width:8, height:8, borderRadius:9999, marginRight:6, background:((): string => {
                                const last = d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0
                                const ageSec = last ? Math.floor((Date.now() - last) / 1000) : Infinity
                                return ageSec < 120 ? '#22c55e' : ageSec < 600 ? '#f59e0b' : '#9ca3af'
                              })() }}></span>
                              {d.name || d.phone}
                            </span>
                            <span className="ml-2">{d.plate_number || '未提供'} {d.car_model || ''} {d.car_color || ''}</span>
                            <span className="ml-2">{dist !== Infinity ? `${dist.toFixed(1)} 公里` : '距離未知'}</span>
                            <span className="ml-2">
                              {etaCache[d.id] != null ? `${etaCache[d.id]} 分 ETA` : (dist !== Infinity ? `${Math.max(1, Math.round((dist / 30) * 60))} 分 ETA` : '')}
                            </span>
                            <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded">{deriveDriverType(d)}</span>
                            <span className="ml-2">⭐ {(d.phone && driverRatings[d.phone] != null ? driverRatings[d.phone] : (d.rating ?? 4.0)).toFixed(1)}</span>
                            <span className="ml-2 text-xs text-gray-500">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString('zh-TW') : '無最近上線'}</span>
                          </div>
                          <button onClick={() => manualAssign(d.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">指派</button>
                        </div>
                      )) : <div className="text-sm text-gray-600">無可用司機位置</div>
                    })()}
                  </div>
                </div>
                <div>
                  <h4 className="text-md font-semibold text-gray-200 mb-2">地圖</h4>
                  <div id="admin-map" className="rounded-2xl shadow-2xl overflow-hidden w-full relative" style={{ height: '100vh' }}>
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[90%] max-w-xl z-20">
                      <div className="rounded-2xl shadow-2xl border border-[#D4AF37]/50 bg-[#1a1a1a] p-3">
                        <div className="mb-2">
                          <label className="block text-xs text-gray-300 mb-1">🔍 您的位置（上車地點）</label>
                          {mapReady ? (
                            <gmpx-place-autocomplete id="admin-pickup-el" style={{ display:'block' }} placeholder="例如：台中市政府"></gmpx-place-autocomplete>
                          ) : (
                            <input id="admin-pickup-input" value={adminPickupAddress} onChange={e=>setAdminPickupAddress(e.target.value)} className="w-full px-3 py-2 border border-[#D4AF37]/50 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent" placeholder="例如：台中市政府" />
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-300 mb-1">📍 您要去哪？（目的地點）</label>
                          {mapReady ? (
                            <gmpx-place-autocomplete id="admin-dropoff-el" style={{ display:'block' }} placeholder="例如：台中火車站"></gmpx-place-autocomplete>
                          ) : (
                            <input id="admin-dropoff-input" value={adminDropoffAddress} onChange={e=>setAdminDropoffAddress(e.target.value)} className="w-full px-3 py-2 border border-[#D4AF37]/50 bg-[#1a1a1a] text-white rounded-2xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent" placeholder="例如：台中火車站" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="absolute top-3 right-3 w-80 z-20">
                      <div className="rounded-2xl shadow-2xl border border-[#D4AF37]/50 bg-[#1a1a1a] p-3">
                        <div className="text-sm font-semibold mb-2" style={{ color:'#FFD700' }}>待接單</div>
                        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                          {(trips || []).filter(t => t.status==='requested').slice(0,20).map((t)=>(
                            <div key={t.id} className="p-2 rounded-2xl bg-[#111] border border-[#D4AF37]/20">
                          <div className="text-xs text-gray-400 mb-1">{new Date(t.created_at).toLocaleString('zh-TW')}</div>
                          <div className="text-sm text-gray-100">{t.pickup_address}</div>
                          <div className="text-xs text-gray-400">→ {t.dropoff_address}</div>
                              {(() => {
                                const tag = requestedTags[t.id]
                                return (
                                  <div className="mt-1 text-xs">
                                    {tag?.noSmoking && <span className="inline-flex items-center bg-[#111] text-white border border-[#D4AF37]/30 px-2 py-0.5 rounded mr-2">🚭 禁菸</span>}
                                    {tag?.pets && <span className="inline-flex items-center bg-[#111] text-white border border-[#D4AF37]/30 px-2 py-0.5 rounded">🐾 攜帶寵物</span>}
                                  </div>
                                )
                              })()}
                              <div className="flex gap-2 mt-2">
                                <button onClick={()=>{ copyTripAddress(t) }} className="px-2 py-1 text-xs border border-[#D4AF37]/40 rounded-2xl">複製地址</button>
                                <button onClick={()=>{ const p: any = (t as any).pickup_location; if(p) setRadiusCenter({ lat: p.lat, lng: p.lng }); setDispatchRideId(t.id) }} className="px-2 py-1 text-xs rounded-2xl" style={{ backgroundImage:'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111' }}>派單</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    <Suspense fallback={<div className="p-3 text-xs text-gray-600">載入地圖...</div>}>
                      {(() => {
                        const ride = trips.find(t => t.id === dispatchRideId) as any
                        return (
                          <DispatchMap
                            pickup={ride?.pickup_location || null}
                            center={radiusCenter}
                            radiusKm={radiusKm}
                            drivers={driversList}
                            candidateIds={candidatePool.map(c => c.id)}
                            onAssign={manualAssign}
                          />
                        )
                      })()}
                    </Suspense>
                  </div>
                  <div className="mt-3 text-xs text-gray-600">
                    <span className="inline-flex items-center mr-3"><span style={{ display:'inline-block', width:10, height:10, borderRadius:9999, background:'#22c55e', marginRight:6 }}></span>在線（&lt;2 分）</span>
                    <span className="inline-flex items-center mr-3"><span style={{ display:'inline-block', width:10, height:10, borderRadius:9999, background:'#f59e0b', marginRight:6 }}></span>最近（&lt;10 分）</span>
                    <span className="inline-flex items-center"><span style={{ display:'inline-block', width:10, height:10, borderRadius:9999, background:'#9ca3af', marginRight:6 }}></span>離線（≥10 分）</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">提示：點擊地圖可設定半徑中心</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
