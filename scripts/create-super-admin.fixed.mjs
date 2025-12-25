import 'dotenv/config';
import Airtable from 'airtable';

// Create a super_admin record in Drivers table for initial access (fixed fields)
const apiKey = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
if (!apiKey || !baseId) {
  console.error('❌ 缺少 AIRTABLE_PAT/AIRTABLE_TOKEN 與 AIRTABLE_BASE_ID');
  process.exit(1);
}
const base = new Airtable({ apiKey }).base(baseId);

const name = process.env.SUPERADMIN_NAME || '超級管理員';
const phone = process.env.SUPERADMIN_PHONE || '0999999999';
const lat = Number(process.env.SUPERADMIN_LAT ?? 25.0421);
const lng = Number(process.env.SUPERADMIN_LNG ?? 121.5083);
const nickname = process.env.SUPERADMIN_NICKNAME || 'Admin';
const plate = process.env.SUPERADMIN_LICENSE_PLATE || 'ADM-0000';
const carModel = process.env.SUPERADMIN_CAR_MODEL || 'Fleet-Admin';
const inviteCode = process.env.SUPERADMIN_INVITE_CODE || '';

try {
  const created = await base('Drivers').create([
    {
      fields: {
        'Name': name,
        'Phone': phone,
        'Nickname': nickname,
        'Car Model': carModel,
        'License Plate': plate,
        'Is Online': true,
        'location_lat': lat,
        'location_lng': lng,
        'Last Update': new Date().toISOString(),
        'role': 'super_admin',
        'invitation_code': inviteCode,
      }
    }
  ], { typecast: true });
  const rec = created[0];
  console.log('✅ Created super_admin (Drivers):', rec.id, rec.fields);
} catch (e) {
  console.error('❌ Create super_admin error:', e?.message || e);
  process.exitCode = 1;
}