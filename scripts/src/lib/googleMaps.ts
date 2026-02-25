let loaded = false
export async function loadGoogleMaps() {
  if (typeof window === 'undefined') throw new Error('no-window')
  const w = (window as any)
  if (w.google?.maps?.places) { loaded = true; return w.google }
  if (w._gmapsLoadingPromise) {
    await w._gmapsLoadingPromise
    return w.google
  }
  const key = (import.meta.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string) || (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || ''
  w._gmapsLoadingPromise = new Promise<void>((resolve, reject) => {
    if (w.google?.maps?.places) return resolve()
    const exists = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]') as HTMLScriptElement | null
    if (exists) {
      exists.addEventListener('load', () => resolve(), { once: true })
      exists.addEventListener('error', (e) => reject(e as any), { once: true })
      return
    }
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&v=weekly`
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = (e) => reject(e as any)
    document.head.appendChild(s)
  })
  await w._gmapsLoadingPromise
  loaded = true
  return (window as any).google
}
