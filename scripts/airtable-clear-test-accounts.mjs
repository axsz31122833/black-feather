import 'dotenv/config';
import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_PAT }).base(process.env.AIRTABLE_BASE_ID);

function isTestAccount(fields = {}) {
  const email = String(fields.email || fields.Email || '').toLowerCase();
  const name = String(fields.name || fields.Name || '').toLowerCase();
  const phone = String(fields.phone || fields.Phone || '').toLowerCase();
  const notes = String(fields.notes || fields.Notes || '').toLowerCase();
  const flags = [fields.is_test, fields.isTest, fields['Is Test'], fields['is_test']].map(v => Boolean(v));
  const emailIsTest = email.endsWith('@example.com') || email.includes('test') || email.includes('+test');
  const nameIsTest = name.includes('test') || name.includes('測試') || name.includes('测试');
  const phoneIsTest = phone.startsWith('099') || phone.includes('test');
  const notesIsTest = notes.includes('test') || notes.includes('測試') || notes.includes('测试');
  return flags.some(Boolean) || emailIsTest || nameIsTest || phoneIsTest || notesIsTest;
}

async function run() {
  const dryRun = (process.env.DRY_RUN ?? 'true') !== 'false';
  const table = process.env.TABLE || 'Users';
  console.log(`[airtable-clear-test-accounts] base=${process.env.AIRTABLE_BASE_ID} table=${table} DRY_RUN=${dryRun}`);

  const all = await base(table).select({ pageSize: 100 }).all();
  const targets = all.filter(r => isTestAccount(r.fields));
  console.log(`Found ${targets.length} test records.`);

  if (targets.length === 0) {
    console.log('No test records to clear.');
    return;
  }

  if (dryRun) {
    console.log('Dry run mode, will not delete. Preview targets:');
    for (const r of targets) {
      const f = r.fields || {};
      console.log(`- id=${r.id} email=${f.email || f.Email || ''} name=${f.name || f.Name || ''} phone=${f.phone || f.Phone || ''}`);
    }
    return;
  }

  const chunkSize = 10;
  for (let i = 0; i < targets.length; i += chunkSize) {
    const ids = targets.slice(i, i + chunkSize).map(r => r.id);
    await base(table).destroy(ids);
    console.log(`Deleted ${ids.length} records: ${ids.join(', ')}`);
  }

  console.log('Done.');
}

run().catch(err => {
  console.error('Error clearing test accounts:', err && err.stack || err);
  process.exitCode = 1;
});
