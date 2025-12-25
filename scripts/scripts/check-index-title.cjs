const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'index.html');
const s = fs.readFileSync(file, 'utf8');
const m = /<title>([^<]*)<\/title>/i.exec(s);
console.log('Title tag:', m ? m[1] : 'NOT FOUND');
console.log('Has correct Chinese?', /Black Feather 車隊管理系統/.test(s));