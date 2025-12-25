// 費率計算規則
// 車資 = 基本車資 70 元 + 每公里 15 元 + 每分鐘 3 元；
// 若超過 20 公里，每多 1 公里加 10 元；
// 跑腿單（errand） → 車資 + 代墊金額 + 100 元；
// 代駕單（designated_driver） → 車資 × 2 + 300 元；

export function calculateFare(distanceMeters = 0, durationSeconds = 0, opts = {}) {
  const km = Math.max(0, Number(distanceMeters || 0) / 1000);
  const minutes = Math.max(0, Number(durationSeconds || 0) / 60);
  const base = 70 + (km * 15) + (minutes * 3);
  const over20 = Math.max(0, km - 20);
  const extra = over20 * 10;
  let total = base + extra;
  const serviceType = String(opts.service_type || opts.serviceType || 'standard');
  const deposit = Number(opts.deposit || 0);
  if (serviceType === 'errand') {
    total = total + deposit + 100;
  } else if (serviceType === 'designated_driver') {
    total = (total * 2) + 300;
  }
  return Math.round(total);
}

export default calculateFare;