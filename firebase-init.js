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
const storage = firebase.storage();

// Persistencia offline (igual que en la versión original del proyecto).
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  console.warn('Persistencia offline no disponible:', err.code);
});

function fbTimestamp() {
  return firebase.firestore.FieldValue.serverTimestamp();
}

const PUBLIC_PAGES = ['login.html'];
const currentPage = location.pathname.split('/').pop() || 'index.html';

window.currentUser = null;
window.currentUserRole = null;

window.fbReady = new Promise((resolve, reject) => {
  auth.onAuthStateChanged(async (user) => {
    if (!user || user.isAnonymous) {
      // Sin sesión real: si venía de una sesión anónima vieja, ciérrala
      // para no dejarla dando vueltas en el navegador.
      if (user && user.isAnonymous) {
        try { await auth.signOut(); } catch (e) { /* no hay nada más que hacer aquí */ }
      }
      if (!PUBLIC_PAGES.includes(currentPage)) {
        const next = encodeURIComponent(currentPage);
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
        await auth.signOut();
        reject(new Error('Tu cuenta existe pero no tiene un rol asignado. Pide a un administrador que te dé de alta en "usuarios".'));
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
        await auth.signOut();
        reject(new Error('Tu cuenta está desactivada. Contacta a un administrador.'));
        return;
      }

      window.currentUserRole = snap.data();
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
    ];
    const bar = document.createElement('div');
    bar.id = 'fbMiniNav';
    bar.style.cssText = 'display:flex;gap:4px;overflow-x:auto;padding:8px 14px;background:#0B131C;border-bottom:1px solid #2D3F55;font-size:11px;align-items:center;position:sticky;top:0;z-index:250;';
    bar.innerHTML = pages.map(p =>
      `<a href="${p.href}" style="padding:5px 9px;border-radius:6px;white-space:nowrap;text-decoration:none;font-weight:600;color:${p.id===active?'#F59E0B':'#94A3B8'};background:${p.id===active?'#F59E0B18':'transparent'};">${p.label}</a>`
    ).join('')
    + `<span style="margin-left:auto;color:#94A3B8;white-space:nowrap;padding-left:8px;">👤 ${(window.currentUserRole && window.currentUserRole.nombre) || (window.currentUser && window.currentUser.email) || ''}</span>`
    + `<button onclick="fbLogout()" style="margin-left:8px;background:none;border:1px solid #2D3F55;color:#94A3B8;border-radius:6px;padding:4px 9px;font-size:11px;cursor:pointer;white-space:nowrap;">Salir</button>`;
    document.body.insertBefore(bar, document.body.firstChild);
  }).catch(()=>{}); // si no hay sesión, fbReady ya redirigió a login.html — no hacer nada aquí
}
