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
    const { serviceType, distanceKm, durationMinutes, passengerCount = 1, deliveryFee = 0 } = await req.json();
    
    if (!serviceType) {
      throw new Error('服務類型為必填項目');
    }

    if (!['ride', 'delivery', 'designated_driver'].includes(serviceType)) {
      throw new Error('無效的服務類型');
    }

    let baseFare = 0;
    let distanceFee = 0;
    let timeFee = 0;
    let extraDistanceFee = 0;
    let passengerExtraFee = 0;
    let serviceFee = 0;
    let deliveryServiceFee = deliveryFee;
    let totalAmount = 0;

    // 計算程式根據不同服務類型
    switch (serviceType) {
      case 'ride': // 搭車：基本車賄70元 + 每公里15元 + 每分鈘3元 + 超過20公里每公里額外10元
        baseFare = 70;
        if (distanceKm) {
          distanceFee = distanceKm * 15;
          if (distanceKm > 20) {
            extraDistanceFee = (distanceKm - 20) * 10;
          }
        }
        if (durationMinutes) {
          timeFee = durationMinutes * 3;
        }
        // 乘客數量加費：5人+50元，6人+100元，以此類推
        if (passengerCount > 4) {
          passengerExtraFee = (passengerCount - 4) * 50;
        }
        break;
        
      case 'delivery': // 跑腿：路程費 + 代壊費用 + 100元服務費
        if (distanceKm) {
          distanceFee = distanceKm * 15;
          if (distanceKm > 20) {
            extraDistanceFee = (distanceKm - 20) * 10;
          }
        }
        if (durationMinutes) {
          timeFee = durationMinutes * 3;
        }
        serviceFee = 100;
        break;
        
      case 'designated_driver': // 代駕：行程費×2 + 300元服務費
        if (distanceKm) {
          distanceFee = distanceKm * 15 * 2; // 行程費×2
          if (distanceKm > 20) {
            extraDistanceFee = (distanceKm - 20) * 10 * 2; // 額外費用也×2
          }
        }
        if (durationMinutes) {
          timeFee = durationMinutes * 3 * 2; // 時間費用也×2
        }
        serviceFee = 300;
        break;
    }

    // 計算總金額
    totalAmount = baseFare + distanceFee + timeFee + extraDistanceFee + passengerExtraFee + serviceFee + deliveryServiceFee;

    // 確保最小金額
    if (totalAmount < 50) {
      totalAmount = 50;
    }

    const pricingDetails = {
      serviceType,
      baseFare,
      distanceKm: distanceKm || 0,
      durationMinutes: durationMinutes || 0,
      distanceFee,
      timeFee,
      extraDistanceFee,
      passengerExtraFee,
      serviceFee,
      deliveryFee: deliveryServiceFee,
      totalAmount: Math.round(totalAmount), // 四捨五入到整數
      breakdown: {
        '基本車資': baseFare,
        '距離費用': distanceFee,
        '時間費用': timeFee,
        '超距額外費': extraDistanceFee,
        '乘客加費': passengerExtraFee,
        '服務費': serviceFee,
        '代壊費用': deliveryServiceFee
      }
    };

    return new Response(JSON.stringify({
      success: true,
      data: pricingDetails,
      message: '價格計算完成'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('價格計算失敗:', error);

    const errorResponse = {
      success: false,
      error: {
        code: 'PRICE_CALCULATION_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});