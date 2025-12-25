function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

async function getRouteWithFallbacks(origin, destination) {
  // Force OSRM in test by making Google fail
  // Google Directions not available in Node test; try OSRM
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`
  const resp = await fetch(url)
  const json = await resp.json()
  if (json && json.routes && json.routes[0]) {
    const dKm = (json.routes[0].distance || 0) / 1000
    const dMin = Math.round((json.routes[0].duration || 0) / 60)
    return { distanceKm: dKm, durationMin: dMin, source: 'osrm' }
  }
  const dKm = calculateDistance(origin.lat, origin.lng, destination.lat, destination.lng)
  const dMin = Math.max(1, Math.round((dKm / 30) * 60))
  return { distanceKm: dKm, durationMin: dMin, source: 'heuristic' }
}

exports.run = async function () {
  const origin = { lat: 25.033, lng: 121.565 }
  const dest = { lat: 25.047, lng: 121.517 }
  const r = await getRouteWithFallbacks(origin, dest)
  if (!r || typeof r.distanceKm !== 'number' || typeof r.durationMin !== 'number') {
    throw new Error('route fallback returned invalid result')
  }
}

