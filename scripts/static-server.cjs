// Custom static server to serve dist with explicit UTF-8 charset headers (CommonJS)
const express = require('express');
const path = require('path');

const app = express();
const DIST = path.join(__dirname, '../dist');
const PORT = process.env.PORT || 5173;

// Force UTF-8 charset for common text assets
app.use((req, res, next) => {
  const p = (req.path || '').toLowerCase();
  if (p.endsWith('.html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0');
  } else if (p.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  } else if (p.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
  } else if (p.endsWith('.json')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  } else if (p.endsWith('.txt')) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.use(express.static(DIST, { setHeaders: (res, filePath) => { const p = (filePath || '').toLowerCase(); if (p.endsWith('.html')) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0'); } else if (p.endsWith('.js')) { res.setHeader('Content-Type', 'application/javascript; charset=utf-8'); } else if (p.endsWith('.css')) { res.setHeader('Content-Type', 'text/css; charset=utf-8'); } else if (p.endsWith('.json')) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); } else if (p.endsWith('.txt')) { res.setHeader('Content-Type', 'text/plain; charset=utf-8'); } res.setHeader('X-Content-Type-Options', 'nosniff'); } }));

// SPA fallback
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0');
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[bf-taxi-web] Static server listening on http://localhost:${PORT}`);
});


