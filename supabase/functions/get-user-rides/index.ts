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
    const { userPhone, userType = 'passenger' } = await req.json();
    
    if (!userPhone) {
      throw new Error('缺少必要参数：userPhone');
    }

    if (!['passenger', 'driver'].includes(userType)) {
      throw new Error('无效的用户类型，必须是 passenger 或 driver');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase 配置缺失');
    }

    // 根据用户类型查询订单
    const phoneField = userType === 'passenger' ? 'passenger_phone' : 'driver_phone';
    
    const ridesResponse = await fetch(`${supabaseUrl}/rest/v1/rides?${phoneField}=eq.${userPhone}&select=*&order=created_at.desc`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    });

    if (!ridesResponse.ok) {
      throw new Error('查询订单信息失败');
    }

    const rides = await ridesResponse.json();

    // 计算统计数据
    const stats = {
      total: rides.length,
      requested: rides.filter(r => r.status === 'requested').length,
      assigned: rides.filter(r => r.status === 'assigned').length,
      accepted: rides.filter(r => r.status === 'accepted').length,
      enroute: rides.filter(r => r.status === 'enroute').length,
      arrived: rides.filter(r => r.status === 'arrived').length,
      completed: rides.filter(r => r.status === 'completed').length,
      cancelled: rides.filter(r => r.status === 'cancelled').length,
      totalEarnings: rides
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (r.actual_price || r.estimated_price || 0), 0)
    };

    // 获取今日订单
    const today = new Date().toISOString().split('T')[0];
    const todayRides = rides.filter(r => r.created_at.startsWith(today));

    return new Response(JSON.stringify({
      success: true,
      data: {
        rides: rides,
        stats: stats,
        todayStats: {
          total: todayRides.length,
          completed: todayRides.filter(r => r.status === 'completed').length,
          earnings: todayRides
            .filter(r => r.status === 'completed')
            .reduce((sum, r) => sum + (r.actual_price || r.estimated_price || 0), 0)
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('获取用户订单失败:', error);

    const errorResponse = {
      success: false,
      error: {
        code: 'GET_USER_RIDES_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
