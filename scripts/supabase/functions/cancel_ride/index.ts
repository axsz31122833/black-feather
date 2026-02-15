// Supabase Edge Function: cancel_ride
// Cancels a ride, marks timestamps, and optionally applies penalties (not enforced here).
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

    const { ride_id, reason } = body as { ride_id: string; reason?: string };
    if (!ride_id) return new Response(JSON.stringify({ error: "Missing ride_id" }), { status: 400 });

    // Fetch current ride status before update
    const { data: beforeRide, error: beforeErr } = await supabase
      .from("rides")
      .select("id, driver_id, passenger_id, status")
      .eq("id", ride_id)
      .single();
    if (beforeErr) throw beforeErr;

    const prevStatus = beforeRide?.status as string | null;

    const { data: ride, error: rideErr } = await supabase
      .from("rides")
      .update({ status: "canceled", canceled_at: new Date().toISOString() })
      .eq("id", ride_id)
      .select("id, driver_id, passenger_id, status, canceled_at")
      .single();
    if (rideErr) throw rideErr;

    // Free driver if was assigned
    if (ride?.driver_id) {
      await supabase.from("drivers").update({ status: "online" }).eq("id", ride.driver_id);
    }

    // Apply penalty when driver had accepted
    if (prevStatus === "accepted") {
      await supabase.from("penalties").insert({
        ride_id: ride_id,
        passenger_id: ride?.passenger_id ?? beforeRide?.passenger_id ?? null,
        driver_id: ride?.driver_id ?? beforeRide?.driver_id ?? null,
        type: "passenger_cancel_after_accept",
        amount_cents: 10000,
        reason: reason || "passenger_cancel_after_accept",
        applied: true,
      });
    } else if (reason) {
      // Optional recording for other cancel reasons without fee
      await supabase.from("penalties").insert({
        ride_id: ride_id,
        passenger_id: ride?.passenger_id ?? beforeRide?.passenger_id ?? null,
        driver_id: ride?.driver_id ?? beforeRide?.driver_id ?? null,
        type: "cancel",
        amount_cents: 0,
        reason,
        applied: false,
      });
    }

    return new Response(JSON.stringify({ ok: true, ride }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cancel_ride error", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
