import { Router } from 'express';
import { requestRide, acceptRide, startRide, completeRide, cancelRide, markDriverArrived } from '../services/ridesService.js';

const router = Router();

// 1) POST /rides/request
router.post('/request', async (req, res, next) => {
  try {
    const { rider_id, end_lat, end_lng } = req.body;
    const result = await requestRide({ rider_id, end_lat, end_lng });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 2) POST /rides/accept
router.post('/accept', async (req, res, next) => {
  try {
    const { ride_id, driver_id } = req.body;
    const ride = await acceptRide({ ride_id, driver_id });
    res.json({ message: 'accepted', ride });
  } catch (err) {
    next(err);
  }
});

// 3) POST /rides/start
router.post('/start', async (req, res, next) => {
  try {
    const { ride_id } = req.body;
    const ride = await startRide({ ride_id });
    res.json({ message: 'ongoing', ride });
  } catch (err) {
    next(err);
  }
});

// 4) POST /rides/complete
router.post('/complete', async (req, res, next) => {
  try {
    const { ride_id } = req.body;
    const ride = await completeRide({ ride_id });
    res.json({ message: 'completed', ride });
  } catch (err) {
    next(err);
  }
});

// 5) POST /rides/cancel
// 規則：
// - 若 ride.status in ('dispatched','accepted') 且 driver_arrived_at > 3 分鐘，回傳 { confirm:true, fee:100 }
// - 否則正常取消：rides.status -> 'cancelled'，drivers.status -> 'idle'
router.post('/cancel', async (req, res, next) => {
  try {
    const { ride_id, force } = req.body; // force=true 代表使用者已確認需付費，直接取消
    const result = await cancelRide({ ride_id, force: Boolean(force) });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 6) POST /rides/driver-arrived 供司機到站時呼叫，記錄到站時間
router.post('/driver-arrived', async (req, res, next) => {
  try {
    const { ride_id } = req.body;
    const ride = await markDriverArrived({ ride_id });
    res.json({ message: 'driver_arrived_recorded', ride });
  } catch (err) {
    next(err);
  }
});

export default router;