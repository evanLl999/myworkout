const CACHE_NAME = 'myworkout-v5';
const SCOPE = self.registration.scope;
const APP_SHELL = [
  SCOPE,
  `${SCOPE}index.html`,
  `${SCOPE}manifest.json`,
  `${SCOPE}icon-192.png`,
  `${SCOPE}icon-512.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(precache().catch((err) => console.warn('预缓存失败', err)));
});

async function precache() {
  const cache = await caches.open(CACHE_NAME);
  const pageUrl = `${SCOPE}index.html`;
  const response = await fetch(pageUrl, { cache: 'no-store' });

  if (!response.ok) {
    await cache.addAll(APP_SHELL);
    return;
  }

  await cache.put(pageUrl, response.clone());
  const html = await response.text();
  const assetUrls = Array.from(html.matchAll(/(?:src|href)="([^"]+)"/g))
    .map((match) => new URL(match[1], SCOPE).href)
    .filter((url) => url.startsWith(SCOPE));

  await cache.addAll(Array.from(new Set([...APP_SHELL, ...assetUrls])));
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航走网络优先：拿到新版本，断网时回退到缓存的首页
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(`${SCOPE}index.html`, copy));
          }
          return response;
        })
        .catch(() => caches.match(`${SCOPE}index.html`).then((cached) => cached || caches.match(SCOPE)))
    );
    return;
  }

  // 静态资源缓存优先，后台顺手更新
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
