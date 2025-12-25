# Black Feather Taxi Backend API

Node.js + Express + pg-promise + PostGIS 的後端 API，提供白牌車隊叫車核心功能。

## 功能概述

- POST /rides/request：乘客提出叫車，系統自動派最近且 idle 的司機並建立行程（dispatched），同時將司機狀態改為 busy。
- POST /rides/accept：司機接受行程（accepted）。
- POST /rides/start：行程開始（ongoing）。
- POST /rides/complete：行程完成（completed），司機狀態回復 idle。
- GET /drivers/nearby：回傳附近司機（依距離排序）。
- POST /rides/cancel：取消行程。若司機已到站超過 3 分鐘則回覆需確認（confirm=true, fee=100），否則直接取消並將司機回 idle。
- POST /rides/driver-arrived：司機到站回報，記錄 driver_arrived_at。
- POST /drivers/online：司機上線並定位（更新 lat/lng、狀態 idle）。
- POST /drivers/update_location：更新司機定位（不變更狀態）。
- POST /auth/register：註冊乘客/司機/超級管理員（司機需邀請碼，乘客免邀請碼，超級管理員 phone=0982214855 免邀請碼）。

所有 API 皆以 JSON 回傳。

## 資料庫需求

已安裝 PostgreSQL + PostGIS，並存在以下資料表欄位（範例 Schema 僅供參考）：

```sql
-- drivers
CREATE TABLE drivers (
  id SERIAL PRIMARY KEY,
  name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  status TEXT CHECK (status IN ('idle','busy','offline'))
);

-- riders
CREATE TABLE riders (
  id SERIAL PRIMARY KEY,
  name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION
);

-- rides
CREATE TABLE rides (
  id SERIAL PRIMARY KEY,
  rider_id INTEGER REFERENCES riders(id),
  driver_id INTEGER REFERENCES drivers(id),
  status TEXT CHECK (status IN ('requested','dispatched','accepted','ongoing','completed','cancelled')),
  start_lat DOUBLE PRECISION,
  start_lng DOUBLE PRECISION,
  end_lat DOUBLE PRECISION,
  end_lng DOUBLE PRECISION,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);
```

> 注意：距離計算使用 `ST_DistanceSphere(ST_MakePoint(lng, lat), ST_MakePoint(lng, lat))`，請確保 PostGIS 已啟用。

## 專案結構

```
backend/
├── .env.example
├── package.json
├── README.md
└── src/
    ├── config/
    │   └── db.js
    ├── index.js
    ├── middleware/
    │   └── errorHandler.js
    ├── routes/
    │   ├── drivers.js
    │   └── rides.js
    └── services/
        └── ridesService.js
```

## 安裝與啟動

1. 建立環境設定檔 `.env`（可參考 `.env.example`）：

```
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=blackfeather_taxi
PG_USER=postgres
PG_PASSWORD=postgres
PORT=4000
```

2. 安裝依賴：

```
npm install
```

（於 backend 目錄執行）

3. 啟動伺服器：

```
npm start
```

伺服器將在 `http://localhost:4000` 監聽。

## API 測試範例

使用 cURL 測試：

1) 叫車（派最近 idle 司機）

```
curl -i -X POST http://localhost:4000/rides/request \
  -H "Content-Type: application/json" \
  -d '{"rider_id":1, "end_lat":25.0478, "end_lng":121.5319}'
```

回應成功：

```
{
  "message": "Driver dispatched",
  "rider": { "id": 1, "name": "...", "lat": ..., "lng": ... },
  "driver": { "id": 2, "name": "...", "lat": ..., "lng": ... },
  "ride": { "id": 10, "status": "dispatched", ... }
}
```

若沒有可用司機：

```
{ "message": "No idle drivers available" }
```

2) 司機接受行程

```
curl -i -X POST http://localhost:4000/rides/accept \
  -H "Content-Type: application/json" \
  -d '{"ride_id":10, "driver_id":2}'
```

3) 行程開始

```
curl -i -X POST http://localhost:4000/rides/start \
  -H "Content-Type: application/json" \
  -d '{"ride_id":10}'
```

4) 行程完成（司機狀態回 idle）

```
curl -i -X POST http://localhost:4000/rides/complete \
  -H "Content-Type: application/json" \
  -d '{"ride_id":10}'
```

5) 查詢附近司機（預設回 5 位，以距離排序）

```
curl -i "http://localhost:4000/drivers/nearby?lat=25.0478&lng=121.5319&limit=5"
```

6) 取消行程（含 3 分鐘到站提示）

先記錄司機到站（通常由司機端在抵達時呼叫）：

```
curl -i -X POST http://localhost:4000/rides/driver-arrived \
  -H "Content-Type: application/json" \
  -d '{"ride_id":10}'
```

乘客取消：

```
curl -i -X POST http://localhost:4000/rides/cancel \
  -H "Content-Type: application/json" \
  -d '{"ride_id":10}'
```

若回覆 `{ "confirm": true, "fee": 100 }`，代表司機已到達超過 3 分鐘，前端需提示乘客確認。若乘客確認，再次呼叫並帶上 force=true：

```
curl -i -X POST http://localhost:4000/rides/cancel \
  -H "Content-Type: application/json" \
  -d '{"ride_id":10, "force": true}'
```

7) 司機上線並定位

```
curl -i -X POST http://localhost:4000/drivers/online \
  -H "Content-Type: application/json" \
  -d '{"driver_id":2, "lat":25.0478, "lng":121.5319}'
```

8) 更新司機定位（不改變狀態）

```
curl -i -X POST http://localhost:4000/drivers/update_location \
  -H "Content-Type: application/json" \
  -d '{"driver_id":2, "lat":25.0479, "lng":121.5320}'
```

9) 註冊 API

乘客：

```
curl -i -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"role":"rider","name":"小明","phone":"0912345678"}'
```

司機（需邀請碼，0971827628 或 0982214855）：

```
curl -i -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"role":"driver","name":"阿德","phone":"0922333444","invite_code":"0971827628"}'
```

超級管理員（phone=0982214855，免邀請碼）：

```
curl -i -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"role":"driver","name":"管理員","phone":"0982214855"}'
```

## 常見問題

- 若收到 PostGIS 相關錯誤，請確認資料庫已安裝並啟用 PostGIS（`CREATE EXTENSION postgis;`）。
- 距離計算使用 `lng, lat` 順序，請注意參數順序。
- 叫車流程中已使用 CTE 進行司機預留（idle -> busy）以降低併發衝突，但在高併發情境仍建議增加隊列或鎖控策略。

## Railway 雲端部署（選用）

1) 建立 Railway 專案（black-feather-taxi），新增 PostgreSQL 並啟用 PostGIS：

```
CREATE EXTENSION IF NOT EXISTS postgis;
```

2) 建立資料表（若存在則略過），可直接使用本專案的 `sql/schema.sql`：

3) 上傳後端至 Railway：

```
cd backend
git init
railway link
railway up
```

4) 設定環境變數（Railway → Variables）：

```
PG_HOST=<Railway DB HOST>
PG_PORT=<對應 PORT>
PG_DATABASE=<資料庫名稱>
PG_USER=<資料庫使用者>
PG_PASSWORD=<密碼>
PORT=4000
```

5) 重啟服務，取得服務 URL（例如 `https://<railway-app>.up.railway.app`），並驗證健康檢查：

```
curl -i https://<railway-app>.up.railway.app/health
```

請回報：
- ✅ Railway 專案連結
- ✅ 後端 API 部署 URL
- ✅ PostgreSQL 連線 URL
- ✅ /health 測試結果