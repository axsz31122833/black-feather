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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase 配置缺失');
    }

    // 获取所有司机信息
    const driversResponse = await fetch(`${supabaseUrl}/rest/v1/drivers?select=*&order=created_at.desc`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    });

    if (!driversResponse.ok) {
      throw new Error('查询司机信息失败');
    }

    const drivers = await driversResponse.json();

    // 计算统计数据
    const stats = {
      total: drivers.length,
      idle: drivers.filter(d => d.status === 'idle').length,
      busy: drivers.filter(d => d.status === 'busy').length,
      offline: drivers.filter(d => d.status === 'offline').length
    };

    // 获取进行中的订单数量
    // 以 requested 作為待派車訂單狀態（schema ENUM：requested/assigned/accepted/...）
    const ridesResponse = await fetch(`${supabaseUrl}/rest/v1/rides?status=eq.requested&select=count`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    });

    let pendingOrders = 0;
    if (ridesResponse.ok) {
      const countHeader = ridesResponse.headers.get('Content-Range');
      if (countHeader) {
        const match = countHeader.match(/\/(\d+)$/);
        if (match) {
          pendingOrders = parseInt(match[1]);
        }
      }
    }

    // 获取今日完成订单数
    const today = new Date().toISOString().split('T')[0];
    const todayRidesResponse = await fetch(`${supabaseUrl}/rest/v1/rides?status=eq.completed&completed_at=gte.${today}T00:00:00&select=count`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    });

    let todayCompletedOrders = 0;
    if (todayRidesResponse.ok) {
      const countHeader = todayRidesResponse.headers.get('Content-Range');
      if (countHeader) {
        const match = countHeader.match(/\/(\d+)$/);
        if (match) {
          todayCompletedOrders = parseInt(match[1]);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        drivers: drivers,
        stats: {
          ...stats,
          pendingOrders: pendingOrders,
          todayCompletedOrders: todayCompletedOrders
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('获取司机状态失败:', error);

    const errorResponse = {
      success: false,
      error: {
        code: 'GET_DRIVER_STATUS_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
