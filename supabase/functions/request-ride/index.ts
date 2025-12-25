// request-ride Edge Function（修正版）
// 建立乘客端叫車請求：以 requested 狀態建立 rides，並觸發 auto-dispatch
// 前端請提供：passengerPhone、pickup（文字）、dropoff（可選）、pickupLat、pickupLng（必填）

function toBase64Url(input: Uint8Array) {
  const b64 = btoa(String.fromCharCode(...input));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signJwtHS256(payload: Record<string, any>, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = toBase64Url(encoder.encode(JSON.stringify(header)));
  const p = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const data = `${h}.${p}`;
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const s = toBase64Url(new Uint8Array(sig));
  return `${data}.${s}`;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { passengerPhone, pickup, dropoff, pickupLat, pickupLng } = await req.json();
    if (!passengerPhone || !pickup || typeof pickupLat !== 'number' || typeof pickupLng !== 'number') {
      throw new Error('缺少必要參數：passengerPhone、pickup、pickupLat、pickupLng');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase 配置缺失');
    }

    // 1) 乘客查詢 / 建立
    const passengerResp = await fetch(`${supabaseUrl}/rest/v1/passengers?phone=eq.${passengerPhone}&select=*`, {
      headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey }
    });
    if (!passengerResp.ok) throw new Error(`查詢乘客失敗: ${await passengerResp.text()}`);
    const passArr = await passengerResp.json();
    let passenger = passArr[0];
    if (!passenger) {
      const createPass = await fetch(`${supabaseUrl}/rest/v1/passengers`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ phone: passengerPhone, name: `乘客${String(passengerPhone).slice(-4)}` })
      });
      if (!createPass.ok) throw new Error(`建立乘客失敗: ${await createPass.text()}`);
      passenger = (await createPass.json())[0];
    }

    // 2) 粗略估價（若有提供 dropoff 可估距離；此處簡化為常數/可接 calculate-price）
    const basePrice = 50; // 起步價
    const pricePerKm = 15; // 每公里價格
    const estimatedDistanceKm = dropoff ? 8 : 0; // TODO: 之後接 Google Distance Matrix
    const estimatedPrice = dropoff ? basePrice + (estimatedDistanceKm * pricePerKm) : null;

    // 3) 建立 rides（requested）
    const createRideResp = await fetch(`${supabaseUrl}/rest/v1/rides`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        passenger_id: passenger.id,
        passenger_phone: passengerPhone,
        pickup_location: pickup,
        dropoff_location: dropoff ?? null,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_lat: null,
        dropoff_lng: null,
        estimated_distance_meters: dropoff ? Math.round(estimatedDistanceKm * 1000) : null,
        estimated_duration_seconds: dropoff ? 15 * 60 : null,
        estimated_price: estimatedPrice,
        status: 'requested'
      })
    });
    if (!createRideResp.ok) {
      const err = await createRideResp.text();
      throw new Error(`建立行程失敗: ${err}`);
    }
    const createdRides = await createRideResp.json();
    const ride = createdRides[0];

    // 4) 觸發 auto-dispatch
    const jwtSecret = Deno.env.get('JWT_SECRET') || '';
    if (!jwtSecret) throw new Error('缺少 JWT_SECRET 以觸發自動派車');
    const now = Math.floor(Date.now() / 1000);
    const payload = { iss: 'black-feather-taxi', iat: now, exp: now + 300, sub: String(passenger?.id || passengerPhone), role: 'admin', name: passenger?.name || '乘客' };
    const token = await signJwtHS256(payload, jwtSecret);
    const dispatchResp = await fetch(`${supabaseUrl}/functions/v1/auto-dispatch`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rideId: ride.id, pickupLat, pickupLng })
    });
    const dispatchJson = await dispatchResp.json().catch(() => ({ success: false }));
    if (!dispatchResp.ok || !dispatchJson?.success) {
      console.warn('自動派車觸發失敗，請稍後重試:', await dispatchResp.text());
    }

    // 5) 回傳成功（不直接指派司機，由 auto-dispatch 決定）
    return new Response(JSON.stringify({ success: true, data: { ride, priceEstimate: estimatedPrice }, message: '叫車請求已建立，系統正在自動派車' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('叫車請求處理失敗:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'REQUEST_RIDE_FAILED', message: (error as any).message } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
