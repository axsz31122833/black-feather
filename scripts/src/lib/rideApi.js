import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hmlyfcpicjpjxayilyhk.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_MSRGbeXWokHV5p0wsZm-uA_71ry5z2j';
const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || 'https://hmlyfcpicjpjxayilyhk.functions.supabase.co';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function withHeaders() {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function requestRide({ passenger_id, origin, destination }) {
  const url = `${FUNCTIONS_URL}/request_ride`;
  const t0 = performance.now?.() || Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: await withHeaders(),
      body: JSON.stringify({ passenger_id, origin, destination }),
    });
    const t1 = performance.now?.() || Date.now();
    try { await supabase.from('ops_events').insert({ event_type: 'backend_perf', payload: { url, ms: Math.round(t1 - t0), status: res.status } }); } catch {}
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from request_ride' }));
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const t1 = performance.now?.() || Date.now();
    try { await supabase.from('ops_events').insert({ event_type: 'backend_error', payload: { url, ms: Math.round(t1 - t0), error: String(e) } }); } catch {}
    return { ok: false, status: 0, data: { error: 'network_error' } };
  }
}

export async function assignDriver({ ride_id, driver_id }) {
  const url = `${FUNCTIONS_URL}/assign_driver`;
  const t0 = performance.now?.() || Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: await withHeaders(),
      body: JSON.stringify(driver_id ? { ride_id, driver_id } : { ride_id }),
    });
    const t1 = performance.now?.() || Date.now();
    try { await supabase.from('ops_events').insert({ event_type: 'backend_perf', payload: { url, ms: Math.round(t1 - t0), status: res.status } }); } catch {}
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from assign_driver' }));
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const t1 = performance.now?.() || Date.now();
    try { await supabase.from('ops_events').insert({ event_type: 'backend_error', payload: { url, ms: Math.round(t1 - t0), error: String(e) } }); } catch {}
    return { ok: false, status: 0, data: { error: 'network_error' } };
  }
}

export async function updateDriverLocation({ driver_id, lat, lng }) {
  const url = `${FUNCTIONS_URL}/update_location`;
  const t0 = performance.now?.() || Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: await withHeaders(),
      body: JSON.stringify({ driver_id, lat, lng }),
    });
    const t1 = performance.now?.() || Date.now();
    try { await supabase.from('ops_events').insert({ event_type: 'backend_perf', payload: { url, ms: Math.round(t1 - t0), status: res.status } }); } catch {}
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from update_location' }));
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const t1 = performance.now?.() || Date.now();
    try { await supabase.from('ops_events').insert({ event_type: 'backend_error', payload: { url, ms: Math.round(t1 - t0), error: String(e) } }); } catch {}
    return { ok: false, status: 0, data: { error: 'network_error' } };
  }
}

export async function startRide({ ride_id }) {
  const url = `${FUNCTIONS_URL}/start_ride`;
  const t0 = performance.now?.() || Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: await withHeaders(),
      body: JSON.stringify({ ride_id }),
    });
    const t1 = performance.now?.() || Date.now();
    try { await supabase.from('ops_events').insert({ event_type: 'backend_perf', payload: { url, ms: Math.round(t1 - t0), status: res.status } }); } catch {}
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from start_ride' }));
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const t1 = performance.now?.() || Date.now();
    try { await supabase.from('ops_events').insert({ event_type: 'backend_error', payload: { url, ms: Math.round(t1 - t0), error: String(e) } }); } catch {}
    return { ok: false, status: 0, data: { error: 'network_error' } };
  }
}

export async function finishRide({ ride_id, dropoff }) {
  const url = `${FUNCTIONS_URL}/finish_ride`;
  const t0 = performance.now?.() || Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: await withHeaders(),
      body: JSON.stringify({ ride_id, dropoff }),
    });
    const t1 = performance.now?.() || Date.now();
    try { await supabase.from('ops_events').insert({ event_type: 'backend_perf', payload: { url, ms: Math.round(t1 - t0), status: res.status } }); } catch {}
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from finish_ride' }));
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const t1 = performance.now?.() || Date.now();
    try { await supabase.from('ops_events').insert({ event_type: 'backend_error', payload: { url, ms: Math.round(t1 - t0), error: String(e) } }); } catch {}
    return { ok: false, status: 0, data: { error: 'network_error' } };
  }
}

export async function cancelRide({ ride_id, reason }) {
  const url = `${FUNCTIONS_URL}/cancel_ride`;
  const t0 = performance.now?.() || Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: await withHeaders(),
      body: JSON.stringify({ ride_id, reason }),
    });
    const t1 = performance.now?.() || Date.now();
    try { await supabase.from('ops_events').insert({ event_type: 'backend_perf', payload: { url, ms: Math.round(t1 - t0), status: res.status } }); } catch {}
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from cancel_ride' }));
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const t1 = performance.now?.() || Date.now();
    try { await supabase.from('ops_events').insert({ event_type: 'backend_error', payload: { url, ms: Math.round(t1 - t0), error: String(e) } }); } catch {}
    return { ok: false, status: 0, data: { error: 'network_error' } };
  }
}

export async function sendPush({ user_id, title, body }) {
  const url = `${FUNCTIONS_URL}/send_push`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: await withHeaders(),
      body: JSON.stringify({ user_id, title, body }),
    });
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from send_push' }));
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    return { ok: false, status: 0, data: { error: String(e) } };
  }
}

export function subscribeDriverRides(driverId, handler) {
  const channel = supabase
    .channel('driver-channel-' + driverId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `driver_id=eq.${driverId}` }, (payload) => {
      try { handler(payload); } catch (e) { console.error('handler error', e); }
    })
    .subscribe();
  return channel;
}

export function subscribeDriverLocations(handler) {
  const channel = supabase
    .channel('locations')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
      try { handler(payload); } catch (e) { console.error('handler error', e); }
    })
    .subscribe();
  return channel;
}

export function subscribeRides(handler) {
  const channel = supabase
    .channel('rides-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, (payload) => {
      try { handler(payload); } catch (e) { console.error('handler error', e); }
    })
    .subscribe();
  return channel;
}

export function startDriverLocationUploader(driverId, getCoordsFn) {
  const timer = setInterval(async () => {
    try {
      const { lat, lng } = await getCoordsFn();
      await updateDriverLocation({ driver_id: driverId, lat, lng });
    } catch (e) {
      console.warn('update location failed', e);
    }
  }, 3000);
  return () => clearInterval(timer);
}

export async function signInWithPhone({ phone }) {
  const { data, error } = await supabase.auth.signInWithOtp({ phone });
  return { data, error };
}

export async function verifyPhoneOtp({ phone, token }) {
  const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  return { data, error };
}

export async function runScheduleChecker() {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/schedule_checker`, {
      method: 'POST',
      headers: await withHeaders(),
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({ error: 'Invalid JSON from schedule_checker' }));
      return { ok: true, status: res.status, data: json };
    }
  } catch {}
  const mb = await readMinutesBefore()
  const data = await runLocalScheduleChecker(mb)
  return { ok: true, status: 200, data }
}

async function readMinutesBefore() {
  try {
    const { data } = await supabase.from('scheduler_config').select('minutes_before').eq('id', 'global').single()
    return (data?.minutes_before || 15)
  } catch { return 15 }
}

async function runLocalScheduleChecker(minutesBefore) {
  const now = Date.now()
  const triggerAt = new Date(now + minutesBefore * 60 * 1000).toISOString()
  const { data: sched } = await supabase
    .from('scheduled_rides')
    .select('id, passenger_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, scheduled_time, processed, status, driver_id')
    .lte('scheduled_time', triggerAt)
    .eq('processed', false)
    .order('scheduled_time', { ascending: true })
  const created = []
  for (const s of (sched || [])) {
    let driverId = s.driver_id || null
    try {
      const { data: ev } = await supabase
        .from('ops_events')
        .select('payload,created_at')
        .eq('ref_id', s.id)
        .eq('event_type', 'scheduled_accept')
        .order('created_at', { ascending: false })
        .limit(1)
      const p = ev && ev[0]?.payload
      if (p && p.driver_id) driverId = p.driver_id
    } catch {}
    const pickup = { lat: s.pickup_lat, lng: s.pickup_lng }
    const dropoff = { lat: s.dropoff_lat, lng: s.dropoff_lng }
    const { data: trip, error: terr } = await supabase
      .from('trips')
      .insert({
        passenger_id: s.passenger_id,
        pickup_location: pickup,
        dropoff_location: dropoff,
        status: driverId ? 'accepted' : 'requested',
        driver_id: driverId || null
      })
      .select('id')
      .single()
    if (!terr && trip?.id) {
      try {
        await supabase.from('scheduled_rides').update({ processed: true, status: 'dispatched' }).eq('id', s.id)
        await supabase.from('ops_events').insert({ event_type: 'scheduled_dispatch', ref_id: s.id, payload: { trip_id: trip.id, driver_id: driverId || null } })
      } catch {}
      created.push({ scheduled_id: s.id, trip_id: trip.id, driver_id: driverId || null })
    }
  }
  return { processed: created.length, items: created }
}
