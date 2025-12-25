// Supabase Edge Function: auto-dispatch
// 使用 --no-verify-jwt 部署以便前端無需 JWT 測試呼叫
// 需求：請於 Supabase 專案 Secrets 設定 SUPABASE_SERVICE_ROLE_KEY（用於資料庫讀寫）

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.46.1";

type Driver = {
  id: number;
  name?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  plate?: string | null;
  is_online?: boolean | null;
};

type Rider = {
  id: number;
  name?: string | null;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(s1 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * s2));
  return R * c;
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405 });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return new Response(JSON.stringify({ error: "Expected application/json" }), { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const riderPhone = String(body?.riderPhone || "").trim();
    if (!riderPhone) {
      return new Response(JSON.stringify({ error: "Missing riderPhone" }), { status: 400 });
    }

    const url = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? Deno.env.get("URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    if (!url || !serviceRole) {
      return new Response(
        JSON.stringify({
          error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
          hint:
            "請於 Supabase 專案 Secrets 設定 SUPABASE_SERVICE_ROLE_KEY，或提供此值給部署環境。",
        }),
        { status: 500 }
      );
    }

    const supabase = createClient(url, serviceRole);

    // 1) 找乘客
    const { data: rider, error: riderErr } = await supabase
      .from("riders")
      .select("id,name,phone,lat,lng")
      .eq("phone", riderPhone)
      .maybeSingle();

    if (riderErr) throw riderErr;
    if (!rider || rider.lat == null || rider.lng == null) {
      return new Response(JSON.stringify({ error: "Rider not found or has no location" }), { status: 404 });
    }

    // 2) 找 Online 司機
    const { data: drivers, error: driversErr } = await supabase
      .from("drivers")
      .select("id,name,phone,lat,lng,plate,is_online")
      .eq("is_online", true);

    if (driversErr) throw driversErr;
    if (!drivers || !drivers.length) {
      return new Response(JSON.stringify({ error: "No available drivers" }), { status: 409 });
    }

    // 3) 挑最近司機
    let best: Driver | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const d of drivers) {
      if (d.lat != null && d.lng != null) {
        const dist = haversineKm({ lat: rider.lat!, lng: rider.lng! }, { lat: d.lat!, lng: d.lng! });
        if (dist < bestDist) {
          best = d;
          bestDist = dist;
        }
      }
    }

    if (!best) {
      return new Response(JSON.stringify({ error: "No driver with valid location" }), { status: 409 });
    }

    // 4) 建立 rides 並標記為 assigned
    const { data: inserted, error: insertErr } = await supabase
      .from("rides")
      .insert({
        rider_id: rider.id,
        driver_id: best.id,
        status: "assigned",
        start_lat: rider.lat,
        start_lng: rider.lng,
      })
      .select("id,created_at");

    if (insertErr) throw insertErr;

    // 回傳司機資訊與距離（取兩位小數）
    const response = {
      driver: {
        id: best.id,
        name: best.name ?? null,
        phone: best.phone ?? null,
        plate: best.plate ?? null,
        lat: best.lat ?? null,
        lng: best.lng ?? null,
        distance_km: Number.isFinite(bestDist) ? Number(bestDist.toFixed(2)) : null,
      },
      ride: inserted?.[0] ?? null,
      rider: { id: rider.id, name: rider.name ?? null, phone: rider.phone ?? null },
    };

    return new Response(JSON.stringify(response), {
      headers: { "content-type": "application/json; charset=utf-8" },
      status: 200,
    });
  } catch (err) {
    const message = (err?.message || String(err)) as string;
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
