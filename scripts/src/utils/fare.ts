export function computeFare(min: number, km: number) {
  const base = 70 + (km * 15) + (min * 3) + (km > 20 ? (km - 20) * 10 : 0)
  return Math.round(base)
}
export function computeCashback(price: number) {
  return Math.floor(price / 100) * 10 + 20
}
export function calculateFare(min: number, km: number) {
  return computeFare(min, km)
}
export function fareBreakdown(min: number, km: number) {
  const distanceFee = Math.round(km * 15)
  const timeFee = Math.round(min * 3)
  const longFee = km > 20 ? Math.round((km - 20) * 10) : 0
  return { distanceFee, timeFee, longFee }
}
