export function calculateFare(minutes: number, kilometers: number): number {
  const base = 70
  const perMinute = minutes * 3
  const longKm = Math.max(0, kilometers - 20)
  const normalKm = kilometers - longKm
  const perKm = normalKm * 15 + longKm * 25
  const total = base + perMinute + perKm
  const rounded = Math.round(total / 10) * 10
  return Math.max(100, rounded)
}

export function fareBreakdown(minutes: number, kilometers: number) {
  const base = 70
  const timeFee = minutes * 3
  const longKm = Math.max(0, kilometers - 20)
  const normalKm = kilometers - longKm
  const distanceFee = normalKm * 15
  const longFee = longKm * 25
  const totalRaw = base + timeFee + distanceFee + longFee
  const total = Math.max(100, Math.round(totalRaw / 10) * 10)
  return { base, timeFee, distanceFee, longFee, total }
}
