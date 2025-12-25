const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src', 'pages', 'RegisterPage.jsx');
let s = fs.readFileSync(file, 'utf8');
s = s.replace(/description:\s*欢迎，！/g, "description: `欢迎，${userData.name}！`");
s = s.replace(/title:\s*'註.?.?失.?.?'/g, "title: '注册失败'");
s = s.replace(/title:\s*'註.?.?[^']*'/g, (m) => "title: '注册成功'");
fs.writeFileSync(file, s, 'utf8');
console.log('Replaced RegisterPage toast lines.');