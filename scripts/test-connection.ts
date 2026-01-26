import { createClient } from '@supabase/supabase-js'

async function main() {
  const url =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  const key =
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''

  console.log('[診斷] 讀取環境變數')
  console.log('SUPABASE_URL=', url ? '已取得' : '未設定')
  console.log('SUPABASE_ANON_KEY=', key ? '已取得' : '未設定')

  if (!url || !key) {
    console.error('環境變數缺失：請設定 SUPABASE_URL 與 SUPABASE_ANON_KEY（或對應 VITE_ 前綴）')
    process.exit(1)
  }

  const client = createClient(url, key)
  try {
    console.log('[診斷] 測試查詢 users 表')
    const { data, error } = await client.from('users').select('id,email,phone').limit(1)
    if (error) {
      console.error('[失敗] 查詢 users 表失敗：', error.message)
      process.exit(2)
    }
    console.log('[成功] 連線正常。樣本資料：', data)
  } catch (e: any) {
    console.error('[異常] 無法連線：', e?.message || String(e))
    process.exit(3)
  }
}

main().catch((e) => {
  console.error('[異常] 腳本錯誤：', e?.message || String(e))
  process.exit(4)
})
