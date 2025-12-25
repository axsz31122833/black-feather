// Static server to serve project root dist with explicit UTF-8 headers (CommonJS)
const express = require('express');
const path = require('path');

const app = express();
// __dirname points to the "scripts" directory; project root dist is one level up
const DIST = path.resolve(__dirname, '..', 'dist');
// Force port 3000 for production preview to avoid inheriting PORT from other tools (e.g. Vite 5173)
const PORT = 3000;

// Force UTF-8 charset for common text assets
app.use((req, res, next) => {
  const p = (req.path || '').toLowerCase();
  if (p.endsWith('.html')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
  } else if (p.endsWith('.js')) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  } else if (p.endsWith('.css')) {
    res.setHeader('Content-Type', 'text/css; charset=utf-8');
  } else if (p.endsWith('.json')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  } else if (p.endsWith('.txt')) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  }
  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Serve static assets from dist
app.use(express.static(DIST));

// SPA fallback to index.html
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[bf-taxi-web] Static server listening on http://localhost:${PORT}`);
  console.log(`[bf-taxi-web] Serving directory: ${DIST}`);
});