const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '..', '..', 'src', 'pages', 'DriverDashboard.jsx');
let src = fs.readFileSync(file, 'utf8');
let changed = false;

// 1) import useWs
if (!src.includes("from '../contexts/WsContext'")) {
  const marker = "import OSMMap from '../components/OSMMap';";
  if (src.includes(marker)) {
    src = src.replace(marker, `${marker}\nimport { useWs } from '../contexts/WsContext';`);
  } else {
    // fallback: after React import
    const reactImport = src.match(/^import\s+React[^\n]*$/m)?.[0] || null;
    if (reactImport) {
      src = src.replace(reactImport, `${reactImport}\nimport { useWs } from '../contexts/WsContext';`);
    } else {
      src = `import { useWs } from '../contexts/WsContext';\n` + src;
    }
  }
  changed = true;
}

// 2) inside component: declare useWs
if (!src.includes('const { online, setOnline, lastLocation, startMeter } = useWs();')) {
  const hookMarker = 'const heartbeatTimer = useRef(';
  const idx = src.indexOf(hookMarker);
  if (idx !== -1) {
    const before = src.substring(0, idx);
    const after = src.substring(idx);
    src = `${before}const heartbeatTimer = useRef(null);\n  // WebSocket integration\n  const { online, setOnline, lastLocation, startMeter } = useWs();\n${after.replace('const heartbeatTimer = useRef(', '// moved above: const heartbeatTimer = useRef(')}`;
  } else {
    // Fallback: inject near top of function body
    const funcStartMatch = src.match(/function\s+DriverDashboard\s*\([^)]*\)\s*{\s*/);
    if (funcStartMatch) {
      const insertPos = src.indexOf(funcStartMatch[0]) + funcStartMatch[0].length;
      src = src.slice(0, insertPos) + `\n  const { online, setOnline, lastLocation, startMeter } = useWs();\n` + src.slice(insertPos);
    }
  }
  changed = true;
}

// 3) header controls: add online toggle button
if (!src.includes('onClick={() => setOnline(!online)}')) {
  src = src.replace(
    '<div className="flex gap-2">',
    `<div className=\"flex gap-2\">\n          {/* WebSocket: online toggle */}\n          <Button variant={online ? 'secondary' : 'default'} onClick={() => setOnline(!online)}>{online ? '下線' : '上線'}</Button>`
  );
  changed = true;
}

if (changed) {
  fs.writeFileSync(file, src, 'utf8');
  console.log('Patched', file);
} else {
  console.log('No changes applied to', file);
}