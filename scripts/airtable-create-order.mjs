import Airtable from 'airtable';
import dotenv from 'dotenv';

dotenv.config();

/**
 * 建立示範乘客與訂單（符合 Base Structure Builder 的欄位命名）
 * Passengers 欄位：Name, Phone, Email, Common Places, Glide User ID, Order Type, Scheduled Time, Created At
 * Orders 欄位：Status, Type, Pickup/Dropoff Address + Lat/Lng, Distance (km), Duration (min), Fare Estimate, Passenger Comment, Created At, Completed At, Passenger, Driver
 */

const AIRTABLE_PAT = process.env.AIRTABLE_PAT || process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
  console.error('❌ 缺少環境變數 AIRTABLE_PAT/AIRTABLE_TOKEN 或 AIRTABLE_BASE_ID');
  process.exit(1);
}

const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

async function main() {
  try {
    // 1) 建立一筆示範乘客
    const [passenger] = await base('Passengers').create(
      [
        {
          fields: {
            'Name': '示範乘客',
            'Phone': '0912345678',
            'Email': 'demo@example.com',
            'Common Places': '台北市政府\n台北車站',
            'Glide User ID': 'glide_user_demo_1',
            'Order Type': '即時單',
            'Scheduled Time': new Date().toISOString(),
          },
        },
      ],
      { typecast: true }
    );

    console.log('✅ 已建立乘客：', passenger.id, passenger.fields['Name']);

    // 2) 建立一筆等待中訂單（Status=等待中, Type=一般叫車）
    const pickupLat = 25.0375;
    const pickupLng = 121.5645;
    const dropoffLat = 25.0478;
    const dropoffLng = 121.5170;

    const [order] = await base('Orders').create(
      [
        {
          fields: {
            'Passenger': [{ id: passenger.id }],
            'Status': '等待中',
            'Type': '一般叫車',
            'Pickup Address': '台北市信義區市府路1號',
            'Pickup Lat': pickupLat,
            'Pickup Lng': pickupLng,
            'Dropoff Address': '台北車站',
            'Dropoff Lat': dropoffLat,
            'Dropoff Lng': dropoffLng,
            'Distance (km)': 7.5,
            'Duration (min)': 18,
            'Fare Estimate': 250,
            'Passenger Comment': '',
            'Created At': new Date().toISOString(),
          },
        },
      ],
      { typecast: true }
    );

    console.log('✅ 已建立訂單：', order.id, order.fields['Status']);
    console.log('\n下一步：執行自動派車腳本 -> node scripts/airtable-auto-dispatch.mjs');
  } catch (err) {
    console.error('❌ 建立乘客/訂單失敗：', err?.message || err);
    if (err?.response?.body) {
      try {
        console.error('API 錯誤內容：', JSON.stringify(JSON.parse(err.response.body), null, 2));
      } catch (_) {
        console.error('原始錯誤內容：', err.response.body);
      }
    }
    process.exit(1);
  }
}

main();