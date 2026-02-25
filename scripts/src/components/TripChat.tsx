import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MessageCircle, Send, Bell } from 'lucide-react'

interface Msg {
  id: string
  type: string
  text: string
  from: string
  time: string
  eventType?: string
}

export default function TripChat({ tripId, userId, role }: { tripId: string; userId: string; role: 'passenger' | 'driver' }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [filter, setFilter] = useState<'all' | 'chat' | 'arrived' | 'picked_up' | 'started' | 'completed' | 'payment_confirmed'>('all')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const arr = JSON.parse(localStorage.getItem(`bf_msgs_${tripId}`) || '[]')
      const ms: Msg[] = (arr || []).map((x: any, i: number) => ({ id: `local-${i}-${x.time}`, type: x.type === 'chat' ? 'chat' : 'notify', text: x.text, from: x.type === 'chat' ? (x.from || 'system') : 'system', time: x.time, eventType: x.type }))
      if (ms.length) setMessages(prev => [...prev, ...ms])
    } catch {}
    const ch = supabase
      .channel('ops-chat-' + tripId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ops_events', filter: `ref_id=eq.${tripId}` }, (payload: any) => {
        const ev = payload.new
        if (!ev) return
        const t = ev.event_type as string
        if (t === 'chat') {
          const txt = (ev.payload && ev.payload.text) || ''
          const from = (ev.payload && ev.payload.from_role) || 'system'
          setMessages(prev => [...prev, { id: ev.id, type: 'chat', text: txt, from, time: ev.created_at, eventType: 'chat' }])
        } else {
          setMessages(prev => [...prev, { id: ev.id, type: 'notify', text: t, from: 'system', time: ev.created_at, eventType: t }])
        }
      })
      .subscribe()
    return () => { ch.unsubscribe() }
  }, [tripId])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  const send = async () => {
    const v = text.trim()
    if (!v) return
    setText('')
    try {
      const { error } = await supabase.from('trip_messages').insert({
        trip_id: tripId,
        user_id: userId,
        role,
        text: v
      } as any)
      if (error) throw error
    } catch {
      await supabase.from('ops_events').insert({
        event_type: 'chat',
        ref_id: tripId,
        payload: { text: v, from_role: role, from_user_id: userId }
      } as any)
    }
  }

  return (
    <div className="rounded-lg" style={{ border:'1px solid rgba(218,165,32,0.35)' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom:'1px solid rgba(218,165,32,0.35)' }}>
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-4 h-4" style={{ color:'#9ca3af' }} />
          <span className="text-sm font-medium" style={{ color:'#DAA520' }}>聊天</span>
        </div>
        <div className="flex items-center space-x-1 text-xs" style={{ color:'#9ca3af' }}>
          <Bell className="w-3 h-3" />
          <span>系統通知同步</span>
        </div>
      </div>
      <div className="px-3 py-2 flex items-center space-x-2" style={{ background:'#1A1A1A', borderBottom:'1px solid rgba(218,165,32,0.35)' }}>
        <label className="text-xs" style={{ color:'#9ca3af' }}>篩選</label>
        <select value={filter} onChange={e=>setFilter(e.target.value as any)} className="px-2 py-1 text-xs" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb', borderRadius:6 }}>
          <option value="all">全部</option>
          <option value="chat">聊天</option>
          <option value="arrived">到達</option>
          <option value="picked_up">上車</option>
          <option value="started">開始</option>
          <option value="completed">完成</option>
          <option value="payment_confirmed">支付確認</option>
        </select>
      </div>
      <div ref={listRef} className="px-3 py-2 h-40 overflow-y-auto space-y-2" style={{ background:'#0f0f0f' }}>
        {messages.filter(m => {
          if (filter === 'all') return true
          if (filter === 'chat') return m.type === 'chat'
          return m.eventType === filter
        }).map(m => (
          <div key={m.id} className="text-sm" style={{ color: m.type === 'notify' ? '#a78bfa' : (m.from === role ? '#60a5fa' : '#e5e7eb') }}>
            <span className="font-medium">{m.type === 'notify' ? '系統' : m.from}</span>
            <span className="mx-1">·</span>
            <span>{m.text}</span>
          </div>
        ))}
        {messages.length === 0 && <div className="text-xs" style={{ color:'#9ca3af' }}>尚無訊息</div>}
      </div>
      <div className="flex items-center p-2 space-x-2">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="輸入訊息..." className="flex-1 px-2 py-2" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb', borderRadius:8 }} />
        <button onClick={send} className="px-3 py-2 rounded-lg hover:opacity-90 flex items-center space-x-1" style={{ backgroundImage:'linear-gradient(to right, #3b82f6, #2563eb)', color:'#111' }}>
          <Send className="w-4 h-4" />
          <span className="text-sm">送出</span>
        </button>
      </div>
    </div>
  )
}
