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
    const { phone, name, role, nickname, carPlate, remarks } = await req.json();
    
    if (!phone || !name || !role) {
      throw new Error('手機號碼、姓名和角色為必填項目');
    }

    if (!['admin', 'driver', 'passenger'].includes(role)) {
      throw new Error('無效的用戶角色');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase 配置缺失');
    }

    // 檢查手機號碼是否已存在
    const checkExistingResponse = await fetch(`${supabaseUrl}/rest/v1/auth_users?phone=eq.${phone}&select=*`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    });

    if (!checkExistingResponse.ok) {
      throw new Error('檢查用戶狀態失敗');
    }

    const existingUsers = await checkExistingResponse.json();
    if (existingUsers.length > 0) {
      throw new Error('該手機號碼已被註冊');
    }

    // 生成6位數驗證碼
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10分鐘後過期

    // 建立用戶記錄
    const createUserResponse = await fetch(`${supabaseUrl}/rest/v1/auth_users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        phone,
        name,
        role,
        verification_code: verificationCode,
        verification_expires_at: verificationExpires.toISOString(),
        is_verified: false
      })
    });

    if (!createUserResponse.ok) {
      const errorText = await createUserResponse.text();
      throw new Error(`建立用戶失敗: ${errorText}`);
    }

    const newUsers = await createUserResponse.json();
    const newUser = newUsers[0];

    // 模擬發送簡訊驗證碼（實際環境應串接簡訊服務）
    console.log(`模擬發送簡訊驗證碼到 ${phone}: ${verificationCode}`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        userId: newUser.id,
        phone: newUser.phone,
        name: newUser.name,
        role: newUser.role,
        verificationRequired: true
      },
      message: '註冊成功，請輸入簡訊驗證碼完成驗證'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('用戶註冊失敗:', error);

    const errorResponse = {
      success: false,
      error: {
        code: 'USER_REGISTER_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});