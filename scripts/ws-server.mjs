import "dotenv/config";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import Airtable from "airtable";

const PORT = Number(process.env.WS_PORT ?? 3010);
const API_KEY = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

let base = null;
if (API_KEY && BASE_ID) {
  try {
    base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);
    console.log("[ws] Airtable base initialized");
  } catch (e) {
    console.warn("[ws] Airtable init failed:", e?.message || e);
  }
} else {
  console.warn("[ws] Missing AIRTABLE_PAT/TOKEN and/or AIRTABLE_BASE_ID; will run without DB writes.");
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

// Track clients with lightweight metadata
const clients = new Set();

function send(ws, event, data) {
  try {
    ws.send(JSON.stringify({ event, data }));
  } catch (_) {}
}

function broadcast(filterFn, event, data) {
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN && (!filterFn || filterFn(ws))) {
      send(ws, event, data);
    }
  }
}

async function upsertDriverLocation({ phone, lat, lng }) {
  if (!base || !phone) return;
  try {
    const filter = `LOWER({Phone}) = '${String(phone).toLowerCase()}'`;
    const found = await base("Drivers").select({ filterByFormula: filter, maxRecords: 1 }).firstPage();
    const fields = {
      "Phone": phone,
      "Current Lat": Number(lat),
      "Current Lng": Number(lng),
      "Last Update": new Date().toISOString(),
      "Is Online": true,
    };
    if (found && found.length) {
      await base("Drivers").update([{ id: found[0].id, fields }], { typecast: true });
    } else {
      await base("Drivers").create([{ fields }], { typecast: true });
    }
  } catch (e) {
    console.warn("[ws] upsert driver location failed:", e?.message || e);
  }
}

async function updateOrderDriverLocation({ orderId, lat, lng }) {
  if (!base || !orderId) return;
  try {
    await base("Orders").update([
      {
        id: orderId,
        fields: {
          "driver_lat": Number(lat),
          "driver_lng": Number(lng),
        },
      },
    ], { typecast: true });
  } catch (e) {
    console.warn("[ws] update order driver coords failed:", e?.message || e);
  }
}

async function markMeterStart({ orderId }) {
  if (!base || !orderId) return;
  try {
    await base("Orders").update([
      {
        id: orderId,
        fields: {
          "Status": "meter_started",
          "meter_start_at": new Date().toISOString(),
        },
      },
    ], { typecast: true });
  } catch (e) {
    console.warn("[ws] meter start failed:", e?.message || e);
  }
}

wss.on("connection", (ws, req) => {
  // Parse role from query string if provided
  try {
    const url = new URL(req.url, "http://localhost");
    const role = url.searchParams.get("role");
    if (role) ws.role = role;
  } catch (_) {}

  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });
  clients.add(ws);

  ws.on("message", async (raw) => {
    let msg = null;
    try {
      msg = JSON.parse(String(raw));
    } catch (_) {
      return;
    }
    const { event, data } = msg || {};

    // Allow clients to register role explicitly
    if (event === "register" && data && data.role) {
      ws.role = data.role;
      return;
    }

    if (event === "driver:update_location") {
      const { phone, lat, lng, orderId } = data || {};
      // Persist driver location to DB (if available)
      upsertDriverLocation({ phone, lat, lng });
      if (orderId) updateOrderDriverLocation({ orderId, lat, lng });
      // Broadcast to passenger clients to update driver marker
      broadcast((c) => c.role === "passenger", "passenger:update_driver_marker", { phone, lat, lng, orderId });
      return;
    }

    if (event === "driver:meter_start") {
      const { orderId } = data || {};
      markMeterStart({ orderId });
      broadcast((c) => c.role === "passenger", "passenger:meter_started", { orderId });
      return;
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});

// Heartbeat to terminate dead connections
const interval = setInterval(() => {
  for (const ws of clients) {
    if (ws.isAlive === false) {
      try { ws.terminate(); } catch (_) {}
      clients.delete(ws);
      continue;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  }
}, 30000);

wss.on("close", () => { clearInterval(interval); });

server.listen(PORT, () => {
  console.log(`[ws] WebSocket server listening on ws://localhost:${PORT}`);
});
