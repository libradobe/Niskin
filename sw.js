// Service worker de Niskin: notificaciones push + página sin conexión.
// No guarda la app en caché: cada visita carga la versión más reciente desde el servidor.
// Solo se guarda una pequeña página "sin conexión" con el logo para cuando no hay internet.
const OFFLINE_CACHE = 'niskin-offline-v1';
const OFFLINE_URL = 'offline.html';
const OFFLINE_FILES = [OFFLINE_URL, 'assets/logo.svg', 'assets/icon-192.png', 'assets/badge-96.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE)
      .then(cache => cache.addAll(OFFLINE_FILES))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('niskin-') && key !== OFFLINE_CACHE).map(key => caches.delete(key)));
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
    await self.clients.claim();
  })());
});

// Solo las navegaciones (abrir una página): red primero y, si falla, la página sin conexión
self.addEventListener('fetch', event => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith((async () => {
    try {
      const preloaded = await event.preloadResponse;
      return preloaded || await fetch(event.request);
    } catch (err) {
      const cached = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
      return cached || Response.error();
    }
  })());
});

// Avisa a las pestañas abiertas para que recarguen los datos sin esperar
async function broadcast(message) {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach(client => client.postMessage(message));
  return windows;
}

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Niskin Beauty Studio';
  const url = new URL(data.url || './', self.registration.scope).href;

  event.waitUntil((async () => {
    await self.registration.showNotification(title, {
      body: data.body || '',
      icon: 'assets/icon-192.png',
      // Ícono pequeño de la barra de estado de Android: silueta blanca sobre transparente
      badge: 'assets/badge-96.png',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      timestamp: data.timestamp || Date.now(),
      vibrate: [120, 60, 120],
      lang: data.lang || undefined,
      data: { url, tag: data.tag || '' }
    });
    await broadcast({ type: 'niskin-push', tag: data.tag || '', url });
    // Número sobre el ícono de la app (Android, escritorio y iPhone con la app instalada)
    if (self.navigator && 'setAppBadge' in self.navigator) {
      const open = await self.registration.getNotifications();
      await self.navigator.setAppBadge(open.length).catch(() => {});
    }
  })());
});

async function refreshBadge() {
  if (!(self.navigator && 'setAppBadge' in self.navigator)) return;
  const open = await self.registration.getNotifications();
  if (open.length) await self.navigator.setAppBadge(open.length).catch(() => {});
  else await self.navigator.clearAppBadge().catch(() => {});
}

self.addEventListener('notificationclose', event => {
  event.waitUntil(refreshBadge());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil((async () => {
    await refreshBadge();
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const targetPath = new URL(target).pathname;
    for (const client of windows) {
      if (new URL(client.url).pathname === targetPath && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) return client.navigate(target);
        return;
      }
    }
    return self.clients.openWindow(target);
  })());
});

// La página pide limpiar el número del ícono cuando la persona ya está viendo la app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'niskin-clear-badge' && self.navigator && 'clearAppBadge' in self.navigator) {
    event.waitUntil(self.navigator.clearAppBadge().catch(() => {}));
  }
});
