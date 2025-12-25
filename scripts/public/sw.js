const CACHE_NAME = 'bf-taxi-v3'
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
]

self.addEventListener('message', (event) => {
  const msg = event.data || {}
  if (msg && msg.type === 'enqueue_ops') {
    enqueueOps({ event_type: msg.event_type, ref_id: msg.ref_id || null, payload: msg.payload || null, created_at: new Date().toISOString() })
  }
  if (msg && msg.type === 'request_flush') {
    flushOps()
  }
})

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('push', (event) => {
  const data = (() => {
    try { return event.data?.json() } catch { return { title: 'BF 推播', body: event.data?.text() || '通知' } }
  })()
  const title = data.title || 'BF 推播'
  const body = data.body || '您有新的通知'
  event.waitUntil(
    self.registration.showNotification(title, { body })
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((resp) => {
        const copy = resp.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
        return resp
      }).catch(() => cached || caches.match('/index.html'))
      return cached || fetchPromise
    })
  )
})

// IndexedDB queue for ops_events
const DB_NAME = 'bf-queue'
const STORE_OPS = 'ops'
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = (e) => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_OPS)) {
        db.createObjectStore(STORE_OPS, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function enqueueOps(item) {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_OPS, 'readwrite')
    tx.objectStore(STORE_OPS).add(item)
  } catch {}
}
async function readAllOps() {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_OPS, 'readonly')
    return await new Promise((resolve, reject) => {
      const req = tx.objectStore(STORE_OPS).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
  } catch { return [] }
}
async function clearOps() {
  try {
    const db = await openDb()
    const tx = db.transaction(STORE_OPS, 'readwrite')
    tx.objectStore(STORE_OPS).clear()
  } catch {}
}

async function flushOps() {
  const items = await readAllOps()
  if (!items.length) return
  try {
    // Attempt bulk send via postMessage to clients; clients will insert to backend
    const clientsList = await self.clients.matchAll({ includeUncontrolled: true })
    for (const client of clientsList) {
      for (const it of items) {
        client.postMessage({ type: 'flush_ops', item: it })
      }
    }
    await clearOps()
  } catch {}
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'bf-sync') {
    event.waitUntil(flushOps())
  }
})

self.addEventListener('online', () => {
  flushOps()
})
