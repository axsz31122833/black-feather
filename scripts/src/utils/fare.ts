export function calculateFare(minutes: number, kilometers: number): number {
  const base = 70
  const perMinute = minutes * 3
  const longKm = Math.max(0, kilometers - 20)
  const normalKm = kilometers - longKm
  const perKm = normalKm * 15 + longKm * 25
  const total = Math.round(base + perMinute + perKm)
  return Math.max(100, total)
}
