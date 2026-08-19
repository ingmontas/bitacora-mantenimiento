/* ═══════════════════════════════════════════════════════════════
   CAPA COMPARTIDA DE FIREBASE
   Cargada por bitacora.html, inventario.html y analisis.html.
   Provee: autenticación anónima automática, acceso a Firestore y
   Storage, subida de imágenes/PDF, barra de "sin conexión", y una
   mini barra de navegación consistente entre las 3 páginas.
   ═══════════════════════════════════════════════════════════════ */

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Persistencia offline: los cambios hechos sin señal se guardan en el
// celular y se suben solos apenas vuelva la conexión. No requiere que
// nosotros escribamos lógica manual de "cola pendiente".
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn('Persistencia offline no disponible:', err.code);
});

// Promesa que se resuelve cuando ya iniciamos sesión anónima y podemos
// leer/escribir en Firestore. Cada página debe hacer:
//   await window.fbReady;
// antes de usar `db` o `storage`.
window.fbReady = new Promise((resolve, reject) => {
  auth.onAuthStateChanged((user) => {
    if (user) { resolve(user); return; }
    auth.signInAnonymously().catch((err) => {
      console.error('No se pudo iniciar sesión anónima en Firebase:', err);
      reject(err);
    });
  });
});

window.db = db;
window.storage = storage;
window.fbTimestamp = firebase.firestore.FieldValue.serverTimestamp;

/* ═══════════════ SUBIDA DE ARCHIVOS (fotos de repuestos, manuales PDF) ═══════════════ */
// Convierte un data: URL (lo que produce FileReader/canvas.toDataURL) en un
// archivo real y lo sube a Firebase Storage. Devuelve la URL pública de
// descarga, que es lo único que se guarda en Firestore (así los documentos
// no se llenan de texto base64 y no chocan con el límite de 1MB por doc).
async function fbUploadDataUrl(dataUrl, path) {
  await window.fbReady;
  const ref = storage.ref(path);
  await ref.putString(dataUrl, 'data_url');
  return await ref.getDownloadURL();
}
window.fbUploadDataUrl = fbUploadDataUrl;

async function fbDeleteFile(url) {
  if (!url) return;
  try {
    await window.fbReady;
    await storage.refFromURL(url).delete();
  } catch (e) {
    console.warn('No se pudo borrar el archivo anterior de Storage:', e.message);
  }
}
window.fbDeleteFile = fbDeleteFile;

/* ═══════════════ BARRA "SIN CONEXIÓN" ═══════════════ */
function fbSetupOfflineBar(elId) {
  const bar = document.getElementById(elId);
  if (!bar) return;
  const update = () => bar.classList.toggle('show', !navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
window.fbSetupOfflineBar = fbSetupOfflineBar;

/* ═══════════════ MINI NAVEGACIÓN ENTRE LAS 3 HERRAMIENTAS ═══════════════ */
// Inyecta una barrita consistente arriba de cada página para saltar entre
// Inicio / Bitácora / Inventario / Análisis, y muestra el estado de
// conexión a Firebase (útil para saber si la sincronización está viva).
function fbRenderMiniNav(active) {
  const items = [
    { key: 'home', href: 'index.html', label: '🏠 Inicio' },
    { key: 'bitacora', href: 'bitacora.html', label: '📋 Bitácora' },
    { key: 'inventario', href: 'inventario.html', label: '🔧 Inventario' },
    { key: 'analisis', href: 'analisis.html', label: '📊 Análisis' },
  ];
  const bar = document.createElement('div');
  bar.id = 'fb-mini-nav';
  bar.style.cssText = 'display:flex;gap:0;background:#0a0e14;border-bottom:1px solid #262f3d;overflow-x:auto;position:sticky;top:0;z-index:300;font-family:sans-serif;';
  bar.innerHTML = items.map(it => `
    <a href="${it.href}" style="flex:0 0 auto;padding:9px 14px;font-size:12px;font-weight:600;text-decoration:none;white-space:nowrap;
      color:${it.key===active ? '#f0a930' : '#8b98ab'};border-bottom:2px solid ${it.key===active ? '#f0a930' : 'transparent'};">${it.label}</a>
  `).join('') + `<span id="fb-conn-badge" style="margin-left:auto;flex:0 0 auto;padding:9px 14px;font-size:11px;color:#8b98ab;white-space:nowrap;">⚪ conectando…</span>`;
  document.body.insertBefore(bar, document.body.firstChild);

  const badge = document.getElementById('fb-conn-badge');
  window.fbReady.then(() => {
    badge.textContent = navigator.onLine ? '🟢 en línea' : '🟡 sin conexión (se guarda local)';
  }).catch(() => { badge.textContent = '🔴 error de conexión a Firebase'; });
  window.addEventListener('online', () => { badge.textContent = '🟢 en línea'; });
  window.addEventListener('offline', () => { badge.textContent = '🟡 sin conexión (se guarda local)'; });
}
window.fbRenderMiniNav = fbRenderMiniNav;

/* ═══════════════ PIN COMPARTIDO (protección para eliminar) ═══════════════ */
// Antes el PIN vivía en localStorage de cada celular (cada uno con su propia
// clave). Ahora vive en un documento de Firestore para que sea EL MISMO PIN
// en todos los celulares.
async function fbGetSharedPin() {
  await window.fbReady;
  const snap = await db.collection('config').doc('app').get();
  return snap.exists ? (snap.data().pin || null) : null;
}
async function fbSetSharedPin(pin) {
  await window.fbReady;
  await db.collection('config').doc('app').set({ pin: pin || firebase.firestore.FieldValue.delete() }, { merge: true });
}
window.fbGetSharedPin = fbGetSharedPin;
window.fbSetSharedPin = fbSetSharedPin;
