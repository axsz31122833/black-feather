import { Loader } from '@googlemaps/js-api-loader'
let loader: Loader | null = null
let ready: Promise<typeof google> | null = null

export async function loadGoogleMaps(libs: string[] = ['places']) {
  if (typeof window === 'undefined') throw new Error('no-window')
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!key) throw new Error('missing-google-maps-key')
  if ((window as any).google?.maps) return (window as any).google
  if (!loader) {
    loader = new Loader({ apiKey: key, version: 'weekly', libraries: libs })
  }
  if (!ready) {
    ready = (async () => {
      const google = await loader!.load()
      try { await (google as any).maps.importLibrary?.('maps') } catch {}
      try { if (libs.includes('places')) await (google as any).maps.importLibrary?.('places') } catch {}
      return google as any
    })()
  }
  return ready
}
