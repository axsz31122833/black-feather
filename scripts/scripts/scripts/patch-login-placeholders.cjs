const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src', 'pages', 'LoginPage.jsx');
let s = fs.readFileSync(file, 'utf8');
// Replace placeholder values safely with regex
s = s.replace(/type="tel"[\s\S]*?placeholder="[^"]*"/, (m) => m.replace(/placeholder="[^"]*"/, 'placeholder="请输入手机号"'));
s = s.replace(/type="password"[\s\S]*?placeholder="[^"]*"/, (m) => m.replace(/placeholder="[^"]*"/, 'placeholder="请输入密码"'));
s = s.replace(/verificationCode[\s\S]*?placeholder="[^"]*"/, (m) => m.replace(/placeholder="[^"]*"/, 'placeholder="请输入 6 位验证码"'));
fs.writeFileSync(file, s, 'utf8');
console.log('Patched LoginPage.jsx placeholders for phone, password, and verification code.');