// PHC Inventory v2 - Service Worker for Offline Mode
// Strategy:
//   - App shell (HTML, JS, CSS): Cache-First with background update
//   - Supabase API calls: Network-First with offline fallback to cache
//   - Static assets (fonts, icons): Stale-While-Revalidate

const CACHE_VERSION = 'phc-v2-1'
const STATIC_CACHE  = `${CACHE_VERSION}-static`
const API_CACHE     = `${CACHE_VERSION}-api`

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/phc-logo.png',
  '/manifest.json',
]

// Install: pre-cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('phc-v') && k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch routing
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (!url.protocol.startsWith('http')) return

  // Supabase API -> Network-First
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  // SPA navigation -> serve index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then(cached => cached || fetch(request))
    )
    return
  }

  // Static assets -> Cache-First
  event.respondWith(cacheFirst(request, STATIC_CACHE))
})

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    // Return offline JSON stub so the app doesn't crash
    return new Response(
      JSON.stringify({ data: [], error: { message: 'You are offline. Data may be stale.' } }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }
}
