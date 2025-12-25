import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GLOBAL_STORE_PATH = path.join(__dirname, 'data', 'global.json');

// Ensure global store file exists
try {
  const dir = path.dirname(GLOBAL_STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(GLOBAL_STORE_PATH)) {
    const initial = { users: [], profiles: [], orders: [], messages: [], logs: [] };
    fs.writeFileSync(GLOBAL_STORE_PATH, JSON.stringify(initial, null, 2), 'utf8');
  }
} catch (e) {
  console.warn('[globalStore] 初始化全域資料庫失敗', e);
}

export function readGlobalStore() {
  try {
    const raw = fs.readFileSync(GLOBAL_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : []
    };
  } catch (e) {
    console.warn('[globalStore] 讀取失敗，回退為空集合', e);
    return { users: [], profiles: [], orders: [], messages: [], logs: [] };
  }
}

export function writeGlobalStore(store) {
  try {
    const safe = {
      users: Array.isArray(store.users) ? store.users : [],
      profiles: Array.isArray(store.profiles) ? store.profiles : [],
      orders: Array.isArray(store.orders) ? store.orders : [],
      messages: Array.isArray(store.messages) ? store.messages : [],
      logs: Array.isArray(store.logs) ? store.logs : []
    };
    fs.writeFileSync(GLOBAL_STORE_PATH, JSON.stringify(safe, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[globalStore] 寫入失敗', e);
    return false;
  }
}

export function upsertUserToGlobal({ id, phone, password_hash, role = 'passenger', name = '', created_at, remember_me = false }) {
  const store = readGlobalStore();
  const uid = id || String(phone);
  const now = new Date().toISOString();
  const existsIndex = store.users.findIndex(u => String(u.phone) === String(phone));
  const record = {
    id: uid,
    phone: String(phone),
    password_hash: password_hash || null,
    role,
    name: name || `User_${phone}`,
    created_at: created_at || now,
    remember_me: !!remember_me
  };
  if (existsIndex >= 0) {
    store.users[existsIndex] = { ...store.users[existsIndex], ...record };
  } else {
    store.users.push(record);
  }
  writeGlobalStore(store);
  return record;
}

export function upsertProfileToGlobal({ user_id, vehicle_info = null, rating_avg = null, total_orders = 0, current_status = 'idle', location = null }) {
  const store = readGlobalStore();
  const idx = store.profiles.findIndex(p => String(p.user_id) === String(user_id));
  const record = { user_id: String(user_id), vehicle_info, rating_avg, total_orders, current_status, location };
  if (idx >= 0) {
    store.profiles[idx] = { ...store.profiles[idx], ...record };
  } else {
    store.profiles.push(record);
  }
  writeGlobalStore(store);
  return record;
}

export function appendOrderToGlobal(order) {
  const store = readGlobalStore();
  const exists = store.orders.find(o => String(o.id) === String(order.id));
  const normalized = {
    id: order.id,
    passenger_id: order.passengerPhone || order.passenger_id,
    driver_id: order.driverPhone || order.driver_id || null,
    type: order.service_type || order.type || '一般',
    status: order.status,
    start_point: order.pickup || order.pickup_location || null,
    end_point: order.dropoff || order.dropoff_location || null,
    distance_km: order.estimated_distance_meters ? (Number(order.estimated_distance_meters) / 1000) : (order.distance_km || null),
    duration_min: order.estimated_duration_seconds ? (Number(order.estimated_duration_seconds) / 60) : (order.duration_min || null),
    fare_estimate: order.estimatedPrice || order.estimated_price || null,
    fare_final: order.fare_final || null,
    created_at: order.createdAt || order.created_at || new Date().toISOString(),
    assigned_at: order.assigned_at || null,
    completed_at: order.completedAt || order.completed_at || null,
    review: order.review || null
  };
  if (exists) {
    Object.assign(exists, normalized);
  } else {
    store.orders.push(normalized);
  }
  writeGlobalStore(store);
  return normalized;
}

export function updateOrderInGlobal(orderId, patch) {
  const store = readGlobalStore();
  const idx = store.orders.findIndex(o => String(o.id) === String(orderId));
  if (idx >= 0) {
    store.orders[idx] = { ...store.orders[idx], ...patch };
    writeGlobalStore(store);
    return store.orders[idx];
  }
  return null;
}

export function appendMessageToGlobal({ id, order_id = null, from_user_id, to_user_id, role_target, content, created_at }) {
  const store = readGlobalStore();
  const msg = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : ('MSG_' + Date.now() + '_' + Math.random().toString(36).slice(2))),
    order_id: order_id || null,
    from_user_id: String(from_user_id),
    to_user_id: String(to_user_id),
    role_target: role_target || null,
    content: String(content || ''),
    created_at: created_at || new Date().toISOString()
  };
  store.messages.push(msg);
  writeGlobalStore(store);
  return msg;
}