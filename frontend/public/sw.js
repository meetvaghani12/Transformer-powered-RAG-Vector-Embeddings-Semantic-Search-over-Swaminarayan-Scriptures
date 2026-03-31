const CACHE_NAME = 'aksharai-v1'
const STATIC_ASSETS = [
  '/',
  '/icon.svg',
  '/icon-dark-32x32.png',
  '/apple-icon.png',
]

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Skip non-GET, API calls, and streaming endpoints
  if (event.request.method !== 'GET') return
  if (url.pathname.startsWith('/api/')) return
  if (url.hostname !== self.location.hostname) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          // Cache successful responses
          if (response.ok && response.type === 'basic') {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => cached) // Fallback to cache if offline

      return cached || fetchPromise
    })
  )
})
