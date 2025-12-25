API 測試樣本與說明

概述
- 本文件提供後端 API 的常用端點、請求與回應範例，以及常見錯誤與排錯建議。
- 基本 Base URL：預設 http://localhost:3001；亦可透過環境變數 PUBLIC_APP_URL 或 VITE_PUBLIC_APP_URL 覆寫。

環境變數
- PUBLIC_APP_URL：後端服務位址（例如 http://localhost:3001）。
- PASSENGER_PHONE：測試用乘客手機（預設 0987654001）。
- DRIVER_PHONE：測試用司機手機（預設 090000001）。
- PASSENGER_NAME / DRIVER_NAME：測試用暱稱（預設為中文顯示）。

端點與範例
1) 健康檢查
   GET /api/health
   成功回應：{"status":"ok","data":null}

2) 發送 OTP（簡化測試）
   POST /auth/send-otp
   Body：{ phone, role, name }
   成功回應：{ success: true, verificationCode: "123456" }（實際欄位可能為 code 或 verificationCode）

3) 驗證手機（OTP）
   POST /auth/verify-phone
   Body：{ phone, verificationCode }
   成功回應：{ success: true }

4) 登入
   POST /auth/login
   Body：{ phone, role, name }
   成功回應：{ success: true, userId: "090000001", role: "driver" }

5) 叫車
   POST /ride/request
   Body：{ passengerPhone, pickup: {lat,lng}, dropoff: {lat,lng} }
   成功回應：{ success: true, order: {...}, driver: {...}, message }
   備註：回應同時會包含指派的司機（driver），或在 order 裡提供 driverPhone。完成訂單時建議優先使用回應中的司機電話。

6) 完成訂單
   POST /ride/complete
   Body：{ orderId, driverPhone }
   成功回應：{ success: true, order: {...}, message }

常見錯誤與排錯
- 連線失敗（ECONNREFUSED）
  原因：後端服務未啟動或 Base URL 設定錯誤。
  處置：確認 npm run server 是否在執行，或將 PUBLIC_APP_URL 指向正確位址（例如 http://localhost:3001）。

- 404 找不到訂單
  原因：傳入的 orderId 不存在，或完成訂單需搭配正確的 driverPhone。
  處置：於叫車回應中取得指派的司機電話（driver.phone 或 order.driverPhone），再用該號碼完成訂單。

- Airtable 驗證失敗（Invalid authentication token）
  原因：僅限需要 Airtable 的腳本（例如 full-flow-test.mjs、airtable-* 系列）。
  處置：於 .env 設定 AIRTABLE_PAT、AIRTABLE_BASE_ID 等正確憑證；僅後端 API 的 E2E 不需要 Airtable。

PowerShell 範例
- 已提供 scripts/api-samples.ps1，可直接設定 PUBLIC_APP_URL 後執行。
- 範例流程：健康檢查 → 乘客與司機發送/驗證 OTP → 登入 → 叫車 → 以回應中之司機電話完成訂單。