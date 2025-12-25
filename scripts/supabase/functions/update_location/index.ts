// Supabase Edge Function: update_location
// Updates driver's current location and logs it in driver_locations.
// Runtime: Deno

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://hmlyfcpicjpjxayilyhk.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

export default async function handler(req: Request): Promise<Response> {
  try {
    if (!SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_SERVICE_ROLE_KEY secret" }), { status: 500 });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => null);
    if (!body) return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });

    const { driver_id, lat, lng } = body as { driver_id: string; lat: number; lng: number };
    if (!driver_id || typeof lat !== "number" || typeof lng !== "number") {
      return new Response(JSON.stringify({ error: "Missing driver_id or lat/lng" }), { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const { data: driver, error: driverErr } = await supabase
      .from("drivers")
      .update({ current_lat: lat, current_lng: lng, last_seen_at: nowIso })
      .eq("id", driver_id)
      .select("id, name, status, car_plate, current_lat, current_lng")
      .single();
    if (driverErr) throw driverErr;

    // Use PostGIS geography Point via RPC to upsert into driver_locations
    // Requires SQL function:
    // create or replace function upsert_driver_location(p_driver uuid, p_lat double precision, p_lng double precision)
    // returns void language sql as $$
    //   insert into driver_locations(driver_id, location)
    //   values (p_driver, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography)
    //   on conflict (driver_id) do update set location = EXCLUDED.location, updated_at = now();
    // $$;
    const { error: rpcErr } = await supabase.rpc("upsert_driver_location", {
      p_driver: driver_id,
      p_lat: lat,
      p_lng: lng,
    });
    if (rpcErr) throw rpcErr;

    // Broadcast realtime via table change: if driver currently has an active ride, log into ride_locations
    try {
      const { data: activeRide } = await supabase
        .from("rides")
        .select("id")
        .eq("driver_id", driver_id)
        .in("status", ["assigned", "in_progress"]) as any;
      const rideId = Array.isArray(activeRide) && activeRide[0]?.id ? activeRide[0].id : null;
      if (rideId) {
        // Optional RPC to insert geography point for the ride path, if table exists
        await supabase.rpc("insert_ride_location", { p_ride_id: rideId, p_lat: lat, p_lng: lng });
        await supabase.from("ops_events").insert({
          event_type: "driver_location",
          ref_id: driver_id,
          message: "Driver GPS update",
          payload: { lat, lng, ride_id: rideId }
        });
      }
    } catch (_e) {
      // swallow if ride_locations or rpc not present
    }

    return new Response(JSON.stringify({ ok: true, driver }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("update_location error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
