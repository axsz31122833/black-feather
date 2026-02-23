export function computeFare(km: number, min: number) {
  const baseFare = 85
  const perKm = 10
  const perMin = 2
  const longRate = 8
  const base = baseFare + (km * perKm) + (min * perMin) + (km > 20 ? (km - 20) * longRate : 0)
  return Math.max(Math.round(base / 10) * 10, 70)
}
export function computeCashback(price: number) {
  return Math.floor(price / 100) * 10 + 20
}
export function calculateFare(km: number, min: number) {
  return computeFare(km, min)
}
export function fareBreakdown(km: number, min: number) {
  const perKm = 10
  const perMin = 2
  const longRate = 8
  const distanceFee = Math.round(km * perKm)
  const timeFee = Math.round(min * perMin)
  const longFee = km > 20 ? Math.round((km - 20) * longRate) : 0
  return { distanceFee, timeFee, longFee }
}
