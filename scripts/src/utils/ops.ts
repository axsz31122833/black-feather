import { supabase } from '../lib/supabase'

export async function sendOpsEvent(event_type: string, ref_id?: string, payload?: any) {
  try {
    const { error } = await supabase.from('ops_events').insert({ event_type, ref_id: ref_id || null, payload: payload || null })
    if (error) throw error
  } catch {
    try {
      if (navigator?.serviceWorker?.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'enqueue_ops', event_type, ref_id, payload })
        if ('sync' in (navigator as any)) {
          ;(navigator as any).serviceWorker.ready.then((reg: any) => reg.sync.register('bf-sync')).catch(()=>{})
        }
      }
    } catch {}
  }
}

