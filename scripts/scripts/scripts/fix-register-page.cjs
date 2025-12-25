// Targeted text fixes for src/pages/RegisterPage.jsx
const fs = require('fs');
const path = require('path');

function applyFixes(s) {
  // Basic replacements for common mojibake fragments
  s = s.replace(/註.?.?失.?.?/g, '注册失败');
  s = s.replace(/LINE 快.?註.?.?已移.?.?/g, 'LINE 快速注册已移除');
  s = s.replace(/移.? OTP .*流.*:/g, '移除 OTP 流程：');

  // Toast success line
  s = s.replace(/toast\(\{\s*title:[^}]*?\}\);/s, (m) => {
    // Replace first toast occurrence with success message
    return "toast({ title: '注册成功', description: `欢迎，${userData.name}！`, variant: 'default' });";
  });

  // Toast error line (use destructive variant)
  s = s.replace(/toast\(\{\s*title:[^}]*variant:\s*'destructive'\s*\}\);/s, (m) => {
    return "toast({ title: '注册失败', description: error.message || '请稍后再试', variant: 'destructive' });";
  });

  return s;
}

(function main() {
  const file = path.join(process.cwd(), 'src', 'pages', 'RegisterPage.jsx');
  if (!fs.existsSync(file)) {
    console.error('RegisterPage.jsx not found');
    process.exit(1);
  }
  const before = fs.readFileSync(file, 'utf8');
  const after = applyFixes(before);
  fs.writeFileSync(file, after, 'utf8');
  console.log('Applied fixes to RegisterPage.jsx');
})();