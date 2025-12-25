const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'index.html');
if (!fs.existsSync(file)) {
  console.error('index.html not found at', file);
  process.exit(1);
}
let html = fs.readFileSync(file, 'utf8');
const re = /(<title>)([\s\S]*?)(<\/title>)/i;
if (!re.test(html)) {
  console.error('No <title> tag found in index.html');
  process.exit(2);
}
html = html.replace(re, '$1Black Feather 車隊管理系統$3');
fs.writeFileSync(file, html, { encoding: 'utf8' });
console.log('Updated <title> to: Black Feather 車隊管理系統');