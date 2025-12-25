import 'dotenv/config';

/**
 * Airtable Base 初始化腳本：建立車隊系統所需資料表
 * 使用 Meta API 管理 Base 結構（建立 Tables 與欄位）
 *
 * 需求表：
 * 1) Passengers
 * 2) Drivers
 * 3) Rides（連 Passengers、Drivers）
 * 4) Payments（連 Rides）
 * 5) Feedback（連 Rides、Passengers）
 * 6) Chat（連 Rides）
 * 7) System_Monitor
 *
 * 注意事項：
 * - 需使用 Personal Access Token（PAT）且權限足以管理 Base 結構
 * - 若表已存在則跳過建立；目前此腳本以「建立為主」，不變更既有欄位
 * - 欄位型別遵循 Airtable Meta API：singleLineText、multilineText、number、currency、date、createdTime、phoneNumber、email、singleSelect、multipleRecordLinks、autoNumber
 */

// --- 環境變數與憑證 ---
const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY || 'patRsdVy7AG902wQH.0b05af70367e4ecfb145a44beaf435a41f19a366cf8b099c21d7ecb3dc8a4988';
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appl73JLmWFi3iJPm';

if (!AIRTABLE_TOKEN || !BASE_ID) {
  console.error('缺少必要憑證或 Base ID，請確認 AIRTABLE_TOKEN/AIRTABLE_API_KEY 與 AIRTABLE_BASE_ID');
  process.exit(1);
}

const META_TABLES_URL = `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`;

const headers = {
  Authorization: `Bearer ${AIRTABLE_TOKEN}`,
  'Content-Type': 'application/json',
};

// --- 共用請求工具（含簡易重試） ---
async function request(url, opts = {}, desc = 'Airtable 請求') {
  const MAX_RETRY = 3;
  for (let attempt = 1; attempt <= MAX_RETRY; attempt++) {
    const res = await fetch(url, { ...opts, headers });
    if (res.ok) {
      return res.json();
    }
    const text = await res.text();
    // 429/5xx 做簡易退避重試
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

// 取得目前 Base 的所有表（含欄位）
async function listTables() {
  const json = await request(META_TABLES_URL, { method: 'GET' }, '取得 Tables');
  return json.tables || [];
}

// 檢查表是否存在（以名稱比對，不區分大小寫）
function findTableByName(tables, name) {
  return tables.find((t) => t.name.toLowerCase() === name.toLowerCase());
}

// 建立單選欄位的 options 物件
function singleSelectOptions(choices) {
  return { choices: choices.map((c) => ({ name: c })) };
}

// 建立「連結到其他表」欄位的 options（multipleRecordLinks）
function linkOptions(linkedTableId) {
  return { linkedTableId };
}

// 建立資料表（若已存在則回傳既有 ID）
async function ensureTable(name, fields) {
  const tables = await listTables();
  const existing = findTableByName(tables, name);
  if (existing) {
    console.log(`表已存在，跳過建立：${name} (tableId=${existing.id})`);
    return existing.id;
  }
  // 說明：fields 陣列中的第一個欄位會成為 Primary Field（通常允許 autoNumber 作為主鍵）
  const payload = { name, fields };
  const created = await request(META_TABLES_URL, { method: 'POST', body: JSON.stringify(payload) }, `建立表 ${name}`);
  console.log(`已建立表：${name} (tableId=${created.id})`);
  return created.id;
}

// --- 各表欄位定義（以 autoNumber 為主鍵） ---
function buildPassengersFields() {
  return [
    { name: 'passenger_id', type: 'autoNumber' }, // Primary key
    { name: 'name', type: 'singleLineText' },
    { name: 'phone', type: 'phoneNumber' },
    { name: 'email', type: 'email' },
    { name: 'created_at', type: 'createdTime' },
  ];
}

function buildDriversFields() {
  return [
    { name: 'driver_id', type: 'autoNumber' }, // Primary key
    { name: 'name', type: 'singleLineText' },
    { name: 'phone', type: 'phoneNumber' },
    { name: 'vehicle_model', type: 'singleLineText' },
    { name: 'license_plate', type: 'singleLineText' },
    { name: 'status', type: 'singleSelect', options: singleSelectOptions(['online', 'offline', 'busy']) },
    { name: 'rating', type: 'number', options: { precision: 2 } },
    { name: 'created_at', type: 'createdTime' },
  ];
}

function buildRidesFields(passengersId, driversId) {
  return [
    { name: 'ride_id', type: 'autoNumber' }, // Primary key
    { name: 'passenger_id', type: 'multipleRecordLinks', options: linkOptions(passengersId) },
    { name: 'driver_id', type: 'multipleRecordLinks', options: linkOptions(driversId) },
    { name: 'start_location', type: 'multilineText' },
    { name: 'end_location', type: 'multilineText' },
    { name: 'distance_km', type: 'number', options: { precision: 2 } },
    { name: 'fare', type: 'currency', options: { precision: 2 } },
    { name: 'status', type: 'singleSelect', options: singleSelectOptions(['requested', 'accepted', 'completed', 'cancelled']) },
    { name: 'requested_at', type: 'createdTime' },
    { name: 'completed_at', type: 'date' },
  ];
}

function buildPaymentsFields(ridesId) {
  return [
    { name: 'payment_id', type: 'autoNumber' }, // Primary key
    { name: 'ride_id', type: 'multipleRecordLinks', options: linkOptions(ridesId) },
    { name: 'method', type: 'singleSelect', options: singleSelectOptions(['cash', 'credit_card', 'mobile_pay']) },
    { name: 'amount', type: 'currency', options: { precision: 2 } },
    { name: 'status', type: 'singleSelect', options: singleSelectOptions(['pending', 'paid', 'failed']) },
    { name: 'paid_at', type: 'date' },
  ];
}

function buildFeedbackFields(ridesId, passengersId) {
  return [
    { name: 'feedback_id', type: 'autoNumber' }, // Primary key
    { name: 'ride_id', type: 'multipleRecordLinks', options: linkOptions(ridesId) },
    { name: 'passenger_id', type: 'multipleRecordLinks', options: linkOptions(passengersId) },
    { name: 'rating', type: 'number', options: { precision: 0 } },
    { name: 'comment', type: 'multilineText' },
    { name: 'created_at', type: 'createdTime' },
  ];
}

function buildChatFields(ridesId) {
  return [
    { name: 'chat_id', type: 'autoNumber' }, // Primary key
    { name: 'ride_id', type: 'multipleRecordLinks', options: linkOptions(ridesId) },
    { name: 'sender', type: 'singleSelect', options: singleSelectOptions(['passenger', 'driver', 'system']) },
    { name: 'message', type: 'multilineText' },
    { name: 'sent_at', type: 'createdTime' },
  ];
}

function buildSystemMonitorFields() {
  return [
    { name: 'log_id', type: 'autoNumber' }, // Primary key
    { name: 'event_type', type: 'singleSelect', options: singleSelectOptions(['error', 'info', 'warning']) },
    { name: 'description', type: 'multilineText' },
    { name: 'related_table', type: 'singleLineText' },
    { name: 'created_at', type: 'createdTime' },
  ];
}

// --- 主流程 ---
(async () => {
  try {
    console.log('開始初始化 Airtable Base 結構...');

    // 先建立不依賴其他表的 Tables
    const passengersId = await ensureTable('Passengers', buildPassengersFields());
    const driversId = await ensureTable('Drivers', buildDriversFields());

    // 依賴 Passengers/Drivers 的 Rides
    const ridesId = await ensureTable('Rides', buildRidesFields(passengersId, driversId));

    // 依賴 Rides 的其餘表
    await ensureTable('Payments', buildPaymentsFields(ridesId));
    await ensureTable('Feedback', buildFeedbackFields(ridesId, passengersId));
    await ensureTable('Chat', buildChatFields(ridesId));

    // 無相依的監控表
    await ensureTable('System_Monitor', buildSystemMonitorFields());

    console.log('✅ 所有資料表已確認存在或成功建立！');
    console.log('提示：若需補齊既有表的缺漏欄位，建議使用 Meta API 的 PATCH 端點新增欄位或於 UI 手動調整。');
  } catch (err) {
    console.error('❌ 初始化失敗：', err.message);
    process.exit(1);
  }
})();