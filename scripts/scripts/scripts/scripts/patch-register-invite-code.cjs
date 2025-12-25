// Patch RegisterPage.jsx: add invitation code field, validation, and payload forwarding
const fs = require('fs');
const path = require('path');

function addInviteCodeState(s) {
  if (/inviteCode\s*:/.test(s)) return s; // already patched
  return s.replace(/useState\(\{([\s\S]*?)\}\)/, (m, body) => {
    // Append inviteCode to formData state object
    const trimmed = body.trim().replace(/\n\s*/g, '\n    ');
    return `useState({\n    ${trimmed},\n    inviteCode: ''\n  })`;
  });
}

function addInviteCodeValidation(s) {
  if (s.includes("请输入邀请码") || s.includes('邀請碼')) return s;
  // Insert validation before setLoading(true)
  return s.replace(/setLoading\(true\);\s*try\s*\{/, (m) => {
    const check = `if (formData.role !== 'super_admin' && !formData.inviteCode.trim()) {\n      toast({ title: '注册失败', description: '请输入邀请码', variant: 'destructive' });\n      return;\n    }\n\n    setLoading(true);\n    try {`;
    return check;
  });
}

function addInviteCodeToPayload(s) {
  if (/inviteCode:\s*formData\.inviteCode/.test(s)) return s;
  return s.replace(/remarks:\s*formData\.remarks(\s*[,\}])/g, (m, tail) => {
    return `remarks: formData.remarks,\n        inviteCode: formData.inviteCode${tail}`;
  });
}

function insertInviteCodeInputForTabs(s) {
  // Passenger tab
  s = s.replace(/(<TabsContent value=\"passenger\"[^>]*>\s*<div className=\"space-y-4\">)/, (m, head) => {
    const block = `\n                    <div>\n                      <label className=\"text-sm font-medium\">邀请码 *</label>\n                      <Input\n                        type=\"text\"\n                        placeholder=\"请输入邀请码（推荐人手机号）\"\n                        value={formData.inviteCode}\n                        onChange={(e) => handleInputChange('inviteCode', e.target.value)}\n                        className=\"bg-background/50\"\n                        disabled={loading}\n                      />\n                    </div>`;
    return head + block;
  });

  // Driver tab
  s = s.replace(/(<TabsContent value=\"driver\"[^>]*>\s*<div className=\"space-y-4\">)/, (m, head) => {
    const block = `\n                    <div>\n                      <label className=\"text-sm font-medium\">邀请码 *</label>\n                      <Input\n                        type=\"text\"\n                        placeholder=\"请输入邀请码（推荐人手机号）\"\n                        value={formData.inviteCode}\n                        onChange={(e) => handleInputChange('inviteCode', e.target.value)}\n                        className=\"bg-background/50\"\n                        disabled={loading}\n                      />\n                    </div>`;
    return head + block;
  });

  return s;
}

function renameAdminToSuperAdmin(s) {
  // Update role value in tab trigger
  s = s.replace(/TabsTrigger value=\"admin\"/g, 'TabsTrigger value="super_admin"');
  s = s.replace(/value=\"admin\"\>/g, 'value="super_admin">');
  // If there is TabsContent for admin, rename it
  s = s.replace(/<TabsContent value=\"admin\"/g, '<TabsContent value="super_admin"');
  return s;
}

(function main() {
  const file = path.join(process.cwd(), 'src', 'pages', 'RegisterPage.jsx');
  if (!fs.existsSync(file)) {
    console.error('RegisterPage.jsx not found');
    process.exit(1);
  }
  let s = fs.readFileSync(file, 'utf8');
  s = addInviteCodeState(s);
  s = addInviteCodeValidation(s);
  s = addInviteCodeToPayload(s);
  s = insertInviteCodeInputForTabs(s);
  s = renameAdminToSuperAdmin(s);
  fs.writeFileSync(file, s, 'utf8');
  console.log('Patched RegisterPage.jsx: invitation code field + validation + payload; admin -> super_admin in tabs.');
})();