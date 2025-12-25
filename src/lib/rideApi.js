import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function withHeaders() {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  };
}

export async function requestRide({ passenger_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, scheduled_time }) {
  const url = FUNCTIONS_URL.replace(/\/$/, '') + '/request_ride';
  const res = await fetch(url, {
    method: 'POST',
    headers: withHeaders(),
    body: JSON.stringify({ passenger_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, scheduled_time }),
  });
  const json = await res.json().catch(() => ({ error: 'Invalid JSON from request_ride' }));
  return { ok: res.ok, status: res.status, data: json };
}

export async function assignDriver({ passenger_lat, passenger_lng }) {
  const url = FUNCTIONS_URL.replace(/\/$/, '') + '/assign_driver';
  const res = await fetch(url, {
    method: 'POST',
    headers: withHeaders(),
    body: JSON.stringify({ passenger_lat, passenger_lng }),
  });
  const json = await res.json().catch(() => ({ error: 'Invalid JSON from assign_driver' }));
  return { ok: res.ok, status: res.status, data: json };
}

export async function updateDriverLocation({ driver_id, lat, lng }) {
  const url = FUNCTIONS_URL.replace(/\/$/, '') + '/update_location';
  const res = await fetch(url, {
    method: 'POST',
    headers: withHeaders(),
    body: JSON.stringify({ driver_id, lat, lng }),
  });
  const json = await res.json().catch(() => ({ error: 'Invalid JSON from update_location' }));
  return { ok: res.ok, status: res.status, data: json };
}

export async function startRide({ ride_id }) {
  const url = FUNCTIONS_URL.replace(/\/$/, '') + '/start_ride';
  const res = await fetch(url, {
    method: 'POST',
    headers: withHeaders(),
    body: JSON.stringify({ ride_id }),
  });
  const json = await res.json().catch(() => ({ error: 'Invalid JSON from start_ride' }));
  return { ok: res.ok, status: res.status, data: json };
}

export async function finishRide({ ride_id, final_drop_lat, final_drop_lng }) {
  const url = FUNCTIONS_URL.replace(/\/$/, '') + '/finish_ride';
  const res = await fetch(url, {
    method: 'POST',
    headers: withHeaders(),
    body: JSON.stringify({ ride_id, final_drop_lat, final_drop_lng }),
  });
  const json = await res.json().catch(() => ({ error: 'Invalid JSON from finish_ride' }));
  return { ok: res.ok, status: res.status, data: json };
}

export async function cancelRide({ ride_id, reason }) {
  const url = FUNCTIONS_URL.replace(/\/$/, '') + '/cancel_ride';
  const res = await fetch(url, {
    method: 'POST',
    headers: withHeaders(),
    body: JSON.stringify({ ride_id, reason }),
  });
  const json = await res.json().catch(() => ({ error: 'Invalid JSON from cancel_ride' }));
  return { ok: res.ok, status: res.status, data: json };
}

export function subscribeDriverRides(driverId, handler) {
  const channel = supabase
    .channel('driver-channel-' + driverId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: "driver_id=eq." + driverId }, (payload) => {
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

