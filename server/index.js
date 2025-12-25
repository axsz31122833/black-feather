import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { readGlobalStore, writeGlobalStore, upsertUserToGlobal, upsertProfileToGlobal, appendOrderToGlobal, updateOrderInGlobal, appendMessageToGlobal } from './globalStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import 'dotenv/config';
import Airtable from 'airtable';
const airtable = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID);
const app = express();
// Ensure JSON body is parsed before any routes that need req.body
app.use(express.json());

// Health endpoint
// Health endpoint (with Airtable driver stats)
app.get('/api/health', async (req, res) => {
  try {
    let stats = null;
    try {
      const all = await airtable('Drivers').select().all();
      const total = all.length;
      const idle = all.filter(d => (d.fields.status || '').toLowerCase() === 'available').length;
      const busy = all.filter(d => (d.fields.status || '').toLowerCase() === 'on_trip').length;
      const offline = all.filter(d => (d.fields.status || '').toLowerCase() === 'offline').length;
      stats = { total, idle, busy, offline };
    } catch (_) {
      // Airtable ???,????????
      stats = null;
    }
    res.json({ status: 'ok', data: stats });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err?.message || 'unknown error' });
  }
});
const server = createServer(app);
// Airtable ??????
async function autoDispatchOrder(orderId) {
  // Load order to get pickup coordinates
  let order = null;
  try {
    order = await airtable('Orders').find(orderId);
  } catch (_) {}
  const pickupLat = Number(order?.fields?.['Pickup Lat']);
  const pickupLng = Number(order?.fields?.['Pickup Lng']);
  const drivers = await airtable('Drivers').select({ filterByFormula: "{Is Online}" }).all();
  if (!drivers || drivers.length === 0) {
    console.log('auto-dispatch: no available drivers');
    return;
  }
  // Haversine distance in km
  const toRad = d => d * Math.PI / 180;
  function haversineKm(aLat, aLng, bLat, bLng) {
    if (![aLat, aLng, bLat, bLng].every(n => typeof n === 'number' && isFinite(n))) return Infinity;
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const aa = Math.sin(dLat/2)**2 + Math.cos(toRad(aLat))*Math.cos(toRad(bLat))*Math.sin(dLng/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
    return R * c;
  }
  // Pick nearest online driver
  let best = drivers[0];
  if (isFinite(pickupLat) && isFinite(pickupLng)) {
    let bestDist = Infinity;
    for (const d of drivers) {
      const dLat = Number(d.fields?.['Current Lat']);
      const dLng = Number(d.fields?.['Current Lng']);
      const dist = haversineKm(pickupLat, pickupLng, dLat, dLng);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    console.log(`auto-dispatch: best driver ${best.id} at ~${bestDist.toFixed(2)} km`);
  } else {


    console.log('auto-dispatch: pickup lat/lng missing, fallback to first driver');
  }
  await airtable('Orders').update([
    { id: orderId, fields: { 'Driver': [best.id], 'Status': '已指派', 'Assigned Time': new Date().toISOString() } }
  ], { typecast: true });
  console.log('auto-dispatch: assigned a driver');
}

// ?????????
app.post('/api/order', async (req, res) => {
  try {
    const record = await airtable('Orders').create([{ fields: req.body }]);
    const newOrder = record[0];
    Promise.resolve(autoDispatchOrder(newOrder.id)).catch(e => console.error('auto dispatch error', e));
    res.json({ success: true, order: newOrder });
  } catch (e) {
    console.error('create order error', e);
    res.status(500).json({ error: e.message });
  }
});
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data', 'accounts');
const LOG_DIR = path.join(__dirname, 'data', 'logs');

// Ã§Â¢ÂºÃ¤Â¿ÂÃ¦â€¢Â¸Ã¦â€œÅ¡Ã§â€ºÂ®Ã©Å’â€žÃ¥Â­ËœÃ¥Å“Â¨
// Ã¦Â¸â€¦Ã§Ââ€ Ã¯Â¼Å¡Ã¤Â¸ÂÃ¥â€ ÂÃ©Â ÂÃ¥â€¦Ë†Ã¥Â»ÂºÃ§Â«â€¹Ã¦Â¨Â¡Ã¦â€œÂ¬Ã¥Â¸Â³Ã¨â„¢Å¸Ã¨Â³â€¡Ã¦â€“â„¢Ã¥Â¤Â¾Ã¯Â¼â€ºÃ¨â€¹Â¥Ã¤Â¸ÂÃ¥Â­ËœÃ¥Å“Â¨Ã¥â€°â€¡Ã§Â¶Â­Ã¦Å’ÂÃ§Â©ÂºÃ¨Â³â€¡Ã¦â€“â„¢Ã¥Â¤Â¾Ã¤Â»Â¥Ã¥â€¦ÂÃ¨Â®â‚¬Ã¥Â¯Â«Ã©Å’Â¯Ã¨ÂªÂ¤
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// moved earlier to ensure /api/order and other routes can read req.body
app.use(express.static(path.join(__dirname, '../dist')));

// CORS Ã¤Â¸Â­Ã©â€“â€œÃ¤Â»Â¶
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Ã¥Â·Â¥Ã¥â€¦Â·Ã¥â€¡Â½Ã¦â€¢Â¸
function getUserDataPath(phone, file) {
  const userDir = path.join(DATA_DIR, phone);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return path.join(userDir, file);
}

function readUserData(phone, file, defaultData = {}) {
  try {
    const filePath = getUserDataPath(phone, file);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return defaultData;
  } catch (error) {
    console.error('create order error', e);
    return defaultData;
  }
}

function writeUserData(phone, file, data) {
  try {
    const filePath = getUserDataPath(phone, file);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('create order error', e);
    return false;
  }
}

// ä¼ºæœå™¨ç«¯è¨˜éŒ„è¼”åŠ©
function appendServerLog(type, payload) {
  try {
    const filePath = path.join(LOG_DIR, 'server-logs.json');
    const arr = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];
    const item = { id: crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '_' + Math.random().toString(36).slice(2)), type, payload, ts: new Date().toISOString() };
    arr.push(item);
    fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), 'utf8');
    return item;
  } catch (e) {
    console.warn('å¯«å…¥ä¼ºæœå™¨æ—¥èªŒå¤±æ•—', e);
    return null;
  }
}

// OTP/Ã©Â©â€”Ã¨Â­â€°Ã§â€ºÂ¸Ã©â€”Å“Ã¥Â·Â¥Ã¥â€¦Â·
function generateOtpCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6Ã¤Â½ÂÃ¦â€¢Â¸
}

function readAuthState(phone) {
  return readUserData(phone, 'auth.json', { isVerified: false, lastVerifiedAt: null });
}

function writeAuthState(phone, state) {
  return writeUserData(phone, 'auth.json', state);
}

function readOtpState(phone) {
  return readUserData(phone, 'otp.json', null);
}

function writeOtpState(phone, otp) {
  return writeUserData(phone, 'otp.json', otp);
}

function removeOtpState(phone) {
  const filePath = getUserDataPath(phone, 'otp.json');
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {
    console.warn('Ã§Â§Â»Ã©â„¢Â¤ OTP Ã¦Âªâ€Ã¦Â¡Ë†Ã¥Â¤Â±Ã¦â€¢â€”', e);
  }
}

function getAllDrivers() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return [];
    }
    
    const users = fs.readdirSync(DATA_DIR);
    const drivers = [];
    
    users.forEach(phone => {
      const profile = readUserData(phone, 'profile.json', {});
      if (profile.role === 'driver') {
        drivers.push({
          phone,
          ...profile,
          status: profile.status || 'offline'
        });
      }
    });
    
    return drivers;
  } catch (error) {
    console.error('create order error', e);
    return [];
  }
}

function findAvailableDriver() {
  const drivers = getAllDrivers();
  // å°‡ 'online' èˆ‡ 'idle' éƒ½è¦–ç‚ºå¯æ´¾é£ç‹€æ…‹
  return drivers.find(driver => driver && ['idle', 'online'].includes(driver.status));
}

function generateOrderId() {
  return 'ORDER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// API Ã¨Â·Â¯Ã§â€Â±

// Ã§â„¢Â¼Ã©â‚¬Â/Ã©â€¡ÂÃ¥Â¯â€ž OTPÃ¯Â¼Ë†Ã¦Å“Â¬Ã¥Å“Â°Ã©â€“â€¹Ã§â„¢Â¼Ã¥Â¾Å’Ã¦ÂÂ´Ã¯Â¼â€°
app.post('/auth/send-otp', (req, res) => {
  try {
    const { phone, name, role } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Ã§Â¼ÂºÃ¥Â°â€˜Ã¥Â¿â€¦Ã¨Â¦ÂÃ¥ÂÆ’Ã¦â€¢Â¸Ã¯Â¼Å¡phone' });
    }

    // Ã¥Â»ÂºÃ§Â«â€¹/Ã¦â€ºÂ´Ã¦â€“Â°Ã¤Â½Â¿Ã§â€Â¨Ã¨â‚¬â€¦Ã¥Å¸ÂºÃ¦Å“Â¬Ã¨Â³â€¡Ã¦â€“â„¢
    const profile = readUserData(phone, 'profile.json', {});
    const newProfile = {
      ...profile,
      phone,
      name: name || profile.name || `Ã§â€Â¨Ã¦Ë†Â¶_${phone}`,
      role: role || profile.role || 'passenger',
      status: profile.status || (role === 'driver' ? 'online' : 'idle')
    };
    writeUserData(phone, 'profile.json', newProfile);

    // Ã©â€¡ÂÃ§Â½Â®Ã©Â©â€”Ã¨Â­â€°Ã§â€¹â‚¬Ã¦â€¦â€¹
    writeAuthState(phone, { isVerified: false, lastVerifiedAt: null });

    // Ã¥Â»ÂºÃ§Â«â€¹ OTP
    const code = generateOtpCode();
    const ttlMinutes = 10;
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
    writeOtpState(phone, { code, expiresAt });

    console.log(`Ã¦Å“Â¬Ã¥Å“Â° send-otp: ${phone} -> ${code} (Ã¦Å“â€°Ã¦â€¢Ë† ${ttlMinutes} Ã¥Ë†â€ Ã©ÂËœ)`);
    return res.json({ success: true, data: { phone, expiresAt, ttlMinutes, devCode: code }, message: 'Ã©Â©â€”Ã¨Â­â€°Ã§Â¢Â¼Ã¥Â·Â²Ã§â„¢Â¼Ã©â‚¬ÂÃ¯Â¼Ë†Ã¦Å“Â¬Ã¥Å“Â°Ã©â€“â€¹Ã§â„¢Â¼Ã¯Â¼â€°' });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'Ã¤Â¼ÂºÃ¦Å“ÂÃ¥â„¢Â¨Ã©Å’Â¯Ã¨ÂªÂ¤' });
  }
});

// Ã©Â©â€”Ã¨Â­â€°Ã¦â€°â€¹Ã¦Â©Å¸Ã¯Â¼Ë†Ã¦Å“Â¬Ã¥Å“Â°Ã©â€“â€¹Ã§â„¢Â¼Ã¥Â¾Å’Ã¦ÂÂ´Ã¯Â¼â€°
app.post('/auth/verify-phone', (req, res) => {
  try {
    const { phone, verificationCode } = req.body || {};
    if (!phone || !verificationCode) {
      return res.status(400).json({ success: false, message: 'Ã§Â¼ÂºÃ¥Â°â€˜Ã¥Â¿â€¦Ã¨Â¦ÂÃ¥ÂÆ’Ã¦â€¢Â¸Ã¯Â¼Å¡phone, verificationCode' });
    }

    const otp = readOtpState(phone);
    if (!otp) {
      return res.status(404).json({ success: false, message: 'Ã¦Å“ÂªÃ¦â€°Â¾Ã¥Ë†Â°Ã©Â©â€”Ã¨Â­â€°Ã§Â¢Â¼Ã¯Â¼Å’Ã¨Â«â€¹Ã¥â€¦Ë†Ã§â„¢Â¼Ã©â‚¬Â OTP' });
    }
    if (Date.now() > otp.expiresAt) {
      removeOtpState(phone);
      return res.status(400).json({ success: false, message: 'Ã©Â©â€”Ã¨Â­â€°Ã§Â¢Â¼Ã¥Â·Â²Ã©ÂÅ½Ã¦Å“Å¸Ã¯Â¼Å’Ã¨Â«â€¹Ã©â€¡ÂÃ¦â€“Â°Ã§â„¢Â¼Ã©â‚¬Â' });
    }
    if (String(verificationCode) !== String(otp.code)) {
      return res.status(400).json({ success: false, message: 'Ã©Â©â€”Ã¨Â­â€°Ã§Â¢Â¼Ã©Å’Â¯Ã¨ÂªÂ¤' });
    }

    // Ã¦Â¨â„¢Ã¨Â¨ËœÃ§â€šÂºÃ¥Â·Â²Ã©Â©â€”Ã¨Â­â€°
    writeAuthState(phone, { isVerified: true, lastVerifiedAt: new Date().toISOString() });
    removeOtpState(phone);
    console.log('auto-dispatch: assigned a driver');
    return res.json({ success: true, data: { phone, verified: true }, message: 'Ã¦â€°â€¹Ã¦Â©Å¸Ã©Â©â€”Ã¨Â­â€°Ã¦Ë†ÂÃ¥Å Å¸Ã¯Â¼Ë†Ã¦Å“Â¬Ã¥Å“Â°Ã©â€“â€¹Ã§â„¢Â¼Ã¯Â¼â€°' });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'Ã¤Â¼ÂºÃ¦Å“ÂÃ¥â„¢Â¨Ã©Å’Â¯Ã¨ÂªÂ¤' });
  }
});

// ä½¿ç”¨ Firebase å®Œæˆ OTP å¾Œçš„æ¨™è¨˜ç«¯é»žï¼ˆä¸æª¢æŸ¥æœ¬åœ° OTPï¼Œåƒ…æ¨™è¨˜é€šéŽï¼‰
app.post('/auth/verify-firebase', (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, message: 'ç¼ºå°‘å¿…è¦åƒæ•¸ï¼šphone' });
    }

    // æ¨™è¨˜ç‚ºå·²é©—è­‰
    writeAuthState(phone, { isVerified: true, lastVerifiedAt: new Date().toISOString() });
    console.log('auto-dispatch: assigned a driver');
    return res.json({ success: true, data: { phone, verified: true }, message: 'æ‰‹æ©Ÿé©—è­‰æˆåŠŸï¼ˆFirebaseï¼‰' });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'ä¼ºæœå™¨éŒ¯èª¤' });
  }
});

// Ã¥ÂÂ«Ã¨Â»Å Ã¨Ë†â€¡Ã¨â€¡ÂªÃ¥â€¹â€¢Ã¦Â´Â¾Ã¨Â»Å 
async function createRideHandler(req, res) {
  try {
    // å¾Œç«¯ Supabase URL æª¢æŸ¥èˆ‡å‚™æ´æç¤ºï¼ˆåƒ…è¨˜éŒ„ï¼Œä¸é˜»æ“‹ï¼‰
    const {
      passengerPhone,
      pickup,
      dropoff,
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
      estimated_distance_meters,
      estimated_duration_seconds,
      estimated_price,
      service_type,
      deposit,
      notes
    } = req.body;
    
    if (!passengerPhone || !pickup || !dropoff) {
      return res.status(400).json({ 
        success: false, 
        message: 'è«‹ç¢ºèªä¸Šè»Šèˆ‡ä¸‹è»Šåœ°é»žå·²è¼¸å…¥' 
      });
    }

    // Ã¦Å¸Â¥Ã¦â€°Â¾Ã¥ÂÂ¯Ã§â€Â¨Ã¥ÂÂ¸Ã¦Â©Å¸
    const availableDriver = findAvailableDriver();
    
    if (!availableDriver) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ã§â€ºÂ®Ã¥â€°ÂÃ¦Â²â€™Ã¦Å“â€°Ã¥ÂÂ¯Ã§â€Â¨Ã¥ÂÂ¸Ã¦Â©Å¸' 
      });
    }

    // Ã§â€Å¸Ã¦Ë†ÂÃ¨Â¨â€šÃ¥â€“Â®
    const orderId = generateOrderId();
    // è¨ˆåƒ¹ï¼ˆè‹¥å‰ç«¯æœªæä¾› estimated_priceï¼Œå‰‡ä»¥ç°¡å–®å…¬å¼è¨ˆç®—ï¼‰
    let price = Number(estimated_price);
    if (!price || Number.isNaN(price)) {
      const km = (Number(estimated_distance_meters) || 0) / 1000;
      const minutes = (Number(estimated_duration_seconds) || 0) / 60;
      const base = 70;
      const perKm = 15;
      const perMin = 3;
      const longTripExtra = km > 20 ? (km - 20) * 10 : 0;
      price = Math.round(base + km * perKm + minutes * perMin + longTripExtra);
    }

    const order = {
      id: orderId,
      passengerPhone,
      driverPhone: availableDriver.phone,
      driverName: availableDriver.name,
      pickup,
      dropoff,
      status: 'pending',
      createdAt: new Date().toISOString(),
      estimatedPrice: price,
      pickup_lat,
      pickup_lng,
      dropoff_lat,
      dropoff_lng,
      estimated_distance_meters,
      estimated_duration_seconds,
      service_type: service_type || 'standard',
      deposit: Number(deposit) || 0,
      notes: notes || ''
    };

    // Ã¦â€ºÂ´Ã¦â€“Â°Ã¥ÂÂ¸Ã¦Â©Å¸Ã§â€¹â‚¬Ã¦â€¦â€¹Ã§â€šÂºÃ¥Â¿â„¢Ã§Â¢Å’
    const driverProfile = readUserData(availableDriver.phone, 'profile.json', {});
    driverProfile.status = 'busy';
    writeUserData(availableDriver.phone, 'profile.json', driverProfile);

    // Ã¤Â¿ÂÃ¥Â­ËœÃ¨Â¨â€šÃ¥â€“Â®Ã¥Ë†Â°Ã¥ÂÂ¸Ã¦Â©Å¸Ã¥â€™Å’Ã¤Â¹ËœÃ¥Â®Â¢Ã§Å¡â€žÃ¨Â¨ËœÃ©Å’â€ž
    const driverOrders = readUserData(availableDriver.phone, 'orders.json', []);
    driverOrders.push(order);
    writeUserData(availableDriver.phone, 'orders.json', driverOrders);

    const passengerOrders = readUserData(passengerPhone, 'orders.json', []);
    passengerOrders.push(order);
    writeUserData(passengerPhone, 'orders.json', passengerOrders);

    // Ã©â‚¬Å¡Ã§Å¸Â¥Ã¦â€°â‚¬Ã¦Å“â€°Ã©â‚¬Â£Ã¦Å½Â¥Ã§Å¡â€žÃ¥Â®Â¢Ã¦Ë†Â¶Ã§Â«Â¯
    io.emit('order_created', order);
    io.emit('driver_status_update', { 
      phone: availableDriver.phone, 
      status: 'busy' 
    });

    console.log('auto-dispatch: assigned a driver');

    // è¨˜éŒ„æ—¥èªŒ
    appendServerLog('ride_request_success', { order, driver: availableDriver });

    // å¯«å…¥å…¨åŸŸè¨‚å–®ï¼ˆglobal.jsonï¼‰
    try { appendOrderToGlobal(order); } catch (_) {}

    res.json({ 
      success: true, 
      order,
      driver: availableDriver,
      message: 'Ã¥ÂÂ«Ã¨Â»Å Ã¦Ë†ÂÃ¥Å Å¸Ã¯Â¼Å’Ã¥ÂÂ¸Ã¦Â©Å¸Ã¥Â·Â²Ã¥Ë†â€ Ã©â€¦Â' 
    });

  } catch (error) {
    console.error('create order error', e);
    appendServerLog('ride_request_error', { error: String(error && error.stack || error) });
    res.status(500).json({ 
      success: false, 
      message: 'Ã¤Â¼ÂºÃ¦Å“ÂÃ¥â„¢Â¨Ã©Å’Â¯Ã¨ÂªÂ¤' 
    });
  }
}

// ä¸»è·¯ç”±
app.post('/ride/request', async (req, res) => {
  return createRideHandler(req, res);
});

// ç›¸å®¹åˆ¥åï¼ˆä¾ä½¿ç”¨è€…éœ€æ±‚ï¼‰ï¼š/api/bookã€/api/create_ride
app.post('/api/book', async (req, res) => {
  return createRideHandler(req, res);
});
app.post('/api/create_ride', async (req, res) => {
  return createRideHandler(req, res);
});

// æ–°å¢žåˆ¥åï¼š/create_orderï¼ˆèˆ‡ createRideHandler ç›¸åŒï¼‰
app.post('/create_order', async (req, res) => {
  return createRideHandler(req, res);
});

// å®¢æˆ¶ç«¯éŒ¯èª¤è¨˜éŒ„
app.post('/logs/client-error', (req, res) => {
  try {
    const { userId, message, context } = req.body || {};
    const item = appendServerLog('client_error', { userId, message, context });
    return res.json({ success: true, item });
  } catch (e) {
    return res.status(500).json({ success: false, message: 'ä¼ºæœå™¨éŒ¯èª¤' });
  }
});

// Ã¥Â®Å’Ã¦Ë†ÂÃ¨Â¨â€šÃ¥â€“Â®
app.post('/ride/complete', async (req, res) => {
  try {
    const { orderId, driverPhone } = req.body;
    
    if (!orderId || !driverPhone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ã§Â¼ÂºÃ¥Â°â€˜Ã¥Â¿â€¦Ã¨Â¦ÂÃ¥ÂÆ’Ã¦â€¢Â¸Ã¯Â¼Å¡orderId, driverPhone' 
      });
    }

    // Ã§ÂÂ²Ã¥Ââ€“Ã¥ÂÂ¸Ã¦Â©Å¸Ã¨Â¨â€šÃ¥â€“Â®
    const driverOrders = readUserData(driverPhone, 'orders.json', []);
    const orderIndex = driverOrders.findIndex(order => order.id === orderId);
    
    if (orderIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ã¦â€°Â¾Ã¤Â¸ÂÃ¥Ë†Â°Ã¨Â©Â²Ã¨Â¨â€šÃ¥â€“Â®' 
      });
    }

    // Ã¦â€ºÂ´Ã¦â€“Â°Ã¨Â¨â€šÃ¥â€“Â®Ã§â€¹â‚¬Ã¦â€¦â€¹
    driverOrders[orderIndex].status = 'completed';
    driverOrders[orderIndex].completedAt = new Date().toISOString();
    writeUserData(driverPhone, 'orders.json', driverOrders);

    // Ã¦â€ºÂ´Ã¦â€“Â°Ã¤Â¹ËœÃ¥Â®Â¢Ã¨Â¨â€šÃ¥â€“Â®
    const passengerPhone = driverOrders[orderIndex].passengerPhone;
    const passengerOrders = readUserData(passengerPhone, 'orders.json', []);
    const passengerOrderIndex = passengerOrders.findIndex(order => order.id === orderId);
    if (passengerOrderIndex !== -1) {
      passengerOrders[passengerOrderIndex].status = 'completed';
      passengerOrders[passengerOrderIndex].completedAt = new Date().toISOString();
      writeUserData(passengerPhone, 'orders.json', passengerOrders);
    }

    // Ã¦ÂÂ¢Ã¥Â¾Â©Ã¥ÂÂ¸Ã¦Â©Å¸Ã§â€¹â‚¬Ã¦â€¦â€¹Ã§â€šÂºÃ©â€“â€™Ã§Â½Â®
    const driverProfile = readUserData(driverPhone, 'profile.json', {});
    driverProfile.status = 'idle';
    writeUserData(driverPhone, 'profile.json', driverProfile);

    // Ã©â‚¬Å¡Ã§Å¸Â¥Ã¦â€°â‚¬Ã¦Å“â€°Ã©â‚¬Â£Ã¦Å½Â¥Ã§Å¡â€žÃ¥Â®Â¢Ã¦Ë†Â¶Ã§Â«Â¯
    io.emit('order_completed', driverOrders[orderIndex]);
    io.emit('driver_status_update', { 
      phone: driverPhone, 
      status: 'idle' 
    });

    console.log('auto-dispatch: assigned a driver');

    // å…¨åŸŸè¨‚å–®ç‹€æ…‹åŒæ­¥
    try { updateOrderInGlobal(orderId, { status: 'completed', completed_at: new Date().toISOString() }); } catch (_) {}

    res.json({ 
      success: true, 
      order: driverOrders[orderIndex],
      message: 'Ã¨Â¨â€šÃ¥â€“Â®Ã¥Â·Â²Ã¥Â®Å’Ã¦Ë†Â' 
    });

  } catch (error) {
    console.error('create order error', e);
    res.status(500).json({ 
      success: false, 
      message: 'Ã¤Â¼ÂºÃ¦Å“ÂÃ¥â„¢Â¨Ã©Å’Â¯Ã¨ÂªÂ¤' 
    });
  }
});

// Ã©â‚¬Å¡Ã§â€Â¨Ã¨Â¨â€šÃ¥â€“Â®Ã§â€¹â‚¬Ã¦â€¦â€¹Ã¦â€ºÂ´Ã¦â€“Â°Ã¯Â¼Ë†accepted/enroute/arrived/completed/cancelled Ã§Â­â€°Ã¯Â¼â€°
app.post('/ride/update-status', async (req, res) => {
  try {
    let { orderId, driverPhone, passengerPhone, nextStatus } = req.body;
    if (!orderId || !nextStatus) {
      return res.status(400).json({ success: false, message: 'Ã§Â¼ÂºÃ¥Â°â€˜Ã¥Â¿â€¦Ã¨Â¦ÂÃ¥ÂÆ’Ã¦â€¢Â¸Ã¯Â¼Å¡orderId, nextStatus' });
    }

    // Ã¥â€žÂªÃ¥â€¦Ë†Ã¥Å“Â¨Ã¦ÂÂÃ¤Â¾â€ºÃ§Å¡â€žÃ§Â«Â¯Ã¦ÂªÂ¢Ã§Â´Â¢Ã¨Â¨â€šÃ¥â€“Â®
    let order = null;
    let driverOrders = [];
    let passengerOrders = [];

    if (driverPhone) {
      driverOrders = readUserData(driverPhone, 'orders.json', []);
      order = driverOrders.find(o => o.id === orderId) || null;
    }
    if (!order && passengerPhone) {
      passengerOrders = readUserData(passengerPhone, 'orders.json', []);
      order = passengerOrders.find(o => o.id === orderId) || null;
    }

    // Ã¦Å“ÂªÃ¦Å’â€¡Ã¥Â®Å¡Ã¤ÂºÂ¦Ã¦Å“ÂªÃ¦â€°Â¾Ã¥Ë†Â°Ã¦â„¢â€šÃ¯Â¼Å’Ã¦Å½Æ’Ã¦ÂÂÃ¥â€¦Â¨Ã©Æ’Â¨Ã¥Â¸Â³Ã¨â„¢Å¸Ã¨Â³â€¡Ã¦â€“â„¢Ã¥Â¤Â¾
    if (!order) {
      try {
        const users = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : [];
        for (const phone of users) {
          const orders = readUserData(phone, 'orders.json', []);
          const found = orders.find(o => o.id === orderId);
          if (found) {
            order = found;
            driverPhone = found.driverPhone;
            passengerPhone = found.passengerPhone;
            driverOrders = readUserData(driverPhone, 'orders.json', []);
            passengerOrders = readUserData(passengerPhone, 'orders.json', []);
            break;
          }
        }
      } catch (_) {}
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Ã¦â€°Â¾Ã¤Â¸ÂÃ¥Ë†Â°Ã¨Â©Â²Ã¨Â¨â€šÃ¥â€“Â®' });
    }

    const now = new Date().toISOString();
    const updater = (o) => {
      if (o.id !== orderId) return o;
      const updated = { ...o, status: nextStatus };
      if (nextStatus === 'completed') updated.completedAt = now;
      return updated;
    };

    if (driverPhone) {
      driverOrders = driverOrders.length ? driverOrders : readUserData(driverPhone, 'orders.json', []);
      driverOrders = driverOrders.map(updater);
      writeUserData(driverPhone, 'orders.json', driverOrders);
    }
    if (passengerPhone) {
      passengerOrders = passengerOrders.length ? passengerOrders : readUserData(passengerPhone, 'orders.json', []);
      passengerOrders = passengerOrders.map(updater);
      writeUserData(passengerPhone, 'orders.json', passengerOrders);
    }

    // Ã¥ÂÅ’Ã¦Â­Â¥Ã¥ÂÂ¸Ã¦Â©Å¸Ã§â€¹â‚¬Ã¦â€¦â€¹
    const driverId = driverPhone || order.driverPhone;
    if (driverId) {
      const profile = readUserData(driverId, 'profile.json', {});
      if (nextStatus === 'completed' || nextStatus === 'cancelled') {
        profile.status = 'idle';
      } else if (nextStatus === 'accepted' || nextStatus === 'enroute' || nextStatus === 'arrived') {
        profile.status = 'busy';
      }
      writeUserData(driverId, 'profile.json', profile);
      io.emit('driver_status_update', { phone: driverId, status: profile.status });
    }

    const updatedOrder = (driverPhone ? driverOrders : passengerOrders).find(o => o.id === orderId) || order;
    io.emit('order_status_update', updatedOrder);

    // å…¨åŸŸè¨‚å–®ç‹€æ…‹åŒæ­¥
    try {
      const patch = { status: nextStatus };
      if (nextStatus === 'completed') patch.completed_at = new Date().toISOString();
      updateOrderInGlobal(orderId, patch);
    } catch (_) {}

    return res.json({ success: true, order: updatedOrder, message: 'Ã¨Â¨â€šÃ¥â€“Â®Ã§â€¹â‚¬Ã¦â€¦â€¹Ã¥Â·Â²Ã¦â€ºÂ´Ã¦â€“Â°' });
  } catch (error) {
    console.error('create order error', e);
    res.status(500).json({ success: false, message: 'Ã¤Â¼ÂºÃ¦Å“ÂÃ¥â„¢Â¨Ã©Å’Â¯Ã¨ÂªÂ¤' });
  }
});

// Ã§ÂÂ²Ã¥Ââ€“Ã¥ÂÂ¸Ã¦Â©Å¸Ã§â€¹â‚¬Ã¦â€¦â€¹
app.get('/drivers/status', (req, res) => {
  try {
    const drivers = getAllDrivers();
    
    const statusSummary = {
      total: drivers.length,
      idle: drivers.filter(d => d.status === 'idle').length,
      busy: drivers.filter(d => d.status === 'busy').length,
      offline: drivers.filter(d => d.status === 'offline').length,
      drivers: drivers.map(driver => ({
        phone: driver.phone,
        name: driver.name,
        status: driver.status,
        vehicle: driver.vehicle,
        lat: (driver.location && driver.location.lat) || driver.lat || null,
        lng: (driver.location && driver.location.lng) || driver.lng || null
      }))
    };

    res.json({ 
      success: true, 
      data: statusSummary 
    });

  } catch (error) {
    console.error('create order error', e);
    res.status(500).json({ 
      success: false, 
      message: 'Ã¤Â¼ÂºÃ¦Å“ÂÃ¥â„¢Â¨Ã©Å’Â¯Ã¨ÂªÂ¤' 
    });
  }
});

// Ã§ÂÂ²Ã¥Ââ€“Ã§â€Â¨Ã¦Ë†Â¶Ã¨Â³â€¡Ã¦â€“â„¢
app.get('/user/:phone', (req, res) => {
  try {
    const { phone } = req.params;
    const profile = readUserData(phone, 'profile.json', null);
    
    if (!profile) {
      return res.status(404).json({ 
        success: false, 
        message: 'Ã§â€Â¨Ã¦Ë†Â¶Ã¤Â¸ÂÃ¥Â­ËœÃ¥Å“Â¨' 
      });
    }

    res.json({ 
      success: true, 
      data: profile 
    });

  } catch (error) {
    console.error('create order error', e);
    res.status(500).json({ 
      success: false, 
      message: 'Ã¤Â¼ÂºÃ¦Å“ÂÃ¥â„¢Â¨Ã©Å’Â¯Ã¨ÂªÂ¤' 
    });
  }
});

// Ã§ÂÂ²Ã¥Ââ€“Ã§â€Â¨Ã¦Ë†Â¶Ã¨Â¨â€šÃ¥â€“Â®
app.get('/user/:phone/orders', (req, res) => {
  try {
    const { phone } = req.params;
    const orders = readUserData(phone, 'orders.json', []);
    
    res.json({ 
      success: true, 
      data: orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) 
    });

  } catch (error) {
    console.error('create order error', e);
    res.status(500).json({ 
      success: false, 
      message: 'Ã¤Â¼ÂºÃ¦Å“ÂÃ¥â„¢Â¨Ã©Å’Â¯Ã¨ÂªÂ¤' 
    });
  }
});

// Ã¦â€ºÂ´Ã¦â€“Â°Ã¥ÂÂ¸Ã¦Â©Å¸Ã§â€¹â‚¬Ã¦â€¦â€¹
app.post('/driver/:phone/status', (req, res) => {
  try {
    const { phone } = req.params;
    const { status } = req.body;
    
    if (!['idle', 'busy', 'offline'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Ã§â€žÂ¡Ã¦â€¢Ë†Ã§Å¡â€žÃ§â€¹â‚¬Ã¦â€¦â€¹Ã¥â‚¬Â¼' 
      });
    }

    const profile = readUserData(phone, 'profile.json', {});
    profile.status = status;
    
    if (writeUserData(phone, 'profile.json', profile)) {
      io.emit('driver_status_update', { phone, status });
      
      res.json({ 
        success: true, 
        message: 'Ã§â€¹â‚¬Ã¦â€¦â€¹Ã¦â€ºÂ´Ã¦â€“Â°Ã¦Ë†ÂÃ¥Å Å¸' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Ã§â€¹â‚¬Ã¦â€¦â€¹Ã¦â€ºÂ´Ã¦â€“Â°Ã¥Â¤Â±Ã¦â€¢â€”' 
      });
    }

  } catch (error) {
    console.error('create order error', e);
    res.status(500).json({ 
      success: false, 
      message: 'Ã¤Â¼ÂºÃ¦Å“ÂÃ¥â„¢Â¨Ã©Å’Â¯Ã¨ÂªÂ¤' 
    });
  }
});

// å¸æ©Ÿå¿ƒè·³ï¼ˆä½ç½®èˆ‡ç‹€æ…‹æ›´æ–°ï¼‰
app.post('/driver-heartbeat', (req, res) => {
  try {
    const { phone, status, lat, lng } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, message: 'ç¼ºå°‘å¿…è¦åƒæ•¸ï¼šphone' });
    }

    const profile = readUserData(phone, 'profile.json', {});
    profile.phone = String(phone);
    if (!profile.role) profile.role = 'driver';
    if (status && ['idle','busy','offline','online'].includes(String(status))) {
      // è‹¥å‰ç«¯å‚³ onlineï¼Œè¦–ç‚º idle å¯æ´¾é£
      profile.status = (status === 'online') ? 'idle' : String(status);
    }
    if (lat !== undefined && lng !== undefined) {
      profile.location = { lat: Number(lat), lng: Number(lng), ts: new Date().toISOString() };
    }
    writeUserData(phone, 'profile.json', profile);

    // å…¨åŸŸæª”æ¡ˆåŒæ­¥
    try {
      upsertProfileToGlobal({
        user_id: String(phone),
        vehicle_info: profile.vehicle || profile.car_plate || null,
        rating_avg: profile.rating_avg || null,
        total_orders: profile.total_orders || 0,
        current_status: profile.status || 'idle',
        location: profile.location || null
      });
    } catch (_) {}

    io.emit('driver_status_update', { phone: String(phone), status: profile.status, location: profile.location });
    return res.json({ success: true, data: { phone: String(phone), status: profile.status, location: profile.location } });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'ä¼ºæœå™¨éŒ¯èª¤' });
  }
});

// è¨‚å–®è©•åƒ¹ï¼ˆå®Œæˆå¾Œï¼‰
// POST /orders/review { orderId, rating(1-5), comment?, by_phone }
app.post('/orders/review', (req, res) => {
  try {
    const { orderId, rating, comment, by_phone } = req.body || {};
    if (!orderId || rating === undefined) {
      return res.status(400).json({ success: false, message: 'ç¼ºå°‘å¿…è¦åƒæ•¸ï¼šorderId, rating' });
    }
    const score = Number(rating);
    if (!(score >= 1 && score <= 5)) {
      return res.status(400).json({ success: false, message: 'rating å¿…é ˆåœ¨ 1~5 ä¹‹é–“' });
    }

    // å°‹æ‰¾è¨‚å–®ï¼ˆå…ˆå˜—è©¦å…¨åŸŸï¼Œå¾Œå‚™è‡³æœ¬åœ°æª”æ¡ˆï¼‰
    let order = null;
    const store = readGlobalStore();
    order = store.orders.find(o => String(o.id) === String(orderId)) || null;
    let driverPhone = null;
    let passengerPhone = null;

    if (!order) {
      const users = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR) : [];
      for (const phone of users) {
        const orders = readUserData(phone, 'orders.json', []);
        const found = orders.find(o => o.id === orderId);
        if (found) {
          order = found;
          driverPhone = found.driverPhone;
          passengerPhone = found.passengerPhone;
          break;
        }
      }
    } else {
      driverPhone = order.driver_id || order.driverPhone || null;
      passengerPhone = order.passenger_id || order.passengerPhone || null;
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'æ‰¾ä¸åˆ°è©²è¨‚å–®' });
    }

    const review = { rating: score, comment: String(comment || ''), by: by_phone || null, at: new Date().toISOString() };

    // æ›´æ–°æœ¬åœ° orders.jsonï¼ˆå¸æ©Ÿèˆ‡ä¹˜å®¢ï¼‰
    if (driverPhone) {
      const dOrders = readUserData(driverPhone, 'orders.json', []);
      const dIdx = dOrders.findIndex(o => o.id === orderId);
      if (dIdx >= 0) { dOrders[dIdx].review = review; writeUserData(driverPhone, 'orders.json', dOrders); }
    }
    if (passengerPhone) {
      const pOrders = readUserData(passengerPhone, 'orders.json', []);
      const pIdx = pOrders.findIndex(o => o.id === orderId);
      if (pIdx >= 0) { pOrders[pIdx].review = review; writeUserData(passengerPhone, 'orders.json', pOrders); }
    }

    // æ›´æ–°å…¨åŸŸè¨‚å–®
    try { updateOrderInGlobal(orderId, { review }); } catch (_) {}

    // æ›´æ–°å¸æ©Ÿè©•åˆ†
    if (driverPhone) {
      const dProfile = readUserData(driverPhone, 'profile.json', {});
      const prevAvg = Number(dProfile.rating_avg || 0);
      const prevCount = Number(dProfile.review_count || 0);
      const newCount = prevCount + 1;
      const newAvg = newCount > 0 ? ((prevAvg * prevCount + score) / newCount) : score;
      dProfile.rating_avg = Math.round(newAvg * 100) / 100;
      dProfile.review_count = newCount;
      writeUserData(driverPhone, 'profile.json', dProfile);
      // å…¨åŸŸæª”æ¡ˆåŒæ­¥
      try { upsertProfileToGlobal({ user_id: String(driverPhone), rating_avg: dProfile.rating_avg, total_orders: dProfile.total_orders || 0, current_status: dProfile.status || 'idle', location: dProfile.location || null }); } catch (_) {}
    }

    io.emit('order_review_update', { orderId, review });
    return res.json({ success: true, data: { orderId, review }, message: 'è©•åƒ¹å·²é€å‡º' });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'ä¼ºæœå™¨éŒ¯èª¤' });
  }
});

// ç™¼é€è¨Šæ¯ï¼ˆä¹˜å®¢â†”å¸æ©Ÿâ†”å¾Œå°ï¼‰
// POST /messages/send { from, to, content, orderId? }
app.post('/messages/send', (req, res) => {
  try {
    const { from, to, content, orderId } = req.body || {};
    if (!from || !to || !content) {
      return res.status(400).json({ success: false, message: 'ç¼ºå°‘å¿…è¦åƒæ•¸ï¼šfrom, to, content' });
    }
    const msg = appendMessageToGlobal({ from_user_id: String(from), to_user_id: String(to), content: String(content), order_id: orderId || null });
    io.emit('message_sent', msg);
    return res.json({ success: true, data: msg });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'ä¼ºæœå™¨éŒ¯èª¤' });
  }
});

// è¨Šæ¯æ­·å²
// GET /messages/history?userA=xxx&userB=yyy&orderId=opt
app.get('/messages/history', (req, res) => {
  try {
    const { userA, userB, orderId } = req.query || {};
    const store = readGlobalStore();
    let msgs = store.messages || [];
    if (orderId) {
      msgs = msgs.filter(m => String(m.order_id || '') === String(orderId));
    }
    if (userA && userB) {
      msgs = msgs.filter(m => (String(m.from_user_id) === String(userA) && String(m.to_user_id) === String(userB)) || (String(m.from_user_id) === String(userB) && String(m.to_user_id) === String(userA)));
    }
    msgs = msgs.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    return res.json({ success: true, data: msgs });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'ä¼ºæœå™¨éŒ¯èª¤' });
  }
});

// ç®¡ç†å“¡æŸ¥çœ‹ä¼ºæœå™¨æ—¥èªŒ
app.get('/admin/logs', (req, res) => {
  try {
    const filePath = path.join(LOG_DIR, 'server-logs.json');
    const logs = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : [];
    return res.json({ success: true, data: logs });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'ä¼ºæœå™¨éŒ¯èª¤' });
  }
});

// Ã§ÂÂ²Ã¥Ââ€“Ã¦â€°â‚¬Ã¦Å“â€°Ã¨Â¨â€šÃ¥â€“Â®Ã¯Â¼Ë†Ã§Â®Â¡Ã§Ââ€ Ã¥â€œÂ¡Ã¯Â¼â€°
app.get('/orders/all', (req, res) => {
  try {
    // å„ªå…ˆä½¿ç”¨å…¨åŸŸè¨‚å–®ï¼ˆglobal.jsonï¼‰
    const globalStore = readGlobalStore();
    if (globalStore.orders && globalStore.orders.length) {
      const sorted = [...globalStore.orders].sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0));
      return res.json({ success: true, data: sorted });
    }

    if (!fs.existsSync(DATA_DIR)) {
      return res.json({ success: true, data: [] });
    }
    
    const allOrders = [];
    const users = fs.readdirSync(DATA_DIR);
    
    users.forEach(phone => {
      const orders = readUserData(phone, 'orders.json', []);
      allOrders.push(...orders);
    });

    // Ã¥Å½Â»Ã©â€¡ÂÃ¤Â¸Â¦Ã¦Å’â€°Ã¦â„¢â€šÃ©â€“â€œÃ¦Å½â€™Ã¥ÂºÂ
    const uniqueOrders = allOrders.filter((order, index, self) => 
      index === self.findIndex(o => o.id === order.id)
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ 
      success: true, 
      data: uniqueOrders 
    });

  } catch (error) {
    console.error('create order error', e);
    res.status(500).json({ 
      success: false, 
      message: 'Ã¤Â¼ÂºÃ¦Å“ÂÃ¥â„¢Â¨Ã©Å’Â¯Ã¨ÂªÂ¤' 
    });
  }
});

// WebSocket Ã©â‚¬Â£Ã¦Å½Â¥Ã¨â„¢â€¢Ã§Ââ€ 
io.on('connection', (socket) => {
  console.log('auto-dispatch: assigned a driver');
  
  socket.on('join_room', (room) => {
    socket.join(room);
    console.log('auto-dispatch: assigned a driver');
  });
  
  socket.on('disconnect', () => {
    console.log('auto-dispatch: assigned a driver');
  });
});

// Ã¦ÂÂÃ¤Â¾â€ºÃ¥â€°ÂÃ§Â«Â¯Ã©Â ÂÃ©ÂÂ¢
// Password-based registration (local development)
// POST /auth/register { phone, password, name?, role? (passenger|driver|admin), nickname?, car_plate?, remember? }
app.post('/auth/register', (req, res) => {
  try {
    const { phone, password, name, role = 'passenger', nickname, car_plate, remember } = req.body || {};
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'ç¼ºå°‘å¿…è¦æ¬„ä½ï¼šphone, password' });
    }

    // prevent re-register
    const authPath = getUserDataPath(phone, 'auth.json');
    if (fs.existsSync(authPath)) {
      return res.status(409).json({ success: false, message: 'æ­¤è™Ÿç¢¼å·²è¨»å†Š' });
    }

    // additional duplication checks (global store / existing profile file)
    try {
      const store = readGlobalStore();
      const existsInUsers = Array.isArray(store.users) && store.users.some(u => String(u.phone) === String(phone));
      const existsInProfiles = Array.isArray(store.profiles) && store.profiles.some(p => String(p.user_id) === String(phone));
      const profilePath = getUserDataPath(phone, 'profile.json');
      if (existsInUsers || existsInProfiles || fs.existsSync(profilePath)) {
        return res.status(409).json({ success: false, message: 'æ­¤è™Ÿç¢¼å·²è¨»å†Š' });
      }
    } catch (_) {}

    // hash password
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
    writeUserData(phone, 'auth.json', { salt, hash, createdAt: new Date().toISOString() });

    // prepare profile
    const finalRole = ['passenger','driver','admin'].includes(String(role)) ? String(role) : 'passenger';
    const finalName = name && String(name).trim().length > 0 ? String(name).trim() : `User_${phone}`;
    const status = finalRole === 'driver' ? 'online' : 'idle';
    const profile = { phone, name: finalName, role: finalRole, status };
    if (finalRole === 'driver') {
      if (nickname) profile.nickname = String(nickname);
      if (car_plate) profile.car_plate = String(car_plate);
    }
    // mark verified for password users
    profile.verified = true;
    writeUserData(phone, 'profile.json', profile);

    // ensure orders file exists
    const ordersPath = getUserDataPath(phone, 'orders.json');
    if (!fs.existsSync(ordersPath)) {
      writeUserData(phone, 'orders.json', []);
    }

    // permissions flags
    const permissions = {
      role: finalRole,
      can_access_admin: finalRole === 'admin',
      can_access_driver: finalRole === 'driver' || finalRole === 'admin',
      can_access_passenger: true
    };

    // sign JWT (HS256)
    const jwtSecret = process.env.JWT_SECRET || process.env.EDGE_JWT_SECRET || 'dev_local_secret_change_this';
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24 * (remember ? 30 : 7);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { iss: 'black-feather-taxi', iat: now, exp, sub: String(phone), role: finalRole, name: finalName };
    const b64url = (input) => Buffer.from(typeof input === 'string' ? input : JSON.stringify(input)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const unsigned = `${b64url(header)}.${b64url(payload)}`;
    const signature = crypto.createHmac('sha256', jwtSecret).update(unsigned).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const token = `${unsigned}.${signature}`;

    const userData = { token, userId: String(phone), phone: String(phone), name: finalName, role: finalRole, permissions };

    // å…¨åŸŸä½¿ç”¨è€…èˆ‡å€‹äººæª”æ¡ˆ upsert
    try {
      upsertUserToGlobal({ id: String(phone), phone: String(phone), password_hash: `${salt}:${hash}`, role: finalRole, name: finalName, created_at: new Date().toISOString(), remember_me: !!remember });
      upsertProfileToGlobal({ user_id: String(phone), vehicle_info: profile.car_plate || null, rating_avg: profile.rating_avg || null, total_orders: 0, current_status: status, location: profile.location || null });
    } catch (_) {}
    return res.json({ success: true, data: userData, message: 'è¨»å†ŠæˆåŠŸï¼ˆæœ¬åœ°é–‹ç™¼ï¼‰' });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'ä¼ºæœå™¨éŒ¯èª¤' });
  }
});

// å…¼å®¹åˆ¥åï¼šPOST /api/register
// èˆ‡ /auth/register ç›¸åŒï¼šæŽ¥æ”¶ phoneã€password ä¸¦å»ºç«‹ä½¿ç”¨è€…è³‡æ–™
app.post('/api/register', (req, res) => {
  try {
    const { phone, password, name, role = 'passenger', nickname, car_plate, remember } = req.body || {};
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'ç¼ºå°‘å¿…è¦æ¬„ä½ï¼šphone, password' });
    }

    // é˜²æ­¢é‡è¤‡è¨»å†Š
    const authPath = getUserDataPath(phone, 'auth.json');
    if (fs.existsSync(authPath)) {
      return res.status(409).json({ success: false, message: 'æ­¤è™Ÿç¢¼å·²è¨»å†Š' });
    }

    // å…¶ä»–é‡è¤‡æª¢æŸ¥ï¼ˆå…¨åŸŸå„²å­˜ / æ—¢æœ‰å€‹äººæª”æ¡ˆï¼‰
    try {
      const store = readGlobalStore();
      const existsInUsers = Array.isArray(store.users) && store.users.some(u => String(u.phone) === String(phone));
      const existsInProfiles = Array.isArray(store.profiles) && store.profiles.some(p => String(p.user_id) === String(phone));
      const profilePath = getUserDataPath(phone, 'profile.json');
      if (existsInUsers || existsInProfiles || fs.existsSync(profilePath)) {
        return res.status(409).json({ success: false, message: 'æ­¤è™Ÿç¢¼å·²è¨»å†Š' });
      }
    } catch (_) {}

    // é›œæ¹Šå¯†ç¢¼
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 64, 'sha512').toString('hex');
    writeUserData(phone, 'auth.json', { salt, hash, createdAt: new Date().toISOString() });

    // å»ºç«‹å€‹äººæª”æ¡ˆ
    const finalRole = ['passenger','driver','admin'].includes(String(role)) ? String(role) : 'passenger';
    const finalName = name && String(name).trim().length > 0 ? String(name).trim() : `User_${phone}`;
    const status = finalRole === 'driver' ? 'online' : 'idle';
    const profile = { phone, name: finalName, role: finalRole, status };
    if (finalRole === 'driver') {
      if (nickname) profile.nickname = String(nickname);
      if (car_plate) profile.car_plate = String(car_plate);
    }
    profile.verified = true; // å¯†ç¢¼è¨»å†Šç›´æŽ¥æ¨™è¨˜å·²é©—è­‰
    writeUserData(phone, 'profile.json', profile);

    // ç¢ºä¿è¨‚å–®æª”æ¡ˆå­˜åœ¨
    const ordersPath = getUserDataPath(phone, 'orders.json');
    if (!fs.existsSync(ordersPath)) {
      writeUserData(phone, 'orders.json', []);
    }

    // æ¬Šé™æ——æ¨™
    const permissions = {
      role: finalRole,
      can_access_admin: finalRole === 'admin',
      can_access_driver: finalRole === 'driver' || finalRole === 'admin',
      can_access_passenger: true
    };

    // ç°½ç™¼ JWTï¼ˆHS256ï¼‰
    const jwtSecret = process.env.JWT_SECRET || process.env.EDGE_JWT_SECRET || 'dev_local_secret_change_this';
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24 * (remember ? 30 : 7);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { iss: 'black-feather-taxi', iat: now, exp, sub: String(phone), role: finalRole, name: finalName };
    const b64url = (input) => Buffer.from(typeof input === 'string' ? input : JSON.stringify(input)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const unsigned = `${b64url(header)}.${b64url(payload)}`;
    const signature = crypto.createHmac('sha256', jwtSecret).update(unsigned).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const token = `${unsigned}.${signature}`;

    const userData = { token, userId: String(phone), phone: String(phone), name: finalName, role: finalRole, permissions };

    // å…¨åŸŸä½¿ç”¨è€…èˆ‡å€‹äººæª”æ¡ˆ upsert
    try {
      upsertUserToGlobal({ id: String(phone), phone: String(phone), password_hash: `${salt}:${hash}`, role: finalRole, name: finalName, created_at: new Date().toISOString(), remember_me: !!remember });
      upsertProfileToGlobal({ user_id: String(phone), vehicle_info: profile.car_plate || null, rating_avg: profile.rating_avg || null, total_orders: 0, current_status: status, location: profile.location || null });
    } catch (_) {}
    return res.json({ success: true, data: userData, message: 'è¨»å†ŠæˆåŠŸï¼ˆæœ¬åœ°é–‹ç™¼ï¼‰' });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'ä¼ºæœå™¨éŒ¯èª¤' });
  }
});

// Password-based login (local development)
// POST /auth/login-pwd { phone, password, remember? }
app.post('/auth/login-pwd', (req, res) => {
  try {
    const { phone, password, remember } = req.body || {};
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'ç¼ºå°‘å¿…è¦æ¬„ä½ï¼šphone, password' });
    }

    // load auth info
    const auth = readUserData(phone, 'auth.json', null);
    if (!auth || !auth.salt || !auth.hash) {
      return res.status(404).json({ success: false, message: 'ä½¿ç”¨è€…ä¸å­˜åœ¨æˆ–å°šæœªè¨­å®šå¯†ç¢¼' });
    }
    const candidate = crypto.pbkdf2Sync(String(password), auth.salt, 100000, 64, 'sha512').toString('hex');
    const isValid = candidate === auth.hash; // timingSafeEqual require Buffer length match; here hex strings fixed length
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'å¯†ç¢¼ä¸æ­£ç¢º' });
    }

    // profile
    const profile = readUserData(phone, 'profile.json', {});
    const finalRole = profile.role || 'passenger';
    const finalName = profile.name || `User_${phone}`;
    // permissions flags
    const permissions = {
      role: finalRole,
      can_access_admin: finalRole === 'admin',
      can_access_driver: finalRole === 'driver' || finalRole === 'admin',
      can_access_passenger: true
    };

    // sign JWT (HS256)
    const jwtSecret = process.env.JWT_SECRET || process.env.EDGE_JWT_SECRET || 'dev_local_secret_change_this';
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24 * (remember ? 30 : 7);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { iss: 'black-feather-taxi', iat: now, exp, sub: String(phone), role: finalRole, name: finalName };
    const b64url = (input) => Buffer.from(typeof input === 'string' ? input : JSON.stringify(input)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const unsigned = `${b64url(header)}.${b64url(payload)}`;
    const signature = crypto.createHmac('sha256', jwtSecret).update(unsigned).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const token = `${unsigned}.${signature}`;

    const userData = { token, userId: String(phone), phone: String(phone), name: finalName, role: finalRole, permissions };

    // å…¨åŸŸä½¿ç”¨è€…èˆ‡å€‹äººæª”æ¡ˆ upsertï¼ˆä¿è­‰å­˜åœ¨ï¼‰
    try {
      upsertUserToGlobal({ id: String(phone), phone: String(phone), role: finalRole, name: finalName });
      upsertProfileToGlobal({ user_id: String(phone), current_status: profile.status || 'idle', vehicle_info: profile.car_plate || null, rating_avg: profile.rating_avg || null, total_orders: profile.total_orders || 0, location: profile.location || null });
    } catch (_) {}
    return res.json({ success: true, data: userData, message: 'ç™»å…¥æˆåŠŸï¼ˆæœ¬åœ°é–‹ç™¼ï¼‰' });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'ä¼ºæœå™¨éŒ¯èª¤' });
  }
});

// å…¼å®¹åˆ¥åï¼šPOST /api/login
// èˆ‡ /auth/login-pwd ç›¸åŒï¼šé©—è­‰ phoneã€passwordï¼ŒæˆåŠŸå›žå‚³ auth_token
app.post('/api/login', (req, res) => {
  try {
    const { phone, password, remember } = req.body || {};
    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'ç¼ºå°‘å¿…è¦æ¬„ä½ï¼šphone, password' });
    }

    // è®€å–å¯†ç¢¼è³‡è¨Š
    const auth = readUserData(phone, 'auth.json', null);
    if (!auth || !auth.salt || !auth.hash) {
      return res.status(404).json({ success: false, message: 'å¸³è™Ÿä¸å­˜åœ¨' });
    }
    const candidate = crypto.pbkdf2Sync(String(password), auth.salt, 100000, 64, 'sha512').toString('hex');
    const isValid = candidate === auth.hash;
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'å¯†ç¢¼éŒ¯èª¤' });
    }

    // çµ„åˆä½¿ç”¨è€…è³‡æ–™
    const profile = readUserData(phone, 'profile.json', {});
    const finalRole = profile.role || 'passenger';
    const finalName = profile.name || `User_${phone}`;
    const permissions = {
      role: finalRole,
      can_access_admin: finalRole === 'admin',
      can_access_driver: finalRole === 'driver' || finalRole === 'admin',
      can_access_passenger: true
    };

    // ç°½ç™¼ JWTï¼ˆHS256ï¼‰
    const jwtSecret = process.env.JWT_SECRET || process.env.EDGE_JWT_SECRET || 'dev_local_secret_change_this';
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24 * (remember ? 30 : 7);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { iss: 'black-feather-taxi', iat: now, exp, sub: String(phone), role: finalRole, name: finalName };
    const b64url = (input) => Buffer.from(typeof input === 'string' ? input : JSON.stringify(input)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const unsigned = `${b64url(header)}.${b64url(payload)}`;
    const signature = crypto.createHmac('sha256', jwtSecret).update(unsigned).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const token = `${unsigned}.${signature}`;

    const userData = { token, userId: String(phone), phone: String(phone), name: finalName, role: finalRole, permissions };

    // upsert å…¨åŸŸè³‡æ–™
    try {
      upsertUserToGlobal({ id: String(phone), phone: String(phone), role: finalRole, name: finalName });
      upsertProfileToGlobal({ user_id: String(phone), current_status: profile.status || 'idle', vehicle_info: profile.car_plate || null, rating_avg: profile.rating_avg || null, total_orders: profile.total_orders || 0, location: profile.location || null });
    } catch (_) {}
    return res.json({ success: true, data: userData, message: 'ç™»å…¥æˆåŠŸï¼ˆæœ¬åœ°é–‹ç™¼ï¼‰' });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'ä¼ºæœå™¨éŒ¯èª¤' });
  }
});

// ===== Added API: Airtable Orders & Drivers =====
// GET /api/orders - list Airtable orders (optional ?status=狀態)
app.get('/api/orders', async (req, res) => {
  try {
    const { status } = req.query || {};
    const options = {};
    if (status) options.filterByFormula = Status = '';
    const records = await airtable('Orders').select(options).all();
    const orders = records.map(r => ({ id: r.id, ...r.fields }));
    return res.json({ success: true, data: orders });
  } catch (err) {
    console.error('GET /api/orders error', err?.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/orders/:id - update Airtable order fields
app.patch('/api/orders/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const fields = (req.body && req.body.fields) ? req.body.fields : req.body || {};
    if (!id || !fields || Object.keys(fields).length === 0) {
      return res.status(400).json({ success: false, message: 'id 與更新欄位為必填' });
    }
    const [record] = await airtable('Orders').update([{ id, fields }], { typecast: true });
    return res.json({ success: true, data: { id: record.id, ...record.fields } });
  } catch (err) {
    console.error('PATCH /api/orders/:id error', err?.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/drivers - list Airtable drivers (optional ?online=true)
app.get('/api/drivers', async (req, res) => {
  try {
    const { online } = req.query || {};
    const options = {};
    if (String(online).toLowerCase() === 'true') options.filterByFormula = "{Is Online}";
    const records = await airtable('Drivers').select(options).all();
    const drivers = records.map(r => ({ id: r.id, ...r.fields }));
    return res.json({ success: true, data: drivers });
  } catch (err) {
    console.error('GET /api/drivers error', err?.message || err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ===== End of Added API =====
// å‰ç«¯ fallback
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Health endpoint
// Health endpoint (with Airtable driver stats)
app.get('/api/health', async (req, res) => {
  try {
    let stats = null;
    try {
      const all = await airtable('Drivers').select().all();
      const total = all.length;
      const idle = all.filter(d => (d.fields.status || '').toLowerCase() === 'available').length;
      const busy = all.filter(d => (d.fields.status || '').toLowerCase() === 'on_trip').length;
      const offline = all.filter(d => (d.fields.status || '').toLowerCase() === 'offline').length;
      stats = { total, idle, busy, offline };
    } catch (_) {
      // Airtable ???,????????
      stats = null;
    }
    res.json({ status: 'ok', data: stats });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err?.message || 'unknown error' });
  }
});

server.listen(PORT, () => {
  const addr = server.address(); console.log(`[server] listening on ${addr?.address}:${addr?.port}`);
  console.log(`[env] PORT=${process.env.PORT || 3001}`);
  console.log(`server started`);
  // keep process alive (temporary workaround while we diagnose exit)
  setInterval(() => {}, 1 << 30);
});

export default app;


// ç™»å…¥ï¼ˆæœ¬åœ°é–‹ç™¼å¾Œæ´ï¼‰ï¼šç°½ç™¼ HS256 JWTï¼Œèˆ‡ Edge phone-login å°é½Š
app.post('/auth/login', (req, res) => {
  try {
    const { phone, role = 'passenger', name = '' } = req.body || {};
    if (!phone) {
      return res.status(400).json({ success: false, message: 'ç¼ºå°‘å¿…è¦åƒæ•¸ï¼šphone' });
    }

    // æª¢æŸ¥æ˜¯å¦å·²é©—è­‰
    const auth = readAuthState(phone);
    if (!auth?.isVerified) {
      return res.status(403).json({ 
        success: false, 
        error: { code: 'USER_NOT_VERIFIED', message: 'ç”¨æˆ¶å°šæœªå®Œæˆæ‰‹æ©Ÿé©—è­‰' },
        data: { verificationRequired: true }
      });
    }

    // å»ºç«‹/æ›´æ–°ä½¿ç”¨è€…åŸºæœ¬è³‡æ–™
    const profile = readUserData(phone, 'profile.json', {});
    const finalRole = (role || profile.role || 'passenger');
    const finalName = (name || profile.name || `ç”¨æˆ¶_${phone}`);
    const newProfile = { ...profile, phone, role: finalRole, name: finalName, status: profile.status || (finalRole === 'driver' ? 'online' : 'idle') };
    writeUserData(phone, 'profile.json', newProfile);

    // æ¬Šé™æ——æ¨™ï¼ˆèˆ‡ Edge å°é½Šï¼‰
    const permissions = {
      role: finalRole,
      can_access_admin: finalRole === 'admin',
      can_access_driver: finalRole === 'driver' || finalRole === 'admin',
      can_access_passenger: true
    };

    // ç°½ç™¼ JWTï¼ˆHS256ï¼‰
    const jwtSecret = process.env.JWT_SECRET || process.env.EDGE_JWT_SECRET || 'dev_local_secret_change_this';
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60 * 24 * 7; // 7 å¤©
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      iss: 'black-feather-taxi',
      iat: now,
      exp,
      sub: String(phone),
      role: finalRole,
      name: finalName
    };
    const b64url = (input) => Buffer.from(typeof input === 'string' ? input : JSON.stringify(input))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    const unsigned = `${b64url(header)}.${b64url(payload)}`;
    const signature = crypto.createHmac('sha256', jwtSecret).update(unsigned).digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    const token = `${unsigned}.${signature}`;

    const userData = {
      token,
      userId: phone,
      phone,
      name: finalName,
      role: finalRole,
      permissions
    };

    return res.json({ success: true, data: userData, message: 'ç™»å…¥æˆåŠŸï¼ˆæœ¬åœ°é–‹ç™¼ï¼‰' });
  } catch (error) {
    console.error('create order error', e);
    return res.status(500).json({ success: false, message: 'ä¼ºæœå™¨éŒ¯èª¤' });
  }
});













// 靜態前端託管（UTF-8 與 no-cache），同時支援 SPA fallback
app.use(express.static(distPath, {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    const p = (filePath || '').toLowerCase();
    if (p.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (p.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (p.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (p.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    } else if (p.endsWith('.txt')) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));
// SPA fallback（避免黑屏）
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(distPath, 'index.html'));
});
