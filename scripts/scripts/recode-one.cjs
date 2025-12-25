const fs = require('fs');
const chardet = require('chardet');
const iconv = require('iconv-lite');
const file = process.argv[2] || 'index.html';
const buf = fs.readFileSync(file);
let enc = chardet.detect(buf) || 'UTF-8';
let str;
try { str = iconv.decode(buf, enc); } catch(e) { str = iconv.decode(buf, 'UTF-8'); enc = 'UTF-8'; }
if (str.charCodeAt(0) === 0xFEFF) str = str.slice(1);
fs.writeFileSync(file, iconv.encode(str, 'UTF-8'));
console.log(`Re-encoded ${file} from ${enc} to UTF-8 (no BOM).`);