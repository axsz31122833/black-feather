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
  const [unread, setUnread] = useState(0)
  const lastSeenKey = `bf_chat_seen_${tripId}_${role}`

  useEffect(() => {
    const ch = supabase
      .channel('trip-chat-' + tripId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${tripId}` }, (payload: any) => {
        const row = payload.new
        if (!row) return
        setMessages(prev => [...prev, { id: row.id, type: 'chat', text: row.content || row.text || '', from: row.role || 'system', time: row.created_at, eventType: 'chat' }])
      })
      .subscribe()
    return () => { ch.unsubscribe() }
  }, [tripId])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])
  useEffect(() => {
    try {
      const lastSeenStr = localStorage.getItem(lastSeenKey)
      const lastSeen = lastSeenStr ? new Date(lastSeenStr).getTime() : 0
      const count = messages.filter(m => m.type === 'chat' && m.from !== role && new Date(m.time).getTime() > lastSeen).length
      setUnread(count)
    } catch { setUnread(0) }
  }, [messages, role, lastSeenKey])
  const markRead = () => {
    try {
      const latest = messages.length ? messages[messages.length - 1].time : new Date().toISOString()
      localStorage.setItem(lastSeenKey, latest)
      setUnread(0)
    } catch {}
  }

  const send = async () => {
    const v = text.trim()
    if (!v) return
    setText('')
    await supabase.from('trip_messages').insert({
      trip_id: tripId,
      sender_id: userId,
      role,
      content: v
    } as any)
  }

  return (
    <div className="rounded-lg" style={{ border:'1px solid rgba(218,165,32,0.35)' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom:'1px solid rgba(218,165,32,0.35)' }}>
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-4 h-4" style={{ color:'#9ca3af' }} />
          <span className="text-sm font-medium" style={{ color:'#DAA520' }}>聊天</span>
          {unread > 0 && <span style={{ minWidth:16, height:16, borderRadius:8, background:'#ef4444', color:'#fff', fontSize:10, lineHeight:'16px', textAlign:'center', padding:'0 4px' }}>{unread}</span>}
        </div>
        <div className="flex items-center space-x-1 text-xs" style={{ color:'#9ca3af' }}>
          <Bell className="w-3 h-3" />
          <span>系統通知同步</span>
          <button onClick={markRead} className="ml-2 px-2 py-0.5 rounded" style={{ border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}>已讀</button>
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
