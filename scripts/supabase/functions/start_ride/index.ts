// Supabase Edge Function: start_ride
// Marks a ride as started and sets timestamps; driver remains busy.
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

    const { ride_id } = body as { ride_id: string };
    if (!ride_id) return new Response(JSON.stringify({ error: "Missing ride_id" }), { status: 400 });

    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", ride_id)
      .select("id, driver_id, passenger_id, status, started_at")
      .single();
    if (rideErr) throw rideErr;

    // Ensure driver is busy
    if (ride?.driver_id) {
      await supabase.from("drivers").update({ status: "busy" }).eq("id", ride.driver_id);
    }

    return new Response(JSON.stringify({ ok: true, ride }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("start_ride error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
