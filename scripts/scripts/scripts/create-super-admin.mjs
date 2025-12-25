import 'dotenv/config';
import Airtable from 'airtable';

// Create a super_admin record in Drivers table for initial access
const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID);

const name = process.env.SUPERADMIN_NAME || '超級管理員';
const phone = process.env.SUPERADMIN_PHONE || '0999999999';
const lat = Number(process.env.SUPERADMIN_LAT ?? 25.0421);
const lng = Number(process.env.SUPERADMIN_LNG ?? 121.5083);
const nickname = process.env.SUPERADMIN_NICKNAME || 'Admin';
const plate = process.env.SUPERADMIN_LICENSE_PLATE || 'ADM-0000';
const inviteCode = process.env.SUPERADMIN_INVITE_CODE || '';

try {
  const created = await base('Drivers').create([
    {
      fields: {
        'Name': name,
        'Phone': phone,
        'Nickname': nickname,
        'License Plate': plate,
        'Is Online': true,
        'Current Lat': lat,
        'Current Lng': lng,
        'Last Update': new Date().toISOString(),
        'role': 'super_admin',
        'invitation_code': inviteCode
      }
    }
  ], { typecast: true });
  const rec = created[0];
  console.log('✅ Created super_admin (Drivers):', rec.id, rec.fields);
} catch (e) {
  console.error('❌ Create super_admin error:', e);
  process.exitCode = 1;
}