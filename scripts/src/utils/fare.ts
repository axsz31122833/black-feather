export function computeFare(km: number, min: number) {
  const base = 70 + (km * 15) + (min * 3) + (km > 20 ? (km - 20) * 10 : 0)
  return Math.max(Math.round(base), 100)
}
export function computeCashback(price: number) {
  return Math.floor(price / 100) * 10 + 20
}
export function calculateFare(km: number, min: number) {
  return computeFare(km, min)
}
export function fareBreakdown(km: number, min: number) {
  const distanceFee = Math.round(km * 15)
  const timeFee = Math.round(min * 3)
  const longFee = km > 20 ? Math.round((km - 20) * 10) : 0
  return { distanceFee, timeFee, longFee }
}
