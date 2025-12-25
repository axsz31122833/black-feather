import React from 'react'
import { supabase } from '../../lib/supabase'

export default function DbMigrationsCheck() {
  const [status, setStatus] = React.useState<{ dispatch_settings: string; scheduled_driver_id: string }>({ dispatch_settings: '檢查中', scheduled_driver_id: '檢查中' })
  React.useEffect(() => {
    (async () => {
      let ds = '未部署'
      let sd = '未部署'
      try {
        const { error } = await supabase.from('dispatch_settings').select('id').limit(1)
        if (!error) ds = 'OK'
      } catch {}
      try {
        const { error } = await supabase.from('scheduled_rides').select('driver_id').limit(1)
        if (!error) sd = 'OK'
      } catch {}
      setStatus({ dispatch_settings: ds, scheduled_driver_id: sd })
    })()
  }, [])
  return (
    <div className="text-sm text-gray-800">
      <div className="flex items-center justify-between">
        <span>dispatch_settings 表</span>
        <span className={`px-2 py-1 rounded ${status.dispatch_settings==='OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{status.dispatch_settings}</span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span>scheduled_rides.driver_id 欄位</span>
        <span className={`px-2 py-1 rounded ${status.scheduled_driver_id==='OK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{status.scheduled_driver_id}</span>
      </div>
      <div className="mt-3 text-xs text-gray-600">若顯示未部署，請執行 supabase/sql 目錄下的遷移檔：010、011、012、013。</div>
    </div>
  )
}

