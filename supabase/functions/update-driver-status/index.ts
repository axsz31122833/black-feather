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
    const { driverPhone, status, latitude, longitude } = await req.json();
    
    if (!driverPhone || !status) {
      throw new Error('缺少必要参数：driverPhone, status');
    }

    if (!['idle', 'busy', 'offline'].includes(status)) {
      throw new Error('无效的状态值，必须是 idle, busy 或 offline');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase 配置缺失');
    }

    // 验证司机存在
    const driverResponse = await fetch(`${supabaseUrl}/rest/v1/drivers?phone=eq.${driverPhone}&select=*`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json'
      }
    });

    if (!driverResponse.ok) {
      throw new Error('查询司机信息失败');
    }

    const drivers = await driverResponse.json();
    
    if (drivers.length === 0) {
      throw new Error('司机不存在');
    }

    const driver = drivers[0];

    // 检查是否有进行中的订单（只有在设置为离线时才检查）
    if (status === 'offline') {
      // 以進行中狀態集合判定：assigned/accepted/enroute/arrived
      const activeRidesResponse = await fetch(`${supabaseUrl}/rest/v1/rides?driver_id=eq.${driver.id}&status=in.(assigned,accepted,enroute,arrived)&select=count`, {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact'
        }
      });

      if (activeRidesResponse.ok) {
        const countHeader = activeRidesResponse.headers.get('Content-Range');
        if (countHeader) {
          const match = countHeader.match(/\/(\d+)$/);
          const activeRides = match ? parseInt(match[1]) : 0;
          if (activeRides > 0) {
            throw new Error('不能设置为离线，您有未完成的订单');
          }
        }
      }
    }

    // 准备更新数据
    const nowIso = new Date().toISOString();
    const updateData: Record<string, any> = {
      status: status,
      updated_at: nowIso,
      heartbeat_at: nowIso
    };

    // 如果提供了位置信息，也更新位置
    if (latitude !== undefined && longitude !== undefined) {
      updateData.latitude = latitude;
      updateData.longitude = longitude;
      // 同步 geography 欄位（location）透過 RPC
      try {
        const rpcResp = await fetch(`${supabaseUrl}/rest/v1/rpc/upsert_driver_location`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ p_driver_id: driver.id, p_lat: latitude, p_lng: longitude })
        });
        // 若 RPC 不存在或錯誤，忽略不中斷流程
        if (!rpcResp.ok) {
          console.warn('upsert_driver_location RPC 失敗或未配置');
        }
      } catch (e) {
        console.warn('呼叫 upsert_driver_location RPC 例外：', e);
      }
    }

    // 更新司机状态
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/drivers?id=eq.${driver.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(updateData)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`更新司机状态失败: ${errorText}`);
    }

    const updatedDrivers = await updateResponse.json();
    const updatedDriver = updatedDrivers[0];

    return new Response(JSON.stringify({
      success: true,
      data: {
        driver: updatedDriver
      },
      message: `司机状态已更新为: ${status}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('更新司机状态失败:', error);

    const errorResponse = {
      success: false,
      error: {
        code: 'UPDATE_DRIVER_STATUS_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
