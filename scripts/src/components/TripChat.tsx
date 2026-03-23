import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MessageCircle, Send, Bell, Image as ImageIcon, MapPin } from 'lucide-react'

interface Msg {
  id: string
  type: string
  text: string
  from: string
  time: string
  eventType?: string
  imageUrl?: string
  loc?: { lat: number; lng: number } | null
}

export default function TripChat({ tripId, userId, role }: { tripId: string; userId: string; role: 'passenger' | 'driver' }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [filter, setFilter] = useState<'all' | 'chat' | 'arrived' | 'picked_up' | 'started' | 'completed' | 'payment_confirmed'>('all')
  const listRef = useRef<HTMLDivElement>(null)
  const [unread, setUnread] = useState(0)
  const lastSeenKey = `bf_chat_seen_${tripId}_${role}`
  const fileRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    const ch = supabase
      .channel('trip-chat-' + tripId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${tripId}` }, (payload: any) => {
        try { console.log('【收到訊息】內容:', payload?.new?.content, '原始封包:', payload?.new) } catch {}
        const row = payload.new
        if (!row) return
        setMessages(prev => [...prev, { id: row.id, type: 'chat', text: (row.content || row.message_content || '內容載入失敗'), from: (row.role || 'unknown'), time: row.created_at, eventType: 'chat', imageUrl: row.image_url || null, loc: row.location_data || null }])
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
    try { console.log('【發送檢查】文字內容:', v) } catch {}
    setText('')
    const tid = (tripId && String(tripId)) || (`support_${userId}`)
    const payload: any = { trip_id: tid, sender_id: userId, message_content: String(v), content: String(v), created_at: new Date().toISOString() }
    try {
      const { data: auth } = await supabase.auth.getUser()
      const authId = auth?.user?.id || null
      if (authId && authId !== userId) payload.sender_id = authId
    } catch {}
    try { console.log('【發送前檢查】Payload:', payload) } catch {}
    const { data, error } = await supabase.from('trip_messages').insert([payload] as any)
    if (error) {
      try { console.error('【Supabase 報錯詳情】:', { message: error.message, code: (error as any).code, details: (error as any).details, hint: (error as any).hint }) } catch {}
      try { window.alert(`發送失敗！原因：${error.message}${(error as any).code ? ` (${(error as any).code})` : ''}`) } catch {}
    }
  }
  const triggerImage = () => { try { fileRef.current?.click() } catch {} }
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const name = `${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name.replace(/\s+/g,'_')}`
      const tid = (tripId && String(tripId)) || (`support_${userId}`)
      const path = `${tid}/${name}`
      const { error } = await supabase.storage.from('chat_images').upload(path, file, { upsert: true, contentType: file.type })
      if (error) throw error
      const { data } = await supabase.storage.from('chat_images').getPublicUrl(path)
      const url = data?.publicUrl
      if (!url) throw new Error('no url')
      let sid = userId
      try {
        const { data: au } = await supabase.auth.getUser()
        if (au?.user?.id) sid = au.user.id
      } catch {}
      if (!sid) sid = 'anonymous'
      const payload: any = { trip_id: tid, sender_id: sid, message_content: '', content: '', image_url: url }
      try { console.log('【發送前檢查】Payload:', payload) } catch {}
      const { error: insErr } = await supabase.from('trip_messages').insert([payload] as any)
      if (insErr) { try { alert('圖片發送失敗：' + (insErr.message || '未知錯誤')) } catch {} }
    } catch {}
    try { if (fileRef.current) fileRef.current.value = '' } catch {}
  }
  const sendLocation = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
            try {
              const tid = (tripId && String(tripId)) || (`support_${userId}`)
              let sid = userId
              try {
                const { data: au } = await supabase.auth.getUser()
              if (au?.user?.id) sid = au.user.id
            } catch {}
            if (!sid) sid = 'anonymous'
            const payload: any = { trip_id: tid, sender_id: sid, message_content: '', content: '', location_data: loc }
            try { console.log('【發送前檢查】Payload:', payload) } catch {}
            const { error } = await supabase.from('trip_messages').insert([payload] as any)
            if (error) throw error
            resolve()
          } catch (e) { reject(e as any) }
        },
          () => reject(new Error('geolocation_failed')),
          { enableHighAccuracy: true, maximumAge: 5000 }
        )
      })
    } catch {}
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
            {m.imageUrl ? (
              <img src={m.imageUrl} alt="" style={{ maxWidth:'60%', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', cursor:'pointer' }} onClick={()=>setPreviewUrl(m.imageUrl!)} />
            ) : m.loc ? (
              <button onClick={()=>{ const u = `https://www.google.com/maps?q=${m.loc!.lat},${m.loc!.lng}`; window.open(u,'_blank') }} className="px-2 py-1 rounded text-xs" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}>
                📍 我目前的位置
              </button>
            ) : (
              <span>{m.text}</span>
            )}
          </div>
        ))}
        {messages.length === 0 && <div className="text-xs" style={{ color:'#9ca3af' }}>尚無訊息</div>}
      </div>
      <div className="flex items-center p-2 space-x-2">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="輸入訊息..." className="flex-1 px-2 py-2" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb', borderRadius:8 }} />
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display:'none' }} />
        <button onClick={triggerImage} className="px-2 py-2 rounded-lg hover:opacity-90" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}>
          <ImageIcon className="w-4 h-4" />
        </button>
        <button onClick={sendLocation} className="px-2 py-2 rounded-lg hover:opacity-90" style={{ background:'#1A1A1A', border:'1px solid rgba(218,165,32,0.35)', color:'#e5e7eb' }}>
          <MapPin className="w-4 h-4" />
        </button>
        <button onClick={send} className="px-3 py-2 rounded-lg hover:opacity-90 flex items-center space-x-1" style={{ backgroundImage:'linear-gradient(to right, #3b82f6, #2563eb)', color:'#111' }}>
          <Send className="w-4 h-4" />
          <span className="text-sm">送出</span>
        </button>
      </div>
      {previewUrl && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>setPreviewUrl(null)}>
          <img src={previewUrl} alt="" style={{ maxWidth:'90%', maxHeight:'90%', borderRadius:10, border:'2px solid rgba(255,255,255,0.2)' }} />
        </div>
      )}
    </div>
  )
}
