export function floorToTen(n: number) {
  return Math.floor((n || 0) / 10) * 10
}

export function calcFare(km: number, mins: number) {
  const dist = Math.max(0, km || 0)
  const time = Math.max(0, mins || 0)
  const base = 70
  const core = 15 * dist + 3 * time
  const longExtra = dist > 20 ? 10 * (dist - 20) : 0
  return floorToTen(base + core + longExtra)
}

export const CANCEL_FEE = 100
