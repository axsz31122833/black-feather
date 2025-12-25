export const env = {
  MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  NODE_ENV: import.meta.env.MODE || 'development',
  VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY || '',
  PLATFORM_JKOPAY_ACCOUNT: import.meta.env.VITE_PLATFORM_JKOPAY_ACCOUNT || ''
}

export const getMapsKey = () => {
  if (!env.MAPS_API_KEY) {
    throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY')
  }
  return env.MAPS_API_KEY
}
