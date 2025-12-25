import 'dotenv/config';
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID);

const orderId = process.argv[2];
if (!orderId) {
  console.error('Usage: node scripts/get-order.mjs <ORDER_ID>');
  process.exit(1);
}

try {
  const rec = await base('Orders').find(orderId);
  console.log('Order:', rec.id);
  console.log('Status:', rec.fields['Status']);
  console.log('Driver:', rec.fields['Driver']);
} catch (e) {
  console.error('❌ Fetch order error:', e);
  process.exitCode = 1;
}