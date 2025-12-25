// Lightweight E2E script using native fetch (Node 18+)
const BASE_URL = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || 'http://localhost:3005';
const passengerPhone = process.env.PASSENGER_PHONE || '0987654001';
const driverPhone = process.env.DRIVER_PHONE || '090000001';
const passengerName = process.env.PASSENGER_NAME || '乘客測試';
const driverName = process.env.DRIVER_NAME || '司機測試';

async function sendOtp(phone, role, name) {
  const res = await fetch(`${BASE_URL}/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, role, name })
  });
  const data = await res.json();
  if (!data?.success) throw new Error(data?.message || 'send-otp failed');
  return data?.data?.devCode;
}

async function verifyPhone(phone, code) {
  const res = await fetch(`${BASE_URL}/auth/verify-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, verificationCode: code })
  });
  const data = await res.json();
  if (!data?.success) throw new Error(data?.message || 'verify-phone failed');
}

async function login(phone, role, name) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, role, name })
  });
  const data = await res.json();
  if (!data?.success) throw new Error(data?.message || 'login failed');
  return data?.data;
}

async function requestRide(passengerPhone) {
  const body = {
    passengerPhone,
    pickup: { lat: 25.033964, lng: 121.564468 },
    dropoff: { lat: 25.047759, lng: 121.531345 },
  };
  const res = await fetch(`${BASE_URL}/ride/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data?.success) throw new Error(data?.message || 'ride/request failed');
  return data?.data?.order || data?.order;
}

async function completeRide(orderId, driverPhone) {
  const body = { orderId, driverPhone };
  const res = await fetch(`${BASE_URL}/ride/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data) throw new Error('ride/complete no data');
  return data;
}

async function main() {
  console.log('[E2E] Base:', BASE_URL);
  console.log('[E2E] Accounts:', { passengerPhone, driverPhone });

  // Register & login passenger
  const pCode = await sendOtp(passengerPhone, 'passenger', passengerName);
  await verifyPhone(passengerPhone, pCode);
  const pLogin = await login(passengerPhone, 'passenger', passengerName);
  console.log('[E2E] Passenger login OK:', { id: pLogin.userId, role: pLogin.role });

  // Register & login driver (ensures driver exists and is online)
  const dCode = await sendOtp(driverPhone, 'driver', driverName);
  await verifyPhone(driverPhone, dCode);
  const dLogin = await login(driverPhone, 'driver', driverName);
  console.log('[E2E] Driver login OK:', { id: dLogin.userId, role: dLogin.role });

  // Request ride
  const order = await requestRide(passengerPhone);
  console.log('[E2E] Ride requested:', order);
  if (!order?.id) throw new Error('Invalid order result');

  // Complete ride
  const complete = await completeRide(order.id, driverPhone);
  console.log('[E2E] Ride complete:', complete);

  // Driver navigation link
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${order.pickup.lat},${order.pickup.lng}`;
  console.log('[E2E] Driver navigate:', gmaps);

  console.log('\n✅ Full E2E passed: register → login → request → assign → complete');
}

main().catch((err) => {
  console.error('❌ Full E2E failed:', err.message);
  process.exit(1);
});