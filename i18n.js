// i18n.js — (v3, nov 2026) Idiomas de toda la app: Español (República
// Dominicana, por defecto), English y Türkçe. Script simple, sin compilar.
// ══════════════════════════════════════════════════════════════════════
// USO EN UNA PANTALLA
//   <script src="i18n.js"></script>
//   <script src="i18n/common.js"></script>      textos comunes (menú, botones, estados…)
//   <script src="i18n/<pantalla>.js"></script>  textos propios (o i18n.cargar('<pantalla>'))
//
//   t('guardar')                      → "Guardar" / "Save" / "Kaydet"   (módulo common)
//   t('capex.appTitle')               → texto del módulo "capex"
//   t('saludo', { n: 'Ana' })         → "Hola, {n}" con el valor puesto
//   tn('nOts', 3)                     → "3 OTs" (plural según el idioma, Intl.PluralRules)
//   i18n.fmtNum(1234.5, 2)            → "1,234.50" (es-DO, en-US) · "1.234,50" (tr-TR)
//   i18n.fmtMoney(1500, 'DOP')        → "RD$ 1,500.00"   ·  i18n.fmtMoney(20, 'USD') → "US$ 20.00"
//   i18n.fmtDate('2026-11-05')        → "05 nov 2026" / "Nov 05, 2026" / "05 Kas 2026"
//   i18n.fmtTime('14:30') · i18n.fmtRel(fecha) ("hace 2 horas" / "2 hours ago" / "2 saat önce")
//   i18n.getLang() / i18n.setLang('en')   (se guarda en el celular y en /usuarios/{uid}.idioma)
//   i18n.applyI18n(raiz)              traduce [data-i18n], [data-i18n-placeholder],
//                                     [data-i18n-title], [data-i18n-aria-label]
//   window.addEventListener('idioma-cambiado', e => repintar(e.detail.lang))
//   i18n.selector(el)                 botones ES · EN · TR (o <div data-i18n-selector></div>)
//
// DICCIONARIOS: i18n/<modulo>.js llama a i18n.registrar('<modulo>', { es:{…}, en:{…}, tr:{…} }).
// Un valor puede ser texto o, para plurales, { one: '…', other: '…' } (y zero/few/many/'=0').
// Si falta una clave en en/tr se usa el español (y se anota en i18n.faltan). Revisión para
// desarrolladores: i18n.revisar() (o abrir la pantalla con ?i18ndev / localStorage i18nDev=1).
//
// LO QUE NO SE TRADUCE CON ESTE ARCHIVO: lo que escribe la gente (fallas, soluciones,
// notas…). Eso lo hace traductor.js, a pedido, con un botón "Traducir".
// ══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const LANGS = ['es', 'en', 'tr'];
  const LOCALES = { es: 'es-DO', en: 'en-US', tr: 'tr-TR' };
  const HTML_LANG = { es: 'es-DO', en: 'en', tr: 'tr' };
  const NOMBRES = { es: 'Español', en: 'English', tr: 'Türkçe' };
  const LS = 'idioma';            // idioma elegido en este celular
  const LS_PEND = 'idiomaPend';   // '1' = elegido aquí y todavía no guardado en el perfil
  const LS_VIEJO = 'capexLang';   // idioma que guardaba CAPEX antes (se adopta una sola vez)

  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  const valido = l => LANGS.includes(l);

  const dicts = {};               // modulo → { es: {}, en: {}, tr: {} }
  const faltan = new Set();       // 'en:common.clave' pedidas en tiempo de ejecución sin traducción
  const cargando = {};            // modulo → Promise (cargar)

  let lang = lsGet(LS);
  if (!valido(lang)) { const v = lsGet(LS_VIEJO); lang = valido(v) ? v : 'es'; }

  // ── Diccionarios ──
  function registrar(mod, d) {
    if (!mod || !d) return;
    const cur = dicts[mod] || (dicts[mod] = {});
    LANGS.forEach(l => { cur[l] = Object.assign(cur[l] || {}, d[l] || {}); });
    if (document.readyState !== 'loading') aplicarPronto();
  }
  function drenar() { const p = window.__i18nPend; if (Array.isArray(p)) while (p.length) { const x = p.shift(); if (x[0] === '@frases') registrarFrases(x[1], x[2]); else registrar(x[0], x[1]); } }
  // Carga perezosa: i18n.cargar('bitacora') agrega <script src="i18n/bitacora.js">.
  // Sin señal y sin copia en el celular resuelve false (los textos quedan en español).
  function cargar(mod) {
    if (dicts[mod] || frMods.has(mod)) return Promise.resolve(true);
    if (cargando[mod]) return cargando[mod];
    cargando[mod] = new Promise(res => {
      const s = document.createElement('script');
      s.src = 'i18n/' + encodeURIComponent(mod) + '.js';
      s.onload = () => { drenar(); res(!!dicts[mod] || frMods.has(mod)); };
      s.onerror = () => { delete cargando[mod]; res(false); };
      document.head.appendChild(s);
    });
    return cargando[mod];
  }
  function partir(key) {
    const k = String(key == null ? '' : key);
    const i = k.indexOf('.');
    if (i > 0) { const m = k.slice(0, i); if (dicts[m]) return [m, k.slice(i + 1)]; }
    return ['common', k];
  }
  function crudo(key, l) {
    const [m, k] = partir(key);
    const d = dicts[m];
    if (!d) return undefined;
    let v = d[l || lang] && d[l || lang][k];
    if (v == null && (l || lang) !== 'es') { faltan.add((l || lang) + ':' + m + '.' + k); v = d.es && d.es[k]; }
    return v;
  }
  function poner(s, p) { return p ? String(s).replace(/\{(\w+)\}/g, (x, n) => (p[n] != null ? p[n] : x)) : String(s); }
  function t(key, params) {
    let v = crudo(key);
    if (v == null) return String(key);
    if (typeof v === 'object') v = v.other != null ? v.other : Object.values(v)[0];
    return poner(v, params);
  }
  const _pr = {};
  function tn(key, n, params) {
    let v = crudo(key);
    const num = Number(n) || 0;
    const p = Object.assign({ n: fmtNum(num, Number.isInteger(num) ? 0 : 1) }, params || {});
    if (v == null) return String(key);
    if (typeof v !== 'object') return poner(v, p);
    if (v['=' + num] != null) return poner(v['=' + num], p);
    const loc = LOCALES[lang];
    const pr = _pr[loc] || (_pr[loc] = new Intl.PluralRules(loc));
    const cat = pr.select(num);
    return poner(v[cat] != null ? v[cat] : v.other != null ? v.other : Object.values(v)[0], p);
  }
  const has = key => crudo(key) != null;

  // ── Formatos (Intl) ──
  const loc = () => LOCALES[lang];
  const _nf = {};
  function nf(o) { const k = loc() + JSON.stringify(o); return _nf[k] || (_nf[k] = new Intl.NumberFormat(loc(), o)); }
  // fmtNum(v, decimales) — decimales fijos (2 por defecto); o fmtNum(v, {opciones de Intl}).
  function fmtNum(v, d) {
    const o = (d && typeof d === 'object') ? d : { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d };
    return nf(o).format(Number(v) || 0);
  }
  const SIM = { DOP: 'RD$', USD: 'US$' };
  // Mismo formato que CAPEX: "RD$ 1,234.50", negativos "−RD$ …".
  function fmtMoney(v, cur, d) {
    v = Number(v) || 0;
    return (v < -0.004 ? '−' : '') + SIM[cur === 'USD' ? 'USD' : 'DOP'] + ' ' + fmtNum(Math.abs(v), d == null ? 2 : d);
  }
  function fmtPct(v, d) { if (v == null || !isFinite(v)) return '—'; return nf({ style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: d == null ? 1 : d }).format(v / 100); }
  // Fecha: 'YYYY-MM-DD' (medianoche LOCAL), Date, milisegundos o Timestamp de Firestore.
  function aDate(x) {
    if (x == null || x === '') return null;
    if (x instanceof Date) return isNaN(x) ? null : x;
    if (typeof x === 'number') return new Date(x);
    if (typeof x.toDate === 'function') return x.toDate();
    if (typeof x.seconds === 'number') return new Date(x.seconds * 1000);
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(x));
    if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(String(x))) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    const d = new Date(x); return isNaN(d) ? null : d;
  }
  const ESTILOS = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    medium: { day: '2-digit', month: 'short', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    weekday: { weekday: 'long', day: 'numeric', month: 'long' },
    dayMonth: { day: '2-digit', month: 'short' },
    monthYear: { month: 'long', year: 'numeric' },
  };
  const _df = {};
  function df(o) { const k = loc() + JSON.stringify(o); return _df[k] || (_df[k] = new Intl.DateTimeFormat(loc(), o)); }
  function fmtDate(x, estilo) { const d = aDate(x); if (!d) return '—'; return df(typeof estilo === 'object' ? estilo : ESTILOS[estilo || 'medium'] || ESTILOS.medium).format(d); }
  // Hora: 'HH:MM' o fecha. Formato de 24 h en es/tr (como se escribe en la planta), 12 h en en.
  function fmtTime(x) {
    let d;
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(x == null ? '' : x).trim());
    if (m) { d = new Date(2000, 0, 1, +m[1], +m[2]); } else d = aDate(x);
    if (!d) return '—';
    return df({ hour: '2-digit', minute: '2-digit', hourCycle: lang === 'en' ? 'h12' : 'h23' }).format(d);
  }
  function fmtDateTime(x) { const d = aDate(x); return d ? fmtDate(d) + ' ' + fmtTime(d) : '—'; }
  const _rf = {};
  function fmtRel(x, ahora) {
    const d = aDate(x); if (!d) return '—';
    const base = ahora != null ? (aDate(ahora) || new Date()) : new Date();
    const s = (d.getTime() - base.getTime()) / 1000;
    const a = Math.abs(s);
    const rf = _rf[loc()] || (_rf[loc()] = new Intl.RelativeTimeFormat(loc(), { numeric: 'auto' }));
    if (a < 45) return rf.format(0, 'second');
    if (a < 2700) return rf.format(Math.round(s / 60), 'minute');
    if (a < 79200) return rf.format(Math.round(s / 3600), 'hour');
    if (a < 6 * 86400) return rf.format(Math.round(s / 86400), 'day');
    if (a < 28 * 86400) return rf.format(Math.round(s / 604800), 'week');
    if (a < 330 * 86400) return rf.format(Math.round(s / 2629800), 'month');
    return rf.format(Math.round(s / 31557600), 'year');
  }

  // ── Idioma actual ──
  const getLang = () => lang;
  const locale = () => LOCALES[lang];
  let _perfilBloqueado = false; // la regla de /usuarios no deja al usuario cambiar su idioma
  try { _perfilBloqueado = sessionStorage.getItem('idiomaPerfilBloq') === '1'; } catch (e) {}
  function guardarEnPerfil(l) {
    const u = window.currentUser, r = window.currentUserRole;
    if (!u || !u.uid || !r || typeof db === 'undefined' || !db) return Promise.resolve(false);
    if (r.idioma === l) { lsSet(LS_PEND, null); return Promise.resolve(true); }
    if (_perfilBloqueado && r.rol !== 'ADMINISTRADOR') return Promise.resolve(false);
    // Campo nuevo y aditivo: /usuarios/{uid}.idioma (1 escritura, solo cuando cambia).
    return db.collection('usuarios').doc(u.uid).update({ idioma: l })
      .then(() => { r.idioma = l; lsSet(LS_PEND, null); return true; })
      .catch(e => {
        if (e && e.code === 'permission-denied') { _perfilBloqueado = true; try { sessionStorage.setItem('idiomaPerfilBloq', '1'); } catch (x) {} }
        else console.warn('idioma: no se pudo guardar en el perfil:', (e && e.message) || e);
        return false;
      });
  }
  function setLang(l, o) {
    o = o || {};
    if (!valido(l)) return false;
    const anterior = lang;
    lang = l;
    lsSet(LS, l);
    if (o.perfil !== false) { lsSet(LS_PEND, '1'); guardarEnPerfil(l); }
    marcarHtml();
    if (anterior !== l || o.forzar) {
      applyI18n(document);
      pintarSelectores();
      domTodo();
      if (l !== 'es') cargarPantalla().then(domTodo);
      const ev = { lang: l, anterior, locale: LOCALES[l] };
      try { window.dispatchEvent(new CustomEvent('idioma-cambiado', { detail: ev })); } catch (e) {}
    }
    return true;
  }
  function marcarHtml() { try { document.documentElement.lang = HTML_LANG[lang]; } catch (e) {} }

  // Al iniciar sesión: el idioma del perfil manda (el mismo en todos sus celulares),
  // salvo que en este celular se haya elegido otro que aún no se pudo guardar.
  let _enganchado = false;
  function engancharPerfil() {
    if (_enganchado || !window.fbReady || typeof window.fbReady.then !== 'function') return;
    _enganchado = true;
    window.fbReady.then(() => {
      const r = window.currentUserRole || {};
      if (lsGet(LS_PEND) === '1') { guardarEnPerfil(lang); return; }
      if (valido(r.idioma) && r.idioma !== lang) setLang(r.idioma, { perfil: false });
    }).catch(() => {});
  }

  // ── Marcado en el HTML ──
  const ATR = [['data-i18n-placeholder', 'placeholder'], ['data-i18n-title', 'title'], ['data-i18n-aria-label', 'aria-label']];
  function params(el) { const p = el.getAttribute('data-i18n-params'); if (!p) return undefined; try { return JSON.parse(p); } catch (e) { return undefined; } }
  function applyI18n(root) {
    root = root || document;
    if (!root.querySelectorAll) return;
    const sel = (a) => { const l = Array.from(root.querySelectorAll('[' + a + ']')); if (root.hasAttribute && root.hasAttribute(a)) l.unshift(root); return l; };
    sel('data-i18n').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if (!has(k)) return; // sin traducción conocida: se deja el texto que trae el HTML
      const n = el.getAttribute('data-i18n-n');
      el.textContent = n != null ? tn(k, Number(n), params(el)) : t(k, params(el));
    });
    ATR.forEach(([a, attr]) => sel(a).forEach(el => { const k = el.getAttribute(a); if (has(k)) el.setAttribute(attr, t(k, params(el))); }));
  }
  let _apTimer = null;
  function aplicarPronto() { clearTimeout(_apTimer); _apTimer = setTimeout(() => { applyI18n(document); pintarSelectores(); }, 0); }

  // ── Selector ES · EN · TR ──
  function css() {
    if (document.getElementById('i18nCss')) return;
    const s = document.createElement('style');
    s.id = 'i18nCss';
    s.textContent = '.i18n-sel{display:inline-flex;border:1px solid var(--color-border-strong,#2D3F55);border-radius:var(--radius-sm,8px);overflow:hidden;flex:0 0 auto;vertical-align:middle}'
      + '.i18n-sel button{background:transparent;color:inherit;border:0;min-height:32px;min-width:38px;padding:4px 9px;font:inherit;font-size:12px;font-weight:800;letter-spacing:.03em;cursor:pointer}'
      + '.i18n-sel button+button{border-left:1px solid var(--color-border-strong,#2D3F55)}'
      + '.i18n-sel button[aria-pressed="true"]{background:var(--color-accent,#F59E0B);color:var(--color-on-accent,#0F1923)}'
      + '.i18n-sel button:focus-visible{outline:2px solid var(--color-primary,#3B82F6);outline-offset:-2px}'
      + 'select.i18n-sel{min-height:32px;padding:3px 6px;background:transparent;color:inherit;font:inherit;font-size:12px;font-weight:700}';
    (document.head || document.documentElement).appendChild(s);
  }
  // i18n.selector(el, { tipo: 'botones' | 'select' }) → pinta el selector dentro de el.
  function selector(el, o) {
    if (!el) return null;
    o = o || {};
    css();
    const tipo = o.tipo || el.getAttribute('data-i18n-selector') || 'botones';
    el.setAttribute('data-i18n-selector', tipo === 'select' ? 'select' : 'botones');
    if (tipo === 'select') {
      el.innerHTML = '<select class="i18n-sel">' + LANGS.map(l => '<option value="' + l + '" lang="' + l + '">' + l.toUpperCase() + ' · ' + NOMBRES[l] + '</option>').join('') + '</select>';
      el.querySelector('select').onchange = e => setLang(e.target.value);
    } else {
      el.innerHTML = '<div class="i18n-sel" role="group">' + LANGS.map(l => '<button type="button" data-lang="' + l + '" lang="' + l + '" title="' + NOMBRES[l] + '">' + l.toUpperCase() + '</button>').join('') + '</div>';
      el.querySelector('.i18n-sel').addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); });
    }
    pintarSelector(el);
    return el;
  }
  function pintarSelector(el) {
    const g = el.querySelector('.i18n-sel');
    if (!g) return;
    const etq = has('idioma') ? t('idioma') : 'Idioma';
    g.setAttribute('aria-label', etq);
    if (g.tagName === 'SELECT') { g.value = lang; return; }
    g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  }
  function pintarSelectores() { document.querySelectorAll('[data-i18n-selector]').forEach(el => { if (el.querySelector('.i18n-sel')) pintarSelector(el); else selector(el); }); }

  // ── Revisión para desarrolladores ──
  // Devuelve por módulo las claves que faltan o sobran en en/tr respecto al español,
  // los textos vacíos y los {parámetros} que no coinciden.
  function revisar(o) {
    o = o || {};
    const out = { ok: true, modulos: {}, enUso: Array.from(faltan) };
    Object.keys(dicts).forEach(m => {
      const d = dicts[m], es = d.es || {};
      const r = { faltan: {}, sobran: {}, vacias: [], params: [] };
      const ph = v => (typeof v === 'object' ? Object.values(v).join(' ') : String(v)).match(/\{\w+\}/g) || [];
      LANGS.filter(l => l !== 'es').forEach(l => {
        const x = d[l] || {};
        r.faltan[l] = Object.keys(es).filter(k => x[k] == null);
        r.sobran[l] = Object.keys(x).filter(k => es[k] == null);
        Object.keys(es).forEach(k => {
          if (x[k] == null) return;
          const a = ph(es[k]).sort().join(), b = ph(x[k]).sort().join();
          if (a !== b && !(typeof es[k] === 'object')) r.params.push(l + ':' + k);
        });
      });
      LANGS.forEach(l => Object.keys(d[l] || {}).forEach(k => { const v = d[l][k]; if (v === '' || (typeof v === 'object' && !Object.keys(v).length)) r.vacias.push(l + ':' + k); }));
      const malo = LANGS.some(l => (r.faltan[l] || []).length || (r.sobran[l] || []).length) || r.vacias.length || r.params.length;
      if (malo) out.ok = false;
      out.modulos[m] = r;
    });
    if (o.consola !== false && !out.ok) {
      try {
        console.groupCollapsed('[i18n] claves por revisar');
        Object.keys(out.modulos).forEach(m => { const r = out.modulos[m]; LANGS.filter(l => l !== 'es').forEach(l => { if (r.faltan[l].length) console.warn(m + ' · faltan en ' + l + ':', r.faltan[l].join(', ')); if (r.sobran[l].length) console.warn(m + ' · sobran en ' + l + ':', r.sobran[l].join(', ')); }); if (r.vacias.length) console.warn(m + ' · vacías:', r.vacias.join(', ')); if (r.params.length) console.warn(m + ' · {parámetros} distintos:', r.params.join(', ')); });
        console.groupEnd();
      } catch (e) {}
    }
    return out;
  }
  const modoDev = () => { try { return /[?&]i18ndev\b/.test(location.search) || localStorage.getItem('i18nDev') === '1'; } catch (e) { return false; } };


  // ══════════════════════════════════════════════════════════════════
  // FRASES (v3 etapa 3b): textos de las pantallas escritos en español en el
  // HTML / JS. Cada módulo i18n/<pantalla>.js trae filas [español, English, Türkçe]:
  //   (window.__i18nPend = window.__i18nPend || []).push(['@frases', 'almacen', [
  //     ['Guardar cambios', 'Save changes', 'Değişiklikleri kaydet'],
  //     ['Hace {n} días', '{n} days ago', '{n} gün önce'],      ← {x} = valor variable ({n}, {n2}… = solo números)
  //   ]]);
  // Con el idioma en en/tr, cada texto que aparece en la pantalla (texto,
  // placeholder, title, aria-label, alt, botones <input>) se cambia por su
  // traducción, también lo que la pantalla pinta después (MutationObserver), y se
  // devuelve el español al volver a ES. NO se toca: lo que escribe la gente
  // (textarea, inputs, [translate="no"], .notranslate) ni nombres/códigos (no
  // están en los diccionarios). En español no hace nada (cero costo).
  //   i18n.tx('Guardar')        → texto suelto (toasts, Excel, impresión)
  //   i18n.txHtml(html)         → un HTML completo (ventanas de impresión)
  //   i18n.sinTraducir          → textos vistos sin traducción (pruebas / ?i18ndev)
  // alert / confirm / prompt también se traducen.
  // ══════════════════════════════════════════════════════════════════
  const FR = { en: new Map(), tr: new Map() }, FRL = { en: new Map(), tr: new Map() };
  const PIDX = new Map();          // palabra ancla → patrones con {x}
  const frMods = new Set();
  const sinTraducir = new Set();
  const nrm = s => String(s).replace(/[\s ]+/g, ' ').trim();
  const LETRA = /[A-Za-zÁÉÍÓÚÑáéíóúñüÜ]/;
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function registrarFrases(mod, filas) {
    frMods.add(mod);
    (filas || []).forEach(f => {
      if (!Array.isArray(f) || f.length < 3 || !f[0]) return;
      const es = nrm(f[0]);
      if (/\{\w+\}/.test(es)) { patron(es, f[1], f[2]); return; }
      ['en', 'tr'].forEach((l, i) => {
        const v = f[i + 1]; if (v == null || v === '') return;
        FR[l].set(es, v);
        const k = es.toLowerCase(); if (!FRL[l].has(k)) FRL[l].set(k, v);
      });
    });
    if (lang !== 'es') domPronto();
  }
  function patron(es, en, tr) {
    const partes = es.split(/\{(\w+)\}/);
    const nombres = []; let re = '^';
    // {n}, {n2}… = solo un número (1 · 1,234.5 · 12 %); cualquier otro nombre = cualquier texto.
    partes.forEach((p, i) => { if (i % 2) { nombres.push(p); re += /^n\d*$/.test(p) ? '([−-]?[\\d][\\d.,\\s]*%?)' : '([\\s\\S]+?)'; } else re += escRe(p); });
    const txt = partes.filter((p, i) => !(i % 2)).join(' ').toLowerCase();
    const lit = txt.match(/\p{L}{3,}/gu) || txt.match(/\p{L}{2,}/gu) || [];
    if (!lit.length) return;
    const P = { re: new RegExp(re + '$'), nombres, out: { en, tr }, peso: partes.filter((p, i) => !(i % 2)).join('').length };
    const ancla = lit.slice().sort((a, b) => b.length - a.length)[0];
    if (!PIDX.has(ancla)) PIDX.set(ancla, []);
    PIDX.get(ancla).push(P);
  }
  // Un valor {x} que es español corrido sin traducción ("de equipos", "lista") no es un dato:
  // ese patrón no aplica (evita "Guardar lista" → "lista kaydet").
  const PROSA = /(^|\s)(de|del|la|las|los|el|que|para|con|por|en|un|una|sin|y|al|lista|se|su|sus|es|son|tu|no)(?=\s|$)/;
  function porPatron(c, d) {
    const ws = c.toLowerCase().match(/\p{L}{2,}/gu); if (!ws) return null;
    const vistos = new Set(), cands = [];
    for (const w of ws) {
      const l = PIDX.get(w); if (!l) continue;
      for (const P of l) {
        if (vistos.has(P)) continue; vistos.add(P);
        if (P.out[lang] == null) continue;
        const m = P.re.exec(c); if (m) cands.push([P, m]);
      }
    }
    cands.sort((a, b) => b[0].peso - a[0].peso);
    for (const [P, mm] of cands) {
      const vals = {}; let ok = true;
      P.nombres.forEach((n, i) => {
        const v = mm[i + 1];
        const r = d < 4 && LETRA.test(v) ? nucleo(v.trim(), d + 1) : null;
        if (r == null && PROSA.test(v.trim())) ok = false;
        vals[n] = r != null ? r : v;
      });
      if (ok) return P.out[lang].replace(/\{(\w+)\}/g, (x, n) => (vals[n] != null ? vals[n] : x));
    }
    return null;
  }
  function caso(src, v) {
    const L = LOCALES[lang];
    if (src.length > 1 && src === src.toLocaleUpperCase('es') && src !== src.toLocaleLowerCase('es')) return v.toLocaleUpperCase(L);
    const a = src.charAt(0);
    if (a !== a.toUpperCase()) return v.charAt(0).toLocaleLowerCase(L) + v.slice(1);
    return v.charAt(0).toLocaleUpperCase(L) + v.slice(1);
  }
  function nucleo(c, d) {
    d = d || 0;
    let v = FR[lang].get(c); if (v != null) return v;
    v = FRL[lang].get(c.toLowerCase()); if (v != null) return caso(c, v);
    let m;
    if ((m = /^([\s\S]*?[^\s:：…])(\s*[:：…]+)$/.exec(c)) && (v = nucleo(m[1], d + 1)) != null) return v + m[2];
    if ((m = /^\(([\s\S]+)\)$/.exec(c)) && (v = nucleo(m[1], d + 1)) != null) return '(' + v + ')';
    if ((m = /^([·•—–→←+*›]\s*)([\s\S]+)$/.exec(c)) && (v = nucleo(m[2], d + 1)) != null) return m[1] + v;
    if ((m = /^([\s\S]+?)(\s*[→←›»·]|\s*\(\d+\)|\s*\*)$/.exec(c)) && (v = nucleo(m[1], d + 1)) != null) return v + m[2];
    if ((v = porPatron(c, d)) != null) return v;
    if (d < 3 && /\s[·|—]\s/.test(c)) {           // "Pendiente · 3 días": cada parte por su lado
      const partes = c.split(/(\s[·|—]\s)/); let alguna = false;
      const out = partes.map((p, i) => { if (i % 2) return p; const r = LETRA.test(p) ? nucleo(p.trim(), d + 1) : null; if (r != null) { alguna = true; return r; } return p; });
      if (alguna) return out.join('');
    }
    if (d < 3 && /[.!?]\s+\S/.test(c)) {           // varias oraciones: todas o ninguna
      const os = c.split(/(?<=[.!?])\s+(?=[¿¡A-ZÁÉÍÓÚÑ0-9"“(])/);
      if (os.length > 1) { const r = os.map(o => nucleo(o, d + 1)); if (r.every(x => x != null)) return r.join(' '); }
    }
    return null;
  }
  function tx(s) {
    if (lang === 'es' || s == null) return s;
    const str = String(s);
    if (!LETRA.test(str)) return str;
    if (str.indexOf('\n') >= 0 && nrm(str).length > 0) {
      const ls = str.split('\n'); const r = ls.map(x => tx(x));
      const todo = nucleo(nrm(str));
      return todo != null ? todo : r.join('\n');
    }
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(str);
    const c = nrm(m[2]);
    const r = nucleo(c);
    if (r == null) { if (sinTraducir.size < 5000) sinTraducir.add(c); return str; }
    return m[1] + r + m[3];
  }

  // ── En la pantalla ──
  const SALTAR = 'script,style,textarea,code,pre,svg,[translate="no"],.notranslate,[contenteditable="true"],[contenteditable=""],[data-i18n-no]';
  const ATRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const TXT = new WeakMap(), ATTR = new WeakMap();
  function trTexto(n) {
    const rec = TXT.get(n), cur = n.data;
    const src = rec && cur === rec[1] ? rec[0] : cur;
    if (lang === 'es') { if (rec) { if (cur === rec[1] && rec[0] !== cur) n.data = rec[0]; TXT.delete(n); } return; }
    if (!LETRA.test(src)) return;
    const out = tx(src);
    TXT.set(n, [src, out]);
    if (out !== cur) n.data = out;
  }
  function trUno(el, a, get, set) {
    let rec = ATTR.get(el); const r = rec && rec[a];
    const cur = get(); if (cur == null) return;
    const src = r && cur === r[1] ? r[0] : cur;
    if (lang === 'es') { if (r) { if (cur === r[1] && r[0] !== cur) set(r[0]); delete rec[a]; } return; }
    if (!LETRA.test(src)) return;
    const out = tx(src);
    if (!rec) ATTR.set(el, rec = {});
    rec[a] = [src, out];
    if (out !== cur) set(out);
  }
  function trAttrs(el) {
    for (const a of ATRS) if (el.hasAttribute(a)) trUno(el, a, () => el.getAttribute(a), v => el.setAttribute(a, v));
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type)) trUno(el, 'value', () => el.value, v => { el.value = v; });
  }
  const SEL_ATR = '[placeholder],[title],[aria-label],[alt],input[type=button],input[type=submit],input[type=reset]';
  function recorrer(root) {
    if (!root) return;
    if (root.nodeType === 3) { const p = root.parentElement; if (p && !p.closest(SALTAR)) trTexto(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    const el = root.nodeType === 9 ? root.documentElement : root;
    if (!el || (el.closest && el.closest(SALTAR))) return;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.nodeType === 1 ? (n.matches(SALTAR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT),
    });
    let n; while ((n = w.nextNode())) trTexto(n);
    if (el.matches(SEL_ATR)) trAttrs(el);
    el.querySelectorAll(SEL_ATR).forEach(x => { if (!x.closest(SALTAR)) trAttrs(x); });
  }
  let mo = null;
  function observar() {
    if (mo || !window.MutationObserver || !document.documentElement) return;
    mo = new MutationObserver(muts => {
      if (lang === 'es') return;
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(recorrer);
        else if (m.type === 'characterData') { const p = m.target.parentElement; if (p && !p.closest(SALTAR)) trTexto(m.target); }
        else if (m.type === 'attributes' && !m.target.closest(SALTAR)) trAttrs(m.target);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRS.concat(['value']) });
  }
  function domTodo() {
    if (!document.documentElement) return;
    if (lang !== 'es') observar();
    recorrer(document.documentElement);
    try { document.documentElement.classList.remove('i18n-cargando'); } catch (e) {}
  }
  let _domT = null;
  function domPronto() { if (_domT) return; _domT = setTimeout(() => { _domT = null; domTodo(); }, 0); }
  // HTML completo (por ejemplo, una ventana de impresión): se traduce antes de abrirla.
  function txHtml(html) {
    if (lang === 'es' || !html) return html;
    try {
      const d = new DOMParser().parseFromString(String(html), 'text/html');
      const w = d.createTreeWalker(d.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: n => (n.nodeType === 1 ? (n.matches(SALTAR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP) : NodeFilter.FILTER_ACCEPT) });
      let n; while ((n = w.nextNode())) if (LETRA.test(n.data)) n.data = tx(n.data);
      d.querySelectorAll(SEL_ATR).forEach(x => ATRS.forEach(a => { if (x.hasAttribute(a)) x.setAttribute(a, tx(x.getAttribute(a))); }));
      d.documentElement.lang = HTML_LANG[lang];
      return /^\s*<!doctype/i.test(html) ? '<!DOCTYPE html>' + d.documentElement.outerHTML : (/<html[\s>]/i.test(html) ? d.documentElement.outerHTML : d.body.innerHTML);
    } catch (e) { return html; }
  }
  // Ventanas del navegador (alert / confirm / prompt) en el idioma elegido.
  ['alert', 'confirm', 'prompt'].forEach(fn => {
    const orig = window[fn]; if (typeof orig !== 'function' || orig.__i18n) return;
    const w = function (msg, ...rest) { return orig.call(window, msg == null ? msg : tx(String(msg)), ...rest); };
    w.__i18n = true; window[fn] = w;
  });
  // Diccionarios de cada pantalla (se cargan solo si el idioma no es español).
  const PAG_MODS = {
    'index.html': [], 'login.html': ['login'], 'bitacora.html': ['bitacora'], 'checklist.html': ['checklist'],
    'hoja-vida.html': ['hoja-vida', 'catalogo'], 'almacen.html': ['almacen', 'catalogo'], 'inventario.html': ['almacen'],
    'herramientas.html': ['herramientas'], 'analisis.html': ['analisis'], 'incentivos.html': ['incentivos'],
    'rentabilidad.html': ['rentabilidad'], 'capex.html': ['capex'], 'admin.html': ['admin'], 'guia.html': ['guia'],
    'reportar.html': ['reportar'],
  };
  function modsPagina() {
    const pag = (location.pathname.split('/').pop() || 'index.html');
    const l = PAG_MODS[pag] || [];
    return (pag === 'login.html' ? [] : ['compartido']).concat(l);
  }
  function cargarPantalla() { return Promise.all(modsPagina().map(cargar)).then(() => true, () => false); }

  // ── Exportar ──
  const api = { LANGS, LOCALES, NOMBRES, t, tn, has, registrar, cargar, getLang, setLang, locale, applyI18n, selector,
    fmtNum, fmtMoney, fmtPct, fmtDate, fmtTime, fmtDateTime, fmtRel, aDate, revisar, faltan, dicts, _drenar: drenar,
    registrarFrases, tx, txHtml, sinTraducir, frases: FR, traducirPantalla: domTodo, cargarPantalla, modsPagina,
    // texto en español de un nodo ya traducido (para quien reescribe la pantalla, p. ej. las ayudas "?")
    fuente: n => { const r = n && TXT.get(n); return r && n.data === r[1] ? r[0] : (n ? n.data : ''); } };
  window.i18n = api;
  // Atajos globales (una pantalla con su propia función t() la sigue usando: CAPEX).
  if (typeof window.t === 'undefined') window.t = t;
  if (typeof window.tn === 'undefined') window.tn = tn;
  window.applyI18n = applyI18n;

  drenar();
  marcarHtml();
  engancharPerfil();
  if (lang !== 'es') {
    // Mientras llega el diccionario de la pantalla no se muestra el español (máx. 700 ms).
    try { document.documentElement.classList.add('i18n-cargando'); setTimeout(() => document.documentElement.classList.remove('i18n-cargando'), 700); } catch (e) {}
    cargarPantalla().then(domTodo);
  }
  function listo() {
    drenar();
    engancharPerfil();
    applyI18n(document);
    pintarSelectores();
    if (lang !== 'es') domTodo();
    if (modoDev()) { revisar(); setTimeout(() => { if (sinTraducir.size) console.warn('[i18n] sin traducir:', Array.from(sinTraducir)); }, 3000); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', listo); else listo();
  window.addEventListener('storage', e => { if (e.key === LS && valido(e.newValue) && e.newValue !== lang) setLang(e.newValue, { perfil: false }); });
})();
