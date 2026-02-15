import { Loader } from '@googlemaps/js-api-loader'
let loader: Loader | null = null
let loaded = false
export async function loadGoogleMaps() {
  if (typeof window === 'undefined') throw new Error('no-window')
  if ((window as any).google?.maps) { loaded = true; return (window as any).google }
  const key = (import.meta.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string) || (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string)
  if (!loader) {
    loader = new Loader({ apiKey: key || '', libraries: ['places', 'marker'] })
  }
  try {
    await loader!.importLibrary('maps')
    await loader!.importLibrary('places')
    await loader!.importLibrary('marker')
    loaded = true
    return (window as any).google
  } catch (e) {
    throw e
  }
}
