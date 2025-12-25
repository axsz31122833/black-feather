// auto-dispatch Edge Function
// 輸入乘客座標與 ride_id，查找候選司機，指派最佳，推送通知，逾時則換下一位

type JwtPayload = { sub: string; role: string; name?: string; iat: number; exp: number };

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false'
};

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = base64 + (pad ? '='.repeat(4 - pad) : '');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyJwtHS256(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const data = `${h}.${p}`;
  const signature = base64urlToUint8Array(s);
  const ok = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(data));
  if (!ok) return null;
  const json = JSON.parse(new TextDecoder().decode(base64urlToUint8Array(p)));
  const now = Math.floor(Date.now() / 1000);
  if (json.exp && now > json.exp) return null;
  return json as JwtPayload;
}

async function notifyDriversRealtime(supabaseUrl: string, serviceRoleKey: string, rideId: string, candidateIds: string[]) {
  // 使用 Realtime 發事件（可改為通知表/或 LINE Bot）
  try {
    await fetch(`${supabaseUrl}/rest/v1/rides_events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ride_id: rideId, event_type: 'dispatch_candidates', payload: { candidate_driver_ids: candidateIds } })
    });
  } catch (e) {
    console.warn('通知候選司機事件失敗（可忽略或改用 LINE）:', e);
  }
}

async function pickAndAssign(supabaseUrl: string, serviceRoleKey: string, ride: any, pickupLat: number, pickupLng: number) {
  const rpcResp = await fetch(`${supabaseUrl}/rest/v1/rpc/find_candidate_drivers`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_pickup_lat: pickupLat, p_pickup_lng: pickupLng, p_max_distance_km: 20, p_limit: 5 })
  });
  if (!rpcResp.ok) throw new Error(`查詢候選司機失敗: ${await rpcResp.text()}`);
  const candidates = await rpcResp.json();
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { updatedRide: ride, assignedDriver: null, candidates };
  }
  const best = candidates[0];

  // 更新行程為 assigned
  const assignedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 45 * 1000).toISOString();
  const patchRideResp = await fetch(`${supabaseUrl}/rest/v1/rides?id=eq.${ride.id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'apikey': serviceRoleKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      driver_id: best.driver_id,
      status: 'assigned'
    })
  });
  if (!patchRideResp.ok) throw new Error(`更新行程失敗: ${await patchRideResp.text()}`);
  const updatedRide = (await patchRideResp.json())[0];

  // 更新司機為 busy
  await fetch(`${supabaseUrl}/rest/v1/drivers?id=eq.${best.driver_id}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'busy' })
  });

  // 通知候選司機集合
  await notifyDriversRealtime(supabaseUrl, serviceRoleKey, ride.id, candidates.map((c: any) => c.driver_id));

  return { updatedRide, assignedDriver: best };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const jwtSecret = Deno.env.get('JWT_SECRET') || '';
    if (!token || !jwtSecret) {
      return new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: '缺少或不合法的 bf_auth_token' } }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const payload = await verifyJwtHS256(token, jwtSecret);
    if (!payload) {
      return new Response(JSON.stringify({ success: false, error: { code: 'TOKEN_INVALID', message: 'Token 驗證失敗' } }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (payload.role !== 'admin' && payload.role !== 'passenger') {
      return new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: '僅管理員或乘客可觸發派車' } }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase 配置缺失');

    const body = await req.json();
    const { rideId, pickupLat, pickupLng } = body;
    if (!rideId) throw new Error('缺少 rideId');

    // 若未提供座標，從 rides 讀取
    let lat = pickupLat;
    let lng = pickupLng;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      const rideResp = await fetch(`${supabaseUrl}/rest/v1/rides?id=eq.${rideId}&select=*`, {
        headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey }
      });
      if (!rideResp.ok) throw new Error(`查詢行程失敗: ${await rideResp.text()}`);
      const rides = await rideResp.json();
      const ride = rides[0];
      if (!ride) throw new Error('行程不存在');
      lat = Number(ride.pickup_lat);
      lng = Number(ride.pickup_lng);
      if (!lat || !lng) throw new Error('缺少上車座標');
      // 狀態處理：requested 直接派車；assigned 檢查逾時改派
      if (ride.status === 'requested') {
        const result = await pickAndAssign(supabaseUrl, serviceRoleKey, ride, lat, lng);
        return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else if (ride.status === 'assigned') {
        // 若已 assigned，先直接回傳現況（此 schema 未包含逾時欄位，逾時改派交由前端或其他函式驅動）
        return new Response(JSON.stringify({ success: true, data: { updatedRide: ride, assignedDriver: { id: ride.driver_id } }, meta: { state: 'assigned' } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: false, error: { code: 'RIDE_NOT_REQUESTABLE', message: `行程狀態不可派車：${ride.status}` } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else {
      // 已提供座標，讀取 ride 並派車
      const rideResp = await fetch(`${supabaseUrl}/rest/v1/rides?id=eq.${rideId}&select=*`, {
        headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey }
      });
      if (!rideResp.ok) throw new Error(`查詢行程失敗: ${await rideResp.text()}`);
      const rides = await rideResp.json();
      const ride = rides[0];
      if (!ride) throw new Error('行程不存在');
      if (ride.status === 'requested') {
        const result = await pickAndAssign(supabaseUrl, serviceRoleKey, ride, lat, lng);
        return new Response(JSON.stringify({ success: true, data: result }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } else if (ride.status === 'assigned') {
        return new Response(JSON.stringify({ success: true, data: { updatedRide: ride, assignedDriver: { id: ride.driver_id } }, meta: { state: 'assigned' } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: false, error: { code: 'RIDE_NOT_REQUESTABLE', message: `行程狀態不可派車：${ride.status}` } }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('auto-dispatch 失敗:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'AUTO_DISPATCH_FAILED', message: (error as any).message } }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});