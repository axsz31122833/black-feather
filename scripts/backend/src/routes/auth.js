import { Router } from 'express';
import { db } from '../config/db.js';

const router = Router();

// 註冊：乘客 / 司機 / 超級管理員（手機=0982214855）
// 規則：
// - 司機必填邀請碼，且必須為 0971827628 或 0982214855
// - 乘客無需邀請碼
// - 超級管理員：若 phone=0982214855，免邀請碼，role=super_admin（此處資料存入 drivers，invite_code='SUPER_ADMIN'）
router.post('/register', async (req, res, next) => {
  try {
    const { role, name, phone, invite_code } = req.body;
    if (!role || !name || !phone) {
      const err = new Error('role, name, phone are required');
      err.status = 400;
      throw err;
    }

    const SUPER_ADMIN_PHONE = '0982214855';
    const VALID_DRIVER_CODES = new Set(['0971827628', '0982214855']);

    if (role === 'driver') {
      if (phone === SUPER_ADMIN_PHONE) {
        // 升級為超級管理員
        const exists = await db.oneOrNone('SELECT id FROM drivers WHERE phone = $1', [phone]);
        if (exists) {
          return res.json({ message: 'already_registered', role: 'super_admin', driver_id: exists.id });
        }
        const d = await db.one(
          'INSERT INTO drivers (name, phone, status, invite_code) VALUES ($1, $2, \"idle\", $3) RETURNING id, name, phone, status',
          [name, phone, 'SUPER_ADMIN']
        );
        return res.json({ message: 'registered', role: 'super_admin', driver: d });
      }
      if (!invite_code || !VALID_DRIVER_CODES.has(String(invite_code))) {
        const err = new Error('invalid invite_code for driver');
        err.status = 400;
        throw err;
      }
      const exists = await db.oneOrNone('SELECT id FROM drivers WHERE phone = $1', [phone]);
      if (exists) {
        return res.json({ message: 'already_registered', role: 'driver', driver_id: exists.id });
      }
      const d = await db.one(
        'INSERT INTO drivers (name, phone, status, invite_code) VALUES ($1, $2, \"idle\", $3) RETURNING id, name, phone, status, invite_code',
        [name, phone, invite_code]
      );
      return res.json({ message: 'registered', role: 'driver', driver: d });
    }

    if (role === 'rider') {
      const exists = await db.oneOrNone('SELECT id FROM riders WHERE phone = $1', [phone]);
      if (exists) {
        return res.json({ message: 'already_registered', role: 'rider', rider_id: exists.id });
      }
      const r = await db.one(
        'INSERT INTO riders (name, phone) VALUES ($1, $2) RETURNING id, name, phone',
        [name, phone]
      );
      return res.json({ message: 'registered', role: 'rider', rider: r });
    }

    const err = new Error('unsupported role');
    err.status = 400;
    throw err;
  } catch (err) {
    next(err);
  }
});

export default router;