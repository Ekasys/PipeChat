// NOTE: bump this when changing cache strategy to ensure clients refresh stale HTML.
const CACHE_NAME = 'pipelinepro-cache-v3'
const OFFLINE_URL = '/offline.html'
const PRECACHE_URLS = ['/', '/index.html', '/manifest.json', OFFLINE_URL]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName)),
      ),
    ),
  )
  self.clients.claim()
})

const isHttpRequest = (request) => {
  return request.url.startsWith('http://') || request.url.startsWith('https://')
}

const requestPathname = (request) => {
  try {
    return new URL(request.url).pathname
  } catch {
    return ''
  }
}

const isNavigationRequest = (request) => {
  if (request.mode === 'navigate') return true
  const accept = request.headers.get('accept') || ''
  return accept.includes('text/html')
}

const shouldHandleFetch = (request) => {
  if (request.method !== 'GET') return false
  if (!isHttpRequest(request)) return false
  if (request.url.includes('/api/')) return false

  // Never cache the service worker script itself.
  const pathname = requestPathname(request)
  if (pathname === '/sw.js') return false

  return true
}

self.addEventListener('fetch', (event) => {
  if (!shouldHandleFetch(event.request)) {
    return
  }

  if (isNavigationRequest(event.request)) {
    // Network-first for HTML so deploys/patched builds are picked up immediately.
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return networkResponse
        })
        .catch(async () => {
          const cached = await caches.match(event.request)
          if (cached) return cached
          const offline = await caches.match(OFFLINE_URL)
          return offline || new Response('Offline', { status: 503, statusText: 'Offline' })
        }),
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse
          }

          const responseToCache = networkResponse.clone()
          if (isHttpRequest(event.request)) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }

          return networkResponse
        })
        .catch(() => {
          if (cachedResponse) {
            return cachedResponse
          }
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL)
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' })
        })

      return cachedResponse || fetchPromise
    }),
  )
})
