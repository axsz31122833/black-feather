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

    const results = [];

    // 1. 创建测试司机
    const testDrivers = [
      {
        phone: '0912345001',
        name: '张大明',
        car_plate: 'ABC-1234',
        car_model: 'Toyota Camry',
        car_color: '白色',
        status: 'idle',
        rating: 4.8
      },
      {
        phone: '0912345002',
        name: '李小华',
        car_plate: 'DEF-5678',
        car_model: 'Honda Accord',
        car_color: '黑色',
        status: 'idle',
        rating: 4.9
      },
      {
        phone: '0912345003',
        name: '王美丽',
        car_plate: 'GHI-9012',
        car_model: 'Nissan Sentra',
        car_color: '银色',
        status: 'offline',
        rating: 4.7
      },
      {
        phone: '0912345004',
        name: '陈志强',
        car_plate: 'JKL-3456',
        car_model: 'Mazda 3',
        car_color: '红色',
        status: 'idle',
        rating: 4.6
      }
    ];

    for (const driver of testDrivers) {
      const response = await fetch(`${supabaseUrl}/rest/v1/drivers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(driver)
      });

      if (response.ok) {
        results.push(`成功创建司机: ${driver.name} (${driver.phone})`);
      } else {
        const errorText = await response.text();
        // 如果是重复电话号错误，忽略
        if (errorText.includes('duplicate key value violates unique constraint')) {
          results.push(`司机已存在: ${driver.name} (${driver.phone})`);
        } else {
          results.push(`创建司机失败: ${driver.name} - ${errorText}`);
        }
      }
    }

    // 2. 创建测试乘客
    const testPassengers = [
      {
        phone: '0987654001',
        name: '刘小明'
      },
      {
        phone: '0987654002',
        name: '蔡美丽'
      }
    ];

    for (const passenger of testPassengers) {
      const response = await fetch(`${supabaseUrl}/rest/v1/passengers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(passenger)
      });

      if (response.ok) {
        results.push(`成功创建乘客: ${passenger.name} (${passenger.phone})`);
      } else {
        const errorText = await response.text();
        if (errorText.includes('duplicate key value violates unique constraint')) {
          results.push(`乘客已存在: ${passenger.name} (${passenger.phone})`);
        } else {
          results.push(`创建乘客失败: ${passenger.name} - ${errorText}`);
        }
      }
    }

    // 3. 创建测试管理员
    const testAdmins = [
      {
        phone: '0900000000',
        name: '系统管理员',
        permissions: ['manage_drivers', 'view_orders', 'manage_system']
      }
    ];

    for (const admin of testAdmins) {
      const response = await fetch(`${supabaseUrl}/rest/v1/admins`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(admin)
      });

      if (response.ok) {
        results.push(`成功创建管理员: ${admin.name} (${admin.phone})`);
      } else {
        const errorText = await response.text();
        if (errorText.includes('duplicate key value violates unique constraint')) {
          results.push(`管理员已存在: ${admin.name} (${admin.phone})`);
        } else {
          results.push(`创建管理员失败: ${admin.name} - ${errorText}`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        results: results
      },
      message: '测试数据初始化完成'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('初始化测试数据失败:', error);

    const errorResponse = {
      success: false,
      error: {
        code: 'INIT_TEST_DATA_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
