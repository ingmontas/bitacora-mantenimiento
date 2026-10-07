// Service Worker — Mantenimiento 2026 (Bitácora + Inventario + Análisis)
// IMPORTANTE: sube este número (v2, v3, v4...) cada vez que subas cambios a
// bitacora.html/inventario.html/analisis.html/etc. Mientras el nombre de la
// caché no cambie, el service worker sigue sirviendo la versión vieja de la
// app para siempre y los cambios nuevos nunca se ven — eso fue lo que pasó
// aquí: quedó en "v1" desde el principio, así que ningún cambio posterior se
// notaba hasta borrar la caché a mano.
const CACHE = 'mantenimiento-v40';
const ASSETS = [
  './',
  'index.html',
  'bitacora.html',
  'inventario.html',
  'analisis.html',
  'checklist.html',
  'hoja-vida.html',
  'reportar.html',
  'equipo.html',
  'etiquetas-qr.html',
  'herramientas.html',
  'almacen.html',
  'manifest.json',
  'firebase-config.js',
  'firebase-init.js',
  'login.html',
  'tecnicos.json',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// (5 oct 2026) Librerías externas (Firebase, gráficas, QR, Excel): sus URLs
// llevan versión fija, así que se guardan aparte la primera vez y luego se
// sirven del celular. Antes no se guardaban y sin señal Análisis y Hoja de
// vida quedaban en blanco. Este caché no se borra al cambiar de versión.
const LIBS = 'mantenimiento-libs-v1';
const LIB_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com'];
const esLibreria = url => LIB_HOSTS.includes(url.hostname) || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== LIBS).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Red con límite de tiempo: con WiFi débil, si la red no responde en 4 s se
// usa la copia guardada (si existe) en vez de dejar la pantalla esperando.
function redConLimite(req, ms) {
  return new Promise((resolve, reject) => {
    let listo = false;
    const t = setTimeout(() => {
      caches.match(req, { ignoreSearch: true }).then(r => { if (r && !listo) { listo = true; resolve(r); } });
    }, ms);
    fetch(new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then(resp => {
      clearTimeout(t);
      if (resp && resp.status === 200) {
        const clone = resp.clone();
        // Se guarda sin "?id=…" para no llenar el caché con una copia por equipo.
        const u = new URL(req.url); u.search = '';
        caches.open(CACHE).then(c => c.put(u.toString(), clone));
      }
      if (!listo) { listo = true; resolve(resp); }
    }).catch(err => {
      clearTimeout(t);
      if (listo) return;
      // Sin red y sin copia: solo las páginas caen en index.html (nunca un .js).
      caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : null)).then(r => { listo = true; r ? resolve(r) : reject(err); });
    });
  });
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  if (esLibreria(url)) {
    // Se sirve la copia guardada al instante y, con señal, se vuelve a pedir
    // en segundo plano: si alguna vez se guardó una respuesta fallida (las de
    // otro dominio no dejan ver su estado), se reemplaza en la siguiente visita.
    e.respondWith(caches.open(LIBS).then(c => c.match(e.request).then(hit => {
      const red = fetch(e.request).then(resp => {
        if (resp && (resp.ok || resp.type === 'opaque')) c.put(e.request, resp.clone());
        return resp;
      });
      if (hit) { red.catch(() => {}); return hit; }
      return red;
    })));
    return;
  }
  // Base de datos, inicio de sesión y demás servicios de Google: siempre red.
  if (url.origin !== self.location.origin) return;

  const esCodigo = e.request.mode === 'navigate' || /\.(html|js|json)$/i.test(url.pathname) || url.pathname.endsWith('/');
  if (esCodigo) { e.respondWith(redConLimite(e.request, 4000)); return; }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('index.html'));
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || 'bitacora.html#avisos';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.includes('bitacora.html'));
    if (c) { c.focus(); return c.navigate ? c.navigate(url) : null; }
    return self.clients.openWindow(url);
  }));
});
