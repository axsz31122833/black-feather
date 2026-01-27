import { createClient } from '@supabase/supabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const service = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseKey = service || anon
function makeSafeClient() {
  const safe = {
    auth: {
      async signOut() { return { error: null } },
      async getUser() { return { data: { user: null } } },
    },
    from(_table) {
      return {
        select: async () => ({ data: [], error: supabaseUrl && supabaseKey ? null : { message: 'Supabase 未初始化（缺少 URL/KEY）' } }),
        insert: async (_v) => ({ data: null, error: supabaseUrl && supabaseKey ? null : { message: 'Supabase 未初始化（缺少 URL/KEY）' } }),
        upsert: async (_v) => ({ data: null, error: supabaseUrl && supabaseKey ? null : { message: 'Supabase 未初始化（缺少 URL/KEY）' } }),
        update: async (_v) => ({ data: null, error: supabaseUrl && supabaseKey ? null : { message: 'Supabase 未初始化（缺少 URL/KEY）' } }),
        eq: (_c, _v) => ({ select: async () => ({ data: [], error: null }) }),
        single: async () => ({ data: null, error: null }),
        maybeSingle: async () => ({ data: null, error: null }),
        order: (_c, _opt) => ({ select: async () => ({ data: [], error: null }) }),
        limit: (_n) => ({ select: async () => ({ data: [], error: null }) }),
        in: (_c, _arr) => ({ select: async () => ({ data: [], error: null }) }),
      }
    },
    channel() { return { on() { return this }, subscribe() { return this }, unsubscribe() {} } },
  }
  return safe
}
export const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : makeSafeClient()
export default supabase
