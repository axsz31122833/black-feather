import 'dotenv/config';
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID);

const name = process.env.DRIVER_NAME || '測試司機 A';
const phone = process.env.DRIVER_PHONE || '0900000999';
const lat = Number(process.env.DRIVER_LAT ?? 25.0421);
const lng = Number(process.env.DRIVER_LNG ?? 121.5083);
const carModel = process.env.DRIVER_CAR_MODEL || 'Toyota';
const plate = process.env.DRIVER_LICENSE_PLATE || 'ABC-1234';

try {
  const created = await base('Drivers').create([
    {
      fields: {
        'Name': name,
        'Phone': phone,
        'Car Model': carModel,
        'License Plate': plate,
        'Is Online': true,
        'Current Lat': lat,
        'Current Lng': lng,
        'Last Update': new Date().toISOString()
      }
    }
  ], { typecast: true });
  const rec = created[0];
  console.log('✅ Created driver:', rec.id, rec.fields);
} catch (e) {
  console.error('❌ Create driver error:', e);
  process.exitCode = 1;
}