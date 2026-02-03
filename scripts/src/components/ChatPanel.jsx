import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ChatPanel({ rideId, senderId, role = 'passenger' }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const subRef = useRef(null)

  useEffect(() => {
    let mounted = true
    ;(async ()=>{
      try {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('ride_id', rideId)
          .order('created_at', { ascending: false })
          .limit(50)
        if (mounted) setMessages((data||[]).reverse())
      } catch {}
    })()
    try {
      const ch = supabase
        .channel('messages-' + rideId)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `ride_id=eq.${rideId}` }, (payload) => {
          try {
            const msg = payload.new
            setMessages(prev => [...prev, msg])
          } catch {}
        })
        .subscribe()
      subRef.current = ch
    } catch {}
    return () => {
      try { subRef.current?.unsubscribe?.() } catch {}
      mounted = false
    }
  }, [rideId])

  async function send() {
    const content = String(text || '').trim()
    if (!content) return
    try {
      await supabase.from('messages').insert({ ride_id: rideId, sender_id: senderId, role, content })
      setText('')
    } catch {}
  }

  return (
    <div style={{ position:'fixed', right:12, bottom:96, width:320, maxWidth:'90vw', background:'#111', border:'1px solid rgba(212,175,55,0.35)', borderRadius:12, padding:12, zIndex:10000 }}>
      <div style={{ fontWeight:600, color:'#e5e7eb', marginBottom:8 }}>即時對話</div>
      <div style={{ maxHeight:220, overflowY:'auto', background:'#0b0b0b', borderRadius:8, padding:8, marginBottom:8 }}>
        {messages.length === 0 ? <div style={{ color:'#9ca3af' }}>尚無訊息</div> : messages.map((m)=>(
          <div key={m.id} style={{ marginBottom:6, color:'#e5e7eb' }}>
            <span style={{ fontSize:12, color:'#9ca3af' }}>[{m.role}]</span> {m.content}
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <input value={text} onChange={e=>setText(e.target.value)} placeholder="輸入訊息..." style={{ flex:1, padding:'8px 10px', borderRadius:8, border:'1px solid rgba(212,175,55,0.3)', background:'#0b0b0b', color:'#fff' }} />
        <button onClick={send} style={{ padding:'8px 12px', borderRadius:8, backgroundImage:'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111', fontWeight:600 }}>送出</button>
      </div>
    </div>
  )
}
