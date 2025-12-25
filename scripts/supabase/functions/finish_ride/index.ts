// Supabase Edge Function: finish_ride
// Set end_time, compute total distance via PostGIS (ride path), apply pricing and fixed commission, mark completed.
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

    const { ride_id, dropoff } = body as { ride_id: string; dropoff?: { lat: number; lng: number } };
    if (!ride_id) return new Response(JSON.stringify({ error: "Missing ride_id" }), { status: 400 });

    // Get ride
    const { data: existing, error: getErr } = await supabase
      .from("rides")
      .select("id, driver_id, passenger_id, started_at, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng")
      .eq("id", ride_id)
      .single();
    if (getErr) throw getErr;

    // Optionally update dropoff
    let finalDropLat = existing?.dropoff_lat ?? null;
    let finalDropLng = existing?.dropoff_lng ?? null;
    if (dropoff?.lat != null && dropoff?.lng != null) {
      finalDropLat = dropoff.lat;
      finalDropLng = dropoff.lng;
    }

    // Distance via PostGIS RPC over ride_locations
    let distanceKm = 0;
    try {
      const { data: dist } = await supabase.rpc("compute_ride_distance_km", { p_ride_id: ride_id }) as any;
      distanceKm = typeof dist === "number" ? dist : 0;
    } catch (_e) {
      distanceKm = 0;
    }

    // Duration minutes from started_at to now
    const startedAt = existing?.started_at ? new Date(existing.started_at) : null;
    const now = new Date();
    const minutes = startedAt ? Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 60000)) : 0;

    // Pricing (align with seeded columns)
    const { data: rules } = await supabase
      .from("pricing_rules")
      .select("base_fare_cents, per_km_cents, per_minute_cents")
      .eq("active", true)
      .limit(1);
    const pr =
      rules?.[0] ?? {
        base_fare_cents: 500,
        per_km_cents: 800,
        per_minute_cents: 200,
        surge_multiplier: 1,
        night_multiplier: 1,
        holiday_multiplier: 1,
      };
    const gross = Math.round(
      (pr.base_fare_cents + pr.per_km_cents * distanceKm + pr.per_minute_cents * minutes),
    );
    const finalPriceCents = Math.max(0, gross - 2000); // 固定抽成 $20

    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .update({
        status: "completed",
        finished_at: now.toISOString(),
        dropoff_lat: finalDropLat,
        dropoff_lng: finalDropLng,
        distance_km: distanceKm,
        duration_minutes: minutes,
        final_price_cents: finalPriceCents,
      })
      .eq("id", ride_id)
      .select("id, status, driver_id, final_price_cents, distance_km, duration_minutes")
      .single();
    if (rideErr) throw rideErr;

    // Set driver back online
    if (ride?.driver_id) {
      await supabase.from("drivers").update({ status: "online" }).eq("id", ride.driver_id);
    }

    return new Response(JSON.stringify({ ok: true, ride }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("finish_ride error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
