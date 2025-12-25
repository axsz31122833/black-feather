const fs = require('fs');
const path = require('path');
const file = path.resolve(process.cwd(), 'src/App.jsx');
let s = fs.readFileSync(file, 'utf8');
// Insert import if missing
if (!/import\s+AirtableStatusBanner\s+from\s+['\"]\.\/components\/AirtableStatusBanner['\"]/m.test(s)) {
  s = s.replace(/(import\s+HealthCheckBanner\s+from\s+['\"]\.\/components\/HealthCheckBanner['\"];?)/, 
    '$1\nimport AirtableStatusBanner from \"./components/AirtableStatusBanner\";');
}
// Insert component render after HealthCheckBanner
if (!/<AirtableStatusBanner\s*\/>/.test(s)) {
  s = s.replace(/(<HealthCheckBanner\s*\/>)/, '$1\n          <AirtableStatusBanner />');
}
fs.writeFileSync(file, s, 'utf8');
console.log('Updated App.jsx to include AirtableStatusBanner');