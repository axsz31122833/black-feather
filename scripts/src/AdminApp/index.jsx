import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AdminApp() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [history, setHistory] = useState([])
  const [manual, setManual] = useState({ driver_name:'', pickup_text:'', dropoff_text:'', distance_km:'', duration_min:'', fare_final:'' })

  async function load() {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id,full_name,phone,referrer_phone,role,created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      const list = data || []
      const countMap = {}
      for (const r of list) {
        const key = r.phone || ''
        countMap[key] = 0
      }
      for (const r of list) {
        const ref = r.referrer_phone || ''
        if (ref && countMap[ref] != null) countMap[ref]++
      }
      setRows(list.map(r => ({ ...r, referral_count: countMap[r.phone || ''] || 0 })))
      const nowIso = new Date().toISOString()
      const { data: alertRides } = await supabase
        .from('rides')
        .select('id,pickup_text,dropoff_text,distance_km,scheduled_time,pre_dispatch,pre_dispatch_expires_at')
        .gte('distance_km', 40)
        .eq('pre_dispatch', true)
      setAlerts(alertRides || [])
      const since = new Date(Date.now() - 30*24*60*60*1000).toISOString()
      const { data: hist } = await supabase
        .from('rides')
        .select('id,pickup_text,dropoff_text,fare_final,distance_km,duration_min,driver_name,route_history,ended_at')
        .gte('ended_at', since)
        .order('ended_at', { ascending: false })
        .limit(200)
      setHistory(hist || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setDriver(id) {
    try {
      await supabase.from('profiles').update({ role: 'driver' }).eq('id', id)
      await load()
    } catch {}
  }
  async function assignRide(rideId, driverId) {
    try {
      await supabase.from('rides').update({ pre_dispatch: false }).eq('id', rideId)
    } catch {}
  }
  async function addManual() {
    try {
      const payload = {
        driver_name: manual.driver_name || null,
        pickup_text: manual.pickup_text || null,
        dropoff_text: manual.dropoff_text || null,
        distance_km: Number(manual.distance_km || 0),
        duration_min: Number(manual.duration_min || 0),
        fare_final: Number(manual.fare_final || 0),
        ended_at: new Date().toISOString(),
        route_history: []
      }
      await supabase.from('rides').insert(payload)
      setManual({ driver_name:'', pickup_text:'', dropoff_text:'', distance_km:'', duration_min:'', fare_final:'' })
      await load()
    } catch {}
  }

  function Countdown({ id, onExpire }) {
    const [sec, setSec] = useState(90)
    useEffect(() => {
      const t = setInterval(() => setSec(s => s > 0 ? s - 1 : 0), 1000)
      return () => clearInterval(t)
    }, [])
    useEffect(() => {
      if (sec === 0) { try { onExpire?.() } catch {} }
    }, [sec])
    return <div style={{ color:'#ff8a80', marginTop:6 }}>釋放倒數：{sec}s</div>
  }

  return (
    <>
    <div style={{ padding: 24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#D4AF37' }}>用戶戰情牆</div>
        <button onClick={load} style={{ padding: '6px 10px', borderRadius: 8, border:'1px solid rgba(212,175,55,0.25)', color:'#e5e7eb' }}>重新載入</button>
      </div>
      <div style={{ overflowX: 'auto', border:'1px solid rgba(212,175,55,0.25)', borderRadius: 12 }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#0b0b0b', color:'#e5e7eb' }}>
              <th style={{ padding:8, textAlign:'left' }}>姓名</th>
              <th style={{ padding:8, textAlign:'left' }}>電話</th>
              <th style={{ padding:8, textAlign:'left' }}>邀請人電話</th>
              <th style={{ padding:8, textAlign:'left' }}>角色</th>
              <th style={{ padding:8, textAlign:'left' }}>推薦統計</th>
              <th style={{ padding:8, textAlign:'left' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop: '1px solid #222', color:'#e5e7eb' }}>
                <td style={{ padding:8 }}>{r.full_name || '-'}</td>
                <td style={{ padding:8 }}>{r.phone || '-'}</td>
                <td style={{ padding:8 }}>{r.referrer_phone || '-'}</td>
                <td style={{ padding:8 }}>{r.role || '-'}</td>
                <td style={{ padding:8 }}>{r.referral_count}</td>
                <td style={{ padding:8 }}>
                  <button onClick={()=>setDriver(r.id)} style={{ padding:'6px 10px', borderRadius:8, backgroundImage:'linear-gradient(to right, #D4AF37, #B8860B)', color:'#111', fontWeight:700 }}>
                    一鍵設為司機
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ padding:12, color:'#9ca3af' }}>{loading ? '載入中...' : '無資料'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
    <div style={{ padding:24 }}>
      <div style={{ fontSize:20, fontWeight:700, color:'#D4AF37', marginBottom:12 }}>長途預約攔截（>=40km）</div>
      <div style={{ display:'grid', gap:8 }}>
        {alerts.map(a=>(
          <div key={a.id} style={{ background:'#150000', border:'1px solid #b71c1c', borderRadius:8, padding:10 }}>
            <div style={{ color:'#ff8a80', fontWeight:700 }}>警報：{(a.distance_km||0)} km 預約單</div>
            <div style={{ color:'#e5e7eb' }}>{a.pickup_text} → {a.dropoff_text}</div>
            <Countdown id={a.id} onExpire={()=>assignRide(a.id)} />
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={()=>assignRide(a.id)} style={{ padding:'6px 10px', borderRadius:8, background:'#1e88e5', color:'#fff' }}>釋放到預約專區</button>
            </div>
          </div>
        ))}
        {alerts.length===0 && <div style={{ color:'#9ca3af' }}>目前無長途警報</div>}
      </div>
    </div>
    <div style={{ padding:24 }}>
      <div style={{ fontSize:20, fontWeight:700, color:'#D4AF37', marginBottom:12 }}>30 天行程歷史</div>
      <div style={{ overflowX:'auto', border:'1px solid rgba(212,175,55,0.25)', borderRadius:12 }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'#0b0b0b', color:'#e5e7eb' }}>
              <th style={{ padding:8, textAlign:'left' }}>司機</th>
              <th style={{ padding:8, textAlign:'left' }}>起點</th>
              <th style={{ padding:8, textAlign:'left' }}>終點</th>
              <th style={{ padding:8, textAlign:'left' }}>金額</th>
              <th style={{ padding:8, textAlign:'left' }}>里程</th>
              <th style={{ padding:8, textAlign:'left' }}>時間</th>
            </tr>
          </thead>
          <tbody>
            {history.map(h=>(
              <tr key={h.id} style={{ borderTop:'1px solid #222', color:'#e5e7eb' }}>
                <td style={{ padding:8 }}>{h.driver_name || '-'}</td>
                <td style={{ padding:8 }}>{h.pickup_text || '-'}</td>
                <td style={{ padding:8 }}>{h.dropoff_text || '-'}</td>
                <td style={{ padding:8 }}>{h.fare_final != null ? `NT$ ${h.fare_final}` : '-'}</td>
                <td style={{ padding:8 }}>{h.distance_km || '-'}</td>
                <td style={{ padding:8 }}>{h.duration_min || '-'}</td>
              </tr>
            ))}
            {history.length===0 && <tr><td colSpan={6} style={{ padding:12, color:'#9ca3af' }}>無資料</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop:12 }}>
        <div style={{ fontSize:16, fontWeight:700, color:'#D4AF37', marginBottom:8 }}>手動補錄</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
          <input placeholder="司機名" value={manual.driver_name} onChange={e=>setManual(v=>({ ...v, driver_name:e.target.value }))} style={{ padding:8, borderRadius:8, background:'#111', color:'#fff', border:'1px solid rgba(212,175,55,0.25)' }} />
          <input placeholder="起點文字" value={manual.pickup_text} onChange={e=>setManual(v=>({ ...v, pickup_text:e.target.value }))} style={{ padding:8, borderRadius:8, background:'#111', color:'#fff', border:'1px solid rgba(212,175,55,0.25)' }} />
          <input placeholder="終點文字" value={manual.dropoff_text} onChange={e=>setManual(v=>({ ...v, dropoff_text:e.target.value }))} style={{ padding:8, borderRadius:8, background:'#111', color:'#fff', border:'1px solid rgba(212,175,55,0.25)' }} />
          <input placeholder="里程 km" value={manual.distance_km} onChange={e=>setManual(v=>({ ...v, distance_km:e.target.value }))} style={{ padding:8, borderRadius:8, background:'#111', color:'#fff', border:'1px solid rgba(212,175,55,0.25)' }} />
          <input placeholder="時間 min" value={manual.duration_min} onChange={e=>setManual(v=>({ ...v, duration_min:e.target.value }))} style={{ padding:8, borderRadius:8, background:'#111', color:'#fff', border:'1px solid rgba(212,175,55,0.25)' }} />
          <input placeholder="金額 NT$" value={manual.fare_final} onChange={e=>setManual(v=>({ ...v, fare_final:e.target.value }))} style={{ padding:8, borderRadius:8, background:'#111', color:'#fff', border:'1px solid rgba(212,175,55,0.25)' }} />
        </div>
        <button onClick={addManual} style={{ marginTop:8, padding:'8px 12px', borderRadius:8, background:'linear-gradient(to right,#D4AF37,#B8860B)', color:'#111', fontWeight:700 }}>新增行程</button>
      </div>
    </div>
    </>
  )
}
