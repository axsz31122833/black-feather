import { Router } from 'express';
import { db } from '../config/db.js';

const router = Router();

// 更新乘客定位（lat/lng），便於測試下單流程
// POST /riders/update_location { rider_id, lat, lng }
router.post('/update_location', async (req, res, next) => {
  try {
    const { rider_id, lat, lng } = req.body;
    if (rider_id == null || Number.isNaN(Number(rider_id))) {
      const err = new Error('rider_id must be a number');
      err.status = 400;
      throw err;
    }
    const updated = await db.oneOrNone(
      'UPDATE riders SET lat=$2, lng=$3 WHERE id=$1 RETURNING id, name, phone, lat, lng',
      [rider_id, lat, lng]
    );
    if (!updated) {
      const err = new Error('Rider not found');
      err.status = 404;
      throw err;
    }
    res.json({ message: 'location_updated', rider: updated });
  } catch (err) {
    next(err);
  }
});

export default router;