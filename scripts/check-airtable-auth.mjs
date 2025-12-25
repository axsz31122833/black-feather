import 'dotenv/config';
import fetch from 'node-fetch';

const token = process.env.AIRTABLE_PAT;
const baseId = process.env.AIRTABLE_BASE_ID;

if (!token || !baseId) {
  console.error('❌ 缺少 AIRTABLE_PAT 或 AIRTABLE_BASE_ID');
  process.exit(1);
}

async function checkAuth() {
  console.log('🔍 正在檢查 Airtable 權限...');
  const metaUrl = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;

  try {
    const res = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    if (res.ok) {
      console.log('✅ 已成功連線 Airtable Base：', baseId);
      console.log('📄 偵測到以下表格：');
      data.tables.forEach(t => console.log(` - ${t.name} (${t.id})`));
    } else {
      console.error('❌ 無法讀取 Base：', data?.error?.message || data);
    }
  } catch (err) {
    console.error('⚠️ 發生錯誤：', err.message);
  }

  // 嘗試建立測試資料
  console.log('\n🧪 嘗試建立測試記錄...');
  try {
    const testRes = await fetch(`https://api.airtable.com/v0/${baseId}/System_Monitor`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [
          {
            fields: {
              Name: '權限測試紀錄',
              Status: 'OK',
              Timestamp: new Date().toISOString(),
            },
          },
        ],
      }),
    });
    const testData = await testRes.json();

    if (testRes.ok) {
      console.log('✅ 成功建立測試記錄！');
    } else {
      console.error('❌ 無法寫入資料：', testData?.error?.message || testData);
    }
  } catch (err) {
    console.error('⚠️ 錯誤：', err.message);
  }
}

checkAuth();
