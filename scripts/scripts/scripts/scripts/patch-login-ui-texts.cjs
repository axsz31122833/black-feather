// Patch specific UI texts in LoginPage.jsx to resolve mojibake and restore intended Chinese strings
// Safe, targeted replacements without changing JSX structure
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'pages', 'LoginPage.jsx');
if (!fs.existsSync(file)) {
  console.error('LoginPage.jsx not found:', file);
  process.exit(1);
}

let s = fs.readFileSync(file, 'utf8');
let changed = false;

// 1) Fix main heading inside <h1> that contains "Black Feather"
{
  const re = /(<h1[^>]*>)[\s\S]*?Black Feather[\s\S]*?(<\/h1>)/i;
  if (re.test(s)) {
    s = s.replace(re, '$1Black Feather 車隊管理系統$2');
    changed = true;
  }
}

// 2) Fix subtitle paragraph below the heading
{
  const re = /(<p[^>]*className="[^"]*text-gray-300[^"]*"[^>]*>)[\s\S]*?(<\/p>)/i;
  if (re.test(s)) {
    s = s.replace(re, '$1智慧車隊調度與叫車平台$2');
    changed = true;
  }
}

// 3) Replace corrupted display names for test users
{
  const beforePassenger = s;
  s = s.replace(/'測試��客'/g, "'測試乘客'");
  s = s.replace(/'測試司�x'/g, "'測試司機'");
  if (s !== beforePassenger) changed = true;
}

// 4) Replace corrupted button labels for quick test login
{
  const beforeButtons = s;
  s = s.replace(/以測試��客[^<]*/g, '以測試乘客登入');
  s = s.replace(/以測試司�x[^<]*/g, '以測試司機登入');
  if (s !== beforeButtons) changed = true;
}

// Write back if changed
if (changed) {
  fs.writeFileSync(file, s, 'utf8');
  console.log('Patched LoginPage.jsx UI texts successfully.');
} else {
  console.log('No changes were applied (patterns not found).');
}