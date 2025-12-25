const fs = require('fs');
const path = require('path');
const file = path.resolve(process.cwd(), 'vite.config.js');
let s = fs.readFileSync(file, 'utf8');
if (!/resolve\s*:\s*{[\s\S]*alias\s*:\s*{[\s\S]*airtable\s*:/m.test(s)) {
  s = s.replace(/alias\s*:\s*{([\s\S]*?)}/m, (m, inner) => {
    const insertion = `\n      "airtable": path.resolve(__dirname, "./src/shims/airtable-mock.js"),`;
    // Insert before closing brace
    return `alias: {${inner}${insertion}\n    }`;
  });
  fs.writeFileSync(file, s, 'utf8');
  console.log('Inserted airtable alias into vite.config.js');
} else {
  console.log('vite.config.js already contains airtable alias');
}