// Supabase Edge Function: verify-firebase
// 用途：在 Firebase OTP 完成後，標記指定 phone 的使用者為已驗證（is_verified=true）。
// 若使用者不存在，會建立一筆並設為已驗證。

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase 配置缺失');

    const body = await req.json().catch(() => ({}));
    const phone: string = (body.phone || '').trim();
    const role: string = (body.role || 'passenger').trim();
    const name: string = (body.name || '').trim();
    if (!phone) throw new Error('缺少必要參數：phone');

    // 查找使用者
    const findRes = await fetch(`${supabaseUrl}/rest/v1/auth_users?phone=eq.${encodeURIComponent(phone)}&select=*`, {
      headers: { 'Authorization': `Bearer ${serviceRoleKey}`, 'apikey': serviceRoleKey }
    });
    if (!findRes.ok) throw new Error(`查詢使用者失敗: ${await findRes.text()}`);
    const arr = await findRes.json();
    let user = arr[0];

    if (!user) {
      // 不存在則建立
      const createRes = await fetch(`${supabaseUrl}/rest/v1/auth_users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          phone,
          name: name || `user_${phone}`,
          role: ['admin', 'driver', 'passenger'].includes(role) ? role : 'passenger',
          is_verified: true,
          verification_code: null,
          verification_expires_at: null
        })
      });
      if (!createRes.ok) throw new Error(`建立使用者失敗: ${await createRes.text()}`);
      const created = await createRes.json();
      user = Array.isArray(created) ? created[0] : created;
    } else {
      // 已存在則標記為已驗證
      const patchRes = await fetch(`${supabaseUrl}/rest/v1/auth_users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ is_verified: true, verification_code: null, verification_expires_at: null })
      });
      if (!patchRes.ok) throw new Error(`更新驗證狀態失敗: ${await patchRes.text()}`);
      const updated = await patchRes.json();
      user = Array.isArray(updated) ? updated[0] : updated;
    }

    return new Response(JSON.stringify({ success: true, data: { phone, userId: user.id, verified: true } }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('verify-firebase error:', error);
    return new Response(JSON.stringify({ success: false, error: { message: error?.message || 'Unknown error' } }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});