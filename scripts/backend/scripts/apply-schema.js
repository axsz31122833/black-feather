import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  try {
    const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
    const seedPath = path.join(__dirname, '..', 'sql', 'seed.sql');
    const withSeed = process.argv.includes('--seed');

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('[apply-schema] Applying schema.sql ...');
    await db.none(schemaSql);
    console.log('[apply-schema] Schema applied successfully.');

    if (withSeed && fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      console.log('[apply-schema] Applying seed.sql ...');
      await db.none(seedSql);
      console.log('[apply-schema] Seed applied successfully.');
    }

    process.exit(0);
  } catch (err) {
    console.error('[apply-schema] Error:', err);
    process.exit(1);
  }
}

run();