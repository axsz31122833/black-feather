import 'dotenv/config';

/**
 * BlackFeather Fleet - Airtable Base Structure Builder (中文註解版)
 *
 * 依據需求建立 6 張資料表：
 * 1) Passengers
 * 2) Drivers
 * 3) Orders
 * 4) Chat
 * 5) Common_Places
 * 6) System_Monitor
 *
 * 使用 Airtable Meta API：POST https://api.airtable.com/v0/meta/bases/{baseId}/tables
 * - 需要具備「Schema/Meta 寫入」權限的 Personal Access Token (PAT)
 * - 若表已存在則跳過建立（此版本不自動補欄位，如需補欄位可再擴充 PATCH 邏輯）
 */

const AIRTABLE_TOKEN = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_TOKEN || !BASE_ID) {
  console.error('❌ 請在環境變數設定 AIRTABLE_BASE_ID 與 AIRTABLE_PAT（或 AIRTABLE_TOKEN）');
  process.exit(1);
}

const META_TABLES_URL = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`;

const headers = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

async function request(url, opts = {}, desc = 'Airtable 請求') {
  const MAX_RETRY = 3;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    const res = await fetch(url, { ...opts, headers });
    if (res.ok) return res.json();
    const text = await res.text();
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      const wait = 500 * attempt;
      console.warn(`${desc} 第 ${attempt} 次失敗（${res.status}），${wait}ms 後重試...\n${text}`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`${desc} 失敗：${res.status} ${res.statusText}\n${text}`);
  }
  throw new Error(`${desc} 重試後仍失敗`);
}

async function listTables() {
  const json = await request(META_TABLES_URL, { method: 'GET' }, '取得 Tables');
  return json.tables || [];
}

function findTableByName(tables, name) {
  return tables.find((t) => t.name.toLowerCase() === name.toLowerCase());
}

function singleSelectOptions(choices) {
  return { choices: choices.map((c) => ({ name: c })) };
}

function linkOptions(linkedTableId) {
  return { linkedTableId };
}

async function ensureTable(name, fields) {
  const tables = await listTables();
  const existing = findTableByName(tables, name);
  if (existing) {
    const count = Array.isArray(existing.fields) ? existing.fields.length : '未知';
    console.log(`↺ 表已存在，跳過：${name} (fields=${count}, tableId=${existing.id})`);
    return existing.id;
  }
  const payload = { name, fields };
  const created = await request(META_TABLES_URL, { method: 'POST', body: JSON.stringify(payload) }, `建立表 ${name}`);
  const count = Array.isArray(fields) ? fields.length : '未知';
  console.log(`✅ 已建立表：${name} (fields=${count}, tableId=${created.id})`);
  return created.id;
}

// --- 欄位定義（注意：第一個欄位會成為 Primary Field） ---
function buildPassengersFields() {
  return [
    { name: 'Name', type: 'singleLineText' },
    { name: 'Phone', type: 'phoneNumber' },
    { name: 'Email', type: 'email' },
    { name: 'invitation_code', type: 'singleLineText' },
    { name: 'role', type: 'singleSelect', options: singleSelectOptions(['super_admin', 'driver', 'passenger']) },
    { name: 'Glide User ID', type: 'singleLineText' },
    { name: 'Common Places', type: 'multilineText' },
    { name: 'Total Rides', type: 'number', options: { precision: 0 } },
    { name: 'Join Date', type: 'date', options: { dateFormat: { name: 'local' } } },
    { name: 'Preferred Payment', type: 'singleSelect', options: singleSelectOptions(['Cash', 'Card']) },
    { name: 'Remarks', type: 'multilineText' },
  ];
}

function buildDriversFields() {
  return [
    { name: 'Name', type: 'singleLineText' },
    { name: 'Phone', type: 'phoneNumber' },
    { name: 'Nickname', type: 'singleLineText' },
    { name: 'Car Model', type: 'singleLineText' },
    { name: 'License Plate', type: 'singleLineText' },
    { name: 'Is Online', type: 'checkbox', options: { icon: 'check', color: 'greenBright' } },
    { name: 'Rating', type: 'number', options: { precision: 0 } },
    { name: 'location_lat', type: 'number', options: { precision: 6 } },
    { name: 'location_lng', type: 'number', options: { precision: 6 } },
    { name: 'Current Address', type: 'singleLineText' },
    { name: 'Last Update', type: 'dateTime', options: { dateFormat: { name: 'local' }, timeFormat: { name: '24hour' }, timeZone: 'Asia/Taipei' } },
    { name: 'Completed Rides', type: 'number', options: { precision: 0 } },
    { name: 'Balance', type: 'currency', options: { precision: 2, symbol: 'NT$' } },
    { name: 'invitation_code', type: 'singleLineText' },
    { name: 'role', type: 'singleSelect', options: singleSelectOptions(['super_admin', 'driver', 'passenger']) },
  ];
}

function buildOrdersFields(passengersId, driversId) {
  return [
    { name: 'Pickup Address', type: 'singleLineText' },
    { name: 'Passenger', type: 'multipleRecordLinks', options: linkOptions(passengersId) },
    { name: 'Driver', type: 'multipleRecordLinks', options: linkOptions(driversId) },
    { name: 'Pickup Lat', type: 'number', options: { precision: 6 } },
    { name: 'Pickup Lng', type: 'number', options: { precision: 6 } },
    { name: 'Dropoff Address', type: 'singleLineText' },
    { name: 'Dropoff Lat', type: 'number', options: { precision: 6 } },
    { name: 'Dropoff Lng', type: 'number', options: { precision: 6 } },
    { name: 'Status', type: 'singleSelect', options: singleSelectOptions(['searching', 'assigned', 'driver_arrived', 'meter_started', 'ongoing', 'completed', 'cancelled']) },
    { name: 'Fare Estimate', type: 'currency', options: { precision: 2, symbol: 'NT$' } },
    { name: 'Assigned Time', type: 'dateTime', options: { dateFormat: { name: 'local' }, timeFormat: { name: '24hour' }, timeZone: 'Asia/Taipei' } },
    { name: 'Completed Time', type: 'dateTime', options: { dateFormat: { name: 'local' }, timeFormat: { name: '24hour' }, timeZone: 'Asia/Taipei' } },
    { name: 'Type', type: 'singleSelect', options: singleSelectOptions(['即時單', '預約單']) },
    { name: 'Scheduled Time', type: 'dateTime', options: { dateFormat: { name: 'local' }, timeFormat: { name: '24hour' }, timeZone: 'Asia/Taipei' } },
    { name: 'Distance', type: 'number', options: { precision: 2 } },
    { name: 'Duration', type: 'number', options: { precision: 2 } },
    { name: 'Payment Status', type: 'singleSelect', options: singleSelectOptions(['Unpaid', 'Paid']) },
    { name: 'driver_lat', type: 'number', options: { precision: 6 } },
    { name: 'driver_lng', type: 'number', options: { precision: 6 } },
    { name: 'meter_start_at', type: 'dateTime', options: { dateFormat: { name: 'local' }, timeFormat: { name: '24hour' }, timeZone: 'Asia/Taipei' } },
  ];
}

function buildChatFields(ordersId) {
  return [
    { name: 'Sender ID', type: 'singleLineText' },
    { name: 'Receiver ID', type: 'singleLineText' },
    { name: 'Message', type: 'multilineText' },
    { name: 'Timestamp', type: 'dateTime', options: { dateFormat: { name: 'local' }, timeFormat: { name: '24hour' }, timeZone: 'Asia/Taipei' } },
    { name: 'Order', type: 'multipleRecordLinks', options: linkOptions(ordersId) },
  ];
}

function buildCommonPlacesFields(passengersId) {
  return [
    { name: 'Place Name', type: 'singleLineText' },
    { name: 'Address', type: 'singleLineText' },
    { name: 'Lat', type: 'number', options: { precision: 6 } },
    { name: 'Lng', type: 'number', options: { precision: 6 } },
    { name: 'Passenger', type: 'multipleRecordLinks', options: linkOptions(passengersId) },
  ];
}

function buildSystemMonitorFields() {
  return [
    { name: 'Title', type: 'singleLineText' }, // 新增作為 Primary Field
    { name: 'Event', type: 'singleSelect', options: singleSelectOptions(['Create', 'Update', 'Error', 'Dispatch']) },
    { name: 'Source', type: 'singleSelect', options: singleSelectOptions(['Passenger', 'Driver', 'System']) },
    { name: 'Description', type: 'multilineText' },
    { name: 'Timestamp', type: 'dateTime', options: { dateFormat: { name: 'local' }, timeFormat: { name: '24hour' }, timeZone: 'Asia/Taipei' } },
    { name: 'Status', type: 'singleSelect', options: singleSelectOptions(['Success', 'Failed']) },
  ];
}

// --- 主流程 ---
(async () => {
  try {
    console.log('🚀 開始建立 Airtable Base 結構（Base ID: ' + BASE_ID + '）');

    // 先建立不相依的表
    const passengersId = await ensureTable('Passengers', buildPassengersFields());
    const driversId = await ensureTable('Drivers', buildDriversFields());

    // 依賴 Passengers/Drivers 的 Orders
    const ordersId = await ensureTable('Orders', buildOrdersFields(passengersId, driversId));

    // 依賴 Orders 的 Chat
    await ensureTable('Chat', buildChatFields(ordersId));

    // 依賴 Passengers 的 Common_Places
    await ensureTable('Common_Places', buildCommonPlacesFields(passengersId));

    // 無相依的 System_Monitor
    await ensureTable('System_Monitor', buildSystemMonitorFields());

    console.log('✅ 完成：所有資料表已建立或確認存在！');
    console.log('ℹ️ 若需補齊既有表的缺漏欄位，可擴充此腳本的 PATCH 邏輯或於 UI 手動增加欄位。');
  } catch (err) {
    console.error('❌ 結構建立失敗：', err.message);
    process.exit(1);
  }
})();