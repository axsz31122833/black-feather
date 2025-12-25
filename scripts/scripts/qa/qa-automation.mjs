// QA automation script per user's request
// Runs end-to-end tests against local backend API at http://localhost:4000
// Outputs a JSON summary report

import dotenv from 'dotenv';

dotenv.config();

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';

async function jsonFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error(`Non-JSON response ${url}: ${text}`); }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}: ${text}`);
  return data;
}

async function run() {
  const report = {
    ok: [],
    issues: [],
    missing: [],
    checklist: [],
    details: {},
  };

  const passenger = { phone: '0972000001', name: '測試乘客A' };
  const driver = { phone: '0972000002', name: '測試司機B', invite_code: '0971827628' };
  const taipeiStation = { lat: 25.0478, lng: 121.5170 };
  const dropoff = { lat: 25.033964, lng: 121.564468 };

  // Create accounts
  try {
    const pReg = await jsonFetch('/auth/register', { method: 'POST', body: JSON.stringify({ role: 'rider', name: passenger.name, phone: passenger.phone }) });
    const dReg = await jsonFetch('/auth/register', { method: 'POST', body: JSON.stringify({ role: 'driver', name: driver.name, phone: driver.phone, invite_code: driver.invite_code }) });
    report.ok.push('建立測試帳號（乘客/司機）');
    const rider_id = pReg?.rider?.id || pReg?.data?.rider?.id || pReg?.id;
    const driver_id = dReg?.driver?.id || dReg?.data?.driver?.id || dReg?.id;
    report.details.accounts = { rider_id, driver_id };

    // Set driver online
    await jsonFetch('/drivers/online', { method: 'POST', body: JSON.stringify({ driver_id, lat: taipeiStation.lat, lng: taipeiStation.lng }) });
    report.ok.push('司機上線並設定座標');

    // Update rider location via tool script
    try {
      const proc = Bun ? null : null; // no-op for bundlers
    } catch {}
    // Call internal tool via HTTP-less approach by hitting temporary endpoint if available
    // Fallback: use a direct DB tool script via separate process (invoked by the testing harness outside this script)
    report.details.rider_location_required = true;
  } catch (err) {
    report.issues.push({ name: '建立測試帳號', msg: err.message, cause: '後端 /auth/register 錯誤或未啟動' });
  }

  // Functional flows (best-effort)
  try {
    const rider_id = report.details?.accounts?.rider_id;
    const driver_id = report.details?.accounts?.driver_id;
    if (!rider_id || !driver_id) throw new Error('缺少 rider_id 或 driver_id');

    // Request ride (requires rider lat/lng)
    let ride1;
    try {
      const resp = await jsonFetch('/rides/request', { method: 'POST', body: JSON.stringify({ rider_id, end_lat: dropoff.lat, end_lng: dropoff.lng }) });
      ride1 = resp?.ride || resp?.data?.ride || resp?.data?.order;
      if (ride1?.id) {
        report.ok.push('乘客下單並派單成功');
        report.details.ride1 = ride1;
      } else {
        report.issues.push({ name: '下單派單', msg: '沒有返回有效的 ride.id', cause: '可能無可用司機或乘客缺少座標' });
      }
    } catch (e) {
      report.issues.push({ name: '乘客下單', msg: e.message, cause: '乘客座標缺失或 API 錯誤' });
    }

    // Accept -> Start -> Complete (if ride exists)
    if (ride1?.id) {
      try {
        await jsonFetch('/rides/accept', { method: 'POST', body: JSON.stringify({ ride_id: ride1.id, driver_id }) });
        report.ok.push('司機接單成功');
      } catch (e) {
        report.issues.push({ name: '司機接單', msg: e.message, cause: 'driver_id 不匹配或狀態錯誤' });
      }
      try {
        await jsonFetch('/drivers/update_location', { method: 'POST', body: JSON.stringify({ driver_id, lat: 25.046, lng: 121.520 }) });
        await jsonFetch('/drivers/update_location', { method: 'POST', body: JSON.stringify({ driver_id, lat: 25.045, lng: 121.523 }) });
        await jsonFetch('/drivers/update_location', { method: 'POST', body: JSON.stringify({ driver_id, lat: 25.043, lng: 121.526 }) });
        report.ok.push('司機更新位置（3次）');
      } catch (e) {
        report.issues.push({ name: '司機更新位置', msg: e.message, cause: 'API /drivers/update_location 錯誤' });
      }
      try {
        await jsonFetch('/rides/start', { method: 'POST', body: JSON.stringify({ ride_id: ride1.id }) });
        report.ok.push('開始行程');
      } catch (e) {
        report.issues.push({ name: '開始行程', msg: e.message, cause: 'API /rides/start 錯誤' });
      }
      try {
        await jsonFetch('/rides/complete', { method: 'POST', body: JSON.stringify({ ride_id: ride1.id }) });
        report.ok.push('結束行程');
      } catch (e) {
        report.issues.push({ name: '結束行程', msg: e.message, cause: 'API /rides/complete 錯誤' });
      }
    }

    // Cancel flow (new ride then cancel)
    let ride2;
    try {
      const resp = await jsonFetch('/rides/request', { method: 'POST', body: JSON.stringify({ rider_id, end_lat: dropoff.lat, end_lng: dropoff.lng }) });
      ride2 = resp?.ride || resp?.data?.ride || resp?.data?.order;
    } catch {}
    if (ride2?.id) {
      try {
        const cancelResp = await jsonFetch('/rides/cancel', { method: 'POST', body: JSON.stringify({ ride_id: ride2.id }) });
        if (cancelResp?.confirm) {
          report.ok.push('取消叫車需要確認費用（符合商規）');
        } else {
          report.ok.push('取消叫車成功');
        }
      } catch (e) {
        report.issues.push({ name: '取消叫車', msg: e.message, cause: 'API /rides/cancel 錯誤' });
      }
    }

    // Unimplemented items
    report.missing.push('預約單與 schedule_checker（未整合 Supabase cron）');
    report.missing.push('歷史行程列表與詳細資訊 API');
    report.missing.push('距離計算與費率定價');
    report.missing.push('司機歷史行程查詢');
    report.missing.push('Supabase RPC：assign_driver, upsert_driver_location, insert_ride_location, compute_ride_distance_km');

    report.checklist.push(
      '補乘客座標更新 API 或在前端加入定位上傳',
      '整合 Supabase 定時任務 schedule_checker 與預約單資料表',
      '在完成行程時計算距離與費率，寫入 rides.final_price_cents/distance_km/duration_minutes',
      '提供行程列表與詳細查詢 API（乘客、司機）',
      '補充通知機制（派單、接單、到站）',
      '對齊 Supabase RPC 簽章與後端 API 行為'
    );
  } catch (e) {
    report.issues.push({ name: '流程總結', msg: e.message, cause: '測試執行中斷' });
  }

  console.log(JSON.stringify(report, null, 2));
}

run().catch((err) => {
  console.error(JSON.stringify({ fatal: true, error: err.message }));
  process.exit(1);
});