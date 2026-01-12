import { createClient } from '@supabase/supabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hmlyfcpicjpjxayilyhk.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_MSRGbeXWokHV5p0wsZm-uA_71ry5z2j'
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export default supabase
