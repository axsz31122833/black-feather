import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, ensureAuth } from '../lib/supabaseClient'
import { getSupabaseUrl } from '../lib/supabase'
import { useAuthStore } from '../stores/auth'
import BottomNav from '../components/BottomNav'

type DriverRow = {
  id: string
  name?: string
  phone?: string
  status?: string
  current_lat?: number
  current_lng?: number
  last_seen_at?: string
}

export default function AdminCommandCenter() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [drivers, setDrivers] = useState<DriverRow[]>([])
  const [tripsToday, setTripsToday] = useState(0)
  const [revenueToday, setRevenueToday] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [fareBase, setFareBase] = useState<number>(70)
  const [farePerKm, setFarePerKm] = useState<number>(15)
  const [farePerMin, setFarePerMin] = useState<number>(3)
  const [longThreshold, setLongThreshold] = useState<number>(20)
  const [longRate, setLongRate] = useState<number>(10)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<Record<string, any>>({})
  const orderMarkerRef = useRef<any>(null)
  const mapElRef = useRef<HTMLDivElement | null>(null)
  const [requestedTrips, setRequestedTrips] = useState<Array<{ id: string; pickup_location?: { address?: string; lat?: number; lng?: number }; estimated_price?: number; passenger_id?: string; created_at?: string }>>([])
  const [selectedTrip, setSelectedTrip] = useState<any>(null)
  const [onlineDrivers, setOnlineDrivers] = useState<any[]>([])
  const [usersPassengers, setUsersPassengers] = useState<any[]>([])
  const [usersDrivers, setUsersDrivers] = useState<any[]>([])
  const [usersAdmins, setUsersAdmins] = useState<any[]>([])
  const [vehicleEdit, setVehicleEdit] = useState<Record<string, { plate?: string; model?: string; color?: string }>>({})
  const [activeLeft, setActiveLeft] = useState<'overview'|'users'|'support'>('overview')
  const [chatSummaries, setChatSummaries] = useState<Array<{ trip_id: string; last_text: string; at: string; unread: number }>>([])
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; role: string; text: string; created_at: string; image_url?: string | null; location_data?: any }>>([])
  const [chatText, setChatText] = useState('')
  const activeChatRef = useRef<string | null>(null)
  const reloadActiveThread = async () => {
    try {
      const id = (activeChatRef.current || '').toString()
      if (!id) return
      const { data } = await supabase.from('trip_messages').select('*').eq('trip_id', id).order('created_at', { ascending: true })
      setChatMessages((data || []).map((row:any)=>({ id: row.id, role: row.role, text: row.message_content || row.content || row.text || '', created_at: row.created_at, image_url: row.image_url || null, location_data: row.location_data || null })))
    } catch {}
  }
  const [focusedDriver, setFocusedDriver] = useState<any>(null)
  const [overdueRequested, setOverdueRequested] = useState<any[]>([])
  const [showOverdueAlert, setShowOverdueAlert] = useState(false)
  const [driverSummary, setDriverSummary] = useState<{ id?: string; trips: number; revenue: number } | null>(null)
  const [imgPreview, setImgPreview] = useState<string | null>(null)
  const [connDiag, setConnDiag] = useState<{ url: string; session: string }>({ url: '', session: 'unknown' })
  const reloadRequested = async () => {
    try {
      const { data: req } = await supabase
        .from('trips')
        .select('id,pickup_location,estimated_price,passenger_id,created_at')
        .eq('status','requested')
        .order('created_at',{ ascending:false })
        .limit(100)
      setRequestedTrips(req || [])
    } catch { setRequestedTrips([]) }
  }

  useEffect(() => {
    ;(async () => {
      try {
        await ensureAuth()
        const start = new Date()
        start.setHours(0,0,0,0)
        const startIso = start.toISOString()
        try { console.log('【發送請求前檢查】表名:', 'trips', '過濾條件:', { gte_created_at: startIso }) } catch {}
        const { data: tripsData } = await supabase.from('trips').select('*').gte('created_at', startIso)
        setTripsToday((tripsData || []).length)
        setRevenueToday((tripsData || []).filter(t=>t.status==='completed').reduce((s: number, t:any)=> s + Number(t.final_price||0), 0))
      } catch {}
      try {
        try { console.log('【發送請求前檢查】表名:', 'trips', '過濾條件:', { status_eq: 'requested' }) } catch {}
        const { data: req } = await supabase.from('trips').select('*').eq('status','requested').order('created_at',{ ascending:false }).limit(100)
        setRequestedTrips(req || [])
      } catch {}
      try {
        try { console.log('【發送請求前檢查】表名:', 'driver_profiles', '過濾條件:', { status_eq: 'pending' }) } catch {}
        const { data: profs } = await supabase.from('driver_profiles').select('id').eq('status','pending')
        setPendingCount((profs || []).length)
      } catch { setPendingCount(0) }
      try {
        try { console.log('【發送請求前檢查】表名:', 'driver_profiles', '過濾條件:', null) } catch {}
        const { data } = await supabase.from('driver_profiles').select('user_id,is_online,current_location,car_plate,car_model,updated_at')
        setDrivers((data || []).map((d:any)=>({ id: d.user_id, is_online: !!d.is_online, current_location: d.current_location || null, car_plate: d.car_plate, car_model: d.car_model, updated_at: d.updated_at })))
      } catch { setDrivers([]) }
      try {
        try { console.log('【發送請求前檢查】表名:', 'profiles', '過濾條件:', { role_eq: 'driver' }) } catch {}
        const { data } = await supabase.from('profiles').select('id,is_online,role').eq('role','driver')
        try { console.log('【統計】driver profiles 原始筆數:', (data || []).length) } catch {}
        setOnlineDrivers((data || []).map((p:any)=>({ id: p.id, is_online: !!p.is_online })))
      } catch {}
      try {
        try { console.log('【發送請求前檢查】表名:', 'profiles', '過濾條件:', null) } catch {}
        const { data: profs } = await supabase.from('profiles').select('id,user_id,full_name,phone,role')
        const list = (profs || []).map((p:any)=>({ id: p.id, user_id: p.user_id, full_name: p.full_name || '', phone: p.phone || '', role: p.role || '' }))
        setUsersPassengers(list.filter((u:any)=>u.role==='passenger'))
        setUsersDrivers(list.filter((u:any)=>u.role==='driver'))
        setUsersAdmins(list.filter((u:any)=>u.role==='admin'))
      } catch {}
      try {
        try { console.log('【發送請求前檢查】表名:', 'fare_config', '過濾條件:', { id_eq: 'global' }) } catch {}
        const { data } = await supabase.from('fare_config').select('*').eq('id','global').maybeSingle()
        if (data) {
          setFareBase(Number(data.base||70))
          setFarePerKm(Number(data.per_km||15))
          setFarePerMin(Number(data.per_min||3))
          setLongThreshold(Number(data.long_threshold||20))
          setLongRate(Number(data.long_rate||10))
        } else {
          const s = localStorage.getItem('bf_fare_config')
          if (s) {
            const cfg = JSON.parse(s)
            setFareBase(Number(cfg.base||70))
            setFarePerKm(Number(cfg.per_km||15))
            setFarePerMin(Number(cfg.per_min||3))
            setLongThreshold(Number(cfg.long_threshold||20))
            setLongRate(Number(cfg.long_rate||10))
          }
        }
      } catch {}
    })()
  }, [])
  useEffect(() => {
    ;(async ()=>{
      try {
        const url = (getSupabaseUrl() || '').slice(0, 10)
        const { data: { session } } = await supabase.auth.getSession()
        const s = session?.access_token ? 'valid' : 'none'
        setConnDiag({ url, session: s })
      } catch { setConnDiag({ url:'', session:'error' }) }
    })()
  }, [])

  useEffect(() => {
    activeChatRef.current = activeChat
  }, [activeChat])

  useEffect(() => {
    const ch1 = supabase.channel('admin-cc-drivers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_profiles' }, (payload: any) => {
        const d = payload.new || payload.old
        const did = d?.user_id || d?.id
        if (!did) return
        const mapped = { id: did, is_online: !!d.is_online, current_location: d.current_location || null, car_plate: d.car_plate, car_model: d.car_model, updated_at: d.updated_at }
        setDrivers(prev => {
          const idx = prev.findIndex((x:any) => x.id === did)
          const list = [...prev]
          if (idx >= 0) list[idx] = { ...list[idx], ...mapped }
          else list.unshift(mapped)
          return list
        })
      }).subscribe()
    const chP = supabase.channel('admin-cc-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload: any) => {
        try {
          const p = payload.new || payload.old
          if (!p) return
          const one = { id: p.id, user_id: p.user_id, full_name: p.full_name || '', phone: p.phone || '', role: p.role || '' }
          setUsersPassengers(prev => {
            const arr = prev.filter((x:any)=>x.id!==one.id)
            return (one.role==='passenger') ? [one, ...arr] : arr
          })
          setUsersDrivers(prev => {
            const arr = prev.filter((x:any)=>x.id!==one.id)
            return (one.role==='driver') ? [one, ...arr] : arr
          })
          setUsersAdmins(prev => {
            const arr = prev.filter((x:any)=>x.id!==one.id)
            return (one.role==='admin') ? [one, ...arr] : arr
          })
        } catch {}
      }).subscribe()
    const ch2 = supabase.channel('admin-cc-trips')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        const start = new Date()
        start.setHours(0,0,0,0)
        const startIso = start.toISOString()
        try { console.log('【發送請求前檢查】表名:', 'trips', '過濾條件:', { gte_created_at: startIso }) } catch {}
        supabase.from('trips').select('*').gte('created_at', startIso).then((res:any)=>{
          const arr = res.data || []
          setTripsToday(arr.length)
          setRevenueToday(arr.filter((t:any)=>t.status==='completed').reduce((s:number,t:any)=>s+Number(t.final_price||0),0))
        })
        try { console.log('【發送請求前檢查】表名:', 'trips', '過濾條件:', { status_eq: 'requested' }) } catch {}
        supabase.from('trips').select('*').eq('status','requested').order('created_at',{ ascending:false }).limit(100).then((res:any)=>{
          setRequestedTrips(res.data || [])
        })
        try { console.log('【發送請求前檢查】表名:', 'profiles', '過濾條件:', { role_eq: 'driver' }) } catch {}
        supabase.from('profiles').select('id,is_online,role').eq('role','driver').then((res:any)=> { try { console.log('【統計】driver profiles 即時筆數:', (res.data || []).length) } catch {}; setOnlineDrivers((res.data || []).map((p:any)=>({ id:p.id, is_online: !!p.is_online }))) })
      }).subscribe()
    return () => { ch1.unsubscribe(); ch2.unsubscribe(); chP.unsubscribe() }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const g = await (await import('../lib/googleMaps')).loadGoogleMaps()
        if (!g?.maps) return
        if (!mapElRef.current) return
        if (!mapRef.current) {
          let center = { lat: 25.0418, lng: 121.5651 }
          let zoom = 11
          try {
            const s = localStorage.getItem('bf_admin_map_state')
            if (s) {
              const st = JSON.parse(s)
              if (typeof st.lat === 'number' && typeof st.lng === 'number') center = { lat: st.lat, lng: st.lng }
              if (typeof st.zoom === 'number') zoom = st.zoom
            }
          } catch {}
          mapRef.current = new g.maps.Map(mapElRef.current, { center, zoom })
          g.maps.event.addListener(mapRef.current, 'idle', () => {
            try {
              const c = mapRef.current!.getCenter()
              const z = mapRef.current!.getZoom()
              localStorage.setItem('bf_admin_map_state', JSON.stringify({ lat: c.lat(), lng: c.lng(), zoom: z }))
            } catch {}
          })
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    try {
      const g: any = (window as any).google
      if (!g || !g.maps || !mapRef.current) return
      const m = mapRef.current
      const mk = markersRef.current
      drivers.forEach((d:any) => {
        const key = d.id
        let lat: number | null = null, lng: number | null = null
        if (typeof d.current_lat === 'number' && typeof d.current_lng === 'number') { lat = d.current_lat; lng = d.current_lng }
        else if (d.current_location && typeof d.current_location.lat === 'number' && typeof d.current_location.lng === 'number') { lat = d.current_location.lat; lng = d.current_location.lng }
        if (lat == null || lng == null) return
        const pos = { lat, lng }
        const isOnline = (onlineDrivers || []).some((x:any)=> x.id === d.id)
        const color = isOnline ? '#10B981' : '#6b7280'
        if (mk[key]) {
          try { mk[key].setPosition(pos) } catch {}
          try { mk[key].setIcon({ path: 'M12 2 L2 9 L2 14 L22 14 L22 9 L12 2 Z', scale: 1, fillColor: color, fillOpacity: 1, strokeColor: color, strokeWeight: 1 }) } catch {}
        } else {
          mk[key] = new g.maps.Marker({ position: pos, map: m, icon: { path: 'M12 2 L2 9 L2 14 L22 14 L22 9 L12 2 Z', scale: 1, fillColor: color, fillOpacity: 1, strokeColor: color, strokeWeight: 1 } })
          mk[key].addListener('click', () => {
            try {
              const drv = drivers.find((x:any) => x.id === d.id)
              ;(window as any).__focusDriver = drv
              setFocusedDriver(drv || null)
            } catch {}
          })
        }
      })
    } catch {}
  }, [drivers])
  useEffect(() => {
    try {
      const now = Date.now()
      const list = (requestedTrips || []).filter((t:any)=> t.created_at && (now - new Date(t.created_at).getTime()) > 120000)
      setOverdueRequested(list)
      setShowOverdueAlert(list.length > 0)
    } catch {}
  }, [requestedTrips])

  const saveFare = async () => {
    const payload = { id: 'global', base: fareBase, per_km: farePerKm, per_min: farePerMin, long_threshold: longThreshold, long_rate: longRate }
    try {
      await ensureAuth()
      await supabase.from('fare_config').upsert(payload, { onConflict: 'id' } as any)
      try { await supabase.from('ops_events').insert({ event_type: 'fare_config_updated', ref_id: 'global', payload }) } catch {}
      try { localStorage.setItem('bf_fare_config', JSON.stringify(payload)) } catch {}
      alert('費率設定已更新')
    } catch (e) {
      alert(`儲存失敗：${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const focusTrip = (t: any) => {
    try {
      const g: any = (window as any).google
      if (!g || !mapRef.current) return
      const pick = t?.pickup_location
      if (!pick || typeof pick.lat !== 'number' || typeof pick.lng !== 'number') return
      mapRef.current.setCenter({ lat: pick.lat, lng: pick.lng })
      mapRef.current.setZoom(14)
      if (orderMarkerRef.current) {
        try { orderMarkerRef.current.setMap(null) } catch {}
        orderMarkerRef.current = null
      }
      orderMarkerRef.current = new g.maps.Marker({
        position: { lat: pick.lat, lng: pick.lng },
        map: mapRef.current,
        icon: { path: g.maps.SymbolPath.BACKWARD_CLOSED_ARROW, scale: 5, fillColor: '#60a5fa', fillOpacity: 1, strokeColor: '#60a5fa', strokeWeight: 1 },
        title: (t?.pickup_location?.address || '待派訂單') + (t?.estimated_price ? ` · $${t.estimated_price}` : '')
      })
      setSelectedTrip(t)
    } catch {}
  }
  useEffect(() => {
    try {
      const ch = supabase
        .channel('admin-chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_messages' }, (p:any)=>{
          try { console.log('【收到任何訊息】', p?.new) } catch {}
          try {
            const row = p.new
            if (row?.trip_id) {
              const lastSeenRaw = localStorage.getItem('bf_admin_chat_seen') || '{}'
              const lastSeen = JSON.parse(lastSeenRaw)
              const unread = lastSeen[row.trip_id] && new Date(row.created_at) <= new Date(lastSeen[row.trip_id]) ? 0 : 1
              setChatSummaries(prev => [{ trip_id: row.trip_id, last_text: row.message_content || row.content || row.text || '', at: row.created_at, unread }, ...prev.filter(x=>x.trip_id!==row.trip_id)])
            }
          } catch {}
          reloadActiveThread()
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_events', filter:'event_type=eq.chat' }, (p:any)=>{
          const row = p.new
          if (!row?.ref_id) return
          const lastSeenRaw = localStorage.getItem('bf_admin_chat_seen') || '{}'
          const lastSeen = JSON.parse(lastSeenRaw)
          const unread = lastSeen[row.ref_id] && new Date(row.created_at) <= new Date(lastSeen[row.ref_id]) ? 0 : 1
          const text = (row.payload && row.payload.text) || '(系統)'
          setChatSummaries(prev => [{ trip_id: row.ref_id, last_text: text, at: row.created_at, unread }, ...prev.filter(x=>x.trip_id!==row.ref_id)])
        })
        .subscribe((status: any) => {
          try { console.log('頻道狀態:', status) } catch {}
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            try { ch.unsubscribe() } catch {}
            const ch2 = supabase
              .channel('admin-chat')
              .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_messages' }, (p:any)=>{
                try { console.log('【收到任何訊息】', p?.new) } catch {}
                reloadActiveThread()
              })
              .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ops_events', filter:'event_type=eq.chat' }, (p:any)=>{
                const row = p.new
                if (!row?.ref_id) return
                const lastSeenRaw = localStorage.getItem('bf_admin_chat_seen') || '{}'
                const lastSeen = JSON.parse(lastSeenRaw)
                const unread = lastSeen[row.ref_id] && new Date(row.created_at) <= new Date(lastSeen[row.ref_id]) ? 0 : 1
                const text = (row.payload && row.payload.text) || '(系統)'
                setChatSummaries(prev => [{ trip_id: row.ref_id, last_text: text, at: row.created_at, unread }, ...prev.filter(x=>x.trip_id!==row.ref_id)])
              })
              .subscribe()
          }
        })
      return () => { ch.unsubscribe() }
    } catch {}
  }, [])
  useEffect(() => {
    try { console.warn('請確認 trip_messages 已設置 REPLICA IDENTITY FULL，並檢查 RLS 對 admin 是否開放') } catch {}
  }, [])
  const markChatRead = (tripId: string) => {
    try {
      const lastSeenRaw = localStorage.getItem('bf_admin_chat_seen') || '{}'
      const lastSeen = JSON.parse(lastSeenRaw)
      lastSeen[tripId] = new Date().toISOString()
      localStorage.setItem('bf_admin_chat_seen', JSON.stringify(lastSeen))
      setChatSummaries(prev => prev.map(x => x.trip_id === tripId ? { ...x, unread: 0 } : x))
    } catch {}
  }
  useEffect(() => {
    if (!activeChat) return
    const fetchThread = async () => {
      try {
        const { data } = await supabase.from('trip_messages').select('*').eq('trip_id', activeChat).order('created_at', { ascending: true })
        try { console.log('載入訊息筆數:', (data || []).length) } catch {}
        setChatMessages((data || []).map((row:any)=>({ id: row.id, role: row.role, text: row.message_content || row.content || row.text || '', created_at: row.created_at, image_url: row.image_url || null, location_data: row.location_data || null })))
      } catch { /* 保持現況 */ }
    }
    ;(async () => { await fetchThread() })()
    const intId = window.setInterval(fetchThread, 5000)
    const ch = supabase
      .channel('admin-chat-thread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${activeChat}` }, (p:any)=>{
        const row = p.new
        try { console.log('Realtime收到訊息:', p) } catch {}
        if (!row) return
        setChatMessages(prev => [...prev, { id: row.id, role: row.role, text: row.message_content || row.content || row.text || '', created_at: row.created_at, image_url: row.image_url || null, location_data: row.location_data || null }])
      })
      .subscribe((status: any) => {
        try { console.log('頻道狀態:', status) } catch {}
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          try { ch.unsubscribe() } catch {}
          const ch2 = supabase
            .channel('admin-chat-thread')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${activeChat}` }, (p:any)=>{
              const row = p.new
              try { console.log('Realtime收到訊息:', p) } catch {}
              if (!row) return
              setChatMessages(prev => [...prev, { id: row.id, role: row.role, text: row.message_content || row.content || row.text || '', created_at: row.created_at, image_url: row.image_url || null, location_data: row.location_data || null }])
            })
            .subscribe()
        }
      })
    return () => { try { ch.unsubscribe() } catch {}; try { clearInterval(intId) } catch {} }
  }, [activeChat])
  const sendAdminMessage = async () => {
    const v = chatText.trim()
    if (!v || !activeChat) return
    setChatText('')
    let sid = user?.id || null
    try {
      const { data: au } = await supabase.auth.getUser()
      if (au?.user?.id) sid = au.user.id
    } catch {}
    if (!sid) sid = 'anonymous'
    const payload: any = { trip_id: String(activeChat), sender_id: sid, message_content: v, content: v }
    const { data, error } = await supabase.from('trip_messages').insert([payload] as any)
    if (error) { try { alert('發送失敗：' + (error.message || '未知錯誤')) } catch {} }
  }
  const assignToDriver = async (tripId: string, driverId: string) => {
    try {
      await supabase.from('trips').update({ driver_id: driverId, status: 'accepted' }).eq('id', tripId)
      try { await supabase.from('ops_events').insert({ event_type:'manual_assign', ref_id: tripId, payload:{ driver_id: driverId } }) } catch {}
      alert('已手動指派')
      setSelectedTrip(null)
    } catch { alert('指派失敗') }
  }
  const pushExternalAssign = async (tripId: string, info: { plate?: string; color?: string; phone?: string }) => {
    try {
      await supabase.from('ops_events').insert({ event_type:'external_assign', ref_id: tripId, payload: info } as any)
      alert('已推送外部車隊資訊給乘客')
      setSelectedTrip(null)
    } catch { alert('推送失敗') }
  }
  const promoteToDriver = async (userId: string) => {
    try {
      await supabase.from('profiles').update({ role:'driver' }).eq('id', userId)
      try { await supabase.from('driver_profiles').upsert({ user_id: userId }, { onConflict:'user_id' } as any) } catch {}
      alert('已升等為司機')
    } catch { alert('操作失敗') }
  }
  const saveVehicle = async (userId: string) => {
    try {
      const val = vehicleEdit[userId] || {}
      await supabase.from('driver_profiles').upsert({ user_id: userId, car_plate: val.plate || null, car_model: val.model || null, car_color: val.color || null }, { onConflict:'user_id' } as any)
      alert('已保存車輛資料')
    } catch { alert('保存失敗') }
  }
  const diagnoseTrips = async () => {
    try {
      await ensureAuth()
      const { data, error } = await supabase.from('trips').select('*').limit(1)
      if (error) throw error
      if (data && data[0]) {
        console.log('trips 欄位推斷：', Object.keys(data[0]))
        alert('已在 Console 輸出 trips 欄位')
      } else {
        console.log('trips 目前無資料，無法直接推斷欄位')
        alert('trips 無資料，請先建立一筆或使用空物件測試')
      }
    } catch (e) {
      console.log('診斷 trips 欄位失敗', e)
      alert(`診斷失敗：${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div className="min-h-screen" style={{ background:'#121212' }}>
      <div className="flex">
        <aside className={`min-h-screen p-4 ${menuOpen ? 'block' : 'hidden md:block'}`} style={{ width:256, background:'#121212', borderRight:'1px solid rgba(255,255,255,0.08)' }}>
          <div className="text-xl font-bold mb-4" style={{ color:'#00FFFF' }}>指揮中心</div>
          <div className="space-y-2">
            <button onClick={()=>setActiveLeft('overview')} className="w-full text-left px-3 py-2 rounded" style={{ color: activeLeft==='overview' ? '#00FFFF' : '#e5e7eb' }}>總覽</button>
            <button onClick={()=>setActiveLeft('users')} className="w-full text-left px-3 py-2 rounded" style={{ color: activeLeft==='users' ? '#00FFFF' : '#e5e7eb' }}>人員管理</button>
            <button onClick={()=>setActiveLeft('support')} className="w-full text-left px-3 py-2 rounded flex items-center gap-2" style={{ color: activeLeft==='support' ? '#00FFFF' : '#e5e7eb' }}>
              <span>客服中心</span>
              {chatSummaries.some(x=>x.unread>0) && <span style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', display:'inline-block' }} />}
            </button>
            <hr style={{ borderColor:'rgba(255,255,255,0.08)' }} />
            <button onClick={()=>navigate('/passenger')} className="w-full text-left px-3 py-2 rounded" style={{ color:'#e5e7eb' }}>乘客視角</button>
            <button onClick={()=>navigate('/driver')} className="w-full text-left px-3 py-2 rounded" style={{ color:'#e5e7eb' }}>司機視角</button>
            <button onClick={async ()=>{ await signOut(); navigate('/admin/login') }} className="w-full text-left px-3 py-2 rounded" style={{ color:'#e5e7eb' }}>登出</button>
          </div>
        </aside>
        <main className="flex-1 p-4 md:p-6">
          <div className="md:hidden flex items中心 justify-between mb-3">
            <button onClick={()=>setMenuOpen(v=>!v)} className="px-3 py-2 rounded" style={{ border:'1px solid rgba(255,255,255,0.15)', color:'#e5e7eb' }}>☰</button>
            <div className="text-sm" style={{ color:'#9ca3af' }}>管理儀表板</div>
          </div>
          {showOverdueAlert && (
            <div className="mb-3 p-3 rounded-lg" style={{ background:'#7f1d1d', color:'#fff', border:'1px solid rgba(255,255,255,0.2)' }}>
              <div className="font-semibold mb-1">逾時未接警示</div>
              <div className="text-xs">超過 120 秒未接：{overdueRequested.length} 筆</div>
              <div className="mt-2">
                <button onClick={()=>{ if (overdueRequested[0]) focusTrip(overdueRequested[0]) }} className="px-3 py-1 text-xs rounded" style={{ background:'#ef4444', color:'#fff' }}>聚焦最新逾時</button>
                <button onClick={()=>setShowOverdueAlert(false)} className="ml-2 px-3 py-1 text-xs rounded" style={{ border:'1px solid rgba(255,255,255,0.2)', color:'#fff' }}>忽略</button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" style={{ display: activeLeft==='overview' ? 'grid' : 'none' }}>
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(0,255,255,0.2)' }}>
              <div className="text-sm" style={{ color:'#9ca3af' }}>今日營收</div>
              <div className="text-3xl font-bold" style={{ color:'#00FFFF' }}>${revenueToday}</div>
            </div>
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(0,255,255,0.2)' }}>
              <div className="text-sm" style={{ color:'#9ca3af' }}>總單數</div>
              <div className="text-3xl font-bold" style={{ color:'#00FFFF' }}>{tripsToday}</div>
            </div>
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(16,185,129,0.25)' }}>
              <div className="text-sm" style={{ color:'#9ca3af' }}>在線司機</div>
              <div className="text-3xl font-bold" style={{ color:'#10B981' }}>{onlineDrivers.length}</div>
            </div>
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(239,68,68,0.25)' }}>
              <div className="text-sm" style={{ color:'#9ca3af' }}>待審核身分</div>
              <div className="text-3xl font-bold" style={{ color:'#EF4444' }}>{pendingCount}</div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ display: activeLeft==='overview' ? 'grid' : 'none' }}>
            <div className="lg:col-span-2 rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm" style={{ color:'#9ca3af' }}>全域即時地圖</div>
              </div>
              <div ref={mapElRef} style={{ height:'40vh', width:'100%' }} />
              <div className="mt-2 text-xs" style={{ color:'#9ca3af' }}>空車：綠色點；載客中：紅色點</div>
            </div>
            <div className="rounded-lg p-4 space-y-4" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div>
              <div className="text-sm mb-2" style={{ color:'#e5e7eb' }}>即時訂單監控（待派 Requested）</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {requestedTrips.length === 0 ? (
                  <div className="text-xs" style={{ color:'#9ca3af' }}>目前無待派訂單</div>
                ) : requestedTrips.map(t => (
                    <button key={t.id} onClick={()=>focusTrip(t)} className="w-full text-left px-3 py-2 rounded-md hover:bg-[#2A2A2A]" style={{ border:'1px solid rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
                      <div className="text-xs" style={{ color:'#9ca3af' }}>{new Date(t.created_at || '').toLocaleString('zh-TW')}</div>
                      <div className="text-sm truncate">{(t as any).pickup_location?.address || '—'}</div>
                      <div className="text-xs" style={{ color:'#9ca3af' }}>{t.estimated_price ? `$${t.estimated_price}` : ''}</div>
                    </button>
                  ))}
              </div>
            </div>
              <div className="text-sm mb-2" style={{ color:'#e5e7eb' }}>費率即時設定</div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={fareBase} onChange={e=>setFareBase(Number(e.target.value||'0'))} placeholder="基礎費" className="px-2 py-2 rounded" style={{ background:'#121212', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.1)' }} />
                <input type="number" value={farePerKm} onChange={e=>setFarePerKm(Number(e.target.value||'0'))} placeholder="每公里" className="px-2 py-2 rounded" style={{ background:'#121212', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.1)' }} />
                <input type="number" value={farePerMin} onChange={e=>setFarePerMin(Number(e.target.value||'0'))} placeholder="每分鐘" className="px-2 py-2 rounded" style={{ background:'#121212', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.1)' }} />
                <input type="number" value={longThreshold} onChange={e=>setLongThreshold(Number(e.target.value||'0'))} placeholder="長途門檻" className="px-2 py-2 rounded" style={{ background:'#121212', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.1)' }} />
                <input type="number" value={longRate} onChange={e=>setLongRate(Number(e.target.value||'0'))} placeholder="長途加成(每公里)" className="px-2 py-2 rounded" style={{ background:'#121212', color:'#e5e7eb', border:'1px solid rgba(255,255,255,0.1)' }} />
              </div>
              <div className="mt-3">
                <button onClick={saveFare} className="px-4 py-2 rounded" style={{ background:'#00FFFF', color:'#121212' }}>儲存</button>
                <button onClick={diagnoseTrips} className="ml-2 px-4 py-2 rounded" style={{ background:'#10B981', color:'#121212' }}>資料庫欄位診斷</button>
                <button onClick={async ()=>{
                  try { await supabase.from('ops_events').insert({ event_type:'big_order', ref_id:null, payload:{ ts: Date.now() } } as any); alert('已推送大單') } catch { alert('推送失敗') }
                }} className="ml-2 px-4 py-2 rounded" style={{ background:'#ef4444', color:'#121212' }}>推送大單</button>
              </div>
            </div>
          </div>
          {/* User Management */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4" style={{ display: activeLeft==='users' ? 'grid' : 'none' }}>
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-sm font-semibold mb-2" style={{ color:'#e5e7eb' }}>乘客</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {usersPassengers.map(u=>(
                  <div key={u.id} className="p-2 rounded border" style={{ borderColor:'rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
                    <div className="text-sm">{u.full_name || u.name || '—'} · {u.phone || '—'}</div>
                    <div className="text-xs" style={{ color:'#9ca3af' }}>推薦人：{u.recommended_by_phone || '—'}</div>
                    <div className="mt-1">
                      <button onClick={()=>promoteToDriver(u.id)} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded">升等為司機</button>
                      <button onClick={()=>{ const tid = `support_${String(u.id).trim()}`; try { console.log('【點擊動作偵測】:', { target:'用戶列表', data:u, generated_trip_id: tid }) } catch {}; setActiveLeft('support'); setActiveChat(tid); activeChatRef.current = tid; }} className="ml-2 px-2 py-1 text-xs rounded" style={{ border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>客服對話</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-sm font-semibold mb-2" style={{ color:'#e5e7eb' }}>司機</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {usersDrivers.map(u=>(
                  <div key={u.id} className="p-2 rounded border space-y-2" style={{ borderColor:'rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
                    <div className="text-sm">{u.full_name || u.name || '—'} · {u.phone || '—'}</div>
                    <div className="grid grid-cols-3 gap-2">
                      <input placeholder="車牌" value={vehicleEdit[u.id]?.plate || ''} onChange={e=>setVehicleEdit(v=>({ ...v, [u.id]: { ...v[u.id], plate:e.target.value } }))} className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                      <input placeholder="車型" value={vehicleEdit[u.id]?.model || ''} onChange={e=>setVehicleEdit(v=>({ ...v, [u.id]: { ...v[u.id], model:e.target.value } }))} className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                      <input placeholder="車色" value={vehicleEdit[u.id]?.color || ''} onChange={e=>setVehicleEdit(v=>({ ...v, [u.id]: { ...v[u.id], color:e.target.value } }))} className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                    </div>
                    <button onClick={()=>saveVehicle(u.id)} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded">保存車輛資料</button>
                    <button onClick={()=>{ const tid = `support_${String(u.id).trim()}`; try { console.log('【點擊動作偵測】:', { target:'用戶列表', data:u, generated_trip_id: tid }) } catch {}; setActiveLeft('support'); setActiveChat(tid); activeChatRef.current = tid; }} className="ml-2 px-2 py-1 text-xs rounded" style={{ border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>客服對話</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-sm font-semibold mb-2" style={{ color:'#e5e7eb' }}>管理員</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {usersAdmins.map(u=>(
                  <div key={u.id} className="p-2 rounded border" style={{ borderColor:'rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
                    <div className="text-sm">{u.name || '—'} · {u.phone || '—'}</div>
                    <div className="mt-1">
                      <button onClick={()=>{ const tid = `support_${String(u.id).trim()}`; try { console.log('【點擊動作偵測】:', { target:'用戶列表', data:u, generated_trip_id: tid }) } catch {}; setActiveLeft('support'); setActiveChat(tid); activeChatRef.current = tid; }} className="px-2 py-1 text-xs rounded" style={{ border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>客服對話</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Focused Driver Quick Assign */}
          {focusedDriver && (
            <div className="fixed right-4 bottom-20 rounded-lg p-4" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
              <div className="text-sm mb-1">司機：{focusedDriver?.name || focusedDriver?.phone || focusedDriver?.id}</div>
              <div className="text-xs mb-2" style={{ color:'#9ca3af' }}>狀態：{focusedDriver?.status || '—'}</div>
              <div className="flex items-center gap-2">
                <button onClick={()=>setFocusedDriver(null)} className="px-2 py-1 text-xs rounded" style={{ border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>關閉</button>
                {selectedTrip ? (
                  <button onClick={()=>assignToDriver(selectedTrip.id, focusedDriver.id)} className="px-2 py-1 text-xs rounded bg-indigo-600 text-white">指派給他</button>
                ) : (
                  <span className="text-xs" style={{ color:'#9ca3af' }}>右側選擇訂單後可快速指派</span>
                )}
                <button onClick={async ()=>{
                  try {
                    const startIso = new Date(new Date().toISOString().slice(0,10) + 'T00:00:00Z').toISOString()
                    const { data } = await supabase.from('trips').select('final_price,status,created_at').eq('driver_id', focusedDriver.id).gte('created_at', startIso)
                    const arr = data || []
                    const revenue = arr.filter((t:any)=>t.status==='completed').reduce((s:number,t:any)=> s + Number(t.final_price||0), 0)
                    setDriverSummary({ id: focusedDriver.id, trips: arr.length, revenue })
                  } catch { setDriverSummary({ id: focusedDriver.id, trips: 0, revenue: 0 }) }
                }} className="px-2 py-1 text-xs rounded bg-green-600 text-white">今日清算</button>
              </div>
            </div>
          )}
          {driverSummary && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
                <div className="text-sm font-semibold mb-2">司機日結單</div>
                <div className="text-xs mb-1" style={{ color:'#9ca3af' }}>司機：{driverSummary.id}</div>
                <div className="text-sm">今日單數：{driverSummary.trips}</div>
                <div className="text-sm">今日收入：${driverSummary.revenue}</div>
                <div className="mt-3 text-right">
                  <button onClick={()=>setDriverSummary(null)} className="px-3 py-1 text-xs rounded" style={{ border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>關閉</button>
                </div>
              </div>
            </div>
          )}
          {/* Support Center */}
          <div className="rounded-lg p-4 space-y-3" style={{ display: activeLeft==='support' ? 'block' : 'none', background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
            <div className="text-sm">客服中心</div>
            <div className="space-y-2">
              {chatSummaries.length === 0 ? (
                <div className="text-xs" style={{ color:'#9ca3af' }}>尚無對話</div>
              ) : chatSummaries.map(c => (
                <button key={c.trip_id} onClick={()=>{ try { console.log('【點擊動作偵測】:', { target:'對話列表', data:c, trip_id:c.trip_id }) } catch {}; const tid = String(c.trip_id).trim(); setActiveChat(tid); activeChatRef.current = tid; markChatRead(tid) }} className="w-full text-left p-2 rounded border" style={{ borderColor:'rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">Trip {c.trip_id.slice(0,6)}…</div>
                    {c.unread>0 && <span style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', display:'inline-block' }} />}
                  </div>
                  <div className="text-xs" style={{ color:'#9ca3af' }}>{new Date(c.at).toLocaleString('zh-TW')}</div>
                  <div className="text-xs" style={{ color:'#e5e7eb' }}>{c.last_text}</div>
                </button>
              ))}
            </div>
            {activeChat && (
              <div className="rounded p-3 border" style={{ borderColor:'rgba(255,255,255,0.08)' }}>
                <div className="text-xs mb-2" style={{ color:'#9ca3af' }}>對話：{activeChat}</div>
                <div className="space-y-1 max-h-48 overflow-y-auto mb-2">
                  {chatMessages.map(m=>(
                    <div key={m.id} className="text-sm" style={{ color: m.role==='admin' ? '#60a5fa' : (m.role==='driver' ? '#34d399' : '#e5e7eb') }}>
                      <span style={{ fontWeight:600 }}>{m.role}</span>
                      <span className="mx-1">·</span>
                      {m.image_url ? (
                        <img src={m.image_url || ''} alt="" style={{ maxWidth:'50%', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer' }} onClick={()=>setImgPreview(m.image_url || '')} />
                      ) : m.location_data ? (
                        <button onClick={()=>{ const u = `https://www.google.com/maps?q=${m.location_data.lat},${m.location_data.lng}`; window.open(u,'_blank') }} className="px-2 py-1 rounded text-xs" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>
                          📍 查看乘客位置
                        </button>
                      ) : (
                        <span>{m.text}</span>
                      )}
                    </div>
                  ))}
                  {chatMessages.length===0 && <div className="text-xs" style={{ color:'#9ca3af' }}>尚無訊息</div>}
                </div>
                <div className="flex items-center gap-2">
                  <input value={chatText} onChange={e=>setChatText(e.target.value)} placeholder="輸入訊息…" className="flex-1 px-2 py-2 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display:'none' }} />
                  <button onClick={triggerImage} className="px-2 py-2 rounded text-xs" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>🖼️</button>
                  <button onClick={sendLocation} className="px-2 py-2 rounded text-xs" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>📍</button>
                  <button onClick={sendAdminMessage} className="px-3 py-2 text-xs rounded bg-indigo-600 text-white">發送</button>
                </div>
                {imgPreview && (
                  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={()=>setImgPreview(null)}>
                    <img src={imgPreview} alt="" style={{ maxWidth:'90%', maxHeight:'90%', borderRadius:10, border:'2px solid rgba(255,255,255,0.2)' }} />
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Order Detail Modal */}
          {selectedTrip && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
              <div className="rounded-2xl p-6 w-full max-w-lg" style={{ background:'#1E1E1E', border:'1px solid rgba(255,255,255,0.08)', color:'#e5e7eb' }}>
                <div className="text-lg font-semibold mb-2" style={{ color:'#00FFFF' }}>訂單詳情</div>
                <div className="text-sm mb-1">上車：{selectedTrip?.pickup_location?.address || '—'}</div>
                <div className="text-sm mb-1">下車：{selectedTrip?.dropoff_location?.address || '—'}</div>
                <div className="text-sm mb-1">金額：${selectedTrip?.estimated_price || '—'}</div>
                <div className="text-sm mb-3">公里數：{(() => {
                  try {
                    const a = selectedTrip?.pickup_location, b = selectedTrip?.dropoff_location
                    if (a && b && typeof a.lat === 'number' && typeof a.lng === 'number' && typeof b.lat === 'number' && typeof b.lng === 'number') {
                      const R=6371, toRad=(v:number)=>(v*Math.PI)/180
                      const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng)
                      const h=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2
                      return (2*R*Math.asin(Math.sqrt(h))).toFixed(1)
                    }
                  } catch {}
                  return '—'
                })()} km</div>
                <div className="mt-2">
                <div className="text-sm mb-1" style={{ color:'#9ca3af' }}>手動派單</div>
                <div className="flex items-center space-x-2 mb-2">
                  <select id="assign-driver" className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>
                    {onlineDrivers.map(d => (<option key={d.id} value={d.id}>{d.name || d.phone || d.id}</option>))}
                  </select>
                  <button onClick={()=>{
                    const el = document.getElementById('assign-driver') as HTMLSelectElement
                    if (el && el.value) assignToDriver(selectedTrip.id, el.value)
                  }} className="px-3 py-1 rounded text-xs bg-indigo-600 text-white">指派在線司機</button>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input id="ext-plate" placeholder="車牌" className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                  <input id="ext-color" placeholder="車色" className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                  <input id="ext-phone" placeholder="電話" className="px-2 py-1 rounded text-sm" style={{ background:'#121212', border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }} />
                </div>
                <button onClick={()=>{
                  const plate = (document.getElementById('ext-plate') as HTMLInputElement)?.value || ''
                  const color = (document.getElementById('ext-color') as HTMLInputElement)?.value || ''
                  const phone = (document.getElementById('ext-phone') as HTMLInputElement)?.value || ''
                  pushExternalAssign(selectedTrip.id, { plate, color, phone })
                }} className="px-3 py-2 rounded text-xs bg-emerald-600 text-white">外部車隊派單</button>
                <div className="mt-2 text-xs" style={{ color: '#f59e0b' }}>
                  {(() => {
                    try {
                      const a = selectedTrip?.pickup_location, b = selectedTrip?.dropoff_location
                      if (a && b && typeof a.lat === 'number' && typeof a.lng === 'number' && typeof b.lat === 'number' && typeof b.lng === 'number') {
                        const R=6371, toRad=(v:number)=>(v*Math.PI)/180
                        const dLat=toRad(b.lat-a.lat), dLng=toRad(b.lng-a.lng)
                        const h=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2
                        const dist=2*R*Math.asin(Math.sqrt(h))
                        if (dist >= 50) return '長途議價：金額顯示為「管理員核定/直收」'
                        if (dist >= 30) return '大單預警：建議由管理員手動指派'
                      }
                    } catch {}
                    return ''
                  })()}
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <button onClick={async ()=>{ try { await supabase.from('trips').update({ status:'closed' }).eq('id', selectedTrip.id); await reloadRequested(); alert('已關閉訂單'); setSelectedTrip(null) } catch { alert('關閉失敗') } }} className="px-3 py-2 rounded text-xs bg-red-600 text-white">關閉訂單</button>
                    <button onClick={async ()=>{ try { await supabase.from('trips').delete().eq('id', selectedTrip.id); await reloadRequested(); alert('已刪除訂單'); setSelectedTrip(null) } catch { alert('刪除失敗') } }} className="px-3 py-2 rounded text-xs" style={{ border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>刪除</button>
                </div>
                </div>
                <div className="mt-4 text-right">
                  <button onClick={()=>setSelectedTrip(null)} className="px-3 py-2 rounded text-xs" style={{ border:'1px solid rgba(255,255,255,0.1)', color:'#e5e7eb' }}>關閉</button>
                </div>
              </div>
            </div>
          )}
        </main>
        <div style={{ position:'fixed', left:0, right:0, bottom:0 }}>
          <BottomNav role="admin" />
        </div>
        <div style={{ position:'fixed', left:12, bottom:10, fontSize:12, color:'#93c5fd', opacity:0.9, background:'rgba(0,0,0,0.35)', padding:'4px 8px', borderRadius:8, border:'1px solid rgba(147,197,253,0.4)' }}>
          連線診斷 · URL:{connDiag.url || '—'} · Session:{connDiag.session}
        </div>
      </div>
    </div>
  )
}
