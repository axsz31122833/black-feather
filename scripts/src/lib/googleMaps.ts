import { Loader } from '@googlemaps/js-api-loader'
let loader: Loader | null = null
let ready: Promise<typeof google> | null = null

export async function loadGoogleMaps(libs: string[] = ['places']) {
  if (typeof window === 'undefined') throw new Error('no-window')
  const keyRaw = (import.meta.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string) || (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string)
  const key = keyRaw as string
  try {
    const preview = key ? String(key).slice(0, 5) + '***' : 'undefined'
    console.log('GMAPS env:', preview, 'online:', navigator.onLine)
  } catch {}
  if (!key) throw new Error('missing-google-maps-key')
  if ((window as any).google?.maps) return (window as any).google
  if (!loader) {
    loader = new Loader({ apiKey: key, version: 'weekly', libraries: libs })
  }
  if (!ready) {
    ready = (async () => {
      const google = await loader!.load().catch((err: any) => {
        try { console.error('GMAPS load error:', err?.message || err) } catch {}
        try { alert('Google Maps Error: ' + (err?.message || err)) } catch {}
        throw err
      })
      try { await (google as any).maps.importLibrary?.('maps') } catch (e: any) { try { console.error('GMAPS import maps error:', e?.message || e); alert('Google Maps Error: ' + (e?.message || e)) } catch {} }
      try { if (libs.includes('places')) await (google as any).maps.importLibrary?.('places') } catch (e: any) { try { console.error('GMAPS import places error:', e?.message || e); alert('Google Maps Error: ' + (e?.message || e)) } catch {} }
      try { console.log('GMAPS ready:', !!(google as any).maps) } catch {}
      return google as any
    })()
  }
  return ready
}
try {
  // proactively attempt load to decouple from app state
  // libraries: maps + places
  ;(async () => { try { await loadGoogleMaps(['places']) } catch {} })()
} catch {}
