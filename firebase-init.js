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
// (20 oct 2026) reportar.html y login.html no cargan el SDK de Storage: antes
// esta línea fallaba ahí y detenía todo el arranque ("paso: ?" en Reportar).
const storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;

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
      // (20 oct 2026) Incentivos: solo lo ve el Administrador (tiene salarios).
      { id: 'incentivos', href: 'incentivos.html', label: '💰 Incentivos', roles: ['ADMINISTRADOR'] },
      // (22 oct 2026) Rentabilidad de equipos: solo Administrador (costos y salarios).
      { id: 'rentabilidad', href: 'rentabilidad.html', label: '📊 Rentabilidad', roles: ['ADMINISTRADOR'] },
      // (29 oct 2026) CAPEX (proyectos de inversión): Administrador y Encargado de mantenimiento.
      { id: 'capex', href: 'capex.html', label: '💼 CAPEX', roles: ['ADMINISTRADOR', 'ENCARGADO_MANTENIMIENTO'] },
      // (25 oct 2026) Administración (usuarios, respaldo, uso del plan gratis): solo Administrador.
      { id: 'admin', href: 'admin.html', label: '⚙️ Administración', roles: ['ADMINISTRADOR'] },
    ].filter(p => !p.roles || userHasRole(...p.roles));
    const bar = document.createElement('div');
    bar.id = 'fbMiniNav';
    bar.style.cssText = 'display:flex;gap:4px;overflow-x:auto;padding:8px 14px;background:var(--color-nav-bg,#0B131C);border-bottom:1px solid var(--color-nav-border,#2D3F55);font-size:11px;align-items:center;position:sticky;top:0;z-index:250;';
    // (25 oct 2026, Etapa 2) Selector de nave al principio (siempre a la vista).
    bar.innerHTML = `<span data-fb-nave style="display:flex;flex:0 0 auto;align-items:center;">${fbHtmlSelectorNave()}</span>`
    + pages.map(p =>
      `<a href="${p.href}"${p.id===active?' class="fbActivo" aria-current="page"':''} style="padding:5px 9px;border-radius:6px;white-space:nowrap;text-decoration:none;font-weight:600;color:${p.id===active?'#F59E0B':'#94A3B8'};background:${p.id===active?'#F59E0B18':'transparent'};">${p.label}</a>`
    ).join('')
    + `<span style="margin-left:auto;color:#94A3B8;white-space:nowrap;padding-left:8px;">👤 ${fbEsc((window.currentUserRole && window.currentUserRole.nombre) || (window.currentUser && window.currentUser.email) || '')}</span>`
    + `<button onclick="fbLogout()" style="margin-left:8px;background:none;border:1px solid #2D3F55;color:#94A3B8;border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer;white-space:nowrap;">Salir</button>`;
    document.body.insertBefore(bar, document.body.firstChild);
    _fbPintarSelectorNave();
    fbCargarPlantas().then(() => _fbPintarSelectorNave()).catch(() => {});
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
  if (!storage) throw new Error('Esta pantalla no tiene Storage cargado');
  const ref = storage.ref().child(path);
  await ref.putString(dataUrl, 'data_url');
  return ref.getDownloadURL();
}
function fbDeleteFile(url) {
  if (!url || !storage || !/^https?:|^gs:/.test(url)) return Promise.resolve();
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
  // (25 oct 2026, Etapa 2) Cada vez que llega el catálogo se anota de qué nave
  // es cada equipo (sin lecturas extra), para fbEnNave() / fbPlantaDeEquipo().
  try { fbIndexarEquipos(lista.map(d => ({ id: d.id, ...(d.data() || {}) }))); } catch (e) { console.warn('índice de naves:', e.message); }
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

// ══════════════════════════════════════════════════════════════════════
// LISTA DE TÉCNICOS COMPARTIDA (25 oct 2026 — ampliación a 6 naves)
// Antes cada pantalla leía tecnicos.json del repositorio (había que editar
// GitHub para agregar un técnico). Ahora la lista la mantiene el
// Administrador en ⚙️ Administración → Usuarios y se guarda en
// /config/tecnicos { lista: [{nombre, corto, plantas, activo, uid}] }.
// fbTecnicos() → Promise de los técnicos ACTIVOS [{nombre, corto, plantas}]
// (misma forma {nombre, corto} que tenía tecnicos.json).
//  - 1 lectura por sesión: se guarda en memoria y en el celular
//    (localStorage); en la misma sesión del navegador (y por 6 h como
//    máximo) se usa esa copia sin volver a leer.
//  - Si /config/tecnicos todavía no existe → tecnicos.json (como antes), así
//    nada cambia hasta que el Administrador use el panel.
//  - Sin señal o sin permiso (RR.HH./Operador no leen /config) → la última
//    copia del celular y, si no hay, tecnicos.json.
// ══════════════════════════════════════════════════════════════════════
const FB_TEC_LS = 'fbTecnicosCopia';
const FB_TEC_SES = 'fbTecnicosSesion';
const FB_TEC_TTL_MS = 6 * 60 * 60 * 1000;
let _fbTecPromesa = null;
function _fbTecActivos(lista) {
  return (Array.isArray(lista) ? lista : []).filter(t => t && t.nombre && t.activo !== false).map(t => ({
    nombre: String(t.nombre), corto: String(t.corto || t.nombre),
    plantas: Array.isArray(t.plantas) ? t.plantas.map(String) : [],
    // (26 oct 2026) nombre completo del usuario enlazado (solo si la lista lo trae): Reporte de incentivos
    ...(t.nombreCompleto ? { nombreCompleto: String(t.nombreCompleto) } : {}),
  }));
}
function _fbTecLeerCopia() {
  try { const c = JSON.parse(localStorage.getItem(FB_TEC_LS) || 'null'); return c && Array.isArray(c.lista) ? c : null; } catch (e) { return null; }
}
// admin.html la llama al guardar, para que este celular vea el cambio ya.
function fbTecnicosActualizarCopia(lista) {
  const activos = _fbTecActivos(lista);
  try { localStorage.setItem(FB_TEC_LS, JSON.stringify({ lista: activos, fuente: 'config', guardado: Date.now() })); } catch (e) {}
  try { sessionStorage.setItem(FB_TEC_SES, String(Date.now())); } catch (e) {}
  _fbTecPromesa = Promise.resolve(activos.map(t => ({ ...t, plantas: t.plantas.slice() })));
  return activos;
}
async function _fbTecDesdeJson() {
  const r = await fetch('tecnicos.json?_=' + Date.now()); // evita caché vieja
  if (!r.ok) throw new Error('tecnicos.json HTTP ' + r.status);
  return _fbTecActivos(await r.json());
}
function fbTecnicos(forzar) {
  if (_fbTecPromesa && !forzar) return _fbTecPromesa.then(l => l.map(t => ({ ...t, plantas: t.plantas.slice() })));
  _fbTecPromesa = (async () => {
    const copia = _fbTecLeerCopia();
    let ses = 0;
    try { ses = +sessionStorage.getItem(FB_TEC_SES) || 0; } catch (e) {}
    if (!forzar && copia && copia.fuente === 'config' && ses && Date.now() - ses < FB_TEC_TTL_MS) return copia.lista;
    try {
      await window.fbReady;
      const s = await db.collection('config').doc('tecnicos').get();
      if (s.exists && Array.isArray((s.data() || {}).lista)) return fbTecnicosActualizarCopia(s.data().lista);
      try { localStorage.removeItem(FB_TEC_LS); } catch (e) {} // aún no existe: manda tecnicos.json
    } catch (e) {
      if (!(e && e.code === 'permission-denied')) console.warn('No se pudo leer /config/tecnicos:', (e && e.message) || e);
      if (copia && copia.fuente === 'config') return copia.lista;
    }
    try { return await _fbTecDesdeJson(); }
    catch (e) { console.warn('No se pudo cargar tecnicos.json:', e.message); return copia ? copia.lista : []; }
  })();
  return _fbTecPromesa.then(l => l.map(t => ({ ...t, plantas: t.plantas.slice() })));
}

// ══════════════════════════════════════════════════════════════════════
// NAVES (25 oct 2026 — Etapa 2 "Nave en todo")
// "Nave" = un documento de /plantas. En toda la app la nave se guarda por
// NOMBRE (equipos.planta, areas.plantaNombre, usuarios.plantas, OTs PLANTA),
// así que aquí todo se compara por nombre (fbEquipoKey: sin mayúsculas,
// acentos ni espacios) y respetando los nombres viejos de una nave, área o
// línea renombrada (campo nombresAnteriores, ⚙️ Administración → Naves).
//
//  fbMisNaves()          null = todas las naves; si no, [nombres] del usuario
//                        (/usuarios.plantas, ya leído al iniciar sesión: 0 lecturas).
//                        El Administrador siempre tiene todas.
//  fbNaveActiva()        null = "Todas" (o todas las mías); si no, el nombre.
//  fbSetNaveActiva(x)    x = nombre | 'todas'. Se guarda en este celular.
//  fbNavesFiltro()       null (sin filtro) o [claves] de las naves que se ven.
//  fbNaveDe(doc)         nave de un registro: su campo planta / PLANTA o, si
//                        es viejo y no lo tiene, la de su equipo en el catálogo
//                        (por equipoId, por nombre o por área). '' = no se sabe.
//  fbEnNave(doc)         ¿se muestra con la nave elegida? Un registro cuya nave
//                        no se puede saber SE MUESTRA (nunca se esconde nada).
//  fbEquipoEnNave(e) / fbPlantaDeEquipo(e|id) / fbTecnicoEnNave(t)
//  fbOnNaveCambio(cb)    la pantalla se repinta al cambiar de nave; si una
//                        pantalla no se registra, se recarga.
// Lecturas: ninguna extra. Todo sale de lo que ya se leía (usuario, catálogo
// de equipos, /plantas, /areas y /lineas de Bitácora / Inventario / Admin).
// ══════════════════════════════════════════════════════════════════════
const FB_NAV_LS = 'fbNaveActiva';
const FB_NOM_LS = 'fbNombresCopia';   // { plantas: [...], areas: [...], lineas: [...] } (copia de las listas)
const FB_EQIDX_LS = 'fbEqIndice';     // { id: [planta, localidad, nombre] }
const _fbK = s => fbEquipoKey(s);
// Por tipo: docs [{id, nombre, nombresAnteriores, activo, plantaNombre|areaNombre, …}],
// actual: clave → nombre vigente, viejo: clave de un nombre anterior → nombre vigente.
const _fbNom = { plantas: { docs: [], actual: new Map(), viejo: new Map() }, areas: { docs: [], actual: new Map(), viejo: new Map() }, lineas: { docs: [], actual: new Map(), viejo: new Map() } };
function _fbNomLimpio(d) {
  if (!d || !d.nombre) return null;
  const o = { id: String(d.id || ''), nombre: String(d.nombre), activo: d.activo !== false,
    nombresAnteriores: Array.isArray(d.nombresAnteriores) ? d.nombresAnteriores.map(String).filter(Boolean) : [] };
  if (d.plantaNombre != null || d.planta != null) o.plantaNombre = String(d.plantaNombre || d.planta || '');
  if (d.areaNombre != null) o.areaNombre = String(d.areaNombre || '');
  if (d.encargado) o.encargado = String(d.encargado);
  if (d.encargadoNombre) o.encargadoNombre = String(d.encargadoNombre);
  if (d.descripcion) o.descripcion = String(d.descripcion);
  return o;
}
function _fbNomIndexar(tipo) {
  const t = _fbNom[tipo]; t.actual = new Map(); t.viejo = new Map();
  t.docs.forEach(d => { const k = _fbK(d.nombre); if (k && !t.actual.has(k)) t.actual.set(k, d.nombre); });
  t.docs.forEach(d => d.nombresAnteriores.forEach(v => { const k = _fbK(v); if (k && !t.actual.has(k) && !t.viejo.has(k)) t.viejo.set(k, d.nombre); }));
}
// Las pantallas que ya leen /plantas, /areas o /lineas pasan aquí sus
// documentos (sin lecturas extra); se guarda una copia en el celular.
function fbRegistrarNombres(tipo, docs) {
  if (!_fbNom[tipo]) return;
  _fbNom[tipo].docs = (docs || []).map(d => _fbNomLimpio(d && typeof d.data === 'function' ? { id: d.id, ...d.data() } : d)).filter(Boolean);
  _fbNomIndexar(tipo);
  try {
    const c = JSON.parse(localStorage.getItem(FB_NOM_LS) || '{}') || {};
    c[tipo] = _fbNom[tipo].docs;
    localStorage.setItem(FB_NOM_LS, JSON.stringify(c));
  } catch (e) {}
  if (tipo === 'plantas' && typeof document !== 'undefined') _fbPintarSelectorNave();
  _fbAvisarCatalogo();
}
// (25 oct 2026, Etapa 3) Aviso a quien muestre listas de áreas/líneas/equipos
// (barra de filtros, filtros.js) cuando llega el catálogo o las listas. Sin lecturas.
const _fbCatOyentes = [];
function fbOnCatalogo(cb) { if (typeof cb === 'function') _fbCatOyentes.push(cb); }
function _fbAvisarCatalogo() { _fbCatOyentes.forEach(cb => { try { cb(); } catch (e) { console.error(e); } }); }
(function () { // copia guardada en el celular → disponible al instante
  try {
    const c = JSON.parse(localStorage.getItem(FB_NOM_LS) || '{}') || {};
    Object.keys(_fbNom).forEach(t => { if (Array.isArray(c[t])) { _fbNom[t].docs = c[t].map(_fbNomLimpio).filter(Boolean); _fbNomIndexar(t); } });
  } catch (e) {}
})();
function fbListaNombres(tipo) { return (_fbNom[tipo] ? _fbNom[tipo].docs : []).map(d => ({ ...d, nombresAnteriores: d.nombresAnteriores.slice() })); }
// Nombre vigente: solo cambia un nombre ANTERIOR (renombrado); cualquier otro
// texto se devuelve tal cual (así nada cambia mientras no se renombre nada).
function fbNombreActual(tipo, s) {
  if (s == null || s === '') return s;
  const t = _fbNom[tipo]; if (!t) return s;
  const k = _fbK(s);
  return (!t.actual.has(k) && t.viejo.has(k)) ? t.viejo.get(k) : s;
}
function fbClaveNombre(tipo, s) { return _fbK(fbNombreActual(tipo, s)); }
function fbMismoNombre(tipo, a, b) { const ka = fbClaveNombre(tipo, a); return !!ka && ka === fbClaveNombre(tipo, b); }
// ¿Está activo? (inactivo = no sale en las listas para registros nuevos).
// Un nombre que no está en la lista cuenta como activo.
function fbNombreActivo(tipo, s) {
  const t = _fbNom[tipo]; if (!t || !s) return true;
  const k = fbClaveNombre(tipo, s);
  const d = t.docs.find(x => _fbK(x.nombre) === k);
  return !d || d.activo !== false;
}
// Nave de un área (por su plantaNombre); '' si no tiene.
function fbPlantaDeArea(area) {
  if (!area) return '';
  const k = fbClaveNombre('areas', area);
  const a = _fbNom.areas.docs.find(x => _fbK(x.nombre) === k);
  return a && a.plantaNombre ? fbNombreActual('plantas', a.plantaNombre) : '';
}

// ── Índice de equipos (id → nave) ──
let _fbEqIdx = {}, _fbEqPorNombre = new Map();
function _fbEqIdxReconstruirNombres() {
  _fbEqPorNombre = new Map();
  Object.keys(_fbEqIdx).forEach(id => { const k = _fbK(_fbEqIdx[id][2]); if (!k) return; _fbEqPorNombre.set(k, _fbEqPorNombre.has(k) ? null : id); }); // null = nombre repetido
}
try { _fbEqIdx = JSON.parse(localStorage.getItem(FB_EQIDX_LS) || '{}') || {}; _fbEqIdxReconstruirNombres(); } catch (e) { _fbEqIdx = {}; }
function fbIndexarEquipos(lista) {
  const idx = {};
  // (25 oct 2026, Etapa 3) + línea y si está activo (posiciones 3 y 4; una copia vieja sin ellas sigue sirviendo)
  // (28 oct 2026) + criticidad A/B/C (posición 5; '' = sin evaluar)
  (lista || []).forEach(e => { if (e && e.id) idx[e.id] = [String(e.planta || ''), String(e.localidad || ''), String(e.nombre || ''), String(e.linea || ''), e.activo === false ? 0 : 1, ['A', 'B', 'C'].includes(e.criticidad) ? e.criticidad : '']; });
  _fbEqIdx = idx; _fbEqIdxReconstruirNombres();
  try { localStorage.setItem(FB_EQIDX_LS, JSON.stringify(idx)); } catch (e) {}
  // sin copia de /plantas en el celular, las naves salen de los equipos: se repinta el selector
  if (!_fbNom.plantas.docs.length && typeof document !== 'undefined') _fbPintarSelectorNave();
  _fbAvisarCatalogo();
}
// Equipos del catálogo ya leído (copia en memoria): [{id, planta, localidad, nombre, linea, activo}].
function fbEquiposIndice() {
  return Object.keys(_fbEqIdx).map(id => { const x = _fbEqIdx[id] || []; return { id, planta: x[0] || '', localidad: x[1] || '', nombre: x[2] || '', linea: x[3] || '', activo: x[4] !== 0, criticidad: x[5] || '' }; });
}
// (28 oct 2026) Criticidad de un equipo desde el índice (0 lecturas). Al guardar
// una evaluación se corrige aquí mismo para que el celular la vea al instante.
function fbCriticidadDeEquipo(id) { const x = id && _fbEqIdx[id]; return (x && x[5]) || ''; }
function fbIndiceCriticidad(id, nivel) {
  const x = id && _fbEqIdx[id]; if (!x) return;
  x[5] = ['A', 'B', 'C'].includes(nivel) ? nivel : '';
  try { localStorage.setItem(FB_EQIDX_LS, JSON.stringify(_fbEqIdx)); } catch (e) {}
}
// id del equipo con ese nombre (sin mayúsculas/acentos/espacios); '' si no hay o se repite.
function fbEquipoIdPorNombre(n) { return (n && _fbEqPorNombre.get(_fbK(n))) || ''; }
// Nave de un equipo: su campo planta o, si no tiene, la del área (localidad).
function fbPlantaDeEquipo(e) {
  if (!e) return '';
  if (typeof e === 'string') { const x = _fbEqIdx[e]; if (!x) return ''; e = { planta: x[0], localidad: x[1] }; }
  if (e.planta) return fbNombreActual('plantas', e.planta);
  return fbPlantaDeArea(e.localidad);
}
function fbNaveDe(doc) {
  if (!doc) return '';
  const propia = doc.planta || doc.PLANTA;
  if (propia && typeof propia === 'string') return fbNombreActual('plantas', propia);
  if (doc.equipoId && _fbEqIdx[doc.equipoId]) { const p = fbPlantaDeEquipo(doc.equipoId); if (p) return p; }
  const nom = doc.EQUIPO || doc.equipoNombre || (typeof doc.equipo === 'string' ? doc.equipo : '');
  if (nom) { const id = _fbEqPorNombre.get(_fbK(nom)); if (id) { const p = fbPlantaDeEquipo(id); if (p) return p; } }
  return fbPlantaDeArea(doc.LINEA_EQUIPO || doc.equipoLocalidad || '');
}

// ── Naves del usuario y nave elegida ──
function fbMisNaves() {
  const u = window.currentUserRole;
  if (!u || u.rol === 'ADMINISTRADOR' || !Array.isArray(u.plantas)) return null;
  const out = [];
  u.plantas.forEach(p => { const n = fbNombreActual('plantas', String(p || '').trim()); if (n && !out.some(x => _fbK(x) === _fbK(n))) out.push(n); });
  return out.length ? out : null;
}
// Naves que el usuario puede elegir (con nombre vigente). Sin /plantas en el
// celular: las que aparecen en el catálogo de equipos.
function fbNavesDisponibles() {
  const mis = fbMisNaves();
  if (mis) return mis.slice();
  let l = _fbNom.plantas.docs.map(d => d.nombre);
  if (!l.length) Object.keys(_fbEqIdx).forEach(id => { const p = fbPlantaDeEquipo(id); if (p && !l.some(x => _fbK(x) === _fbK(p))) l.push(p); });
  return l.slice().sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
}
function fbNaveActiva() {
  const disp = fbNavesDisponibles();
  let v = null;
  try { v = localStorage.getItem(FB_NAV_LS); } catch (e) {}
  if (v && v !== 'todas') { const k = fbClaveNombre('plantas', v); const hit = disp.find(x => _fbK(x) === k); if (hit) return hit; }
  if (fbMisNaves() && disp.length === 1) return disp[0];
  return null;
}
function fbNavesFiltro() {
  const a = fbNaveActiva();
  if (a) return [_fbK(a)];
  const mis = fbMisNaves();
  return mis ? mis.map(_fbK) : null;
}
function _fbNaveVisible(nombre, f) {
  if (!f) return true;
  if (!nombre) return true; // sin nave conocida: se muestra
  return f.includes(fbClaveNombre('plantas', nombre));
}
function fbEnNave(doc) { const f = fbNavesFiltro(); return !f || _fbNaveVisible(fbNaveDe(doc), f); }
function fbEquipoEnNave(e) { const f = fbNavesFiltro(); return !f || _fbNaveVisible(fbPlantaDeEquipo(e), f); }
// Técnico sin naves (lista vacía) = de todas las naves.
function fbTecnicoEnNave(t) {
  const f = fbNavesFiltro();
  if (!f || !t || !Array.isArray(t.plantas) || !t.plantas.length) return true;
  return t.plantas.some(p => f.includes(fbClaveNombre('plantas', p)));
}
// ¿Esta nave (nombre) se puede usar para un registro nuevo de este usuario?
function fbNavePermitida(nombre) {
  const mis = fbMisNaves();
  return !mis || !nombre || mis.some(x => fbMismoNombre('plantas', x, nombre));
}
const _fbNaveOyentes = [];
function fbOnNaveCambio(cb) { if (typeof cb === 'function') _fbNaveOyentes.push(cb); }
function fbSetNaveActiva(v) {
  try { if (!v || v === 'todas') localStorage.setItem(FB_NAV_LS, 'todas'); else localStorage.setItem(FB_NAV_LS, String(v)); } catch (e) {}
  _fbPintarSelectorNave();
  if (!_fbNaveOyentes.length) { location.reload(); return; }
  _fbNaveOyentes.forEach(cb => { try { cb(fbNaveActiva()); } catch (e) { console.error(e); } });
}
// Texto corto para encabezados: "PLANTA 2", "Todas las naves" o "Mis naves".
function fbNaveTexto() {
  const a = fbNaveActiva();
  if (a) return a;
  return fbMisNaves() ? 'Mis naves' : 'Todas las naves';
}

// /plantas: NO se lee aquí (0 lecturas extra). La lista sale de la copia que
// dejan en el celular las pantallas que ya leen /plantas (Bitácora la escucha
// en vivo, Inventario y Administración la leen al abrir sus formularios) y,
// si todavía no hay copia, de las naves que tienen los equipos del catálogo.
function fbCargarPlantas() { return Promise.resolve(fbListaNombres('plantas')); }

// ── Selector de nave (barra superior) ──
// Se muestra solo si el usuario puede ver más de una nave. Con una sola nave
// asignada se muestra su nombre, sin selector.
function fbHtmlSelectorNave() {
  const disp = fbNavesDisponibles();
  const mis = fbMisNaves();
  if (disp.length <= 1) {
    return (mis && disp.length === 1) ? `<span class="fbNaveTxt" id="fbNaveTxt" style="color:#F59E0B;font-weight:700;white-space:nowrap;padding:4px 6px;max-width:150px;overflow:hidden;text-overflow:ellipsis;">🏭 ${fbEsc(disp[0])}</span>` : '';
  }
  const act = fbNaveActiva();
  const inact = n => !fbNombreActivo('plantas', n);
  return `<select id="fbNaveSel" aria-label="Nave" title="Nave" style="flex:0 0 auto;max-width:150px;background:#1A2535;color:#F59E0B;border:1px solid #F59E0B66;border-radius:6px;padding:4px 6px;font-size:11px;font-weight:700;font-family:inherit;">`
    + `<option value="todas"${act ? '' : ' selected'}>🏭 ${mis ? 'Mis naves' : 'Todas las naves'}</option>`
    + disp.map(n => `<option value="${fbEsc(n)}"${act && _fbK(act) === _fbK(n) ? ' selected' : ''}>🏭 ${fbEsc(n)}${inact(n) ? ' (inactiva)' : ''}</option>`).join('')
    + `</select>`;
}
function _fbPintarSelectorNave() {
  document.querySelectorAll('[data-fb-nave]').forEach(el => {
    el.innerHTML = fbHtmlSelectorNave();
    const s = el.querySelector('select');
    if (s) s.onchange = () => fbSetNaveActiva(s.value);
  });
}
// Para pantallas sin barra superior (Inicio, Reportar): pinta el selector en `el`.
function fbRenderSelectorNave(el) {
  if (!el) return;
  el.setAttribute('data-fb-nave', '');
  window.fbReady.then(() => { _fbPintarSelectorNave(); return fbCargarPlantas(); }).then(() => _fbPintarSelectorNave()).catch(() => {});
}
