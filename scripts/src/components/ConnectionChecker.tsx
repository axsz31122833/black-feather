import React, { useEffect } from 'react'

export default function ConnectionChecker() {
  useEffect(() => {
    try {
      const raw = (import.meta as any).env?.VITE_SUPABASE_URL ?? ''
      const url = String(raw).trim()
      if (!/^https:\/\/.+/i.test(url)) {
        alert('連線錯誤：VITE_SUPABASE_URL 必須以 https:// 開頭，且不含多餘空白/引號')
      }
      if (url.endsWith('/')) {
        alert('連線錯誤：VITE_SUPABASE_URL 不可斜線結尾')
      }
    } catch {}
  }, [])
  return null
}
