/*
  Simple E2E: request a ride and then complete it (fixed)
  Usage: node scripts/e2e-request-complete.fixed.js
*/

const base = process.env.API_BASE_URL || 'http://localhost:3001';
const passengerPhone = process.env.PASSENGER_PHONE || '0987654001';
// fallback driver phone if backend didn't return assignment
const defaultDriverPhone = process.env.DRIVER_PHONE || '090000001';

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('Non-JSON response from ' + url + ': ' + text); }
  if (!res.ok) { throw new Error('HTTP ' + res.status + ' for ' + url + ': ' + text); }
  return data;
}

async function main() {
  console.log('Base URL: ' + base);
  console.log('Passenger: ' + passengerPhone + ' | Driver(default): ' + defaultDriverPhone);

  const requestBody = {
    passengerPhone,
    pickup: { lat: 25.033964, lng: 121.564468 },
    dropoff: { lat: 25.047759, lng: 121.531345 },
  };

  console.log('\n--- Requesting Ride ---');
  const requestResp = await jsonFetch(base + '/ride/request', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
  console.log('Request Response:', JSON.stringify(requestResp, null, 2));

  const orderObj = requestResp && requestResp.data && requestResp.data.order ? requestResp.data.order : requestResp.order;
  const orderId = orderObj && orderObj.id;
  if (!orderId) throw new Error('No orderId returned from request');
  console.log('Order ID: ' + orderId);

  const driverPhoneForCompletion = (requestResp && requestResp.driver && requestResp.driver.phone) || (orderObj && orderObj.driverPhone) || defaultDriverPhone;
  console.log('\n--- Completing Ride ---');
  console.log('Using driver phone: ' + driverPhoneForCompletion);

  const completeBody = { orderId, driverPhone: driverPhoneForCompletion };
  const completeResp = await jsonFetch(base + '/ride/complete', {
    method: 'POST',
    body: JSON.stringify(completeBody),
  });
  console.log('Complete Response:', JSON.stringify(completeResp, null, 2));

  console.log('\nE2E finished successfully.');
}

main().catch((err) => {
  console.error('E2E failed:', err);
  process.exit(1);
});
