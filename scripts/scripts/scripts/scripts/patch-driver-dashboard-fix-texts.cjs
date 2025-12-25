// Patch pending-orders section in src/pages/DriverDashboard.jsx
// Replace mojibake/garbled Chinese texts with valid ones to fix JSX syntax errors
// Safe targeted replacements based on surrounding JSX structure

const fs = require('fs');
const path = require('path');

function replaceBetween(str, startIdx, endIdx, replacement) {
  return str.slice(0, startIdx) + replacement + str.slice(endIdx);
}

function patchFile(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');

  // Locate the pending-orders card by the Clock icon (w-5 h-5) inside CardTitle
  const clockMarker = '<Clock className="w-5 h-5"';
  const clockIdx = s.indexOf(clockMarker);
  if (clockIdx < 0) {
    console.error('Clock marker not found in DriverDashboard.jsx');
    return false;
  }

  // Patch CardTitle containing the clock icon
  const cardTitleStart = s.lastIndexOf('<CardTitle', clockIdx);
  const cardTitleEnd = s.indexOf('</CardTitle>', clockIdx);
  if (cardTitleStart >= 0 && cardTitleEnd > cardTitleStart) {
    const newTitle = [
      '<CardTitle className="flex items-center gap-2">',
      '  <Clock className="w-5 h-5" />',
      '  待處理訂單',
      '</CardTitle>',
    ].join('\n');
    s = replaceBetween(s, cardTitleStart, cardTitleEnd + '</CardTitle>'.length, newTitle);
  }

  // Patch the CardDescription right after that CardTitle
  const descStart = s.indexOf('<CardDescription>', cardTitleStart);
  const descEnd = s.indexOf('</CardDescription>', descStart);
  if (descStart >= 0 && descEnd > descStart) {
    const newDesc = [
      '<CardDescription>',
      '  {pendingOrders.length > 0 ? "你有待處理的訂單，請盡快處理" : "目前沒有待處理訂單"}',
      '</CardDescription>',
    ].join('\n');
    s = replaceBetween(s, descStart, descEnd + '</CardDescription>'.length, newDesc);
  }

  // Replace the order id line under Badge
  s = s.replace(
    /<p className="text-sm text-muted-foreground mt-1">[\s\S]*?<\/p>/,
    '<p className="text-sm text-muted-foreground mt-1">訂單編號 # {order.id}</p>'
  );

  // Replace labels for pickup/dropoff/createdAt/passengerPhone within the same card
  s = s.replace(
    /(\<MapPin[^>]*\>[\s\S]*?<span className="text-muted-foreground">)[\s\S]*?(<\/span>\s*<span className="truncate">\{order\.pickup\}<\/span>)/,
    '$1起點$2'
  );
  s = s.replace(
    /(\<Navigation[^>]*\>[\s\S]*?<span className="text-muted-foreground">)[\s\S]*?(<\/span>\s*<span className="truncate">\{order\.dropoff\}<\/span>)/,
    '$1終點$2'
  );
  s = s.replace(
    /(\<Clock[^>]*\>[\s\S]*?<span className="text-muted-foreground">)[\s\S]*?(<\/span>\s*<span>\{formatDate\(order\.createdAt\)\}<\/span>)/,
    '$1建立時間$2'
  );
  s = s.replace(
    /(\<User[^>]*\>|<Phone[^>]*\>[\s\S]*?<span className="text-muted-foreground">)[\s\S]*?(<\/span>\s*<span className="truncate">\{order\.passengerPhone\}<\/span>)/,
    '$1乘客$2'
  );

  fs.writeFileSync(filePath, s, 'utf8');
  console.log('Patched DriverDashboard.jsx pending-orders section successfully.');
  return true;
}

(function main() {
  const file = path.join(process.cwd(), 'src', 'pages', 'DriverDashboard.jsx');
  if (!fs.existsSync(file)) {
    console.error('DriverDashboard.jsx not found at', file);
    process.exit(1);
  }
  const ok = patchFile(file);
  process.exit(ok ? 0 : 2);
})();