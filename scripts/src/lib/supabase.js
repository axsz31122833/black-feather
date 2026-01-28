import { createClient } from '@supabase/supabase-js'
const urlRaw = (import.meta).env?.VITE_SUPABASE_URL ?? ''
const keyRaw = (import.meta).env?.VITE_SUPABASE_ANON_KEY ?? ''
const supabaseUrl = String(urlRaw).trim()
const supabaseKey = String(keyRaw).trim()
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase 初始化錯誤：請設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY')
}
if (!/^https:\/\/.+/i.test(supabaseUrl)) {
  throw new Error('Supabase 初始化錯誤：VITE_SUPABASE_URL 必須以 https:// 開頭')
}
if (supabaseUrl.endsWith('/')) {
  throw new Error('Supabase 初始化錯誤：VITE_SUPABASE_URL 不可以斜線結尾')
}
export const supabase = createClient(supabaseUrl, supabaseKey)
export default supabase
