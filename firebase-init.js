// firebase-init.js — FASE 1
// ══════════════════════════════════════════════════════════════════════
// QUÉ CAMBIÓ respecto a la versión anterior:
//  - ANTES: firebase.auth().signInAnonymously() se ejecutaba solo, sin
//    pedir nada a nadie — cualquiera con el link entraba con los mismos
//    permisos que todos los demás.
//  - AHORA: si no hay una sesión real (email + contraseña) iniciada, se
//    redirige a login.html. Una vez autenticado, se lee su documento
//    /usuarios/{uid} para saber su rol, nombre y si está activo.
//
// QUÉ SE CONSERVA IGUAL (para no romper bitacora.html / inventario.html /
// analisis.html / index.html, que ya usan estos nombres):
//  - la variable global `db` (Firestore) y `storage` (Storage)
//  - la función `fbTimestamp()`
//  - la promesa global `window.fbReady`
//
// QUÉ SE AGREGA:
//  - `window.currentUser`      → { uid, email }
//  - `window.currentUserRole`  → el documento completo de /usuarios/{uid}
//  - `userHasRole(...roles)`   → helper para mostrar/ocultar botones
//    según rol (SOLO cosmético — la protección real está en
//    firestore.rules / storage.rules, nunca confíes solo en esto para
//    seguridad)
//  - `fbLogout()`              → cierra sesión y regresa a login.html
//
// CORRECCIÓN (revisión previa a publicar): cualquiera que ya usó la app
// tiene una sesión anónima vieja guardada en su navegador (venía de
// signInAnonymously()). Esa sesión SÍ cuenta como "user" para Firebase
// (no es null), así que sin este chequeo la app la trataba como cuenta
// real: buscaba su rol en /usuarios, no lo encontraba, y recién ahí la
// sacaba — con un mensaje de error equivocado y una lectura de Firestore
// de más. Ahora se descarta user.isAnonymous en el mismo punto que "no
// hay sesión".
// ══════════════════════════════════════════════════════════════════════

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
// (5 oct 2026) Algunas redes (WiFi de planta, datos con filtro) bloquean la
// conexión "en vivo" que usa Firestore por defecto y la app se queda en
// "Cargando..." para siempre. Con esto Firestore detecta ese caso solo y
// cambia a un modo compatible (long polling). En redes normales no cambia nada.
try { db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (e) { console.warn('settings:', e.message); }
const storage = firebase.storage();

// Persistencia offline (igual que en la versión original del proyecto).
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn('Persistencia offline no disponible:', err.code);
});

function fbTimestamp() {
  return firebase.firestore.FieldValue.serverTimestamp();
}

// equipo.html (destino del QR de cada máquina) también se abre sin sesión:
// cualquiera puede reportar una falla y ver la hoja de vida pública (4 oct 2026).
const PUBLIC_PAGES = ['login.html', 'equipo.html'];
const currentPage = location.pathname.split('/').pop() || 'index.html';

window.currentUser = null;
window.currentUserRole = null;

// window.fbEtapa: en qué paso va el arranque (lo muestran las pantallas si
// tarda demasiado, para saber si el problema es la sesión o la base de datos).
window.fbEtapa = 'abriendo la sesión';
window.fbReady = new Promise((resolve, reject) => {
  auth.onAuthStateChanged(async (user) => {
    window.fbEtapa = user ? 'leyendo tu usuario en la base de datos' : 'sin sesión';
    if (!user || user.isAnonymous) {
      // Sin sesión real: si venía de una sesión anónima vieja, ciérrala
      // para no dejarla dando vueltas en el navegador.
      if (user && user.isAnonymous) {
        try { await auth.signOut(); } catch (e) { /* no hay nada más que hacer aquí */ }
      }
      if (!PUBLIC_PAGES.includes(currentPage)) {
        // Se incluye location.search (no solo el nombre del archivo) para no
        // perder parámetros como ?equipo=<id> del QR de checklist.html si el
        // técnico todavía no había iniciado sesión al escanearlo — 28 sep 2026.
        const next = encodeURIComponent(currentPage + location.search);
        location.href = 'login.html?next=' + next;
      }
      reject(new Error('No hay sesión iniciada'));
      return;
    }

    window.currentUser = { uid: user.uid, email: user.email };

    try {
      const snap = await db.collection('usuarios').doc(user.uid).get();

      if (!snap.exists) {
        // Tiene cuenta de Firebase Auth pero nadie le creó su documento de
        // usuario/rol todavía → no puede usar la app.
        const m = 'Tu cuenta existe pero no tiene un rol asignado. Pide a un administrador que te dé de alta.';
        try { sessionStorage.setItem('fbMotivoSalida', m); } catch (e) {}
        await auth.signOut();
        reject(new Error(m));
        return;
      }
      // CORRECCIÓN: antes era `activo === false`, que deja pasar a
      // cualquier documento donde el campo `activo` no exista (undefined
      // no es === false). firestore.rules exige `activo == true` para
      // dejar leer/escribir, así que con el chequeo viejo alguien podía
      // entrar a la interfaz y encontrarse con permission-denied en todo,
      // en vez de un aviso claro de cuenta desactivada. Ahora exige el
      // campo explícitamente en true, igual que las reglas.
      if (snap.data().activo !== true) {
        const m = 'Tu cuenta está desactivada. Contacta a un administrador.';
        try { sessionStorage.setItem('fbMotivoSalida', m); } catch (e) {}
        await auth.signOut();
        reject(new Error(m));
        return;
      }

      window.currentUserRole = snap.data();
      window.fbEtapa = 'listo';
      resolve();
    } catch (err) {
      reject(err);
    }
  });
});

function userHasRole(...roles) {
  return !!window.currentUserRole && roles.includes(window.currentUserRole.rol);
}

async function fbLogout() {
  await auth.signOut();
  location.href = 'login.html';
}

// ══════════════════════════════════════════════════════════════════════
// CORRECCIÓN: esta función faltaba en la primera versión de este archivo.
// El código original de bitacora.html / inventario.html / analisis.html /
// index.html ya la llama (fbRenderMiniNav('bitacora'), etc.) para mostrar
// una barra superior con enlaces entre las apps, el usuario conectado y
// "Salir". Se agrega aquí para no dejar esa llamada rota.
// ══════════════════════════════════════════════════════════════════════
function fbRenderMiniNav(active) {
  window.fbReady.then(() => {
    if (document.getElementById('fbMiniNav')) return; // evita duplicar si se llama 2 veces
    const pages = [
      { id: 'index',      href: 'index.html',      label: '🏠 Inicio' },
      { id: 'bitacora',   href: 'bitacora.html',   label: '📋 Bitácora' },
      { id: 'inventario', href: 'inventario.html', label: '🔧 Inventario' },
      { id: 'analisis',   href: 'analisis.html',   label: '📊 Análisis' },   
      { id: 'checklist',  href: 'checklist.html',  label: '🩺 Checklist' },
      { id: 'hoja-vida',  href: 'hoja-vida.html',  label: '🗂️ Hoja de Vida' },
      { id: 'herramientas', href: 'herramientas.html', label: '🧰 Herramientas' },
      { id: 'almacen',    href: 'almacen.html',    label: '📦 Almacén' },
    ];
    const bar = document.createElement('div');
    bar.id = 'fbMiniNav';
    bar.style.cssText = 'display:flex;gap:4px;overflow-x:auto;padding:8px 14px;background:#0B131C;border-bottom:1px solid #2D3F55;font-size:11px;align-items:center;position:sticky;top:0;z-index:250;';
    bar.innerHTML = pages.map(p =>
      `<a href="${p.href}" style="padding:5px 9px;border-radius:6px;white-space:nowrap;text-decoration:none;font-weight:600;color:${p.id===active?'#F59E0B':'#94A3B8'};background:${p.id===active?'#F59E0B18':'transparent'};">${p.label}</a>`
    ).join('')
    + `<span style="margin-left:auto;color:#94A3B8;white-space:nowrap;padding-left:8px;">👤 ${fbEsc((window.currentUserRole && window.currentUserRole.nombre) || (window.currentUser && window.currentUser.email) || '')}</span>`
    + `<button onclick="fbLogout()" style="margin-left:8px;background:none;border:1px solid #2D3F55;color:#94A3B8;border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer;white-space:nowrap;">Salir</button>`;
    document.body.insertBefore(bar, document.body.firstChild);
  }).catch(()=>{}); // si no hay sesión, fbReady ya redirigió a login.html — no hacer nada aquí
}

// ══════════════════════════════════════════════════════════════════════
// HOJA DE VIDA PÚBLICA (4 oct 2026)
// El QR de cada máquina (equipo.html) se puede abrir SIN iniciar sesión.
// Para no abrir toda la base de datos, lo que ve el público sale de una copia
// aparte por equipo: /equipos_publico/{mismo id del equipo}, con la ficha
// técnica y el historial de trabajos SIN nombres de técnicos, costos ni
// repuestos. La escriben los usuarios de mantenimiento automáticamente
// (Bitácora al guardar, Hoja de Vida al abrir un equipo, Etiquetas QR al
// imprimir) con publicarHojaVida().
// ══════════════════════════════════════════════════════════════════════
const _normPub = s => fbEquipoKey(s);
// Mismas reglas que la Hoja de Vida: por nombre de equipo, por línea con el
// mismo nombre, o por equipoId (avisos y checklist).
function otsDelEquipo(e, ots) {
  const n = _normPub(e.nombre);
  return (ots || []).filter(o => o.FECHA && o.estado !== 'anulada' && !(['operador', 'qr', 'checklist'].includes(o.origen) && o.estado !== 'completada') && (_normPub(o.EQUIPO || o.TIPO_MAQUINA) === n || _normPub(o.LINEA_EQUIPO) === n || (o.equipoId && o.equipoId === e.id)));
}
// (5 oct 2026) Todas las OTs de UN equipo sin leer toda la colección /ots
// (cuota gratis de Firebase: 50.000 lecturas al día). Hace 4 consultas
// pequeñas y une el resultado por id:
//   equipoId == e.id  (avisos, checklist y OTs nuevas)
//   EQUIPO / TIPO_MAQUINA / LINEA_EQUIPO  'in'  [formas de escribir el nombre]
// Formas: el nombre tal cual, MAYÚSCULAS, minúsculas, Tipo Título, los
// nombres extra que pase la pantalla (p. ej. los vistos en sus OTs recientes)
// y variantes sin acentos / sin espacios.
// Máximo 10 por consulta ('in' de este SDK). Devuelve las OTs SIN filtrar:
// quien la usa filtra con otsDelEquipo() / fbEquipoKey para el emparejamiento
// exacto (sin acentos ni espacios). Se guarda en memoria por equipo mientras
// la página esté abierta; opts.fresco = true vuelve a leer del servidor.
const _cacheOtsEquipo = new Map();
function fbFormasNombre(nombre, extras) {
  const n = (nombre || '').toString();
  const titulo = n.toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());
  const sinAcento = n.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const pegado = n.replace(/\s+/g, '');
  // Primero las formas más comunes y los nombres vistos; después variantes
  // sin acentos / sin espacios ("WEAVING5"), hasta completar 10.
  const formas = [n, n.trim(), n.toUpperCase(), n.toLowerCase(), titulo].concat(extras || [],
    [sinAcento, sinAcento.toUpperCase(), pegado, pegado.toUpperCase(), pegado.toLowerCase()]);
  const key = fbEquipoKey(n);
  const out = [];
  formas.forEach(f => { if (f && typeof f === 'string' && !out.includes(f) && (!key || fbEquipoKey(f) === key)) out.push(f); });
  return out.slice(0, 10);
}
function fbOtsDeEquipo(e, opts) {
  opts = opts || {};
  if (!e || !e.id || typeof db === 'undefined') return Promise.resolve([]);
  const k = e.id + '|' + (e.nombre || '');
  if (!opts.fresco && _cacheOtsEquipo.has(k)) return _cacheOtsEquipo.get(k);
  const col = db.collection('ots');
  const formas = fbFormasNombre(e.nombre, opts.nombres);
  const consultas = [col.where('equipoId', '==', e.id).get()];
  if (formas.length) ['EQUIPO', 'TIPO_MAQUINA', 'LINEA_EQUIPO'].forEach(campo => consultas.push(col.where(campo, 'in', formas).get()));
  const p = Promise.all(consultas).then(snaps => {
    const porId = new Map();
    snaps.forEach(sn => sn.docs.forEach(d => { if (!porId.has(d.id)) porId.set(d.id, { id: d.id, ...d.data() }); }));
    return [...porId.values()];
  });
  _cacheOtsEquipo.set(k, p);
  p.catch(() => _cacheOtsEquipo.delete(k)); // si falla, el próximo intento vuelve a leer
  return p;
}
const CAMPOS_FICHA_PUB = ['nombre','localidad','marca','modelo','serie','fabricacion','instalacion','tension','potencia','frecuencia','fase','tamano','peso','madein','caracteristicas','checklistProximaFecha'];
// e = equipo ({id, nombre, ...}); ots = las OTs del equipo (fbOtsDeEquipo) o
// todas las OTs — se filtran aquí con otsDelEquipo (opcional: sin ellas solo
// se publica la ficha técnica y se conserva el historial que ya hubiera).
function publicarHojaVida(e, ots) {
  if (!e || !e.id || typeof db === 'undefined') return Promise.resolve();
  const doc = {};
  CAMPOS_FICHA_PUB.forEach(k => { doc[k] = e[k] != null ? e[k] : ''; });
  if (ots) {
    const corta = (s, n) => { s = (s || '').toString().trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
    const lista = otsDelEquipo(e, ots)
      .sort((a, b) => (b.FECHA || '').localeCompare(a.FECHA || '') || (b.H_INICIO || '').localeCompare(a.H_INICIO || ''));
    doc.totalOts = lista.length;
    doc.totalCorrectivos = lista.filter(o => (o.TIPO_MANTENIMIENTO || '').toLowerCase() === 'correctivo').length;
    doc.ultimaIntervencion = lista[0] ? lista[0].FECHA : '';
    doc.historial = lista.slice(0, 150).map(o => ({
      f: o.FECHA || '', t: o.TIPO_MANTENIMIENTO || '', c: o.CAUSA_FALLA || o.causaFalla || '',
      d: corta(o.DESCRIPCION_FALLA || o.descripcionFalla, 220), s: corta(o.DESCRIPCION_SOLUCION, 220),
      p: Number(o.TOTAL_MIN_MAQUINA) || 0, pz: corta(o.PIEZA, 60),
    }));
  }
  doc.actualizado = firebase.firestore.FieldValue.serverTimestamp();
  return db.collection('equipos_publico').doc(e.id).set(doc, { merge: true })
    .catch(err => console.warn('No se pudo publicar la hoja de vida de', e.nombre, err.message));
}


// ══════════════════════════════════════════════════════════════════════
// UTILIDADES COMPARTIDAS (5 oct 2026 — auditoría)
// Antes cada pantalla tenía su propia copia de estas funciones y algunas ya
// se comportaban distinto (fecha en UTC, semana desde el 1 de enero, nombres
// de equipo comparados de formas diferentes). Ahora todas usan estas.
// ══════════════════════════════════════════════════════════════════════

// Texto seguro para meter en HTML: cualquier dato escrito por una persona
// (incluido un reporte anónimo desde el QR) pasa por aquí antes de mostrarse.
function fbEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
}
// Fecha local YYYY-MM-DD (NUNCA toISOString: eso es UTC y después de las
// 8:00 pm en UTC-4 da la fecha de mañana).
function fbFechaLocal(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
const fbHoy = () => fbFechaLocal(new Date());
// 'YYYY-MM-DD' → Date a medianoche LOCAL (new Date('YYYY-MM-DD') es UTC).
function fbParseFecha(f) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
// Semana ISO 8601 (lunes a domingo; la semana 1 es la que tiene el primer
// jueves del año). Es la misma que usa Análisis y la de los calendarios.
function fbSemanaISO(f) {
  const d0 = f instanceof Date ? f : fbParseFecha(f);
  if (!d0) return null;
  const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
  const dia = (d.getDay() + 6) % 7;            // lunes = 0
  d.setDate(d.getDate() - dia + 3);            // jueves de esa semana
  const anio = d.getFullYear();
  const jue1 = new Date(anio, 0, 4);
  return 1 + Math.round(((d - jue1) / 86400000 - 3 + ((jue1.getDay() + 6) % 7)) / 7);
}
// Año al que pertenece la semana ISO (el 29-dic puede ser semana 1 del año siguiente).
function fbAnioSemanaISO(f) {
  const d0 = f instanceof Date ? f : fbParseFecha(f);
  if (!d0) return null;
  const d = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3);
  return d.getFullYear();
}
// 'HH:MM' → minutos del día (null si viene vacío o mal escrito).
function fbHoraAMin(h) {
  const m = /^(\d{1,2}):(\d{2})/.exec(h || '');
  return m ? (+m[1]) * 60 + (+m[2]) : null;
}
// Minutos entre dos horas del mismo trabajo. Si la final es menor que la
// inicial, el trabajo cruzó la medianoche (23:30 → 01:10 = 100 min, no 0).
function fbMinutosEntre(hIni, hFin) {
  const a = fbHoraAMin(hIni), b = fbHoraAMin(hFin);
  if (a == null || b == null) return 0;
  return b >= a ? b - a : b + 1440 - a;
}
// Clave para comparar nombres de equipo: sin mayúsculas, sin acentos y sin
// espacios ("Weaving 5", "weaving5" y "WEAVING  5" son el mismo equipo).
function fbEquipoKey(s) {
  return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '');
}

// ── Archivos (fotos de repuestos y manuales) ──
// Faltaban: Inventario las llamaba y no existían, así que nunca subía nada.
async function fbUploadDataUrl(dataUrl, path) {
  const ref = storage.ref().child(path);
  await ref.putString(dataUrl, 'data_url');
  return ref.getDownloadURL();
}
function fbDeleteFile(url) {
  if (!url || !/^https?:|^gs:/.test(url)) return Promise.resolve();
  try { return storage.refFromURL(url).delete().catch(err => console.warn('No se pudo borrar el archivo:', err.code || err.message)); }
  catch (e) { return Promise.resolve(); }
}

// ── Error al arrancar ──
// Si la sesión no abre (cuenta desactivada, sin rol, sin conexión) la
// pantalla ya no se queda en "Cargando…" sin decir nada: aparece un aviso
// con la causa y los botones Reintentar / Iniciar sesión. Una pantalla que
// maneja su propio aviso pone window.FB_ERROR_PROPIO = true.
function fbMostrarErrorArranque(texto) {
  if (window.FB_ERROR_PROPIO || document.getElementById('fbErrArranque')) return;
  const pinta = () => {
    if (document.getElementById('fbErrArranque')) return;
    const d = document.createElement('div');
    d.id = 'fbErrArranque';
    d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,25,35,.94);display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,system-ui,sans-serif;';
    d.innerHTML = '<div style="background:#202F42;border:1px solid #2D3F55;border-radius:14px;padding:24px 20px;max-width:360px;width:100%;text-align:center;color:#F1F5F9;">'
      + '<div style="font-size:40px;margin-bottom:8px;">⚠️</div>'
      + '<div style="font-size:15px;line-height:1.5;margin-bottom:16px;">' + fbEsc(texto) + '</div>'
      + '<button onclick="location.reload()" style="width:100%;padding:12px;border:none;border-radius:10px;background:#F59E0B;color:#0F1923;font-weight:800;font-size:15px;cursor:pointer;">🔄 Reintentar</button>'
      + '<a href="login.html?next=' + encodeURIComponent(currentPage + location.search) + '" style="display:block;margin-top:10px;padding:11px;border-radius:10px;background:#2D3F55;color:#F1F5F9;font-weight:700;text-decoration:none;font-size:14px;">Iniciar sesión con otra cuenta</a>'
      + '</div>';
    document.body.appendChild(d);
    const ok = () => d.remove();
    window.fbReady.then(ok, () => {});
  };
  if (document.body) pinta(); else document.addEventListener('DOMContentLoaded', pinta);
}
if (!PUBLIC_PAGES.includes(currentPage)) {
  window.fbReady.catch(err => {
    if (!err || err.message === 'No hay sesión iniciada') return; // ya se fue a login.html
    fbMostrarErrorArranque(err.message);
  });
  setTimeout(() => {
    if (window.fbEtapa !== 'listo' && window.fbEtapa !== 'sin sesión') {
      fbMostrarErrorArranque('La conexión está tardando más de lo normal (paso: ' + window.fbEtapa + '). Revisa el internet o la señal y pulsa Reintentar. Si carga más tarde, esta ventana se quita sola.');
    }
  }, 15000);
}

// ── Folio de OT (un solo formato para toda la app) ──
// Con conexión: OT-0001, OT-0002… del contador compartido (la regla de
// Firestore solo deja sumarle 1). Sin conexión o si tarda más de 5 s:
// folio provisional "OT-P" + código único; la OT se guarda igual.
async function fbFolioNuevo() {
  const ref = db.collection('config').doc('otFolioCounter');
  const tx = db.runTransaction(async t => {
    const s = await t.get(ref);
    const a = (s.exists && typeof s.data().ultimo === 'number') ? s.data().ultimo : 0;
    if (s.exists) t.update(ref, { ultimo: a + 1 }); else t.set(ref, { ultimo: 1 });
    return a + 1;
  });
  try {
    const n = await Promise.race([tx, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
    return 'OT-' + String(n).padStart(4, '0');
  } catch (e) {
    if (e && e.code === 'permission-denied') console.warn('Contador de folios rechazado: revisa /config/otFolioCounter (debe tener ultimo: número).');
    return 'OT-P' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
  }
}

// ══════════════════════════════════════════════════════════════════════
// CATÁLOGO DE EQUIPOS CON CACHÉ (5 oct 2026 — para no pagar nunca)
// El plan gratis de Firebase permite 50.000 lecturas al día. Releer la lista
// completa de equipos cada vez que alguien abre una pantalla gastaba ~15.000
// al día. Ahora se usa la copia guardada en el celular y solo se pide al
// servidor si tiene más de 12 horas, si no hay copia, o si la persona toca
// "Actualizar". Inventario y Etiquetas siguen en vivo (los usa poca gente).
// Se entrega un objeto con la misma forma que un snapshot ({docs:[…]}) para
// que las pantallas no cambien su código de lectura.
// ══════════════════════════════════════════════════════════════════════
const FB_EQ_TTL_MS = 12 * 60 * 60 * 1000; // 12 h (una lectura completa al día por celular, aprox.)
function _fbEqSnap(docs) {
  const lista = docs.slice().sort((a, b) => String((a.data() || {}).nombre || '').localeCompare(String((b.data() || {}).nombre || ''), 'es', { numeric: true }));
  return { docs: lista, size: lista.length, empty: !lista.length, forEach: f => lista.forEach(f) };
}
async function fbEquiposCatalogo(forzar) {
  const ref = db.collection('equipos');
  let ultima = 0;
  try { ultima = +localStorage.getItem('fbEquiposSync') || 0; } catch (e) {}
  if (!forzar && Date.now() - ultima < FB_EQ_TTL_MS) {
    try {
      const c = await ref.get({ source: 'cache' });
      if (!c.empty) return _fbEqSnap(c.docs);
    } catch (e) { /* sin caché local: se va al servidor */ }
  }
  try {
    const s = await ref.get({ source: 'server' });
    try { localStorage.setItem('fbEquiposSync', String(Date.now())); } catch (e) {}
    return _fbEqSnap(s.docs);
  } catch (err) {
    // sin señal: lo que haya en el celular
    const c = await ref.get({ source: 'cache' });
    return _fbEqSnap(c.docs);
  }
}
// Reemplazo de db.collection('equipos').onSnapshot(cb, errCb): entrega una
// vez la lista y vuelve a entregarla si se llama fbRefrescarEquipos().
const _fbEqOyentes = [];
function fbEscucharEquipos(cb, errCb) {
  _fbEqOyentes.push({ cb, errCb });
  fbEquiposCatalogo(false).then(cb, errCb || (e => console.warn('equipos:', e.message)));
  return () => {};
}
function fbRefrescarEquipos(soloCelular) {
  // soloCelular = true: vuelve a entregar la copia local (ya incluye los
  // cambios hechos en ESTE celular) sin gastar lecturas del servidor.
  const p = soloCelular ? db.collection('equipos').get({ source: 'cache' }).then(c => _fbEqSnap(c.docs)) : fbEquiposCatalogo(true);
  return p.then(s => { _fbEqOyentes.forEach(o => { try { o.cb(s); } catch (e) { console.error(e); } }); return s; });
}
