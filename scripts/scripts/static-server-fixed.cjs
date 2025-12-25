// Static server to serve project root dist with explicit UTF-8 headers (CommonJS)
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
// __dirname points to the "scripts" directory; project root dist is one level up
const DIST = path.join(__dirname, '../dist');
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000; // allow override by env

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

// Fix the entry: redirect root to role-select to avoid loading unrelated index
app.get('/', (req, res) => {
  res.redirect('/role-select');
});

// QR 快速登入：設定 localStorage 並導向角色選擇
app.get('/qr-login', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const html = `<!DOCTYPE html>
  <html lang="zh-Hant">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>QR 快速登入</title>
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Noto Sans\", \"PingFang TC\", \"Microsoft JhengHei\", sans-serif; background:#0f172a; color:#e5e7eb; display:flex; align-items:center; justify-content:center; min-height:100vh; }
        .card { background:#111827; padding:24px; border-radius:12px; box-shadow: 0 10px 15px rgba(0,0,0,0.3); width: 560px; }
        .title { font-size:20px; font-weight:700; margin-bottom:12px; }
        .desc { font-size:14px; color:#9ca3af; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="title">正在完成快速登入...</div>
        <div class="desc">請稍候，登入成功後將進入角色選擇頁。</div>
      </div>
      <script>
        (function(){
          const params = new URLSearchParams(location.search);
          const token = params.get('token') || 'dev-token-0971827628';
          const profile = {
            userId: 'superadmin-0971827628',
            phone: '0971827628',
            name: '\\u8c50\\u54e5',
            role: 'super_admin',
            permissions: { can_access_admin: true, can_access_driver: true }
          };
          try {
            localStorage.setItem('bf_auth_token', token);
            localStorage.setItem('bf_user_profile', JSON.stringify(profile));
          } catch (e) {}
          location.replace('/role-select');
        })();
      </script>
    </body>
  </html>`;
  res.send(html);
});

// 登入後角色選擇頁
app.get('/role-select', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const html = `<!DOCTYPE html>
  <html lang="zh-Hant">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>選擇角色</title>
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, \"Noto Sans\", \"PingFang TC\", \"Microsoft JhengHei\", sans-serif; background:#0f172a; color:#e5e7eb; display:flex; align-items:center; justify-content:center; min-height:100vh; }
        .wrap { max-width: 760px; width: 100%; padding: 16px; }
        .title { font-size:24px; font-weight:800; margin-bottom:16px; }
        .grid { display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        .card { background:#111827; border-radius:12px; padding:20px; text-decoration:none; color:#e5e7eb; box-shadow: 0 10px 15px rgba(0,0,0,0.3); transition: transform .15s ease, box-shadow .15s ease; }
        .card:hover { transform: translateY(-2px); box-shadow: 0 15px 20px rgba(0,0,0,0.35); }
        .name { font-weight:700; margin-bottom:4px; }
        .desc { font-size:13px; color:#9ca3af; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="title">請選擇介面</div>
        <div class="grid">
          <a class="card" href="/passenger">
            <div class="name">乘客介面</div>
            <div class="desc">Passenger 面板（/passenger）</div>
          </a>
          <a class="card" href="/driver">
            <div class="name">司機介面</div>
            <div class="desc">Driver 面板（/driver）</div>
          </a>
          <a class="card" href="/admin">
            <div class="name">管理端</div>
            <div class="desc">Admin 面板（/admin）</div>
          </a>
        </div>
      </div>
      <script>
        try {
          var token = localStorage.getItem('bf_auth_token');
          var profile = localStorage.getItem('bf_user_profile');
          if (!token || !profile) {
            console.warn('尚未完成登入，請返回重新掃描 QR');
          }
        } catch (e) {}
      </script>
    </body>
  </html>`;
  res.send(html);
});

// SPA fallback to index.html
app.get('*', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const indexPath = path.join(DIST, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    const html = `<!DOCTYPE html>
    <html lang="zh-Hant">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Black Feather 預覽</title>
        <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,"Noto Sans","PingFang TC","Microsoft JhengHei",sans-serif;background:#0f172a;color:#e5e7eb;display:flex;align-items:center;justify-content:center;min-height:100vh} .card{background:#111827;padding:24px;border-radius:12px;box-shadow:0 10px 15px rgba(0,0,0,.3);width:560px} a{color:#60a5fa;text-decoration:none}</style>
      </head>
      <body>
        <div class="card">
          <h2>尚未找到 dist/index.html</h2>
          <p>請先建置前端（例如執行 <code>npm run build</code> ）或直接前往 <a href="/role-select">角色選擇頁</a> 預覽。</p>
        </div>
      </body>
    </html>`;
    res.send(html);
  }
});

app.listen(PORT, () => {
  console.log(`[bf-taxi-web] Static server listening on http://localhost:${PORT}`);
  console.log(`[bf-taxi-web] Serving directory: ${DIST}`);
});
