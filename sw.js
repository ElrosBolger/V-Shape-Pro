'use strict';

const CACHE_PREFIX = 'vshape-pro-';
const CACHE = CACHE_PREFIX + 'v10-pixel-graphics-20261116';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './icon-192.png', './icon-512.png',
  './icon-maskable-v2-192.png', './icon-maskable-v2-512.png',
  './favicon-32.png', './apple-touch-icon.png', './splash-1080x2400.jpg'
];
const ASSET_URLS = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;

  const image = ASSET_URLS.has(url.href) && /\.(png|jpg)$/.test(url.pathname);
  const network = () => fetch(request).then(response => {
    // Only static assets are cached, never OAuth callback query strings.
    if (response.ok && ASSET_URLS.has(url.href)) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
    }
    return response;
  }).catch(async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    // An image failure must reach the image's error handler, not return HTML.
    if (request.mode === 'navigate') {
      return (await cache.match('./index.html')) || Response.error();
    }
    return Response.error();
  });
  event.respondWith(image ? caches.open(CACHE).then(async cache =>
    (await cache.match(request)) || network()) : network());
});
