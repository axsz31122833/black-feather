import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const { trip_id, lock_sec = 15, admin_sec = 90 } = await req.json()
    const headers = { "Content-Type": "application/json" }
    if (!trip_id) return new Response(JSON.stringify({ error: "missing_trip_id" }), { headers, status: 400 })
    const now = Date.now()
    const lock_until = new Date(now + lock_sec * 1000).toISOString()
    const admin_until = new Date(now + admin_sec * 1000).toISOString()
    const url = Deno.env.get("SUPABASE_URL")!
    const key = Deno.env.get("SUPABASE_ANON_KEY")!
    const resp = await fetch(`${url}/rest/v1/ops_events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ event_type: "priority_lock", ref_id: trip_id, payload: { lock_until, admin_until } })
    })
    const ok = resp.ok
    return new Response(JSON.stringify({ ok, lock_until, admin_until }), { headers, status: ok ? 200 : 500 })
  } catch {
    return new Response(JSON.stringify({ error: "server_error" }), { headers: { "Content-Type": "application/json" }, status: 500 })
  }
})
