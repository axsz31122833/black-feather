const fs = require('fs');
const path = require('path');
const file = path.resolve(process.cwd(), 'vite.config.js');
let s = fs.readFileSync(file, 'utf8');
if (!/base\s*:\s*['\"]/.test(s)) {
  let before = s;
  s = s.replace(/export\s+default\s+defineConfig\(\s*{/, "export default defineConfig({\n  base: './',");
  if (s === before) {
    s = s.replace(/defineConfig\(\s*{/, "defineConfig({\n  base: './',");
  }
  fs.writeFileSync(file, s, 'utf8');
  console.log('Inserted base: ./ into vite.config.js');
} else {
  console.log('vite.config.js already contains base');
}