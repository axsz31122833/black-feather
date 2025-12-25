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
    const { rideId, senderPhone, senderRole, message, messageType = 'text' } = await req.json();
    
    if (!rideId || !senderPhone || !senderRole || !message) {
      throw new Error('訂單ID、發送者手機、角色和訊息內容為必填項目');
    }

    if (!['driver', 'passenger', 'admin'].includes(senderRole)) {
      throw new Error('無效的發送者角色');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase 配置缺失');
    }

    // 驗證訂單存在
    const rideResponse = await fetch(`${supabaseUrl}/rest/v1/rides?id=eq.${rideId}&select=*`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    });

    if (!rideResponse.ok) {
      throw new Error('查詢訂單失敗');
    }

    const rides = await rideResponse.json();
    if (rides.length === 0) {
      throw new Error('訂單不存在');
    }

    const ride = rides[0];

    // 檢查發送者是否與訂單相關
    if (senderRole !== 'admin' && ride.passenger_phone !== senderPhone && ride.driver_phone !== senderPhone) {
      throw new Error('您無權向此訂單發送訊息');
    }

    // 保存訊息
    const createMessageResponse = await fetch(`${supabaseUrl}/rest/v1/ride_messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        ride_id: rideId,
        sender_phone: senderPhone,
        sender_role: senderRole,
        message: message,
        message_type: messageType
      })
    });

    if (!createMessageResponse.ok) {
      const errorText = await createMessageResponse.text();
      throw new Error(`保存訊息失敗: ${errorText}`);
    }

    const newMessages = await createMessageResponse.json();
    const newMessage = newMessages[0];

    return new Response(JSON.stringify({
      success: true,
      data: {
        message: newMessage
      },
      message: '訊息發送成功'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('發送訊息失敗:', error);

    const errorResponse = {
      success: false,
      error: {
        code: 'SEND_MESSAGE_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});