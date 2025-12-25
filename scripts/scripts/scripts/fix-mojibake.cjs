// Attempt to fix mojibake (UTF-8 decoded as Latin-1 then saved) in source files
// Strategy: detect common mojibake characters (ç, é, è, å, æ, â, ã, ï¼, ã€)
// If found, transform string by Buffer.from(str, 'latin1').toString('utf8')
// Only write when Chinese character count increases and mojibake count decreases

const fg = require('fast-glob');
const fs = require('fs');
const path = require('path');

function countChinese(str) {
  // CJK Unified Ideographs + Extension ranges (rough)
  const m = str.match(/[\u3400-\u9FFF]/g);
  return m ? m.length : 0;
}

function countMojibake(str) {
  const m = str.match(/[çéèåæâãï¼ã€]/g);
  return m ? m.length : 0;
}

function fixString(str) {
  try {
    return Buffer.from(str, 'latin1').toString('utf8');
  } catch (e) {
    return null;
  }
}

async function main() {
  const patterns = [
    'src/**/*.{js,jsx,ts,tsx,vue,json,md}',
    '*.md',
  ];
  const ignore = ['node_modules/**', 'dist/**', '.git/**'];
  const files = await fg(patterns, { ignore, dot: true });

  const report = { fixed: [], skipped: [], failed: [] };

  for (const file of files) {
    let before;
    try {
      before = fs.readFileSync(file, 'utf8');
    } catch (e) {
      report.failed.push({ file, error: e.message });
      continue;
    }

    const beforeChinese = countChinese(before);
    const beforeMojibake = countMojibake(before);

    if (beforeMojibake < 3) {
      report.skipped.push({ file, reason: 'no-mojibake-detected' });
      continue;
    }

    const after = fixString(before);
    if (!after) {
      report.failed.push({ file, error: 'fixString returned null' });
      continue;
    }

    const afterChinese = countChinese(after);
    const afterMojibake = countMojibake(after);

    if (afterChinese > beforeChinese && afterMojibake < beforeMojibake) {
      try {
        fs.writeFileSync(file, after, 'utf8');
        report.fixed.push({ file, beforeChinese, afterChinese, beforeMojibake, afterMojibake });
        console.log(`FIXED: ${file} | CJK ${beforeChinese} -> ${afterChinese} | mojibake ${beforeMojibake} -> ${afterMojibake}`);
      } catch (e) {
        report.failed.push({ file, error: e.message });
      }
    } else {
      report.skipped.push({ file, reason: 'no-improvement' });
    }
  }

  const out = path.join(process.cwd(), 'scripts', '__tmp_mojibake_fix_report.json');
  try {
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`Report written: ${out}`);
    console.log(`Fixed ${report.fixed.length} files, skipped ${report.skipped.length}, failed ${report.failed.length}`);
  } catch (e) {
    console.error('Failed to write report:', e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});