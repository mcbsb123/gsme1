// Network-First Service Worker v9.0 (Level 2 Edition)
// Ensures players always receive the latest code updates immediately with fallback to cache when offline
const CACHE_NAME = 'arena-wheels-ctr-v9';
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/style.css?v=9.0',
    '/networkConfig.js?v=9.0',
    '/game.js?v=9.0',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CORE_ASSETS).catch(() => {});
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(
                keyList.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // Network-First strategy with cache: 'no-store' for instant live updates
    event.respondWith(
        fetch(event.request, { cache: 'no-store' })
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});
