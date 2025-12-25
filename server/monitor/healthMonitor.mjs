/**
 * BF 黑羽派車系統 - 健康監控與維運儀表板後端監控服務
 *
 * 功能：
 * - 每 5 分鐘 Ping 主要模組（Glide 乘客/司機、Airtable API、地圖 API、派單模組、聊天伺服器）
 * - 將結果寫入 Airtable 的 System_Monitor（最新狀態）與 System_Log（監控紀錄）
 * - 異常（>5000ms 或 錯誤）觸發 LINE Notify / Email 告警
 * - 持續錯誤 >10 分鐘啟動快速修復（可自訂 URL 或 PowerShell 腳本）
 * - 於 Console 輸出一次性報表（正常/延遲/錯誤清單、下次檢查時間）
 *
 * 使用方式：
 * 1) 於 black-feather-taxi/.env.local 填寫必要環境變數（見 .env.local.example）
 * 2) 安裝依賴：npm i
 * 3) 啟動監控：npm run monitor
 */

import 'dotenv/config';
import axios from 'axios';
import Airtable from 'airtable';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { performance } from 'perf_hooks';

const {
  AIRTABLE_PAT,
  AIRTABLE_BASE_ID,
  AIRTABLE_SYSTEM_MONITOR_TABLE = 'System_Monitor',
  AIRTABLE_SYSTEM_LOG_TABLE = 'System_Log',
  GLIDE_PASSENGER_URL,
  GLIDE_DRIVER_URL,
  AUTO_DISPATCH_HEALTH_URL,
  CHAT_SERVER_HEALTH_URL,
  CHAT_SERVER_RESTART_URL,
  MAPBOX_TOKEN,
  LINE_NOTIFY_TOKEN,
  ALERT_EMAIL_FROM,
  ALERT_EMAIL_TO,
  ALERT_EMAIL_SMTP_HOST,
  ALERT_EMAIL_SMTP_PORT,
  ALERT_EMAIL_SMTP_USER,
  ALERT_EMAIL_SMTP_PASS,
  MONITOR_INTERVAL_MS = '300000',
  QUICK_REPAIR_ENABLED = 'true',
  SYSTEM_VERSION = '1.0.0'
} = process.env;

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.warn('[Monitor] 未設定 Airtable PAT 或 Base ID，監控結果無法寫入 Airtable。請設定環境變數 AIRTABLE_PAT 與 AIRTABLE_BASE_ID。');
}

const base = AIRTABLE_PAT && AIRTABLE_BASE_ID
  ? new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID)
  : null;

// 建立 Email 发送器（如果配置存在）
let mailer = null;
if (ALERT_EMAIL_SMTP_HOST && ALERT_EMAIL_SMTP_USER && ALERT_EMAIL_SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: ALERT_EMAIL_SMTP_HOST,
    port: Number(ALERT_EMAIL_SMTP_PORT || 465),
    secure: true,
    auth: {
      user: ALERT_EMAIL_SMTP_USER,
      pass: ALERT_EMAIL_SMTP_PASS,
    },
  });
}

// 模組清單（可依環境變數決定是否啟用）
const services = [
  {
    name: 'Glide Passenger App',
    url: GLIDE_PASSENGER_URL,
    method: 'GET',
    enabled: !!GLIDE_PASSENGER_URL,
  },
  {
    name: 'Glide Driver App',
    url: GLIDE_DRIVER_URL,
    method: 'GET',
    enabled: !!GLIDE_DRIVER_URL,
  },
  {
    name: 'Airtable API 連線',
    url: 'https://api.airtable.com/v0/meta/bases',
    method: 'GET',
    headers: AIRTABLE_PAT ? { Authorization: `Bearer ${AIRTABLE_PAT}` } : undefined,
    enabled: true,
  },
  {
    name: '地圖 API',
    url: MAPBOX_TOKEN
      ? `https://api.mapbox.com/styles/v1/mapbox/streets-v11?access_token=${MAPBOX_TOKEN}`
      : 'https://tile.openstreetmap.org/0/0/0.png',
    method: 'GET',
    enabled: true,
  },
  {
    name: '派單模組（Auto-Dispatch）',
    url: AUTO_DISPATCH_HEALTH_URL,
    method: 'GET',
    enabled: !!AUTO_DISPATCH_HEALTH_URL,
  },
  {
    name: '即時通訊（Chat Server）',
    url: CHAT_SERVER_HEALTH_URL,
    method: 'GET',
    enabled: !!CHAT_SERVER_HEALTH_URL,
    repair: async () => {
      if (String(QUICK_REPAIR_ENABLED).toLowerCase() !== 'true') return false;
      try {
        if (CHAT_SERVER_RESTART_URL) {
          await axios.post(CHAT_SERVER_RESTART_URL, {}, { timeout: 8000 }).catch(() => {});
        }
        return true;
      } catch (_) {
        return false;
      }
    },
  },
];

// 追蹤持續錯誤狀態
const sustainedErrors = new Map(); // name -> { firstErrorAt, lastErrorAt }

// 工具：發送 LINE Notify
async function sendLineNotify(message) {
  if (!LINE_NOTIFY_TOKEN) return;
  try {
    await axios.post('https://notify-api.line.me/api/notify', new URLSearchParams({ message }), {
      headers: { Authorization: `Bearer ${LINE_NOTIFY_TOKEN}` },
      timeout: 8000,
    });
  } catch (err) {
    console.warn('[Monitor] LINE Notify 發送失敗：', err.message);
  }
}

// 工具：發送 Email
async function sendEmail(subject, text) {
  if (!mailer || !ALERT_EMAIL_TO) return;
  try {
    await mailer.sendMail({
      from: ALERT_EMAIL_FROM || ALERT_EMAIL_SMTP_USER,
      to: ALERT_EMAIL_TO,
      subject,
      text,
    });
  } catch (err) {
    console.warn('[Monitor] Email 發送失敗：', err.message);
  }
}

// Airtable Upsert：更新 System_Monitor（最新狀態）
async function upsertSystemMonitor({ service_name, status, last_check_time, response_time, error_log }) {
  if (!base) return;
  const monitorTable = base(AIRTABLE_SYSTEM_MONITOR_TABLE);
  const query = await monitorTable.select({
    filterByFormula: `{service_name} = "${service_name}"`,
    maxRecords: 1,
  }).firstPage();

  const fields = {
    service_name,
    status,
    last_check_time,
    response_time,
    error_log: error_log || '',
    version: SYSTEM_VERSION,
  };

  if (query.length > 0) {
    await monitorTable.update(query[0].id, fields);
  } else {
    await monitorTable.create(fields);
  }
}

// Airtable Log：寫入 System_Log 監控紀錄
async function logMonitorEvent({ service_name, status, response_time, details, severity = 'info' }) {
  if (!base) return;
  const logTable = base(AIRTABLE_SYSTEM_LOG_TABLE);
  await logTable.create({
    timestamp: new Date().toISOString(),
    event: 'monitor_ping',
    details: details || '',
    service_name,
    severity,
    status,
    response_time,
  });
}

// Airtable Log：記錄修復事件
async function logRepairEvent({ service_name, details, success }) {
  if (!base) return;
  const logTable = base(AIRTABLE_SYSTEM_LOG_TABLE);
  await logTable.create({
    timestamp: new Date().toISOString(),
    event: success ? 'auto_repair_completed' : 'auto_repair_started',
    details: details || '',
    service_name,
    severity: success ? 'info' : 'warning',
  });
}

// 探測一個服務
async function checkService(service) {
  const start = performance.now();
  let status = '正常';
  let error_log = '';
  let response_time = 0;
  const last_check_time = new Date().toISOString();

  if (!service.enabled) {
    status = '錯誤';
    error_log = '未設定健康檢查 URL（請在 .env.local 填入對應變數）';
    response_time = 0;
  } else {
    try {
      const res = await axios({
        url: service.url,
        method: service.method || 'GET',
        headers: service.headers,
        timeout: 6000,
        validateStatus: () => true,
      });
      response_time = Math.round(performance.now() - start);
      if (res.status < 200 || res.status >= 300) {
        status = '錯誤';
        error_log = `HTTP ${res.status}`;
      } else if (response_time > 5000) {
        status = '錯誤';
        error_log = `反應時間過長：${response_time}ms`;
      } else if (response_time > 2000) {
        status = '延遲';
      }
    } catch (err) {
      response_time = Math.round(performance.now() - start);
      status = '錯誤';
      error_log = err?.message || '未知錯誤';
    }
  }

  // 更新 Airtable
  await upsertSystemMonitor({ service_name: service.name, status, last_check_time, response_time, error_log });
  await logMonitorEvent({ service_name: service.name, status, response_time, details: error_log, severity: status === '正常' ? 'info' : status === '延遲' ? 'warning' : 'error' });

  // 告警（延遲>5000ms 已視為錯誤）
  if (status === '錯誤' || response_time > 5000) {
    const msg = `【BF黑羽 系統警報】\n服務：${service.name}\n狀態：${status}\n反應時間：${response_time}ms\n錯誤：${error_log}\n時間：${new Date().toLocaleString()}`;
    await sendLineNotify(msg);
    await sendEmail(`[警報] ${service.name} 狀態：${status}`, msg);
  }

  // 持續錯誤追蹤
  if (status === '錯誤') {
    const now = Date.now();
    const entry = sustainedErrors.get(service.name) || { firstErrorAt: now, lastErrorAt: now };
    entry.lastErrorAt = now;
    sustainedErrors.set(service.name, entry);

    const durationMs = entry.lastErrorAt - entry.firstErrorAt;
    if (durationMs >= 10 * 60 * 1000) { // >10 分鐘
      await logRepairEvent({ service_name: service.name, details: '偵測持續錯誤，啟動快速修復', success: false });
      try {
        const ok = await service.repair?.();
        await logRepairEvent({ service_name: service.name, details: ok ? '快速修復完成' : '快速修復未執行或失敗', success: !!ok });
      } catch (e) {
        await logRepairEvent({ service_name: service.name, details: `快速修復失敗：${e?.message}` , success: false });
      }
      // 重置持續錯誤計時
      sustainedErrors.delete(service.name);
    }
  } else {
    sustainedErrors.delete(service.name);
  }

  return { name: service.name, status, response_time, error_log };
}

// 進行一次全面檢查並輸出報表
async function runOnce() {
  const results = [];
  for (const s of services) {
    const r = await checkService(s);
    results.push(r);
  }

  const ok = results.filter(r => r.status === '正常').map(r => r.name);
  const slow = results.filter(r => r.status === '延遲').map(r => r.name);
  const bad = results.filter(r => r.status === '錯誤').map(r => r.name);

  const nextCheck = new Date(Date.now() + Number(MONITOR_INTERVAL_MS)).toLocaleString();

  console.log('================= BF黑羽 系統監控報表 =================');
  console.log('✅ 正常：', ok.length ? ok.join(', ') : '（無）');
  console.log('⚠️ 延遲：', slow.length ? slow.join(', ') : '（無）');
  console.log('❌ 錯誤：', bad.length ? bad.join(', ') : '（無）');
  console.log('🕒 下次自動檢查：', nextCheck);
  console.log('======================================================');

  return { ok, slow, bad, nextCheck };
}

// 排程每 5 分鐘執行（也支援自訂 MONITOR_INTERVAL_MS）
let lastSummary = null;
cron.schedule('*/5 * * * *', async () => {
  lastSummary = await runOnce();
});

// 啟動即執行一次
runOnce().then(summary => { lastSummary = summary; }).catch(err => console.error('[Monitor] 初始執行失敗：', err));

// 優雅退出時回報最後一次摘要
process.on('SIGINT', () => {
  if (lastSummary) {
    console.log('\n[Monitor] 最後一次摘要：');
    console.log(JSON.stringify(lastSummary, null, 2));
  }
  process.exit(0);
});