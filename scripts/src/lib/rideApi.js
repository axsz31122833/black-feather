import { supabase, ensureAuth } from './supabaseClient';

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || 'https://hmlyfcpicjpjxayilyhk.functions.supabase.co';

async function withHeaders() {
  await ensureAuth()
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  const headers = {
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
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
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from request_ride' }));
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const t1 = performance.now?.() || Date.now();
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
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from assign_driver' }));
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const t1 = performance.now?.() || Date.now();
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
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from update_location' }));
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const t1 = performance.now?.() || Date.now();
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
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from start_ride' }));
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const t1 = performance.now?.() || Date.now();
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
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from finish_ride' }));
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const t1 = performance.now?.() || Date.now();
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
    const json = await res.json().catch(() => ({ error: 'Invalid JSON from cancel_ride' }));
    try {
      await supabase.from('rides').update({ cancel_fee: 100, status: 'cancelled' }).eq('id', ride_id);
      await supabase.from('payments').insert({ trip_id: ride_id, amount: 100, payment_method: 'cash', status: 'pending' });
    } catch (e) {}
    return { ok: res.ok, status: res.status, data: json };
  } catch (e) {
    const t1 = performance.now?.() || Date.now();
    try {
      await supabase.from('rides').update({ cancel_fee: 100, status: 'cancelled' }).eq('id', ride_id);
      await supabase.from('payments').insert({ trip_id: ride_id, amount: 100, payment_method: 'cash', status: 'pending' });
    } catch {}
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

export async function storeRoute({ trip_id, path, price }) {
  const url = `${FUNCTIONS_URL}/store_route`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: await withHeaders(),
      body: JSON.stringify({ trip_id, path, price }),
    });
    const json = await res.json().catch(() => ({ ok: res.ok }))
    return { ok: res.ok, status: res.status, data: json }
  } catch (e) {
    return { ok: false, status: 0, data: { error: String(e) } }
  }
}

export async function requestPrebook({ trip_id }) {
  const url = `${FUNCTIONS_URL}/dispatch_prebook`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: await withHeaders(),
      body: JSON.stringify({ trip_id }),
    });
    const json = await res.json().catch(() => ({ ok: res.ok }))
    return { ok: res.ok, status: res.status, data: json }
  } catch (e) {
    return { ok: false, status: 0, data: { error: String(e) } }
  }
}

export async function setPriorityLock({ trip_id, lock_sec = 15, admin_sec = 90 }) {
  const url = `${FUNCTIONS_URL}/priority_lock`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: await withHeaders(),
      body: JSON.stringify({ trip_id, lock_sec, admin_sec }),
    });
    const json = await res.json().catch(() => ({ ok: res.ok }))
    return { ok: res.ok, status: res.status, data: json }
  } catch (e) {
    return { ok: false, status: 0, data: { error: String(e) } }
  }
}

export function subscribeDriverRides(driverId, handler) {
  try {
    return supabase
      .channel('driver-channel-' + driverId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `driver_id=eq.${driverId}` }, (payload) => {
        try { handler(payload); } catch (e) {}
      })
      .subscribe();
  } catch {
    return { unsubscribe(){}, on(){ return this }, subscribe(){ return this } }
  }
}

export function subscribeDriverLocations(handler) {
  try {
    return supabase
      .channel('locations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, (payload) => {
        try { handler(payload); } catch (e) {}
      })
      .subscribe();
  } catch {
    return { unsubscribe(){}, on(){ return this }, subscribe(){ return this } }
  }
}

export function subscribeRides(handler) {
  try {
    return supabase
      .channel('rides-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, (payload) => {
        try { handler(payload); } catch (e) {}
      })
      .subscribe();
  } catch {
    return { unsubscribe(){}, on(){ return this }, subscribe(){ return this } }
  }
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
