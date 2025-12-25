// Supabase Edge Function: assign_driver
// Assigns the nearest online (not occupied) driver to an existing ride using PostGIS distance.
// Runtime: Deno

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type NearestDriver = { driver_id: string; name?: string; car_plate?: string; distance_km: number };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://hmlyfcpicjpjxayilyhk.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

export default async function handler(req: Request): Promise<Response> {
  try {
    if (!SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_SERVICE_ROLE_KEY secret" }), { status: 500 });
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 });
    }

    const { ride_id } = body as { ride_id: string };
    if (!ride_id) {
      return new Response(JSON.stringify({ error: "Missing ride_id" }), { status: 400 });
    }

    // Get pickup coordinates from ride
    const { data: ride, error: rideErr1 } = await supabase
      .from("rides")
      .select("id, passenger_id, pickup_lat, pickup_lng, status")
      .eq("id", ride_id)
      .single();
    if (rideErr1) throw rideErr1;
    if (!ride?.pickup_lat || !ride?.pickup_lng) {
      return new Response(JSON.stringify({ error: "Ride has no pickup coordinates" }), { status: 400 });
    }

    // Ask Postgres (RPC) for nearest online driver by geography distance
    const { data: nearest, error: rpcErr } = await supabase.rpc("find_nearest_online_driver", {
      p_pickup_lat: ride.pickup_lat,
      p_pickup_lng: ride.pickup_lng,
    }) as unknown as { data: NearestDriver | null; error: any };
    if (rpcErr) throw rpcErr;

    if (!nearest) {
      return new Response(JSON.stringify({ error: "no_driver_available" }), { status: 200 });
    }

    // Assign and update statuses
    const { data: updatedRide, error: updErr } = await supabase
      .from("rides")
      .update({
        status: "assigned",
        driver_id: nearest.driver_id,
        assigned_at: new Date().toISOString(),
        assignment_attempts: (ride.assignment_attempts ?? 0) + 1,
        last_assignment_at: new Date().toISOString(),
      })
      .eq("id", ride_id)
      .select("id, status, driver_id")
      .single();
    if (updErr) throw updErr;

    await supabase.from("drivers").update({ status: "busy" }).eq("id", nearest.driver_id);

    // audit log
    await supabase.from("ops_events").insert({
      event_type: "assign_driver",
      ref_id: ride_id,
      message: "Assigned nearest driver",
      payload: { assigned_driver: nearest }
    });

    return new Response(
      JSON.stringify({ assigned_driver: nearest, ride: updatedRide, function: "assign_driver" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("assign_driver error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
