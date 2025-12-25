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
    const { phone, verificationCode } = await req.json();
    
    if (!phone || !verificationCode) {
      throw new Error('手機號碼和驗證碼為必填項目');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase 配置缺失');
    }

    // 查找用戶並檢查驗證碼
    const userResponse = await fetch(`${supabaseUrl}/rest/v1/auth_users?phone=eq.${phone}&select=*`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    });

    if (!userResponse.ok) {
      throw new Error('查找用戶失敗');
    }

    const users = await userResponse.json();
    if (users.length === 0) {
      throw new Error('用戶不存在，請先註冊');
    }

    const user = users[0];

    // 檢查是否已驗證
    if (user.is_verified) {
      throw new Error('該用戶已完成驗證');
    }

    // 檢查驗證碼是否正確
    if (user.verification_code !== verificationCode) {
      throw new Error('驗證碼錯誤');
    }

    // 檢查驗證碼是否過期
    const now = new Date();
    const expiry = new Date(user.verification_expires_at);
    if (now > expiry) {
      throw new Error('驗證碼已過期，請重新註冊');
    }

    // 更新用戶驗證狀態
    const updateUserResponse = await fetch(`${supabaseUrl}/rest/v1/auth_users?id=eq.${user.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        is_verified: true,
        verification_code: null,
        verification_expires_at: null,
        updated_at: new Date().toISOString()
      })
    });

    if (!updateUserResponse.ok) {
      const errorText = await updateUserResponse.text();
      throw new Error(`更新驗證狀態失敗: ${errorText}`);
    }

    const updatedUsers = await updateUserResponse.json();
    const updatedUser = updatedUsers[0];

    return new Response(JSON.stringify({
      success: true,
      data: {
        userId: updatedUser.id,
        phone: updatedUser.phone,
        name: updatedUser.name,
        role: updatedUser.role,
        isVerified: true
      },
      message: '手機驗證成功，註冊完成！'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('手機驗證失敗:', error);

    const errorResponse = {
      success: false,
      error: {
        code: 'PHONE_VERIFICATION_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});