import 'dotenv/config';
import Airtable from 'airtable';

/**
 * Upsert a triple-role account into Airtable: Passengers, Drivers, and Admin (if exists).
 * Target phone: 0971827628; name/nickname: 豐哥; role: super_admin; invitation_code: ''
 *
 * Usage:
 *   node scripts/airtable-upsert-triple-account.mjs
 *   (Requires env AIRTABLE_PAT and AIRTABLE_BASE_ID)
 */

const apiKey = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
if (!apiKey || !baseId) {
  console.error('❌ 缺少 AIRTABLE_PAT/AIRTABLE_TOKEN 與 AIRTABLE_BASE_ID');
  process.exit(1);
}
const base = new Airtable({ apiKey }).base(baseId);

const PHONE = '0971827628';
const NAME = '豐哥';
const NICKNAME = '豐哥';
const ROLE = 'super_admin';
const INVITE = '';

async function ensureTableExists(tableName) {
  try {
    const recs = await base(tableName).select({ maxRecords: 1 }).firstPage();
    return true;
  } catch (e) {
    // If table does not exist, Airtable SDK throws an error
    console.warn(`⚠️ 資料表不存在或不可讀：${tableName}（${e?.message || e}）`);
    return false;
  }
}

async function upsertByPhone(tableName, fields) {
  const phoneFieldCandidates = ['phone', 'Phone'];
  const nameFieldCandidates = ['name', 'Name'];
  const nicknameFieldCandidates = ['nickname', 'Nickname'];
  const roleFieldCandidates = ['role', 'Role'];
  const inviteFieldCandidates = ['invitation_code', 'Invitation Code'];

  function setField(obj, candidates, value) {
    for (const k of candidates) {
      obj[k] = value;
    }
  }

  // Build fields payload that matches possible schema variants
  const payload = {};
  setField(payload, phoneFieldCandidates, fields.phone);
  if (fields.name) setField(payload, nameFieldCandidates, fields.name);
  if (fields.nickname) setField(payload, nicknameFieldCandidates, fields.nickname);
  if (fields.role) setField(payload, roleFieldCandidates, fields.role);
  if (typeof fields.invitation_code !== 'undefined') setField(payload, inviteFieldCandidates, fields.invitation_code);

  // Try to find existing record by phone (filterByFormula)
  const filterFormula = phoneFieldCandidates
    .map((pf) => `LOWER({${pf}}) = '${String(fields.phone).toLowerCase()}'`)
    .join(' OR ');

  try {
    const found = await base(tableName)
      .select({ filterByFormula: filterFormula, maxRecords: 1 })
      .firstPage();

    if (found && found.length > 0) {
      const rec = found[0];
      const updated = await base(tableName).update([
        { id: rec.id, fields: payload }
      ], { typecast: true });
      console.log(`✅ 更新 ${tableName}：`, updated[0].id, updated[0].fields);
      return updated[0];
    }

    const created = await base(tableName).create([
      { fields: payload }
    ], { typecast: true });
    console.log(`✅ 新增 ${tableName}：`, created[0].id, created[0].fields);
    return created[0];
  } catch (e) {
    console.error(`❌ upsert 失敗（${tableName}）：`, e?.message || e);
    throw e;
  }
}

async function main() {
  console.log('🚀 開始 upsert 三合一帳號到 Airtable');
  const passengersExists = await ensureTableExists('Passengers');
  const driversExists = await ensureTableExists('Drivers');
  const adminExists = await ensureTableExists('Admin');

  // Passengers
  if (passengersExists) {
    await upsertByPhone('Passengers', {
      phone: PHONE,
      name: NAME,
      role: ROLE,
      invitation_code: INVITE,
    });
  } else {
    console.warn('⚠️ 略過 Passengers（表不存在）');
  }

  // Drivers
  if (driversExists) {
    await upsertByPhone('Drivers', {
      phone: PHONE,
      name: NAME,
      nickname: NICKNAME,
      role: ROLE,
      invitation_code: INVITE,
    });
  } else {
    console.warn('⚠️ 略過 Drivers（表不存在）');
  }

  // Admin（若存在）
  if (adminExists) {
    await upsertByPhone('Admin', {
      phone: PHONE,
      role: ROLE,
      invitation_code: INVITE,
    });
  } else {
    console.warn('ℹ️ Admin 表不存在，已略過（非致命）。');
  }

  console.log('🎉 完成 upsert：0971827628 針對 Passengers/Drivers/Admin（如有）');
}

main().catch((err) => {
  console.error('❌ 程式錯誤：', err?.message || err);
  process.exit(1);
});