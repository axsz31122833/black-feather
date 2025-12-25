const fs = require('fs');
const path = require('path');

function sanitizeFile(fp) {
  const lines = fs.readFileSync(fp, 'utf8').split(/\r\n|\n|\r/);
  let changed = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('placeholder="')) {
      // Keep everything up to the closing quote of placeholder, drop any garbage after
      const idx = line.indexOf('placeholder="');
      const start = idx + 'placeholder="'.length;
      const endQuote = line.indexOf('"', start);
      if (endQuote !== -1) {
        const clean = line.slice(0, endQuote + 1); // include closing quote
        const tail = line.slice(endQuote + 1);
        if (/\S/.test(tail)) {
          lines[i] = clean; // remove trailing non-whitespace tail
          changed++;
        }
      }
    }
  }
  fs.writeFileSync(fp, lines.join('\n'), 'utf8');
  return changed;
}

const targets = [
  path.join(process.cwd(), 'src', 'pages', 'RegisterPage.jsx'),
  path.join(process.cwd(), 'src', 'pages', 'LoginPage.jsx'),
];

let total = 0;
for (const t of targets) {
  if (fs.existsSync(t)) total += sanitizeFile(t);
}
console.log(`Sanitized placeholder lines. Changed: ${total}`);