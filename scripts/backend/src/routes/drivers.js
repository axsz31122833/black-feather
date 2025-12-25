import { Router } from 'express';
import { findNearbyDrivers } from '../services/ridesService.js';
import { db } from '../config/db.js';

const router = Router();

// GET /drivers/nearby?lat=&lng=&limit=5
router.get('/nearby', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const limit = parseInt(req.query.limit ?? '5', 10);
    const drivers = await findNearbyDrivers({ lat, lng, limit });
    res.json({ drivers });
  } catch (err) {
    next(err);
  }
});

export default router;

// 司機上線並定位：更新 lat/lng 並設為 idle
router.post('/online', async (req, res, next) => {
  try {
    const { driver_id, lat, lng } = req.body;
    const updated = await db.oneOrNone(
      'UPDATE drivers SET lat=$2, lng=$3, status=\"idle\" WHERE id=$1 RETURNING id, name, phone, status, lat, lng',
      [driver_id, lat, lng]
    );
    if (!updated) {
      const err = new Error('Driver not found');
      err.status = 404;
      throw err;
    }
    res.json({ message: 'online', driver: updated });
  } catch (err) {
    next(err);
  }
});

// 更新司機定位（不變更狀態）
router.post('/update_location', async (req, res, next) => {
  try {
    const { driver_id, lat, lng } = req.body;
    const updated = await db.oneOrNone(
      'UPDATE drivers SET lat=$2, lng=$3 WHERE id=$1 RETURNING id, name, phone, status, lat, lng',
      [driver_id, lat, lng]
    );
    if (!updated) {
      const err = new Error('Driver not found');
      err.status = 404;
      throw err;
    }
    res.json({ message: 'location_updated', driver: updated });
  } catch (err) {
    next(err);
  }
});