import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const AIRTABLE_API_URL = "https://api.airtable.com/v0";
const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TOKEN =
  process.env.AIRTABLE_API_KEY ||
  process.env.AIRTABLE_PAT ||
  process.env.AIRTABLE_TOKEN;

if (!BASE_ID || !TOKEN) {
  console.error("❌ 錯誤：未設定 AIRTABLE_BASE_ID 或 TOKEN，請確認 .env");
  process.exit(1);
}

// ✅ 健康檢查 API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Backend is running" });
});

// ✅ 取得所有司機資料（含多頁）
app.get("/api/drivers", async (req, res) => {
  try {
    let records = [];
    let offset = null;

    do {
      const url = `${AIRTABLE_API_URL}/${BASE_ID}/Drivers?${offset ? `offset=${offset}` : ""}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      records = records.concat(response.data.records);
      offset = response.data.offset;
    } while (offset);

    res.json(records);
  } catch (err) {
    console.error("❌ Fetch drivers failed:", err.message);
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
});

// ✅ 建立訂單
app.post("/api/order", async (req, res) => {
  const { passengerName, pickup, dropoff, distance, duration } = req.body;
  const fare = 70 + distance * 15 + duration * 3;

  try {
    const response = await axios.post(
      `${AIRTABLE_API_URL}/${BASE_ID}/Orders`,
      {
        fields: {
          PassengerName: passengerName,
          PickupLocation: pickup,
          DropoffLocation: dropoff,
          Distance: distance,
          Duration: duration,
          Fare: fare,
          Status: "待派單",
        },
      },
      {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }
    );

    res.json({
      message: "Order created successfully",
      orderId: response.data.id,
      fare,
    });
  } catch (err) {
    console.error("❌ Create order failed:", err.message);
    res.status(500).json({ error: "Failed to create order" });
  }
});

app.listen(PORT, () => {
  console.log(`🚗 Backend server running on http://localhost:${PORT}`);
});
