const fs = require('fs');
const path = require('path');
const file = path.resolve(process.cwd(), 'src/components/AirtableStatusBanner.jsx');
const content = `import React from "react";

const hasAirtableConfig = !!(
  import.meta?.env?.VITE_AIRTABLE_API_KEY && import.meta?.env?.VITE_AIRTABLE_BASE_ID
);

function AirtableStatusBanner() {
  if (hasAirtableConfig) return null;
  return (
    <div className="w-full p-2 text-sm text-white bg-yellow-600/40 border-b border-yellow-500/50">
      <div className="container mx-auto flex items-center justify-between">
        <span>目前為示範模式：尚未設定 Airtable API 金鑰與 Base ID，相關功能已停用</span>
      </div>
    </div>
  );
}

export default AirtableStatusBanner;
`;
fs.writeFileSync(file, content, 'utf8');
console.log('Wrote AirtableStatusBanner.jsx');