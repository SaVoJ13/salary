// Змінюємо ім'я кешу. Це змусить браузер завантажити цей SW як новий
const CACHE_NAME = 'calc-pwa-v2';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './android-chrome-192x192.png',
    './android-chrome-512x512.png'
];

// Встановлення нового Service Worker'а
self.addEventListener('install', event => {
    // Примусово змушуємо новий SW активуватися негайно
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
});

// Активація та ОЧИЩЕННЯ старого кешу (видалить ваш старий fiege-calc-v1)
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Видалення старого кешу:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Стратегія перехоплення запитів
self.addEventListener('fetch', event => {
    // Для HTML-сторінок використовуємо Network First (щоб завжди мати свіжий UI)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(networkResponse => {
                    // Якщо мережа є, оновлюємо кеш свіжою версією
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // Якщо офлайн - віддаємо з кешу
                    return caches.match(event.request);
                })
        );
    } else {
        // Для решти ресурсів (іконки, firebase) використовуємо Cache First
        event.respondWith(
            caches.match(event.request).then(cachedResponse => {
                if (cachedResponse) return cachedResponse;
                
                return fetch(event.request).then(networkResponse => {
                    if (event.request.url.includes('gstatic.com') || event.request.url.includes('googleapis.com')) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return networkResponse;
                });
            }).catch(() => {})
        );
    }
});
