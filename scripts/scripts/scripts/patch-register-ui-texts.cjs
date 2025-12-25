// Patch common UI texts in RegisterPage.jsx to fix mojibake
const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src', 'pages', 'RegisterPage.jsx');
if (!fs.existsSync(file)) {
  console.error('RegisterPage.jsx not found:', file);
  process.exit(1);
}
let s = fs.readFileSync(file, 'utf8');
let changed = false;

function rep(from, to) {
  const before = s;
  s = s.replace(new RegExp(from, 'g'), to);
  if (s !== before) changed = true;
}

// Heading and intro
rep('註� ` Black Feather 帳\"x', '註冊 Black Feather 帳號');
// Replace the subtitle below main heading
s = s.replace(/(<p[^>]*className=\"[^\"]*text-gray-300[^\"]*\"[^>]*>)[\s\S]*?(<\/p>)/i, '$1建立您的帳號以使用車隊管理系統$2'); changed = true;

// Card title and description (robust block replacement)
rep('�↔��ƶ註� `', '快速註冊');
rep('�9選�∟!�→��a▲�↓�0�並填寫�&要�!�`', '請選擇角色並填寫必要資料');

// Fallback: overwrite entire CardTitle/Description blocks regardless of mojibake
{
  const before = s;
  s = s.replace(/(<CardTitle[^>]*>[\s\S]*?<UserPlus[^>]*\/>\s*)([\s\S]*?)(\s*<\/CardTitle>)/, '$1快速註冊$3');
  if (s !== before) changed = true;
}
{
  const before = s;
  s = s.replace(/(<CardDescription[^>]*>)[\s\S]*?(<\/CardDescription>)/, '$1請選擇角色並填寫必要資料$2');
  if (s !== before) changed = true;
}

// Tabs labels
rep('��客', '乘客');
rep('司�x', '司機');
rep('管� �∟�', '管理員');
// Fallback: admin tab block replacement
{
  const before = s;
  s = s.replace(/(<TabsTrigger[^>]*value=\"admin\"[^>]*>\s*<MessageSquare[^>]*\/>\s*)([\s\S]*?)(<\/TabsTrigger>)/, '$1管理員$3');
  if (s !== before) changed = true;
}

// Labels and buttons
rep('�`�0R�\"x碼 *', '車牌號碼 *');
rep('設�a� 碼 *', '設定密碼 *');
rep('\'註� `中...\'', '\'註冊中...\'' );
rep('註� `帳\"x', '註冊帳號');

// Remarks label near the text input with placeholder "请输入备注"
rep('�→\"註', '備註');
{
  const before = s;
  s = s.replace(/(<label[^>]*className=\"[^\"]*text-sm[^\"]*\"[^>]*>)[^<]*(<\/label>)([\s\S]*?placeholder=\"请输入备注\")/, '$1備註$2$3');
  if (s !== before) changed = true;
}

// Bottom prompt
rep('已�S0帳\"x�x', '已有帳號？');
rep('�9即�\"��&�', '立即登入');

if (changed) {
  fs.writeFileSync(file, s, 'utf8');
  console.log('Patched RegisterPage.jsx UI texts successfully.');
} else {
  console.log('No changes applied (patterns not found).');
}
