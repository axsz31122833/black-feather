import { supabase } from './supabase'
export { supabase }
export const ensureAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
