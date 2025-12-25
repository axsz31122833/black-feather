import Airtable from 'airtable';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 自動派車腳本（中文欄位版）
 * - 從 Orders 讀取「等待中」訂單
 * - 挑選最近的「Online」司機（Drivers.Is Online = checked）
 * - 更新訂單為「已指派」，連結司機紀錄（Orders.Driver），並記錄監控（System_Monitor）
 *
 * 欄位對應：
 * - Drivers: Name, Current Lat, Current Lng, Is Online
 * - Orders: Status, Passenger, Driver, Pickup/Dropoff Address + Lat/Lng
 */

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error('❌ 缺少環境變數 AIRTABLE_PAT/AIRTABLE_TOKEN 或 AIRTABLE_BASE_ID');
  process.exit(1);
}

const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function haversineDistanceKm(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchAll(table, options = {}) {
  const records = await base(table).select(options).all();
  return records;
}

async function createMonitor(description, status = 'Success') {
  try {
    await base('System_Monitor').create(
      [
        {
          fields: {
            'Service Name': 'Dispatch',
            'Status': status === 'Success' ? '正常' : '錯誤',
            'Last Check Time': new Date().toISOString(),
            'Response Time (ms)': 0,
            'Error Log': description,
            'Uptime': 1,
            'Version': 'v1',
          },
        },
      ],
      { typecast: true }
    );
  } catch (err) {
    console.warn('⚠️ 寫入 System_Monitor 失敗：', err.message);
  }
}

function driverDistanceKm(driverRec, pickup) {
  const lat = toNumber(driverRec.fields['Current Lat']);
  const lng = toNumber(driverRec.fields['Current Lng']);
  if (lat != null && lng != null && pickup.lat != null && pickup.lng != null) {
    return haversineDistanceKm({ lat, lng }, pickup);
  }
  return 1 + Math.random() * 9;
}

async function autoDispatch(orderRec) {
  const orderId = orderRec.id;
  const pickup = {
    lat: toNumber(orderRec.fields['Pickup Lat']),
    lng: toNumber(orderRec.fields['Pickup Lng']),
  };

  // 1) 找出 Online 司機（Drivers.Is Online = true）
  const drivers = await fetchAll('Drivers', {
    filterByFormula: '{Is Online} = 1',
  });

  if (!drivers.length) {
    await createMonitor(`派車失敗：無可用司機（order=${orderId})`, 'Failed');
    console.log('❌ 派車失敗：目前沒有 Online 司機');
    return null;
  }

  // 2) 依距離選擇最佳司機
  let best = null;
  let bestDist = Infinity;
  for (const d of drivers) {
    const dist = driverDistanceKm(d, pickup);
    if (dist < bestDist) {
      best = d;
      bestDist = dist;
    }
  }

  if (!best) {
    await createMonitor(`派車失敗：距離計算異常（order=${orderId})`, 'Failed');
    console.log('❌ 派車失敗：距離計算異常');
    return null;
  }

  // 3) 更新訂單為「已指派」，連結司機到 Orders.Driver
  try {
    await base('Orders').update(
      [
        {
          id: orderId,
          fields: {
            'Status': '已指派',
            'Driver': [{ id: best.id }],
          },
        },
      ],
      { typecast: true }
    );
  } catch (err) {
    await createMonitor(`派車失敗：無法更新訂單（order=${orderId}) - ${err.message}`, 'Failed');
    throw err;
  }

  // 4)（選擇性）你也可以把司機切換為 Offline/Busy；此版保留 Online 方便測試
  await createMonitor(
    `已派出司機 ${best.fields['Name'] || best.id} 給訂單 ${orderId}（距離約 ${bestDist.toFixed(2)} km）`
  );

  console.log(
    `✅ 已派出司機 ${best.fields['Name'] || best.id} 給訂單 ${orderId}（距離約 ${bestDist.toFixed(2)} km）`
  );

  return best;
}

async function main() {
  try {
    const pendingOrders = await fetchAll('Orders', {
      filterByFormula: "{Status} = '等待中'",
    });

    if (!pendingOrders.length) {
      console.log('目前沒有「等待中」訂單，請先執行：node scripts/airtable-create-order.mjs');
      return;
    }

    for (const order of pendingOrders) {
      await autoDispatch(order);
    }
  } catch (err) {
    console.error('❌ 程式執行錯誤：', err.message);
    process.exit(1);
  }
}

main();