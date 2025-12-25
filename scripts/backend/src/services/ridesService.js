import { db } from '../config/db.js';

function assertNumber(value, name) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    const err = new Error(`${name} must be a number`);
    err.status = 400;
    throw err;
  }
}

export async function requestRide({ rider_id, end_lat, end_lng }) {
  assertNumber(rider_id, 'rider_id');
  assertNumber(end_lat, 'end_lat');
  assertNumber(end_lng, 'end_lng');

  return db.tx(async (t) => {
    // 取得乘客座標
    const rider = await t.oneOrNone(
      'SELECT id, name, lat, lng FROM riders WHERE id = $1',
      [rider_id]
    );
    if (!rider) {
      const err = new Error('Rider not found');
      err.status = 404;
      throw err;
    }
    if (rider.lat == null || rider.lng == null) {
      const err = new Error('Rider has no location');
      err.status = 400;
      throw err;
    }

    // 以 CTE 保留最近 idle 司機並將其狀態設為 busy（原子操作）
    const reserveSql = `
      WITH candidate AS (
        SELECT id, name, lat, lng
        FROM drivers
        WHERE status = 'idle' AND lat IS NOT NULL AND lng IS NOT NULL
        ORDER BY ST_DistanceSphere(
          ST_MakePoint(lng, lat),
          ST_MakePoint($2, $1)
        )
        LIMIT 1
      )
      UPDATE drivers d
      SET status = 'busy'
      FROM candidate c
      WHERE d.id = c.id
      RETURNING d.id, c.name, c.lat, c.lng
    `;
    const reserved = await t.oneOrNone(reserveSql, [rider.lat, rider.lng]);
    if (!reserved) {
      return { message: 'No idle drivers available' };
    }

    // 建立行程（dispatched）
    const ride = await t.one(
      `
      INSERT INTO rides (rider_id, driver_id, status, start_lat, start_lng, end_lat, end_lng, created_at)
      VALUES ($1, $2, 'dispatched', $3, $4, $5, $6, NOW())
      RETURNING id, rider_id, driver_id, status, start_lat, start_lng, end_lat, end_lng, created_at
      `,
      [rider.id, reserved.id, rider.lat, rider.lng, end_lat, end_lng]
    );

    return {
      message: 'Driver dispatched',
      rider: { id: rider.id, name: rider.name, lat: rider.lat, lng: rider.lng },
      driver: { id: reserved.id, name: reserved.name, lat: reserved.lat, lng: reserved.lng },
      ride,
    };
  });
}

export async function acceptRide({ ride_id, driver_id }) {
  assertNumber(ride_id, 'ride_id');
  assertNumber(driver_id, 'driver_id');

  const ride = await db.oneOrNone(
    'SELECT id, rider_id, driver_id, status FROM rides WHERE id = $1',
    [ride_id]
  );
  if (!ride) {
    const err = new Error('Ride not found');
    err.status = 404;
    throw err;
  }
  if (ride.driver_id !== Number(driver_id)) {
    const err = new Error('Driver mismatch for this ride');
    err.status = 400;
    throw err;
  }

  const updated = await db.one(
    'UPDATE rides SET status = \"accepted\" WHERE id = $1 RETURNING id, rider_id, driver_id, status',
    [ride_id]
  );
  return updated;
}

export async function startRide({ ride_id }) {
  assertNumber(ride_id, 'ride_id');

  const updated = await db.oneOrNone(
    'UPDATE rides SET status = \"ongoing\" WHERE id = $1 RETURNING id, rider_id, driver_id, status',
    [ride_id]
  );
  if (!updated) {
    const err = new Error('Ride not found');
    err.status = 404;
    throw err;
  }
  return updated;
}

export async function completeRide({ ride_id }) {
  assertNumber(ride_id, 'ride_id');

  return db.tx(async (t) => {
    const ride = await t.oneOrNone(
      'SELECT id, rider_id, driver_id, status FROM rides WHERE id = $1',
      [ride_id]
    );
    if (!ride) {
      const err = new Error('Ride not found');
      err.status = 404;
      throw err;
    }

    const updatedRide = await t.one(
      'UPDATE rides SET status = \"completed\" WHERE id = $1 RETURNING id, rider_id, driver_id, status',
      [ride_id]
    );

    await t.none('UPDATE drivers SET status = \"idle\" WHERE id = $1', [ride.driver_id]);

    return updatedRide;
  });
}

export async function findNearbyDrivers({ lat, lng, limit = 5 }) {
  assertNumber(lat, 'lat');
  assertNumber(lng, 'lng');
  assertNumber(limit, 'limit');

  const rows = await db.any(
    `
    SELECT id, name, lat, lng, status,
           ST_DistanceSphere(ST_MakePoint(lng, lat), ST_MakePoint($2, $1)) AS distance_m
    FROM drivers
    WHERE lat IS NOT NULL AND lng IS NOT NULL
    ORDER BY distance_m ASC
    LIMIT $3
    `,
    [lat, lng, limit]
  );

  return rows;
}

// 取消行程：
// - 若 ride.status in ('dispatched','accepted') 且 driver_arrived_at > 3 分鐘，先回覆需要確認（不直接取消）
// - 若 force=true 或不需確認，則取消行程並將司機狀態改回 idle
export async function cancelRide({ ride_id, force = false }) {
  assertNumber(ride_id, 'ride_id');

  return db.tx(async (t) => {
    const ride = await t.oneOrNone(
      'SELECT id, rider_id, driver_id, status, driver_arrived_at FROM rides WHERE id = $1',
      [ride_id]
    );
    if (!ride) {
      const err = new Error('Ride not found');
      err.status = 404;
      throw err;
    }

    const needConfirmStatuses = new Set(['dispatched', 'accepted']);
    if (needConfirmStatuses.has(ride.status)) {
      if (ride.driver_arrived_at) {
        const arrivedAt = new Date(ride.driver_arrived_at).getTime();
        const now = Date.now();
        const diffMs = now - arrivedAt; // 到站後經過的毫秒數
        const threeMinutesMs = 3 * 60 * 1000;
        if (diffMs > threeMinutesMs && !force) {
          // 提示需要付費確認
          return { confirm: true, fee: 100 };
        }
      }
    }

    // 執行取消與司機狀態回復
    const updatedRide = await t.one(
      'UPDATE rides SET status = \"cancelled\" WHERE id = $1 RETURNING id, rider_id, driver_id, status',
      [ride_id]
    );
    await t.none('UPDATE drivers SET status = \"idle\" WHERE id = $1', [ride.driver_id]);
    return { message: 'cancelled', ride: updatedRide };
  });
}

// 記錄司機到站時間
export async function markDriverArrived({ ride_id }) {
  assertNumber(ride_id, 'ride_id');
  const updated = await db.oneOrNone(
    'UPDATE rides SET driver_arrived_at = NOW() WHERE id = $1 RETURNING id, driver_arrived_at, status',
    [ride_id]
  );
  if (!updated) {
    const err = new Error('Ride not found');
    err.status = 404;
    throw err;
  }
  return updated;
}