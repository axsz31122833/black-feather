// Targeted text fixes for src/pages/LoginPage.jsx after mojibake repair
// It replaces garbled Chinese texts with proper Simplified Chinese phrases.

const fs = require('fs');
const path = require('path');

function replaceBetween(lines, startIdx, endIdx, newLines) {
  // Replace content between start and end (exclusive)
  lines.splice(startIdx + 1, endIdx - startIdx - 1, ...newLines);
}

function findLineIndex(lines, regex, from = 0) {
  for (let i = from; i < lines.length; i++) {
    if (regex.test(lines[i])) return i;
  }
  return -1;
}

function fixLoginPage(file) {
  let content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r\n|\n|\r/);

  // Fix CardTitle content
  const titleStart = findLineIndex(lines, /<CardTitle/);
  const titleEnd = findLineIndex(lines, /<\/CardTitle>/, titleStart + 1);
  if (titleStart !== -1 && titleEnd !== -1) {
    const newTitle = [
      '                  <Phone className="w-5 h-5" />',
      '                  系统登录',
    ];
    replaceBetween(lines, titleStart, titleEnd, newTitle);
  }

  // Fix CardDescription content
  const descStart = findLineIndex(lines, /<CardDescription>/, titleEnd);
  const descEnd = findLineIndex(lines, /<\/CardDescription>/, descStart + 1);
  if (descStart !== -1 && descEnd !== -1) {
    const newDesc = [
      '                  请输入您的手机号与密码以登录系统',
    ];
    replaceBetween(lines, descStart, descEnd, newDesc);
  }

  // Fix phone input placeholder line
  const phonePlaceholderIdx = findLineIndex(lines, /type=\"tel\"/);
  if (phonePlaceholderIdx !== -1) {
    // Search ahead for placeholder line within next few lines
    for (let i = phonePlaceholderIdx; i < Math.min(phonePlaceholderIdx + 6, lines.length); i++) {
      if (/placeholder=\"/.test(lines[i])) {
        lines[i] = '                      placeholder="请输入手机号"';
        break;
      }
    }
  }

  // Fix password input placeholder line
  const passTypeIdx = findLineIndex(lines, /type=\"password\"/);
  if (passTypeIdx !== -1) {
    for (let i = passTypeIdx; i < Math.min(passTypeIdx + 6, lines.length); i++) {
      if (/placeholder=\"/.test(lines[i])) {
        lines[i] = '                      placeholder="请输入密码"';
        break;
      }
    }
  }

  // Fix role label
  const roleLabelIdx = findLineIndex(lines, /<label[^>]*>/);
  if (roleLabelIdx !== -1 && /select/.test(lines[roleLabelIdx + 1] || '')) {
    // Heuristic: first label before select
    lines[roleLabelIdx] = '                    <label className="block text-sm mb-2">角色</label>';
  }

  // Fix select options
  const passengerIdx = findLineIndex(lines, /<option value=\"passenger\"/);
  if (passengerIdx !== -1) lines[passengerIdx] = '                      <option value="passenger">乘客</option>';
  const driverIdx = findLineIndex(lines, /<option value=\"driver\"/);
  if (driverIdx !== -1) lines[driverIdx] = '                      <option value="driver">司机</option>';
  const adminIdx = findLineIndex(lines, /<option value=\"admin\"/);
  if (adminIdx !== -1) lines[adminIdx] = '                      <option value="admin">管理员</option>';

  // Remember me label
  const rememberLabelIdx = findLineIndex(lines, /label htmlFor=\"remember\"/);
  if (rememberLabelIdx !== -1) {
    lines[rememberLabelIdx] = '                  <label htmlFor="remember" className="text-sm">记住我（此设备）</label>';
  }

  // Submit button text
  const buttonTextIdx = findLineIndex(lines, /\{loading \?/, roleLabelIdx);
  if (buttonTextIdx !== -1) {
    lines[buttonTextIdx] = "                  {loading ? '登录中...' : '登录系统'}";
  }

  // Verification code placeholder
  const vcodeTypeIdx = findLineIndex(lines, /verificationCode/);
  if (vcodeTypeIdx !== -1) {
    // Seek backwards a bit for placeholder line
    for (let i = Math.max(0, vcodeTypeIdx - 4); i <= vcodeTypeIdx + 2 && i < lines.length; i++) {
      if (/placeholder=\"/.test(lines[i])) {
        lines[i] = '                   placeholder="请输入 6 位验证码"';
        break;
      }
    }
  }

  const out = lines.join('\n');
  fs.writeFileSync(file, out, 'utf8');
  console.log(`Applied text fixes to ${file}`);
}

(function main() {
  const file = path.join(process.cwd(), 'src', 'pages', 'LoginPage.jsx');
  if (!fs.existsSync(file)) {
    console.error('LoginPage.jsx not found:', file);
    process.exit(1);
  }
  fixLoginPage(file);
})();