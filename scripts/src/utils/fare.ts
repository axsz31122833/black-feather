export function computeFare(km: number, min: number) {
  const base = 70 + (km * 15) + (min * 3) + (km > 20 ? (km - 20) * 10 : 0)
  return Math.max(Math.round(base), 100)
}
export function computeCashback(price: number) {
  return Math.floor(price / 100) * 10 + 20
}
