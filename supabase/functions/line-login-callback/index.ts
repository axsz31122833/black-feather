// Supabase Edge Function: line-login-callback
// 交換 LINE token、取得 profile、寫入資料庫、簽發 JWT

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

  // 工具：base64url 與 HS256 JWT 簽署
  const base64url = (input: ArrayBuffer | string) => {
    let bytes: Uint8Array;
    if (typeof input === 'string') {
      bytes = new TextEncoder().encode(input);
    } else {
      bytes = new Uint8Array(input);
    }
    let str = btoa(String.fromCharCode(...bytes));
    return str.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  async function signJwtHS256(payload: Record<string, unknown>, secret: string) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    const jwt = `${data}.${base64url(sig)}`;
    return jwt;
  }

  try {
    const { code, redirectUri, state } = await req.json();
    if (!code) throw new Error('缺少授權參數 code');
    // 若前端未提供 redirectUri，改用環境變數 LINE_REDIRECT_URI
    const envRedirect = Deno.env.get('LINE_REDIRECT_URI');
    const finalRedirectUri = redirectUri || envRedirect;
    if (!finalRedirectUri) throw new Error('缺少 redirectUri，請在 body 或 LINE_REDIRECT_URI 設定');

    const lineChannelId = Deno.env.get('LINE_CHANNEL_ID');
    const lineChannelSecret = Deno.env.get('LINE_CHANNEL_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const jwtSecret = Deno.env.get('JWT_SECRET');

    if (!lineChannelId || !lineChannelSecret) {
      throw new Error('缺少 LINE_CHANNEL_ID/LINE_CHANNEL_SECRET 環境變數');
    }
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('缺少 SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 環境變數');
    }
    if (!jwtSecret) {
      throw new Error('缺少 JWT_SECRET 環境變數');
    }

    // 1) 用 code 交換 access_token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: finalRedirectUri,
        client_id: lineChannelId,
        client_secret: lineChannelSecret
      }).toString()
    });

    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      throw new Error(`交換 token 失敗: ${t}`);
    }
    const token = await tokenRes.json();
    const accessToken = token.access_token;
    if (!accessToken) throw new Error('未取得 access_token');

    // 2) 取 LINE profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!profileRes.ok) {
      const p = await profileRes.text();
      throw new Error(`取得 LINE profile 失敗: ${p}`);
    }
    const profile = await profileRes.json();
    const lineId: string = profile.userId;
    const displayName: string = profile.displayName;
    const avatarUrl: string = profile.pictureUrl || null;

    if (!lineId) throw new Error('LINE 用戶 ID 缺失');

    // 3) upsert 到 auth_users
    // 先查既有使用者
    const existingRes = await fetch(`${supabaseUrl}/rest/v1/auth_users?line_id=eq.${lineId}&select=*`, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'Content-Type': 'application/json'
      }
    });
    if (!existingRes.ok) {
      const et = await existingRes.text();
      throw new Error(`查詢使用者失敗: ${et}`);
    }
    const existUsers = await existingRes.json();
    let user = existUsers[0] || null;

    if (!user) {
      // 新增
      const createRes = await fetch(`${supabaseUrl}/rest/v1/auth_users?on_conflict=line_id`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          line_id: lineId,
          display_name: displayName,
          avatar_url: avatarUrl,
          role: 'passenger',
          created_at: new Date().toISOString()
        })
      });
      if (!createRes.ok) {
        const ct = await createRes.text();
        throw new Error(`建立使用者失敗: ${ct}`);
      }
      const created = await createRes.json();
      user = created[0];
    } else {
      // 更新最新資料
      const updateRes = await fetch(`${supabaseUrl}/rest/v1/auth_users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({
          display_name: displayName,
          avatar_url: avatarUrl
        })
      });
      if (updateRes.ok) {
        const updated = await updateRes.json();
        user = updated[0] || user;
      }
    }

    // 4) upsert 到 passengers（以 line_id 作為查找鍵）
    let passenger = null;
    {
      // 查 passengers 是否已存在
      const passCheckRes = await fetch(`${supabaseUrl}/rest/v1/passengers?line_id=eq.${lineId}&select=*`, {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json'
        }
      });
      if (!passCheckRes.ok) {
        const pt = await passCheckRes.text();
        throw new Error(`查詢乘客失敗: ${pt}`);
      }
      const passData = await passCheckRes.json();
      passenger = passData[0] || null;

      const nowIso = new Date().toISOString();
      if (!passenger) {
        // 建立乘客記錄（若資料表有唯一鍵 line_id，則可使用 on_conflict=line_id）
        const passCreateRes = await fetch(`${supabaseUrl}/rest/v1/passengers?on_conflict=line_id`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({
            line_id: lineId,
            name: displayName,
            created_at: nowIso,
            updated_at: nowIso
          })
        });
        if (!passCreateRes.ok) {
          const pct = await passCreateRes.text();
          throw new Error(`建立乘客失敗: ${pct}`);
        }
        const createdPassenger = await passCreateRes.json();
        passenger = createdPassenger[0] || null;
      } else {
        // 更新乘客顯示名稱與更新時間
        const passUpdateRes = await fetch(`${supabaseUrl}/rest/v1/passengers?id=eq.${passenger.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({
            name: displayName,
            updated_at: nowIso
          })
        });
        if (passUpdateRes.ok) {
          const updatedPassenger = await passUpdateRes.json();
          passenger = updatedPassenger[0] || passenger;
        }
      }
    }

    // 5) 讀取 user_permissions（若不存在則可略過）
    let permissions = null;
    if (user?.id) {
      const permRes = await fetch(`${supabaseUrl}/rest/v1/user_permissions?user_id=eq.${user.id}&select=*`, {
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          'Content-Type': 'application/json'
        }
      });
      if (permRes.ok) {
        const permData = await permRes.json();
        permissions = permData[0] || null;
      }
    }

    // 6) 簽發 JWT（HS256）
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24 * 7; // 7 天有效
    const payload = {
      iss: 'black-feather-taxi',
      iat: now,
      exp,
      sub: String(user?.id || lineId),
      role: user?.role || 'passenger',
      line_id: lineId,
      display_name: displayName,
      avatar_url: avatarUrl
    };
    const jwt = await signJwtHS256(payload, jwtSecret);

    return new Response(JSON.stringify({
      success: true,
      data: {
        userId: user?.id,
        role: user?.role || 'passenger',
        lineId,
        displayName,
        avatarUrl,
        permissions,
        passengerId: passenger?.id || null,
        token: jwt
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('line-login-callback 錯誤:', error);
    return new Response(JSON.stringify({ success: false, error: { message: (error as any).message } }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});