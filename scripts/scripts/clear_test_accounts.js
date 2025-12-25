#!/usr/bin/env node
// Clear test accounts script (requires SUPABASE_SERVICE_ROLE_KEY in env)
// Deletes records for specific phone numbers from drivers and passengers.
// Double-confirmation required.

const readline = require('readline');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hmlyfcpicjpjxayilyhk.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const phones = [
  '0971827628',
  // add more test phones here
];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q) { return new Promise(res => rl.question(q, res)); }

async function main(){
  console.log('Target phones to delete:', phones);
  const a = await ask('Type YES to confirm you want to delete these test accounts: ');
  if (a.trim() !== 'YES') { console.log('Aborted.'); rl.close(); return; }
  const b = await ask('Type DELETE to proceed: ');
  if (b.trim() !== 'DELETE') { console.log('Aborted.'); rl.close(); return; }
  rl.close();

  // Delete drivers first (FKs may reference)
  for (const phone of phones) {
    const { error: dErr } = await supabase.from('drivers').delete().eq('phone', phone);
    if (dErr) console.error('Delete driver error for', phone, dErr);
    const { error: pErr } = await supabase.from('passengers').delete().eq('phone', phone);
    if (pErr) console.error('Delete passenger error for', phone, pErr);
  }
  console.log('Done deleting test accounts.');
}

main().catch(e => { console.error(e); process.exit(1); });