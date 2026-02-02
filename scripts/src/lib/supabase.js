import { supabase as client } from './supabase'
export const supabase = client
export const ensureAuth = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
export default client
