export async function loadGoogleMaps() {
  if (typeof window === 'undefined') throw new Error('no-window')
  const keyRaw = (import.meta.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string) || (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string)
  const preview = keyRaw ? String(keyRaw).slice(0, 5) + '***' : 'undefined'
  try { console.log('GMAPS env:', preview, 'online:', navigator.onLine) } catch {}
  const start = Date.now()
  return new Promise<any>((resolve, reject) => {
    const check = () => {
      if ((window as any).google?.maps) {
        try { console.log('GMAPS ready:', true) } catch {}
        resolve((window as any).google)
        return
      }
      if (Date.now() - start > 15000) {
        try { alert('Google Maps Error: timeout while waiting for SDK') } catch {}
        reject(new Error('gmaps-timeout'))
        return
      }
      setTimeout(check, 200)
    }
    check()
  })
}
