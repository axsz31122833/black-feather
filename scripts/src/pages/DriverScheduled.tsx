import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from '../stores/auth'
import { useNavigate } from 'react-router-dom'

export default function DriverScheduled() {
  const { user } = useAuthStore() as any
  const navigate = useNavigate()
  const [list, setList] = useState<Array<any>>([])
  useEffect(() => {
    (async () => {
      try {
        const nowIso = new Date().toISOString()
        const { data } = await supabase
          .from('scheduled_rides')
          .select('*')
          .eq('processed', false)
          .gt('scheduled_time', nowIso)
          .order('scheduled_time', { ascending: true })
        setList(data || [])
      } catch {}
    })()
  }, [])
  useEffect(() => {
    const ch = supabase
      .channel('scheduled-rides')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_rides' }, (payload: any) => {
        const row = payload.new || payload.old
        setList(prev => {
          const cp = prev.slice()
          const idx = cp.findIndex(x => x.id === row.id)
          if (idx >= 0) cp[idx] = { ...(cp[idx] || {}), ...(payload.new || {}) }
          else cp.unshift(payload.new)
          return cp.filter(x => x && !x.processed).sort((a,b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime())
        })
      })
      .subscribe()
    return () => { ch.unsubscribe() }
  }, [])
  return (
    <div className="p-6">
      <div className="text-xl font-bold mb-4">預約大廳</div>
      {list.length === 0 ? (
        <div className="text-sm text-gray-500">目前沒有預約訂單</div>
      ) : (
        <div className="space-y-3">
          {list.map(item => {
            const t = new Date(item.scheduled_time)
            const hhmm = t.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
            return (
              <div key={item.id} className="rounded-2xl border border-[#D4AF37]/30 p-4 bg-[#1a1a1a] text-white">
                <div className="text-sm">乘客預計上車時間：{hhmm}</div>
                <div className="text-xs text-gray-300">上車：{item.pickup_lat?.toFixed(5)}, {item.pickup_lng?.toFixed(5)}</div>
                <div className="text-xs text-gray-300">目的地：{item.dropoff_lat?.toFixed(5)}, {item.dropoff_lng?.toFixed(5)}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        if (!user) return
                        await supabase.from('scheduled_rides').update({ accepted_driver_id: user.id, processed: true }).eq('id', item.id)
                        alert(`已搶單：乘客預計上車時間 ${hhmm}`)
                        navigate('/driver')
                      } catch {}
                    }}
                    className="px-3 py-2 rounded-2xl text-black"
                    style={{ backgroundImage: 'linear-gradient(to right, #FFD700, #B8860B)' }}
                  >
                    搶單
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
