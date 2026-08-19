// Service Worker — Mantenimiento 2026 (Bitácora + Inventario + Análisis)
const CACHE = 'mantenimiento-v1';
const ASSETS = [
  './',
  'index.html',
  'bitacora.html',
  'inventario.html',
  'analisis.html',
  'manifest.json',
  'firebase-config.js',
  'firebase-init.js',
  'tecnicos.json',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Firebase / Firestore / Storage / Google APIs — siempre red, nunca caché.
  // Firestore ya maneja su propio modo sin conexión internamente; si el
  // service worker intercepta estas peticiones se puede romper la
  // sincronización en tiempo real.
  const skipHosts = ['googleapis.com', 'gstatic.com', 'firebaseio.com', 'google.com'];
  if (skipHosts.some(h => url.hostname.includes(h))) return;
  if (url.origin !== self.location.origin) return; // cualquier otro origen externo: red directa

  // Cascarón de la app — caché primero, con respaldo de red
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200 && e.request.method === 'GET') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('index.html'));
    })
  );
});
