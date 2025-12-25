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
    const { reporterPhone, reporterRole, rideId, issueType, title, description } = await req.json();
    
    if (!reporterPhone || !reporterRole || !issueType || !title || !description) {
      throw new Error('回報者手機、角色、問題類型、標題和描述為必填項目');
    }

    if (!['driver', 'passenger'].includes(reporterRole)) {
      throw new Error('只有司機和乘客可以回報問題');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase 配置缺失');
    }

    // 如果有提供rideId，驗證訂單存在且用戶相關
    if (rideId) {
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
        throw new Error('指定的訂單不存在');
      }

      const ride = rides[0];
      if (ride.passenger_phone !== reporterPhone && ride.driver_phone !== reporterPhone) {
        throw new Error('您無權回報此訂單的問題');
      }
    }

    // 建立問題回報
    const createIssueResponse = await fetch(`${supabaseUrl}/rest/v1/issue_reports`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        reporter_phone: reporterPhone,
        reporter_role: reporterRole,
        ride_id: rideId || null,
        issue_type: issueType,
        title: title,
        description: description,
        status: 'pending'
      })
    });

    if (!createIssueResponse.ok) {
      const errorText = await createIssueResponse.text();
      throw new Error(`建立問題回報失敗: ${errorText}`);
    }

    const newIssues = await createIssueResponse.json();
    const newIssue = newIssues[0];

    return new Response(JSON.stringify({
      success: true,
      data: {
        issue: newIssue
      },
      message: '問題回報提交成功，我們會盡快處理'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('提交問題回報失敗:', error);

    const errorResponse = {
      success: false,
      error: {
        code: 'SUBMIT_ISSUE_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});