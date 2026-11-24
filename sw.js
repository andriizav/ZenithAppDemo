/* ---------- SERVICE WORKER ----------
   Stale-while-revalidate для власного коду/стилів/сторінок:
   відповідь віддається миттєво з кешу (старт майже без мережі),
   а в фоні тихо завантажується свіжа версія й оновлює кеш.
   Новий код застосовується при наступному перезавантаженні сторінки.

   Дані закладок (.xbel) лишаються network-first — редагування
   не повинні показуватись застарілими.

   CACHE_NAME треба бампати лише при структурних змінах самого SW. */

const CACHE_NAME = 'tab-links-v4';

const PRECACHE = [
  './',
  'index.html',
  'js/main.js',
  'js/app.js',
  'js/bookmarks.js',
  'tasks/tasks.js',
  'css/main.css',
  'data/favicon.png',
  'data/favicons/default.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        PRECACHE.map((url) =>
          cache.add(url).catch((err) => console.warn('Precache failed for', url, err))
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Favicon із Google s2 — крос-доменний, але кешуємо cache-first:
  // інакше іконки закладок перезавантажуються з мережі щоразу.
  if (url.hostname === 'www.google.com' && url.pathname.startsWith('/s2/favicons')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Інші чужі домени (CDN тощо) — стандартна поведінка браузера.
  if (url.origin !== self.location.origin) return;

  // Не перехоплюємо WAV-звуки таймера
  if (url.pathname.includes('/sounds/')) return;

  // XBEL закладки: network-first, з fallback на кеш у разі офлайну.
  if (url.pathname.includes('/bookmarks/')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Код/CSS/HTML — stale-while-revalidate.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
          return res;
        })
        .catch((err) => {
          if (cached) return cached;
          throw err;
        });
      // Є кеш — віддаємо миттєво, мережа доганяє у фоні.
      if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
      }
      return network;
    })
  );
});
