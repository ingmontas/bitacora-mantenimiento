/* ═══════════════════════════════════════════════════════════════
   CONFIGURACIÓN DE FIREBASE — UNA O VARIAS EMPRESAS (v74, nov 2026)
   ═══════════════════════════════════════════════════════════════
   Cada empresa (cliente) tiene SU PROPIO proyecto de Firebase: su propia
   base de datos, sus propios usuarios y sus propias fotos. Así ningún
   cliente puede ver los datos de otro, aunque usen la misma app.

   La empresa se elige así (la primera que aplique):
     1. La dirección de la página es de esa empresa (campo "hosts", por
        ejemplo "cliente.web.app" si se le publicó su propia copia).
     2. Un enlace con ?empresa=codigo   (ej. login.html?empresa=demo).
     3. La que se eligió antes en este celular (inicio de sesión → Cambiar).
     4. La empresa de siempre (VT_EMPRESA_DEF). Quien usa la app hoy no
        nota ningún cambio: sigue entrando a la misma base de datos.

   Al cambiar de empresa en un celular, las copias guardadas de la otra
   (técnicos, logo, borradores…) se apartan y vuelven cuando se regresa a
   ella; se conservan el idioma y el tema. La sesión de cada empresa queda aparte.

   PARA AGREGAR UN CLIENTE: no se agrega aquí sino en
   kit-clientes/empresas.js (en tu computadora, no en GitHub); ver
   kit-clientes/ALTA-CLIENTE.md. Cada cliente recibe su propia copia de la
   app con solo su empresa. Aquí solo se agrega una empresa si se quiere
   entrar a ella desde esta misma dirección (por ejemplo, una demostración);
   entonces el inicio de sesión muestra "Empresa: … · Cambiar".
   ═══════════════════════════════════════════════════════════════ */

// ═══ EMPRESAS: inicio (no borres esta línea) ═══
const VT_EMPRESAS = {
  voidtech: {
    nombre: 'VoidTech',
    legado: true,   // solo la empresa de siempre: marca VoidTech y lista vieja tecnicos.json
    config: {
      apiKey: "AIzaSyDGCNn6I3KBAPX3uKWFI9xTGfN_4yNAUt8",
      authDomain: "mantenimiento-planta-174c2.firebaseapp.com",
      projectId: "mantenimiento-planta-174c2",
      storageBucket: "mantenimiento-planta-174c2.firebasestorage.app",
      messagingSenderId: "1098102717611",
      appId: "1:1098102717611:web:b91ef5c331ee6470c5cbee"
    }
  },
  // Ejemplo (quita las // para usarlo):
  // 'demo': {
  //   nombre: 'Demostración',          // se muestra en el inicio de sesión y en el menú
  //   hosts: ['demo-mant.web.app'],      // opcional: su propia dirección
  //   config: { apiKey: "…", authDomain: "…", projectId: "…", storageBucket: "…", messagingSenderId: "…", appId: "…" }
  // },
};
const VT_EMPRESA_DEF = 'voidtech';
// ═══ EMPRESAS: fin (no borres esta línea) ═══

// ── No hace falta tocar nada de aquí para abajo ──
(function () {
  const LS = 'vtEmpresa';            // empresa elegida en este celular
  const LS_ACT = 'vtEmpresaActiva';  // empresa de la que son las copias guardadas
  const APARTE = 'vtEmpresaCopia:';  // copias apartadas de cada empresa
  // Lo que es del celular y no de la empresa: se conserva al cambiar.
  // OJO: un ajuste nuevo "de este celular" (no de la empresa) se agrega aquí.
  const CONSERVAR = ['vtTema', 'idioma', 'vtGrupos', 'vtRail', 'i18nDev', LS, LS_ACT];
  const CONSERVAR_PREF = /^(firebase|firestore|__fake|vtEmpresaCopia:)/; // sesiones de Firebase (cada empresa la suya), copias apartadas y pruebas
  const IMPORTANTE = ['bitacora_borrador_pendiente']; // lo escrito que no subió: se aparta aunque falte espacio
  const limpio = c => String(c == null ? '' : c).trim().toLowerCase();
  const existe = c => Object.prototype.hasOwnProperty.call(VT_EMPRESAS, c) && !!(VT_EMPRESAS[c] && VT_EMPRESAS[c].config);
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const lsDel = k => { try { localStorage.removeItem(k); } catch (e) {} };

  // ── 1. Qué empresa ──
  let codigo = null, fija = false, codigoMalo = '';
  const host = (location.hostname || '').toLowerCase();
  codigo = Object.keys(VT_EMPRESAS).find(c => existe(c) && Array.isArray(VT_EMPRESAS[c].hosts) && VT_EMPRESAS[c].hosts.map(limpio).includes(host)) || null;
  if (codigo) fija = true;
  else {
    let pedido = '';
    try { pedido = limpio(new URLSearchParams(location.search).get('empresa')); } catch (e) {}
    if (existe(pedido)) {
      codigo = pedido; lsSet(LS, pedido);
      // Se quita de la dirección: ya quedó guardada, y así dos pestañas con enlaces distintos no se recargan una a la otra sin fin.
      try { const u = new URL(location.href); u.searchParams.delete('empresa'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) {}
    }
    else if (pedido) codigoMalo = pedido;
  }
  if (!codigo && existe(limpio(lsGet(LS)))) codigo = limpio(lsGet(LS));
  // (si VT_EMPRESA_DEF quedó mal escrito, la primera de la lista: la app nunca se queda sin Firebase)
  if (!codigo) codigo = existe(VT_EMPRESA_DEF) ? VT_EMPRESA_DEF : Object.keys(VT_EMPRESAS).find(existe);

  // ── 2. Copias guardadas en este celular ──
  // Las de otra empresa se apartan (vtEmpresaCopia:<código>) antes de que la
  // app las lea, y se traen las de esta si el celular ya la usó. Nada se
  // pierde: un registro de la Bitácora que no subió sigue ahí al volver.
  // Orden seguro: primero se guarda la copia y solo después se borra; al
  // traer, primero se escribe todo y al final se borra la copia; la marca
  // vtEmpresaActiva va de último (si algo se corta antes, se termina la próxima vez).
  // Sin marca (celular que ya usaba la app antes de v74) = son de la empresa de siempre.
  const antes = limpio(lsGet(LS_ACT)) || VT_EMPRESA_DEF;
  const deEmpresa = () => {
    const o = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && !CONSERVAR.includes(k) && !CONSERVAR_PREF.test(k)) o[k] = localStorage.getItem(k); } } catch (e) {}
    return o;
  };
  if (antes !== codigo) {
    const copia = deEmpresa();
    let ok = Object.keys(copia).length === 0 || lsSet(APARTE + antes, JSON.stringify(copia));
    if (!ok) { // sin espacio: se sueltan las copias que se vuelven a leer del servidor y se guarda lo importante
      Object.keys(copia).forEach(k => { if (!IMPORTANTE.includes(k)) lsDel(k); });
      const min = {}; IMPORTANTE.forEach(k => { if (copia[k] != null) min[k] = copia[k]; });
      ok = Object.keys(min).length === 0 || lsSet(APARTE + antes, JSON.stringify(min));
    }
    if (ok) Object.keys(copia).forEach(lsDel);
    try { sessionStorage.clear(); } catch (e) {}
  }
  const suya = lsGet(APARTE + codigo);   // también termina un cambio que se cortó a medias
  if (suya) {
    let o = {}; try { o = JSON.parse(suya) || {}; } catch (e) {}
    // Lo importante primero; si falta espacio para el resto, son copias que se vuelven a leer del servidor.
    // La copia se borra siempre, para que nunca vuelva a pisar datos más nuevos.
    Object.keys(o).sort((x, y) => IMPORTANTE.includes(y) - IMPORTANTE.includes(x)).forEach(k => lsSet(k, o[k]));
    lsDel(APARTE + codigo);
  }
  lsSet(LS_ACT, codigo);
  // Otra pestaña abierta cambió de empresa → esta se recarga para no escribir en la equivocada.
  try { window.addEventListener('storage', ev => { if (ev.key === LS_ACT && ev.newValue && ev.newValue !== codigo) location.reload(); }); } catch (e) {}

  // ── 3. Lo que usan las pantallas ──
  const e = VT_EMPRESAS[codigo];
  const varias = Object.keys(VT_EMPRESAS).filter(existe).length > 1;
  const legado = e.legado === true;
  const nombre = String(e.nombre || codigo);
  window.VT_EMPRESA = Object.freeze({
    codigo,
    nombre,
    legado,                                         // marca VoidTech y tecnicos.json
    fija,                                           // su propia dirección
    codigoMalo,                                     // ?empresa= con un código que no existe
    mostrarEmpresa: varias || !legado,              // decir en qué empresa se está (inicio de sesión, Más)
    puedeCambiar: varias && !fija,                  // inicio de sesión → Cambiar
    marcaHtml: legado ? '<b>Void<em>Tech</em></b>' : '<b>' + nombre.replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';') + '</b>',
    titulo: t => (legado ? String(t) : String(t).replace(/VoidTech/g, () => nombre)),
  });
  // Inicio de sesión → Cambiar. Devuelve false si el código no existe.
  window.vtEmpresaElegir = function (c) {
    c = limpio(c);
    return existe(c) && lsSet(LS, c);
  };
})();

const firebaseConfig = VT_EMPRESAS[window.VT_EMPRESA.codigo].config;
