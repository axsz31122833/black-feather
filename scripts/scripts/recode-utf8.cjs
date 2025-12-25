// Batch re-encode text files to UTF-8 (no BOM) using iconv-lite and chardet
// This script does NOT change content or line endings intentionally; it only re-encodes.
// Usage: node scripts/recode-utf8.js

const fg = require('fast-glob');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const chardet = require('chardet');
const iconv = require('iconv-lite');

function md5(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

function getLines(str) {
  // Preserve existing line endings; counting lines by splitting on CRLF/CR/LF
  return str.split(/\r\n|\r|\n/).length;
}

function recodeFile(file) {
  const buf = fs.readFileSync(file);
  const beforeHash = md5(buf);
  let enc = chardet.detect(buf) || 'UTF-8';
  // Normalize common labels
  if (/^utf-8$/i.test(enc)) enc = 'UTF-8';
  // Decode with detected encoding (fallback UTF-8)
  let str;
  try {
    str = iconv.decode(buf, enc);
  } catch (e) {
    // Fallback to UTF-8 if detection/decoding fails
    try {
      str = iconv.decode(buf, 'UTF-8');
      enc = 'UTF-8';
    } catch (e2) {
      return { file, enc, error: `decode failed: ${e.message}` };
    }
  }

  const beforeLines = getLines(str);
  const beforeChars = str.length;

  // Remove BOM if present at start of decoded string
  if (str.charCodeAt(0) === 0xFEFF) {
    str = str.slice(1);
  }

  // Encode to UTF-8 (iconv-lite encodes without BOM by default)
  const outBuf = iconv.encode(str, 'UTF-8');
  const afterHash = md5(outBuf);
  const afterLines = getLines(str);
  const afterChars = str.length;

  if (afterHash !== beforeHash) {
    fs.writeFileSync(file, outBuf);
    return {
      file,
      enc,
      changed: true,
      beforeHash,
      afterHash,
      beforeLines,
      afterLines,
      beforeChars,
      afterChars,
    };
  }

  return {
    file,
    enc,
    changed: false,
    beforeHash,
    afterHash,
    beforeLines,
    afterLines,
    beforeChars,
    afterChars,
  };
}

async function main() {
  const patterns = [
    'src/**/*.{vue,js,jsx,ts,tsx,json,md}',
    'scripts/**/*.{mjs,js,ts,json,md}',
    'server/**/*.{js,json,md}',
    'client/**/*.{js,jsx,ts,tsx,json,md}',
    '*.md',
    '*.js',
    '*.ts',
    '*.json',
  ];
  const ignore = ['node_modules/**', 'dist/**', '.git/**'];
  const files = await fg(patterns, { ignore, dot: true });

  const results = [];
  for (const f of files) {
    try {
      results.push(recodeFile(f));
    } catch (e) {
      results.push({ file: f, error: e.message });
    }
  }

  console.log(`Total files scanned: ${files.length}`);
  const changed = results.filter((r) => r.changed);
  const unchanged = results.filter((r) => r.changed === false);
  const failed = results.filter((r) => r.error);

  console.log(`Converted to UTF-8 (no BOM): ${changed.length} files`);
  for (const r of changed) {
    console.log(
      `${r.file} | enc=${r.enc} | lines ${r.beforeLines}->${r.afterLines} | chars ${r.beforeChars}->${r.afterChars} | md5 ${r.beforeHash} -> ${r.afterHash}`
    );
  }

  console.log(`Unchanged: ${unchanged.length}`);
  console.log(`Failed: ${failed.length}`);
  for (const r of failed) {
    console.log(`FAILED ${r.file}: ${r.error}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});