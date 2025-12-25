import dotenv from 'dotenv';
import { db } from '../config/db.js';

dotenv.config();

async function updateRiderLocation(riderId, lat, lng) {
  if (!riderId) throw new Error('riderId is required');
  const r = await db.oneOrNone(
    'UPDATE riders SET lat=$2, lng=$3 WHERE id=$1 RETURNING id, name, phone, lat, lng',
    [Number(riderId), Number(lat), Number(lng)]
  );
  if (!r) throw new Error('Rider not found');
  return r;
}

if (import.meta.main) {
  const riderId = process.env.RIDER_ID || process.argv[2];
  const lat = process.env.RIDER_LAT || process.argv[3] || 25.0478;
  const lng = process.env.RIDER_LNG || process.argv[4] || 121.5170;
  updateRiderLocation(riderId, lat, lng)
    .then((r) => {
      console.log(JSON.stringify({ success: true, rider: r }));
      process.exit(0);
    })
    .catch((err) => {
      console.error(JSON.stringify({ success: false, error: err.message }));
      process.exit(1);
    });
}

export { updateRiderLocation };