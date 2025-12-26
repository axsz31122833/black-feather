self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  self.clients.claim()
})

// Do not intercept requests; let the network handle assets and routes
// This keeps SPA routing intact without serving HTML for JS assets

