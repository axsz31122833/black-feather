// Supabase Edge Function: request_ride
// Inserts a new ride with status 'waiting_assignment' and stores pickup/dropoff coords; returns ride_id.
// Runtime: Deno

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Coordinates = { lat: number; lng: number };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://hmlyfcpicjpjxayilyhk.supabase.co";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

    const { passenger_id, origin, destination } = body as {
      passenger_id: string;
      origin: Coordinates;
      destination?: Coordinates;
    };

    if (!passenger_id || !origin?.lat || !origin?.lng) {
      return new Response(JSON.stringify({ error: "Missing passenger_id or origin {lat,lng}" }), { status: 400 });
    }

    // Create ride in waiting_assignment state
    const payload: any = {
      passenger_id,
      status: "waiting_assignment",
      pickup_lat: origin.lat,
      pickup_lng: origin.lng,
      dropoff_lat: destination?.lat ?? null,
      dropoff_lng: destination?.lng ?? null,
      created_at: new Date().toISOString(),
    };
    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .insert(payload)
      .select("id")
      .single();
    if (rideErr) throw rideErr;

    return new Response(JSON.stringify({ ride_id: ride?.id }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("request_ride error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}