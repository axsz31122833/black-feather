// 強化版 user-login：免驗證註冊/登入，補齊權限並簽發 JWT（HS256）

function toBase64Url(input: Uint8Array | string): string {
  let b64: string;
  if (typeof input === 'string') {
    b64 = btoa(input);
  } else {
    const binary = Array.from(input).map((b) => String.fromCharCode(b)).join('');
    b64 = btoa(binary);
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signJwtHS256(payload: Record<string, any>, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = new TextEncoder();
  const headerB64 = toBase64Url(enc.encode(JSON.stringify(header)));
  const payloadB64 = toBase64Url(enc.encode(JSON.stringify(payload)));
  const data = `${headerB64}.${payloadB64}`;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sigB64 = toBase64Url(new Uint8Array(sig));
  return `${data}.${sigB64}`;
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
    const body = await req.json().catch(() => ({}));
    const phone = (body?.phone || '').trim();
    const role = (body?.role || 'passenger').trim(); // 可選：passenger/driver/admin
    const name = (body?.name || '').trim();
    if (!phone) {
      throw new Error('手機號碼為必填項目');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const jwtSecret = Deno.env.get('JWT_SECRET') || Deno.env.get('EDGE_JWT_SECRET') || '';
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase 配置缺失');
    if (!jwtSecret) throw new Error('JWT_SECRET 未設定');

    // 查找用戶（若不存在則建立），並將 is_verified 設為 true
    const userResp = await fetch(`${supabaseUrl}/rest/v1/auth_users?phone=eq.${phone}&select=*`, {
      headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey }
    });
    if (!userResp.ok) throw new Error(`查找用戶失敗: ${await userResp.text()}`);
    const users = await userResp.json();
    let user = users[0] || null;
    const now = new Date().toISOString();

    if (!user) {
      const createResp = await fetch(`${supabaseUrl}/rest/v1/auth_users`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ phone, name: name || '使用者', role, is_verified: true, created_at: now })
      });
      if (!createResp.ok) throw new Error(`建立用戶失敗: ${await createResp.text()}`);
      user = (await createResp.json())[0];
    } else {
      const patchPayload: Record<string, any> = { is_verified: true };
      if (role && user.role !== role) patchPayload.role = role;
      if (name && user.name !== name) patchPayload.name = name;
      const patchResp = await fetch(`${supabaseUrl}/rest/v1/auth_users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(patchPayload)
      });
      if (!patchResp.ok) throw new Error(`更新用戶失敗: ${await patchResp.text()}`);
      user = (await patchResp.json())[0];
    }

    // 權限表：若不存在則建立；若角色變更則同步權限旗標
    const permResp = await fetch(`${supabaseUrl}/rest/v1/user_permissions?user_id=eq.${user.id}&select=*`, {
      headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey }
    });
    if (!permResp.ok) throw new Error(`查詢權限失敗: ${await permResp.text()}`);
    const perms = await permResp.json();
    let permission = perms[0] || null;
    const flags = {
      role: user.role,
      can_access_admin: user.role === 'admin',
      can_access_driver: user.role === 'driver' || user.role === 'admin',
      can_access_passenger: true
    };

    if (!permission) {
      const createPermResp = await fetch(`${supabaseUrl}/rest/v1/user_permissions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ user_id: user.id, ...flags })
      });
      if (!createPermResp.ok) throw new Error(`建立權限失敗: ${await createPermResp.text()}`);
      permission = (await createPermResp.json())[0];
    } else {
      const needPatch = (
        permission.role !== flags.role ||
        permission.can_access_admin !== flags.can_access_admin ||
        permission.can_access_driver !== flags.can_access_driver ||
        permission.can_access_passenger !== flags.can_access_passenger
      );
      if (needPatch) {
        const patchPermResp = await fetch(`${supabaseUrl}/rest/v1/user_permissions?id=eq.${permission.id}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: JSON.stringify(flags)
        });
        if (!patchPermResp.ok) throw new Error(`更新權限失敗: ${await patchPermResp.text()}`);
        permission = (await patchPermResp.json())[0];
      }
    }

    // 簽發 JWT
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 24 * 7; // 7 天有效
    const payload = { sub: String(user.id), role: user.role, name: user.name || user.display_name || '使用者', iat, exp };
    const token = await signJwtHS256(payload, jwtSecret);

    return new Response(JSON.stringify({
      success: true,
      data: {
        userId: user.id,
        phone: user.phone,
        name: user.name || user.display_name || '使用者',
        role: user.role,
        isVerified: user.is_verified,
        permissions: permission,
        token
      },
      message: '登入成功'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('用戶登入失敗:', error);
    return new Response(JSON.stringify({ success: false, error: { code: 'USER_LOGIN_FAILED', message: (error as any)?.message || '未知錯誤' } }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});