/**
 * Airtable Automation Script - BF 黑羽 系統監控
 *
 * 用途：
 * - 建立 / 確保存在：System_Monitor（最新狀態）與 System_Log（紀錄）
 * - 每 5 分鐘由 Automation 觸發本腳本進行健康檢查
 * - 更新各模組狀態、回應時間、錯誤訊息，並寫入 System_Log
 * - 異常時發送 Email / LINE Notify（需在環境變數填入 LINE Token，Automation 自帶 Email 可用）
 *
 * 使用：
 * 1) 在 Airtable Base -> Automations -> Add Trigger -> At a Scheduled Time -> Every 5 minutes
 * 2) Add Action -> Run a script，貼上本腳本
 * 3) 在腳本開頭填入對應的 URLs 與 LINE_NOTIFY_TOKEN
 */

// ---- 設定區（請依實際情況填入）----
const CONFIG = {
  GLIDE_PASSENGER_URL: 'https://your-glide-passenger-app-url',
  GLIDE_DRIVER_URL: 'https://your-glide-driver-app-url',
  AIRTABLE_PAT: '', // 若此腳本在 Airtable Automation 內執行，可不填；如需測試 API，可填 PAT
  MAPBOX_TOKEN: '',
  AUTO_DISPATCH_HEALTH_URL: 'https://your-edge-function/auto-dispatch/health',
  CHAT_SERVER_HEALTH_URL: 'https://your-chat-server/health',
  CHAT_SERVER_RESTART_URL: 'https://your-chat-server/admin/restart',
  LINE_NOTIFY_TOKEN: '',
  SYSTEM_VERSION: '1.0.0',
};

// ---- 工具：HTTP Fetch with timeout ----
async function ping(url, { method = 'GET', headers = {}, timeoutMs = 6000 } = {}) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { method, headers, signal: controller.signal });
    clearTimeout(timer);
    const ms = Date.now() - start;
    return { ok: res.status >= 200 && res.status < 300, statusCode: res.status, ms };
  } catch (e) {
    const ms = Date.now() - start;
    return { ok: false, statusCode: 0, ms, error: e?.message || 'Fetch error' };
  }
}

// ---- 確保資料表與欄位 ----
async function ensureTableAndFields() {
  const tables = base.tables;
  let monitor = tables.find(t => t.name === 'System_Monitor');
  let log = tables.find(t => t.name === 'System_Log');

  if (!monitor) {
    monitor = await base.createTable('System_Monitor', [
      { name: 'service_name', type: 'singleLineText' },
      { name: 'status', type: 'singleSelect', options: { choices: [ { name: '正常' }, { name: '延遲' }, { name: '錯誤' } ] } },
      { name: 'last_check_time', type: 'dateTime' },
      { name: 'response_time', type: 'number', options: { precision: 0 } },
      { name: 'error_log', type: 'multilineText' },
      { name: 'uptime', type: 'percent' },
      { name: 'version', type: 'singleLineText' },
    ]);
  }

  const needMonitorFields = [ 'service_name', 'status', 'last_check_time', 'response_time', 'error_log', 'uptime', 'version' ];
  for (const f of needMonitorFields) {
    if (!monitor.getFieldByNameIfExists(f)) {
      // 由於 Automation 無法直接加欄位型別，這裡略過；請手動建立必要欄位或於 Scripting App 執行結構修復腳本
    }
  }

  if (!log) {
    log = await base.createTable('System_Log', [
      { name: 'timestamp', type: 'dateTime' },
      { name: 'event', type: 'singleSelect', options: { choices: [ { name: 'monitor_ping' }, { name: 'alert_sent' }, { name: 'auto_repair_started' }, { name: 'auto_repair_completed' }, { name: 'error' } ] } },
      { name: 'details', type: 'multilineText' },
      { name: 'service_name', type: 'singleLineText' },
      { name: 'severity', type: 'singleSelect', options: { choices: [ { name: 'info' }, { name: 'warning' }, { name: 'error' } ] } },
      { name: 'status', type: 'singleLineText' },
      { name: 'response_time', type: 'number', options: { precision: 0 } },
    ]);
  }
  return { monitor, log };
}

// ---- 計算最近 24 小時 uptime（以 monitor_ping 正常占比估算）----
async function computeUptime24h(logTable, serviceName) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const records = await logTable.selectRecordsAsync();
  const filtered = records.records.filter(r => {
    const ts = r.getCellValue('timestamp');
    const ev = r.getCellValue('event');
    const name = r.getCellValue('service_name');
    return ts && new Date(ts).toISOString() >= since && ev?.name === 'monitor_ping' && name === serviceName;
  });
  const total = filtered.length;
  const ok = filtered.filter(r => (r.getCellValue('status') || '').includes('正常')).length;
  const uptime = total > 0 ? Math.round((ok / total) * 10000) / 100 : 100; // 百分比，兩位小數
  return uptime;
}

// ---- 發送 LINE Notify ----
async function sendLineNotify(message) {
  if (!CONFIG.LINE_NOTIFY_TOKEN) return;
  try {
    const res = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${CONFIG.LINE_NOTIFY_TOKEN}`,
      },
      body: new URLSearchParams({ message }).toString(),
    });
  } catch (e) {
    output.markdown(`LINE Notify 發送失敗：${e?.message}`);
  }
}

// ---- 主程式 ----
const { monitor, log } = await ensureTableAndFields();
const modules = [
  { name: 'Glide Passenger App', url: CONFIG.GLIDE_PASSENGER_URL },
  { name: 'Glide Driver App', url: CONFIG.GLIDE_DRIVER_URL },
  { name: 'Airtable API 連線', url: 'https://api.airtable.com/v0/meta/bases', headers: CONFIG.AIRTABLE_PAT ? { Authorization: `Bearer ${CONFIG.AIRTABLE_PAT}` } : {} },
  { name: '地圖 API', url: CONFIG.MAPBOX_TOKEN ? `https://api.mapbox.com/styles/v1/mapbox/streets-v11?access_token=${CONFIG.MAPBOX_TOKEN}` : 'https://tile.openstreetmap.org/0/0/0.png' },
  { name: '派單模組（Auto-Dispatch）', url: CONFIG.AUTO_DISPATCH_HEALTH_URL },
  { name: '即時通訊（Chat Server）', url: CONFIG.CHAT_SERVER_HEALTH_URL, repairUrl: CONFIG.CHAT_SERVER_RESTART_URL },
];

const summary = { ok: [], slow: [], bad: [] };
for (const m of modules) {
  const start = Date.now();
  let status = '正常';
  let error_log = '';
  if (!m.url) {
    status = '錯誤';
    error_log = '未設定健康檢查 URL';
  } else {
    const r = await ping(m.url, { headers: m.headers || {} });
    const ms = r.ms;
    if (!r.ok) { status = '錯誤'; error_log = `HTTP ${r.statusCode}`; }
    else if (ms > 5000) { status = '錯誤'; error_log = `反應時間過長：${ms}ms`; }
    else if (ms > 2000) { status = '延遲'; }

    const record = {
      service_name: m.name,
      status,
      last_check_time: new Date().toISOString(),
      response_time: ms,
      error_log,
      version: CONFIG.SYSTEM_VERSION,
    };

    // 更新最新狀態
    const query = await monitor.selectRecordsAsync();
    const exist = query.records.find(r => r.getCellValue('service_name') === m.name);
    if (exist) {
      await monitor.updateRecordAsync(exist, record);
    } else {
      await monitor.createRecordAsync(record);
    }

    // 寫入 Log
    await log.createRecordAsync({
      timestamp: new Date().toISOString(),
      event: { name: 'monitor_ping' },
      details: error_log,
      service_name: m.name,
      severity: { name: status === '正常' ? 'info' : status === '延遲' ? 'warning' : 'error' },
      status,
      response_time: ms,
    });

    // 告警
    if (status === '錯誤' || ms > 5000) {
      await sendLineNotify(`【BF黑羽 系統警報】\n服務：${m.name}\n狀態：${status}\n反應時間：${ms}ms\n錯誤：${error_log}\n時間：${new Date().toLocaleString()}`);
      // 若要 Email，請在 Automation 增加「Send Email」動作，收件人填管理員
    }

    // 24h uptime 計算，寫入 monitor.uptime
    const uptime = await computeUptime24h(log, m.name);
    await monitor.updateRecordAsync(
      (await monitor.selectRecordsAsync()).records.find(r => r.getCellValue('service_name') === m.name),
      { uptime }
    );

    if (status === '正常') summary.ok.push(m.name);
    else if (status === '延遲') summary.slow.push(m.name);
    else summary.bad.push(m.name);
  }
}

// 輸出摘要
output.markdown(`✅ 正常：${summary.ok.join(', ') || '（無）'}`);
output.markdown(`⚠️ 延遲：${summary.slow.join(', ') || '（無）'}`);
output.markdown(`❌ 錯誤：${summary.bad.join(', ') || '（無）'}`);
output.markdown(`🕒 下次自動檢查時間：約 ${new Date(Date.now() + 5*60*1000).toLocaleString()}`);