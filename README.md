# Black Feather 車隊管理系統

一個功能完整的白牌車隊管理系統，實現類似 Uber 的叫車服務，具備完整的商業營運能力。

## 🌐 線上部署

**部署網址**: https://xhzlo16txn5o.space.minimax.io

## 📱 系統功能

### 🚗 核心功能
- **自動派車系統** - 智能分配最適合的司機
- **實時訂單管理** - 即時訂單狀態更新
- **多角色管理** - 乘客、司機、管理員三端整合
- **數據統計分析** - 營收、訂單、司機狀態統計
- **即時通訊** - WebSocket 實時狀態同步

### 👥 用戶角色

#### 🧑‍💼 乘客端
- 快速叫車（輸入上下車地點）
- 自動司機分配
- 訂單狀態追蹤
- 歷史訂單查看
- 費用明細

#### 🚘 司機端
- 狀態管理（閒置/忙碌/離線）
- 接收新訂單
- 完成訂單功能
- 收入統計
- 歷史訂單記錄

#### 👨‍💼 管理員端
- 車隊總覽統計
- 司機狀態監控
- 訂單管理
- 營收分析
- 即時系統監控
- 警示系統

## 🎯 快速體驗

### 測試帳號

#### 乘客帳號
- **劉小明**: `0987654001`
- **蔡美麗**: `0987654002`

#### 司機帳號
- **張大明**: `0912345001`
- **李小華**: `0912345002`
- **王美麗**: `0912345003`
- **林玉珍**: `0912345005`

#### 管理員帳號
- **系統管理員**: `0900000000`

### 🔄 完整體驗流程

1. **乘客叫車**:
   - 使用乘客帳號登入
   - 輸入上車地點（如：台北車站）
   - 輸入下車地點（如：松山機場）
   - 點擊「立即叫車」

2. **司機接單**:
   - 使用司機帳號登入
   - 確認狀態為「閒置」
   - 查看接收到的訂單
   - 完成訂單

3. **管理監控**:
   - 使用管理員帳號登入
   - 查看司機狀態
   - 監控訂單流程
   - 查看營收統計

## 🏗️ 技術架構

### 前端技術
- **React 18** - 現代化前端框架
- **Vite** - 快速構建工具
- **TailwindCSS** - 原子化 CSS 框架
- **shadcn/ui** - 現代化 UI 組件庫
- **React Router** - 前端路由管理
- **Socket.io Client** - 實時通訊

### 後端技術
- **Node.js + Express** - 後端服務框架
- **Socket.io** - WebSocket 實時通訊
- **JSON 文件儲存** - 輕量化數據存儲
- **RESTful API** - 標準化 API 設計

### 設計特色
- **深色專業主題** - 適合長時間營運使用
- **響應式設計** - 支援桌面和移動設備
- **即時狀態指示器** - 清晰的視覺反饋
- **直觀操作界面** - 簡化的工作流程

## 🚀 本地開發

### 環境要求
- Node.js 16+
- npm 或 yarn

### 安裝步驟

```bash
# 克隆項目
git clone <repository-url>
cd black-feather-taxi

# 安裝依賴
npm install

# 初始化演示數據
node server/data/demo-setup.js

# 啟動後端服務器
npm run server

# 新終端窗口，啟動前端開發服務器
npm run dev
```

### 環境配置

項目包含以下環境文件：
- `.env` - 基礎配置
- `.env.local` - 本地開發配置

## 📡 API 接口

### 核心 API

#### 叫車與派車
```http
POST /ride/request
Content-Type: application/json

{
  "passengerPhone": "0987654001",
  "pickup": "台北車站",
  "dropoff": "松山機場"
}
```

#### 完成訂單
```http
POST /ride/complete
Content-Type: application/json

{
  "orderId": "ORDER_1234567890",
  "driverPhone": "0912345001"
}
```

#### 司機狀態查詢
```http
GET /drivers/status
```

#### 更新司機狀態
```http
POST /driver/{phone}/status
Content-Type: application/json

{
  "status": "idle" // idle, busy, offline
}
```

### 數據結構

#### 用戶資料
```json
{
  "role": "driver",
  "name": "張大明",
  "status": "idle",
  "vehicle": {
    "plate": "ABC-1234",
    "model": "Toyota Camry",
    "color": "白色"
  },
  "rating": 4.8,
  "totalTrips": 156
}
```

#### 訂單資料
```json
{
  "id": "ORDER_1696492800_abc123def",
  "passengerPhone": "0987654001",
  "driverPhone": "0912345001",
  "driverName": "張大明",
  "pickup": "台北車站",
  "dropoff": "松山機場",
  "status": "pending",
  "estimatedPrice": 150,
  "createdAt": "2024-10-05T10:00:00.000Z"
}
```

## 🎨 界面設計

### 設計原則
- **深色商務風格** - 專業且易於長時間使用
- **狀態清晰指示** - 用顏色和圖標明確顯示狀態
- **資訊層次分明** - 重要資訊突出顯示
- **操作流程順暢** - 減少不必要的點擊和等待

### 色彩系統
- **綠色** - 閒置、可用、成功狀態
- **黃色** - 忙碌、處理中狀態
- **紅色** - 離線、錯誤狀態
- **藍色** - 已完成、資訊狀態
- **紫色** - 主題色、重要操作

## 🔧 自定義配置

### 修改端口
```javascript
// server/index.js
const PORT = process.env.PORT || 3001;
```

### 添加新司機
```javascript
// server/data/demo-setup.js
const newDriver = {
  phone: '0912345999',
  profile: {
    role: 'driver',
    name: '新司機',
    status: 'offline',
    vehicle: {
      plate: 'NEW-1234',
      model: 'Honda Civic',
      color: '藍色'
    }
  }
};
```

### 修改計費規則
```javascript
// server/index.js - requestRide 函數中
estimatedPrice: calculatePrice(pickup, dropoff) // 自定義計算函數
```

## 📊 商業價值

### 營運優勢
- ✅ **即時派車** - 自動化分配，提高效率
- ✅ **狀態透明** - 實時監控，減少糾紛
- ✅ **數據驅動** - 完整統計，支持決策
- ✅ **擴展性強** - 模組化設計，易於擴展
- ✅ **成本控制** - 無需額外硬體，軟體解決方案

### 收益模式
- 📈 **抽成模式** - 每筆訂單收取一定比例費用
- 📈 **會員制度** - 司機月費或年費
- 📈 **廣告收入** - 在應用中投放廣告
- 📈 **數據服務** - 提供市場分析報告

## 🛠️ 運維建議

### 日常監控
- 定期檢查司機在線率
- 監控訂單完成率
- 關注系統響應時間
- 檢查錯誤日誌

### 擴展建議
- 添加地圖集成（Google Maps API）
- 實現推送通知功能
- 添加評價系統
- 集成支付系統
- 實現 GPS 定位追蹤

## 📞 技術支持

如有技術問題或商業合作需求，請通過以下方式聯繫：

- 📧 Email: support@blackfeather-taxi.com
- 💬 技術諮詢: 請在 GitHub Issues 中提交
- 📱 商業洽談: 請通過官方網站聯繫表單

## 📄 許可證

本項目採用 MIT 許可證，詳見 [LICENSE](LICENSE) 文件。

---

**Black Feather 車隊管理系統** - 讓叫車服務更智能、更高效！ 🚗💨

---

## ☁️ 部署（Vercel + Supabase）

### 前端環境變數（Vite / Vercel）
- `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（Supabase 連線）
- `VITE_GOOGLE_MAPS_API_KEY`（Google Maps JS API）
- `VITE_PUBLIC_APP_URL`（站點 URL，供備援 REST/健康檢查）
  
### Edge Functions / 伺服端環境變數
- `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（Functions 連線 Supabase）
- `JWT_SECRET`（自訂 JWT 用於 Functions 授權與相互呼叫）

設定示例：
```bash
supabase secrets set JWT_SECRET=your-strong-secret
supabase secrets set SUPABASE_URL=https://<PROJECT>.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
```

`vercel.json` 已包含上述鍵名，請於 Vercel Project Settings 填入值。

### Edge Functions / 伺服端環境變數
- `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`（Functions 連線 Supabase）
- `JWT_SECRET`（自訂 JWT 用於 Functions 授權與相互呼叫）

### 部署步驟
1. 建立 Supabase 專案，啟用 Realtime；套用資料表（drivers/passengers/rides）與 RLS。
2. 於 Supabase CLI 部署 Functions：
   - `supabase functions deploy request-ride`（建立 requested 訂單並觸發 auto-dispatch）
   - `supabase functions deploy auto-dispatch`（挑選最近司機、更新 assigned）
   - 可選：`update-driver-status`、`get-user-rides`、`cancel-ride`、`complete-ride`、`reject-assignment`
3. 設定 Vercel 環境變數並部署前端。
4. 本地驗證：`npm run preview` 啟動前端，登入取得 `bf_auth_token`，於乘客頁執行叫車流程。
