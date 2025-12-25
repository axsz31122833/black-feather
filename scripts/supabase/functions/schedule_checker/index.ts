// Supabase Edge Function: schedule_checker
// Checks upcoming scheduled rides and attempts assignment.
// Runtime: Deno

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://hmlyfcpicjpjxayilyhk.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

export default async function handler(_req: Request): Promise<Response> {
  try {
    if (!SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_SERVICE_ROLE_KEY secret" }), { status: 500 });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const now = new Date();
    const windowMinutes = 10; // look ahead 10 minutes
    const windowEnd = new Date(now.getTime() + windowMinutes * 60000).toISOString();
    const nowIso = now.toISOString();

    const { data: schedules, error: schErr } = await supabase
      .from("scheduled_rides")
      .select("id, passenger_id, pickup_lat, pickup_lng, status, scheduled_time")
      .gte("scheduled_time", nowIso)
      .lte("scheduled_time", windowEnd)
      .eq("status", "scheduled");
    if (schErr) throw schErr;

    const { data: drivers } = await supabase
      .from("drivers")
      .select("id, name, car_plate, current_lat, current_lng, status")
      .eq("status", "online");

    const actions: any[] = [];
    for (const s of schedules ?? []) {
      let nearest: any = null;
      let nearestDist = Number.POSITIVE_INFINITY;
      for (const d of drivers ?? []) {
        if (typeof d.current_lat === "number" && typeof d.current_lng === "number" && typeof s.pickup_lat === "number" && typeof s.pickup_lng === "number") {
          const dist = haversineKm(s.pickup_lat, s.pickup_lng, d.current_lat, d.current_lng);
          if (dist < nearestDist) { nearest = d; nearestDist = dist; }
        }
      }

      if (nearest) {
        // Create ride and mark schedule assigned
        const { data: ride } = await supabase
          .from("rides")
          .insert({
            passenger_id: s.passenger_id,
            driver_id: nearest.id,
            status: "assigned",
            pickup_lat: s.pickup_lat,
            pickup_lng: s.pickup_lng,
            assigned_at: new Date().toISOString(),
          })
          .select("*")
          .single();

        await supabase.from("drivers").update({ status: "busy" }).eq("id", nearest.id);
        // scheduled_rides schema uses 'processed' boolean; mark as processed
        await supabase.from("scheduled_rides").update({ processed: true }).eq("id", s.id);

        actions.push({ schedule_id: s.id, assigned_driver_id: nearest.id, driver_distance_km: Number(nearestDist.toFixed(2)), ride_id: ride?.id });
      } else {
        actions.push({ schedule_id: s.id, assigned_driver_id: null, reason: "no online drivers" });
      }
    }

    return new Response(JSON.stringify({ ok: true, actions }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("schedule_checker error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
