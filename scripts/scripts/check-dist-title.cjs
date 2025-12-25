const fs = require('fs');
const path = require('path');
const distIndex = path.join(process.cwd(), 'dist', 'index.html');
const s = fs.readFileSync(distIndex, 'utf8');
const m = /<title>([^<]*)<\/title>/i.exec(s);
console.log('dist/index.html title:', m ? m[1] : 'NOT FOUND');
console.log('Has correct Chinese?', /Black Feather 車隊管理系統/.test(s));