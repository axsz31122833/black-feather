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
    const { rideId, driverPhone } = await req.json();
    
    if (!rideId || !driverPhone) {
      throw new Error('缺少必要参数：rideId, driverPhone');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase 配置缺失');
    }

    // 1. 验证订单存在且状态正确
    const rideResponse = await fetch(`${supabaseUrl}/rest/v1/rides?id=eq.${rideId}&driver_phone=eq.${driverPhone}&select=*`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    });

    if (!rideResponse.ok) {
      throw new Error('查询订单信息失败');
    }

    const rides = await rideResponse.json();
    
    if (rides.length === 0) {
      throw new Error('订单不存在或您无权完成此订单');
    }

    const ride = rides[0];

    if (ride.status === 'completed') {
      throw new Error('订单已经完成');
    }

    if (ride.status === 'cancelled') {
      throw new Error('订单已被取消');
    }

    // 2. 更新订单状态为已完成
    const updateRideResponse = await fetch(`${supabaseUrl}/rest/v1/rides?id=eq.${rideId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        status: 'completed',
        actual_price: ride.estimated_price, // 实际价格等于预估价格
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    });

    if (!updateRideResponse.ok) {
      const errorText = await updateRideResponse.text();
      throw new Error(`更新订单状态失败: ${errorText}`);
    }

    const updatedRides = await updateRideResponse.json();
    const updatedRide = updatedRides[0];

    // 3. 更新司机状态为空闲
    const updateDriverResponse = await fetch(`${supabaseUrl}/rest/v1/drivers?id=eq.${ride.driver_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'idle',
        total_trips: 'total_trips + 1',
        total_earnings: `total_earnings + ${ride.estimated_price}`,
        updated_at: new Date().toISOString()
      })
    });

    if (!updateDriverResponse.ok) {
      console.error('更新司机状态失败，但订单已完成');
    }

    // 4. 更新乘客行程数
    const updatePassengerResponse = await fetch(`${supabaseUrl}/rest/v1/passengers?id=eq.${ride.passenger_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        total_trips: 'total_trips + 1',
        updated_at: new Date().toISOString()
      })
    });

    if (!updatePassengerResponse.ok) {
      console.error('更新乘客信息失败，但订单已完成');
    }

    // 5. 返回成功响应
    return new Response(JSON.stringify({
      success: true,
      data: {
        ride: updatedRide
      },
      message: '订单已成功完成'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('完成订单处理失败:', error);

    const errorResponse = {
      success: false,
      error: {
        code: 'COMPLETE_RIDE_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
