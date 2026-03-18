import { getSupabaseUrl, getSupabaseHeaders, getAuthorizedHeaders } from './supabase'

export function installFetchPatch() {
  try {
    const base = getSupabaseUrl()
    const original = window.fetch
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const url = typeof input === 'string' ? input : String((input as any)?.url || '')
        if (base && url.startsWith(base)) {
          const hdrs = new Headers(init?.headers || {})
          if (!hdrs.has('apikey')) {
            const h = await getAuthorizedHeaders()
            hdrs.set('apikey', h.apikey as any)
            if (h.Authorization) hdrs.set('Authorization', h.Authorization as any)
            init = { ...(init || {}), headers: hdrs }
          }
        }
      } catch {}
      const res = await original(input as any, init as any)
      try {
        const url = typeof input === 'string' ? input : String((input as any)?.url || '')
        if (base && url.startsWith(base) && !res.ok) {
          const clone = res.clone()
          let err: any = {}
          try { err = await clone.json() } catch { try { err.text = await clone.text() } catch {} }
          try {
            console.error('【Supabase 請求失敗】:', { url, status: res.status, ...err })
            const msg = [err.message, err.code, err.details, err.hint].filter(Boolean).join(' | ')
            alert(`資料請求失敗：${msg || ('HTTP '+res.status)}`)
          } catch {}
        }
      } catch {}
      return res
    }
  } catch {}
}
