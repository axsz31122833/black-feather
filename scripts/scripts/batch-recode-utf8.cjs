const fs = require('fs');
const path = require('path');

function listFiles(dir, exts) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { continue; }
    for (const ent of entries) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) stack.push(p);
      else {
        const ext = path.extname(ent.name).toLowerCase();
        if (exts.has(ext)) out.push(p);
      }
    }
  }
  return out;
}

function hasUtf8Bom(buf) {
  return buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
}

function countLines(str) {
  if (!str.length) return 0;
  // Normalize to \n counting; do not alter file content
  return str.split(/\r\n|\n|\r/).length;
}

function convertFile(file) {
  const beforeBuf = fs.readFileSync(file);
  const hadBOM = hasUtf8Bom(beforeBuf);
  let beforeStr;
  // Decode as UTF-8; if BOM present, strip by decoding
  beforeStr = beforeBuf.toString('utf8');
  const beforeLines = countLines(beforeStr);
  // Write back as UTF-8 without BOM
  fs.writeFileSync(file, beforeStr, { encoding: 'utf8' });
  const afterBuf = fs.readFileSync(file);
  const afterHasBOM = hasUtf8Bom(afterBuf);
  const afterStr = afterBuf.toString('utf8');
  const afterLines = countLines(afterStr);
  return { file, hadBOM, afterHasBOM, beforeLines, afterLines };
}

(function main() {
  const root = process.cwd();
  const srcDir = path.join(root, 'src');
  const exts = new Set(['.js', '.ts', '.vue']);
  const toConvert = listFiles(srcDir, exts);
  const publicIndex = path.join(root, 'public', 'index.html');
  const rootIndex = path.join(root, 'index.html');
  const distIndex = path.join(root, 'dist', 'index.html');
  const converted = [];

  if (fs.existsSync(publicIndex)) {
    converted.push(convertFile(publicIndex));
  } else if (fs.existsSync(rootIndex)) {
    converted.push(convertFile(rootIndex));
  }

  for (const f of toConvert) {
    converted.push(convertFile(f));
  }

  let distInfo = null;
  if (fs.existsSync(distIndex)) {
    const buf = fs.readFileSync(distIndex);
    distInfo = { file: distIndex, hasBOM: hasUtf8Bom(buf), size: buf.length };
  }

  const report = { converted, distInfo };
  fs.writeFileSync(path.join(root, 'scripts', '__tmp_recode_report.json'), JSON.stringify(report, null, 2));
  console.log('Converted files (UTF-8 no BOM):');
  for (const item of converted) {
    console.log(`- ${path.relative(root, item.file)} | BOM(before=${item.hadBOM}) -> BOM(after=${item.afterHasBOM}) | lines ${item.beforeLines} -> ${item.afterLines}`);
  }
  if (distInfo) {
    console.log(`Checked dist/index.html: BOM=${distInfo.hasBOM}, size=${distInfo.size} bytes`);
  } else {
    console.log('dist/index.html not found (build may be required).');
  }
})();