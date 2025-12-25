const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src', 'pages', 'RegisterPage.jsx');
let s = fs.readFileSync(file, 'utf8');

function replacePlaceholderAroundValue(source, valueRegex, newText) {
  // Matches a placeholder attribute followed by up to 5 lines then the value line
  const re = new RegExp(
    String.raw`placeholder="[^"]*"([\r\n]|.){0,200}${valueRegex}`,
    'g'
  );
  return source.replace(re, (m) => m.replace(/placeholder="[^"]*"/, `placeholder="${newText}"`));
}

// Phone
s = replacePlaceholderAroundValue(s, String.raw`value=\{formData\.phone\}`, '请输入手机号');
// Password
s = replacePlaceholderAroundValue(s, String.raw`value=\{formData\.password\}`, '请输入密码');
// Confirm Password
s = replacePlaceholderAroundValue(s, String.raw`value=\{formData\.confirmPassword\}`, '请再次输入密码');
// Name
s = replacePlaceholderAroundValue(s, String.raw`value=\{formData\.name\}`, '请输入姓名');
// Nickname
s = replacePlaceholderAroundValue(s, String.raw`value=\{formData\.nickname\}`, '请输入昵称');
// Car Plate
s = replacePlaceholderAroundValue(s, String.raw`value=\{formData\.carPlate\}`, '请输入车牌号');
// Remarks
s = replacePlaceholderAroundValue(s, String.raw`value=\{formData\.remarks\}`, '请输入备注');
// Verification code (driver/passenger verification)
s = replacePlaceholderAroundValue(s, String.raw`value=\{verificationCode\}`, '请输入 6 位验证码');

fs.writeFileSync(file, s, 'utf8');
console.log('Patched RegisterPage.jsx placeholders for known fields.');