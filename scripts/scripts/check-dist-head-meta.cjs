const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'dist', 'index.html');
const s = fs.readFileSync(file, 'utf8');
const headMatch = /<head>([\s\S]*?)<\/head>/i.exec(s);
if (!headMatch) {
  console.log('HEAD NOT FOUND');
  process.exit(1);
}
const head = headMatch[1];
// Find first tag inside head ignoring whitespace/newlines/comments
const tagMatch = /(?:<!--[\s\S]*?-->|\s|\n|\r)*(<[^>]+>)/.exec(head);
if (!tagMatch) {
  console.log('No tags inside <head>');
  process.exit(2);
}
const firstTag = tagMatch[1];
const isMeta = /^<meta\b/i.test(firstTag);
const isCharsetUtf8 = /^<meta\b[^>]*charset=["']?utf-8["']?[^>]*>/i.test(firstTag);
console.log('First head tag:', firstTag);
console.log('Is first tag <meta>?', isMeta);
console.log('Is charset UTF-8?', isCharsetUtf8);