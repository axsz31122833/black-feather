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
      return original(input as any, init as any)
    }
  } catch {}
}
