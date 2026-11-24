/* ---------- SERVICE WORKER — КЕШУВАННЯ ----------
   Stale-while-revalidate для власного коду/CSS/HTML: відповідь
   віддається миттєво з кешу (старт майже без мережі), а свіжа версія
   тихо довантажується у фоні й оновлює кеш. Новий код застосовується
   при наступному перезавантаженні сторінки.

   Дані закладок (.xbel) — network-first, щоб редагування не
   показувались застарілими.

   CACHE_VERSION потрібен лише для структурних змін самого SW
   (напр. зміна стратегії кешування) — щоб примусово скинути старий
   кеш. Для звичайних правок коду проєкту його чіпати не треба.
   Під час локальної розробки SW можна тимчасово вимкнути
   (Chrome DevTools → Application → Service Workers → Unregister). */

const CACHE_VERSION = "tablinks-v28";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Favicon із Google s2 — крос-доменний запит, але його треба кешувати,
  // інакше іконки щоразу перезавантажуються з мережі. Cache-first, бо
  // favicon домену змінюється рідко; фоново оновлюємо в кеші.
  if (url.hostname === "www.google.com" && url.pathname.startsWith("/s2/favicons")) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }
  // Чужі домени (CDN тощо) — стандартна поведінка браузера (HTTP-кеш працює).
  if (url.origin !== self.location.origin) return;

  // Дані закладок (.xbel) — network-first: завжди свіжі, кеш лише
  // як запас для офлайну. Так редагування не показуються застарілими.
  if (url.pathname.endsWith(".xbel")) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200 && res.type === "basic") {
              cache.put(req, res.clone());
            }
            return res;
          })
          .catch(() => cache.match(req));
        return network;
      }),
    );
    return;
  }

  // Код/CSS/HTML — stale-while-revalidate: кеш віддається миттєво,
  // мережа наздоганяє у фоні й оновлює кеш до наступного візиту.
  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          // Кешуємо лише власні успішні basic-відповіді (не opaque/помилки).
          if (res && res.status === 200 && res.type === "basic") {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch((err) => {
          if (cached) return cached;
          throw err;
        });
      if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
      }
      return network;
    }),
  );
});
