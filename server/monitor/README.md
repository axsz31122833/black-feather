# BF 黑羽派車系統 - 健康監控服務

本服務每 5 分鐘偵測核心模組狀態，將結果寫入 Airtable 的 System_Monitor（最新狀態）與 System_Log（紀錄），並在異常時發出告警與嘗試快速修復。

## 安裝與啟動

1. 在 `black-feather-taxi/.env.local` 填入以下環境變數（可參考 `.env.local.example`）：

```
AIRTABLE_PAT=pat-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX
AIRTABLE_SYSTEM_MONITOR_TABLE=System_Monitor
AIRTABLE_SYSTEM_LOG_TABLE=System_Log
GLIDE_PASSENGER_URL=https://your-glide-passenger-app-url
GLIDE_DRIVER_URL=https://your-glide-driver-app-url
AUTO_DISPATCH_HEALTH_URL=https://your-edge-function/auto-dispatch/health
CHAT_SERVER_HEALTH_URL=https://your-chat-server/health
CHAT_SERVER_RESTART_URL=https://your-chat-server/admin/restart
MAPBOX_TOKEN=
LINE_NOTIFY_TOKEN=
ALERT_EMAIL_FROM=monitor@bf-black-feather.local
ALERT_EMAIL_TO=admin@example.com
ALERT_EMAIL_SMTP_HOST=smtp.example.com
ALERT_EMAIL_SMTP_PORT=465
ALERT_EMAIL_SMTP_USER=monitor@example.com
ALERT_EMAIL_SMTP_PASS=change-me
MONITOR_INTERVAL_MS=300000
QUICK_REPAIR_ENABLED=true
SYSTEM_VERSION=1.0.0
```

2. 安裝依賴並啟動：

```
npm install
npm run monitor
```

## 監控範圍

- Glide Passenger App（乘客端）
- Glide Driver App（司機端）
- Airtable API 連線
- 地圖 API（Mapbox / OpenStreetMap）
- 派單模組（Auto-Dispatch）
- 即時通訊（Chat Server）

## 告警條件

- response_time > 5000ms 或狀態為「錯誤」：
  - 寫入 `System_Log`
  - 發送 LINE Notify / Email（如果已設定）

## 自動修復

- 若某模組持續「錯誤」超過 10 分鐘，將觸發快速修復：
  - Chat Server：呼叫 `CHAT_SERVER_RESTART_URL`（若已設定）
  - 可擴充其他模組的 `repair()` 實作
  - 修復開始/完成會寫入 `System_Log`

## Glide 儀表板建議

- 新增「系統監控」頁面：
  - 來源表：`System_Monitor`
  - 顯示卡片或清單：service_name、status（綠/橙/紅）、response_time、last_check_time、error_log（若有）
  - 加入 1 分鐘自動刷新（Glide -> Actions -> Refresh Data 或使用可視化計時器觸發）
  - Uptime 折線圖（最近 24 小時）：
    - 來源表：`System_Log`，過濾 event = `monitor_ping`
    - 分組統計每小時正常比例，使用 Chart 元件繪製折線圖

## 備註

- 若不希望在本機常駐，可改用 Airtable Automation（每 5 分鐘觸發 Run Script），腳本可參考專案提供的 `airtable-automation-monitor.js` 片段（將在助理訊息中提供）。