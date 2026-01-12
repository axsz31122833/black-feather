import React from 'react'
import { env } from '../config/env'

export default function EnvBanner() {
  const missing: string[] = []
  if (!env.SUPABASE_URL) missing.push('Supabase URL')
  if (!env.SUPABASE_ANON_KEY) missing.push('Supabase Anon Key')
  if (missing.length === 0) return null
  return (
    <div className="bg-red-50 text-red-800 text-sm px-3 py-2 border-b border-red-200">
      缺少環境設定：{missing.join(', ')}。請設定 `.env` 或專案環境變數後重新載入。
    </div>
  )
}
