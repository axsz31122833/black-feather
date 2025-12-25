const fs = require('fs');
const path = require('path');

const appPath = path.resolve(__dirname, '..', '..', 'src', 'App.jsx');
let src = fs.readFileSync(appPath, 'utf8');

// 1) import WsProvider
if (!src.includes("WsProvider")) {
  const importLine1 = "import { AppProvider } from './contexts/AppContext';";
  const importLine2 = 'import { AppProvider } from "./contexts/AppContext";';
  if (src.includes(importLine1)) {
    src = src.replace(importLine1, `${importLine1}\nimport { WsProvider } from './contexts/WsContext';`);
  } else if (src.includes(importLine2)) {
    src = src.replace(importLine2, `${importLine2}\nimport { WsProvider } from "./contexts/WsContext";`);
  } else {
    // Fallback: prepend at top
    src = `import { WsProvider } from './contexts/WsContext';\n` + src;
  }
}

// 2) wrap content with WsProvider inside AppProvider
src = src.replace(/<AppProvider>\s*/m, (m) => `${m}      <WsProvider>\n`);
src = src.replace(/<\/AppProvider>/m, `      </WsProvider>\n      </AppProvider>`);

fs.writeFileSync(appPath, src, 'utf8');
console.log('Patched App.jsx to include WsProvider');