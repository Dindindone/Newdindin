const CACHE_NAME = 'travel-journal-app-v1.8.5';
const FILE_CACHE = 'travel-journal-files-v1';
const APP_SHELL = new URL('./index.html', self.registration.scope).href;
const SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.add(APP_SHELL);
    try {
      const response = await fetch(SUPABASE_CDN, { mode: 'cors' });
      if (response.ok) await cache.put(SUPABASE_CDN, response);
    } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('travel-journal-app-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Local synthetic URLs are used only for attachments already saved to the device.
  if (url.origin === self.location.origin && url.pathname.includes('/__offline_file__/')) {
    event.respondWith((async () => {
      const cache = await caches.open(FILE_CACHE);
      return (await cache.match(request)) ||
        new Response('此附件尚未下載到裝置，請連線後開啟一次。', {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
    })());
    return;
  }

  // Never cache Supabase API, Storage, authentication, or other data requests.
  if (url.origin.includes('supabase.co')) return;

  if (url.href === SUPABASE_CDN) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(SUPABASE_CDN);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(SUPABASE_CDN, response.clone());
        return response;
      } catch (_) {
        return new Response('Supabase client library is unavailable offline.', { status: 503 });
      }
    })());
    return;
  }

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        await cache.put(APP_SHELL, response.clone());
        return response;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request, { ignoreSearch: true })) ||
          (await cache.match(APP_SHELL)) ||
          new Response('目前離線，請連線後重新整理。', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});
