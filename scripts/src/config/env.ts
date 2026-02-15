export const env = {
  MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
  MAPS_MAP_ID: import.meta.env.VITE_GOOGLE_MAP_ID || '',
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  NODE_ENV: import.meta.env.MODE || 'development',
  VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY || '',
  PLATFORM_JKOPAY_ACCOUNT: import.meta.env.VITE_PLATFORM_JKOPAY_ACCOUNT || ''
}

export const getMapsKey = () => env.MAPS_API_KEY
export const getMapId = () => env.MAPS_MAP_ID
