import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  try {
    const { trip_id } = await req.json()
    const headers = { "Content-Type": "application/json" }
    if (!trip_id) return new Response(JSON.stringify({ error: "missing_trip_id" }), { headers, status: 400 })
    const url = Deno.env.get("SUPABASE_URL")!
    const key = Deno.env.get("SUPABASE_ANON_KEY")!
    const resp = await fetch(`${url}/rest/v1/ops_events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ event_type: "prebook_offer", ref_id: trip_id, payload: { expires_in_sec: 10 } })
    })
    const ok = resp.ok
    return new Response(JSON.stringify({ ok }), { headers, status: ok ? 200 : 500 })
  } catch {
    return new Response(JSON.stringify({ error: "server_error" }), { headers: { "Content-Type": "application/json" }, status: 500 })
  }
})
