import React, { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../stores/auth'
import { useTripStore } from '../stores/trips'
import { supabase } from '../lib/supabaseClient'
import { Bell } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { sendOpsEvent } from '../utils/ops'

export default function GlobalNotifications() {
  const { user, userType } = useAuthStore()
  const { currentTrip, getCurrentTrip } = useTripStore()
  const [unread, setUnread] = useState(0)
  const [lastText, setLastText] = useState('')
  const nav = useNavigate()
  const loc = useLocation()
  const subRef = useRef<any>(null)
  const lastNotifyRef = useRef<number>(0)
  const [upcoming, setUpcoming] = useState<{ id: string; time: string } | null>(null)

  useEffect(() => {
    if (!user) return
    getCurrentTrip(user.id, userType === 'driver' ? 'driver' : 'passenger')
  }, [user])

  useEffect(() => {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {})
      }
    } catch {}
  }, [])

  useEffect(() => {
    let timer: any = null
    const checkUpcoming = async () => {
      if (!user || userType !== 'passenger') { setUpcoming(null); return }
      try {
        const now = Date.now()
        const from = new Date(now + 10 * 60 * 1000).toISOString()
        const to = new Date(now + 15 * 60 * 1000).toISOString()
        const { data } = await supabase
          .from('scheduled_rides')
          .select('id, scheduled_time, processed, status')
          .eq('passenger_id', user.id)
          .eq('processed', false)
          .gte('scheduled_time', from)
          .lte('scheduled_time', to)
          .order('scheduled_time', { ascending: true })
        const s = (data || [])[0]
        if (s) {
          setUpcoming({ id: s.id, time: s.scheduled_time })
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('預約即將到達', { body: '您的預約行程 15 分鐘後開始' })
            }
          } catch {}
        } else {
          setUpcoming(null)
        }
      } catch {
        setUpcoming(null)
      }
    }
    timer = setInterval(checkUpcoming, 60000)
    checkUpcoming()
    return () => { if (timer) clearInterval(timer) }
  }, [user?.id, userType])
  useEffect(() => {
    if (subRef.current) { subRef.current.unsubscribe(); subRef.current = null }
    if (!currentTrip?.id) return
    const tripId = currentTrip.id
    const ch = supabase
      .channel('global-ops-' + tripId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_events', filter: `ref_id=eq.${tripId}` }, (payload: any) => {
        const ev = payload.new
        if (!ev) return
        const text = ev.event_type === 'chat' ? (ev.payload?.text || '') : ev.event_type
        setLastText(text)
        const path = loc.pathname
        const isOnChatPage = path.includes('/passenger') || path.includes('/driver')
        try {
          const key = `bf_msgs_${tripId}`
          const arr = JSON.parse(localStorage.getItem(key) || '[]')
          arr.push({ time: ev.created_at, type: ev.event_type, text })
          while (arr.length > 200) arr.shift()
          localStorage.setItem(key, JSON.stringify(arr))
        } catch {}
        if (!isOnChatPage) {
          setUnread(u => u + 1)
          try {
            const k = `bf_unread_${tripId}`
            const v = (Number(localStorage.getItem(k) || '0') || 0) + 1
            localStorage.setItem(k, String(v))
          } catch {}
          try {
            const now = Date.now()
            if ('Notification' in window && Notification.permission === 'granted' && now - lastNotifyRef.current > 15000) {
              new Notification('Black Feather 通知', { body: text })
              lastNotifyRef.current = now
            }
          } catch {}
        }
      })
      .subscribe()
    subRef.current = ch
    return () => { ch.unsubscribe(); subRef.current = null }
  }, [currentTrip?.id, loc.pathname])

  if (!user || !currentTrip?.id) return null

  const openTrip = () => {
    if (userType === 'driver') nav('/driver')
    else nav('/passenger')
    setUnread(0)
    try { localStorage.setItem(`bf_unread_${currentTrip.id}`, '0') } catch {}
  }

  const cancelUpcoming = async () => {
    if (!upcoming) return
    try {
      await supabase.from('scheduled_rides').update({ status: 'cancelled', processed: true }).eq('id', upcoming.id)
      setUpcoming(null)
    } catch {}
  }
  const postponeUpcoming = async () => {
    if (!upcoming) return
    try {
      const t = new Date(upcoming.time)
      t.setMinutes(t.getMinutes() + 30)
      await supabase.from('scheduled_rides').update({ scheduled_time: t.toISOString() }).eq('id', upcoming.id)
      setUpcoming({ id: upcoming.id, time: t.toISOString() })
    } catch {}
  }

  return (
    <div style={{ position:'fixed', right:16, bottom:16, zIndex:9999 }}>
      <button onClick={openTrip} className="flex items-center space-x-2 px-3 py-2 bg-yellow-600 text-white rounded-lg shadow hover:bg-yellow-700">
        <Bell className="w-4 h-4" />
        <span className="text-sm">通知</span>
        {unread > 0 && <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded">{unread}</span>}
      </button>
      {lastText && <div className="mt-2 text-xs bg-black/70 text-white px-2 py-1 rounded max-w-[240px]">{lastText}</div>}
      {upcoming && (
        <div className="mt-2 text-xs bg-indigo-600 text-white px-3 py-2 rounded max-w-[280px]">
          <div>預約 15 分鐘後開始：{new Date(upcoming.time).toLocaleString('zh-TW')}</div>
          <div className="mt-2 flex space-x-2">
            <button onClick={cancelUpcoming} className="px-2 py-1 bg-red-600 rounded">取消</button>
            <button onClick={postponeUpcoming} className="px-2 py-1 bg-yellow-500 rounded">延後 30 分</button>
          </div>
        </div>
      )}
    </div>
  )
}
