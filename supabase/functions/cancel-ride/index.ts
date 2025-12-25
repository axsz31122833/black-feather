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
    const { rideId, userPhone, reason } = await req.json();
    
    if (!rideId || !userPhone) {
      throw new Error('訂單ID和用戶手機號碼為必填項目');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase 配置缺失');
    }

    // 查找訂單
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

    // 檢查訂單狀態
    if (ride.status === 'cancelled') {
      throw new Error('訂單已被取消');
    }

    if (ride.status === 'completed') {
      throw new Error('訂單已完成，無法取消');
    }

    // 檢查是否為相關用戶
    if (ride.passenger_phone !== userPhone && ride.driver_phone !== userPhone) {
      throw new Error('您無權取消此訂單');
    }

    // 計算取消費用 - 如果司機已到達則收取100元
    let cancellationFee = 0;
    if (ride.status === 'ongoing' && ride.passenger_phone === userPhone) {
      cancellationFee = 100; // 司機到達後乘客取消收取100元
    }

    // 更新訂單狀態
    const updateRideResponse = await fetch(`${supabaseUrl}/rest/v1/rides?id=eq.${rideId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: reason || '用戶取消',
        cancellation_fee: cancellationFee,
        updated_at: new Date().toISOString()
      })
    });

    if (!updateRideResponse.ok) {
      const errorText = await updateRideResponse.text();
      throw new Error(`更新訂單狀態失敗: ${errorText}`);
    }

    const updatedRides = await updateRideResponse.json();
    const updatedRide = updatedRides[0];

    // 如果有司機，恢復司機狀態為空閒
    if (ride.driver_id) {
      const updateDriverResponse = await fetch(`${supabaseUrl}/rest/v1/drivers?id=eq.${ride.driver_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'idle',
          updated_at: new Date().toISOString()
        })
      });

      if (!updateDriverResponse.ok) {
        console.error('恢復司機狀態失敗');
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        ride: updatedRide,
        cancellationFee: cancellationFee
      },
      message: cancellationFee > 0 ? `訂單已取消，取消費用：${cancellationFee}元` : '訂單已取消'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('取消訂單失敗:', error);

    const errorResponse = {
      success: false,
      error: {
        code: 'CANCEL_RIDE_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});