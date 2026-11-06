// app-shell.js — (v3, nov 2026) Estructura de la app VoidTech.
// Lo carga firebase-init.js en todas las pantallas (menos equipo.html,
// etiquetas-qr.html y login.html). Pinta:
//   · barra superior: insignia VT, título, nave, buscar, avisos (campana)
//   · UNA barra inferior por rol (máx. 5) con el botón central (+ / escanear)
//   · menú lateral en escritorio (≥1024 px) con los mismos destinos
//   · hoja "Más": todas las pantallas del rol por grupos, idioma ES·EN·TR,
//     tema Claro/Oscuro/Auto, nave, usuario y Salir
//   · hoja "Nuevo" (+), escáner de QR, buscador global
//   · tarjeta "Sin acceso" cuando el rol no puede usar la pantalla
// Lecturas: ninguna al pintar. El buscador usa el catálogo de equipos en caché
// (0 lecturas) y solo consulta /ots al escribir un folio (1 consulta pequeña).
// ══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VTShell) return;
  const VERSION = 'v3.0';
  const PAGINA = location.pathname.split('/').pop() || 'index.html';
  const ADM = 'ADMINISTRADOR', ENC = 'ENCARGADO_MANTENIMIENTO', SUP = 'SUPERVISOR', TEC = 'TECNICO', ALM = 'ALMACEN', RH = 'RRHH', OP = 'OPERADOR';
  const MANT = [ADM, ENC, SUP, TEC];
  const TODOS = [ADM, ENC, SUP, TEC, ALM, RH, OP];

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => (typeof fbEsc === 'function' ? fbEsc(s) : String(s == null ? '' : s).replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c])));
  const ic = (n, o) => (window.VTIcons ? window.VTIcons.icon(n, o) : '');
  const T = (k, p) => (window.i18n && i18n.has('shell.' + k) ? i18n.t('shell.' + k, p) : k);
  const TN = (k, n, p) => (window.i18n ? i18n.tn('shell.' + k, n, p) : String(n));
  const C = (k, p) => (window.i18n && i18n.has(k) ? i18n.t(k, p) : k);
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} };
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const rol = () => (window.currentUserRole && window.currentUserRole.rol) || '';
  const tiene = roles => roles.includes(rol());

  // ── Pantallas (Más / menú lateral / buscador). roles: quién puede abrirla. ──
  const PAGINAS = [
    { id: 'index', href: 'index.html', ic: 'home', k: 'p_index', g: 'g_operacion', roles: [ADM, ENC, SUP, TEC, ALM, RH] },
    { id: 'bitacora', href: 'bitacora.html', ic: 'clipboard', k: 'p_bitacora', d: 'd_bitacora', g: 'g_operacion', roles: MANT },
    { id: 'reportar', href: 'reportar.html', ic: 'siren', k: 'p_reportar', d: 'd_reportar', g: 'g_operacion', roles: MANT.concat([OP]) },
    { id: 'checklist', href: 'checklist.html', ic: 'clipboard-check', k: 'p_checklist', d: 'd_checklist', g: 'g_operacion', roles: MANT },
    { id: 'hoja-vida', href: 'hoja-vida.html', ic: 'cog', k: 'p_hojaVida', d: 'd_hojaVida', g: 'g_equipos', roles: MANT },
    { id: 'unifilar', href: 'unifilar.html', ic: 'zap', k: 'p_unifilar', d: 'd_unifilar', g: 'g_equipos', roles: MANT, alias: ['electrico', 'tablero', 'breaker', 'interruptor', 'single-line'] },
    { id: 'etiquetas', href: 'etiquetas-qr.html', ic: 'qr', k: 'p_etiquetas', d: 'd_etiquetas', g: 'g_equipos', roles: [ADM, ENC, SUP] },
    // (v3 etapa 3a) Inventario + Almacén = UN módulo "Almacén" (Repuestos · Solicitudes · Movimientos · Compras).
    // inventario.html sigue abriendo (lleva a almacen.html#repuestos); "inventario" se sigue encontrando en el buscador.
    { id: 'almacen', href: 'almacen.html', ic: 'package', k: 'p_almacen', d: 'd_almacen', g: 'g_almacen', roles: MANT.concat([ALM]), alias: ['inventario', 'repuestos', 'solicitudes', 'compras'] },
    { id: 'herramientas', href: 'herramientas.html', ic: 'hammer', k: 'p_herramientas', d: 'd_herramientas', g: 'g_almacen', roles: [ADM, ENC, SUP, TEC, ALM, RH] },
    { id: 'analisis', href: 'analisis.html', ic: 'chart', k: 'p_analisis', d: 'd_analisis', g: 'g_gestion', roles: MANT },
    { id: 'incentivos', href: 'incentivos.html', ic: 'coins', k: 'p_incentivos', d: 'd_incentivos', g: 'g_gestion', roles: [ADM] },
    { id: 'rentabilidad', href: 'rentabilidad.html', ic: 'pie', k: 'p_rentabilidad', d: 'd_rentabilidad', g: 'g_gestion', roles: [ADM] },
    { id: 'capex', href: 'capex.html', ic: 'briefcase', k: 'p_capex', d: 'd_capex', g: 'g_gestion', roles: [ADM, ENC] },
    { id: 'admin', href: 'admin.html', ic: 'users', k: 'p_admin', d: 'd_admin', g: 'g_admin', roles: [ADM] },
    { id: 'guia', href: 'guia.html', ic: 'book', k: 'p_guia', d: 'd_guia', g: 'g_ayuda', roles: TODOS },
    { id: 'todo', href: 'index.html#todo', ic: 'grid', k: 'p_todo', g: 'g_ayuda', roles: [ADM, ENC, SUP, TEC, ALM, RH] },
  ];
  const GRUPOS = ['g_operacion', 'g_equipos', 'g_almacen', 'g_gestion', 'g_admin', 'g_ayuda'];
  const paginasDelRol = () => PAGINAS.filter(p => tiene(p.roles));
  const ACCESO = {}; PAGINAS.forEach(p => { ACCESO[p.href.split('#')[0]] = ACCESO[p.href.split('#')[0]] || p.roles; });
  ACCESO['inventario.html'] = ACCESO['almacen.html']; // nombre viejo del módulo Almacén

  // ── Barra inferior por rol (máx. 5). 'fab' = botón central. ──
  function barra() {
    const r = rol();
    if (r === TEC) return [['index', 'home', 'tab_hoy', 'index.html'], ['bitacora', 'clipboard', 'tab_trabajos', 'bitacora.html'], ['fab', 'plus', 'tab_nuevo', 'nuevo'], ['hoja-vida', 'cog', 'tab_equipos', 'hoja-vida.html'], ['mas', 'grid', 'tab_mas', 'mas']];
    if ([SUP, ENC, ADM].includes(r)) return [['index', 'home', 'tab_hoy', 'index.html'], ['bitacora', 'clipboard', 'tab_trabajos', 'bitacora.html'], ['fab', 'plus', 'tab_nuevo', 'nuevo'], ['analisis', 'chart', 'tab_reportes', 'analisis.html'], ['mas', 'grid', 'tab_mas', 'mas']];
    if (r === ALM) return [['index', 'home', 'tab_hoy', 'index.html'], ['almacen', 'package', 'tab_almacen', 'almacen.html'], ['fab', 'scan', 'tab_escanear', 'scan'], ['herramientas', 'hammer', 'tab_herramientas', 'herramientas.html'], ['mas', 'grid', 'tab_mas', 'mas']];
    if (r === RH) return [['index', 'home', 'tab_hoy', 'index.html'], ['herramientas', 'hammer', 'tab_herramientas', 'herramientas.html#rrhh'], ['mas', 'grid', 'tab_mas', 'mas']];
    if (r === OP) return [['reportar', 'siren', 'tab_reportar', 'reportar.html'], ['mis-reportes', 'list', 'tab_misReportes', 'reportar.html#estado'], ['mas', 'grid', 'tab_mas', 'mas']];
    return [['index', 'home', 'tab_hoy', 'index.html'], ['mas', 'grid', 'tab_mas', 'mas']];
  }
  // Pantalla activa (id del registro). fbRenderMiniNav('x') de cada pantalla también la marca.
  let activo = window.__vtNavActivo || '';
  function idPagina() {
    if (activo) return activo === 'etiquetas-qr' ? 'etiquetas' : activo === 'inventario' ? 'almacen' : activo;
    const f = PAGINA.replace(/\.html$/, '');
    return f === 'etiquetas-qr' ? 'etiquetas' : f === 'inventario' ? 'almacen' : f;
  }
  function tabActiva() {
    const id = idPagina();
    const b = barra();
    if (id === 'reportar' && /^#estado/.test(location.hash) && b.some(x => x[0] === 'mis-reportes')) return 'mis-reportes';
    if (id === 'index' && location.hash === '#todo') return 'mas';
    return b.some(x => x[0] === id) ? id : 'mas';
  }
  function tituloPagina() {
    const id = idPagina();
    const p = PAGINAS.find(x => x.id === id);
    return p ? T(p.k) : (document.title || C('appNombre'));
  }

  // ── Tema (claro / oscuro / auto), por celular ──
  // (v3 etapa 3b) 'sol' = claro de alto contraste para planta con mucha luz o al aire libre.
  const TEMAS = ['light', 'dark', 'sol'];
  function temaActual() { const t = lsGet('vtTema'); return TEMAS.includes(t) ? t : 'auto'; }
  function setTema(t) {
    if (!TEMAS.includes(t)) t = 'auto';
    lsSet('vtTema', t === 'auto' ? null : t);
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    pintarMetaTema();
    document.querySelectorAll('[data-vt-tema]').forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute('data-vt-tema') === t)));
    try { window.dispatchEvent(new CustomEvent('tema-cambiado', { detail: { tema: t } })); } catch (e) {}
  }
  function oscuro() { const t = temaActual(); return t === 'dark' || (t === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches); }
  function iconoTema() { const t = temaActual(); return t === 'sol' ? 'contrast' : oscuro() ? 'moon' : 'sun'; }
  function pintarMetaTema() {
    let m = document.querySelector('meta[name="theme-color"][data-vt]');
    if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; m.setAttribute('data-vt', ''); document.head.appendChild(m); }
    m.content = oscuro() ? '#181B20' : '#FFFFFF';
    document.querySelectorAll('[data-vt-tema-ic]').forEach(x => { x.innerHTML = ic(iconoTema(), { cls: 'md' }); });
  }

  // ── Nave ──
  function htmlNave() {
    if (typeof fbNavesDisponibles !== 'function') return '';
    const disp = fbNavesDisponibles(), mis = fbMisNaves();
    if (!disp.length) return '';
    const act = fbNaveActiva();
    const texto = act || (mis ? T('misNaves') : T('todasNaves'));
    if (disp.length <= 1) return mis && disp.length === 1 ? `<span class="vt-chip" title="${esc(T('nave'))}">${ic('factory')}<span>${esc(disp[0])}</span></span>` : '';
    const k = s => fbEquipoKey(s);
    // En el celular el encabezado es estrecho: "Todas" / "Mías" en lugar de "Todas las naves" / "Mis naves"
    const corto = act || (mis ? T('misNavesCorto') : T('todasNavesCorto'));
    return `<label class="vt-chip" title="${esc(T('nave') + ': ' + texto)}">${ic('factory')}<span class="vt-chip-l">${esc(texto)}</span><span class="vt-chip-s" aria-hidden="true">${esc(corto)}</span>`
      + `<select data-vt-nave aria-label="${esc(T('nave'))}"><option value="todas"${act ? '' : ' selected'}>${esc(mis ? T('misNaves') : T('todasNaves'))}</option>`
      + disp.map(n => `<option value="${esc(n)}"${act && k(act) === k(n) ? ' selected' : ''}>${esc(n)}</option>`).join('') + '</select></label>';
  }
  function selectNave() {
    if (typeof fbNavesDisponibles !== 'function') return '';
    const disp = fbNavesDisponibles(), mis = fbMisNaves();
    if (disp.length <= 1) return disp.length ? `<b>${esc(disp[0])}</b>` : '';
    const act = fbNaveActiva(), k = s => fbEquipoKey(s);
    return `<select data-vt-nave aria-label="${esc(T('nave'))}"><option value="todas"${act ? '' : ' selected'}>${esc(mis ? T('misNaves') : T('todasNaves'))}</option>`
      + disp.map(n => `<option value="${esc(n)}"${act && k(act) === k(n) ? ' selected' : ''}>${esc(n)}</option>`).join('') + '</select>';
  }
  document.addEventListener('change', e => {
    const s = e.target.closest && e.target.closest('select[data-vt-nave]');
    if (!s) return;
    fbSetNaveActiva(s.value);   // recarga la pantalla si no se repinta sola (comportamiento de siempre)
    pintar();
  });

  // ── Barra superior ──
  let hdr, tabbar, side;
  function pintarHeader() {
    if (!hdr) {
      hdr = document.createElement('header');
      hdr.className = 'vt-hdr'; hdr.id = 'vtHdr';
      document.body.insertBefore(hdr, document.body.firstChild);
    }
    const n = +(sessionStorage.getItem('vtHoyN') || 0) || 0;
    const sesion = !!window.currentUserRole;
    const lang = window.i18n ? i18n.getLang() : 'es';
    hdr.innerHTML = `<a class="vt-brand" href="${rol() === OP ? 'reportar.html' : 'index.html'}" aria-label="${esc(T('inicio'))}">${window.VTIcons ? VTIcons.mono() : ''}<span class="vt-ttl"><b id="vtTitulo">${esc(tituloPagina())}</b>${sesion ? `<small id="vtUsuario">${esc((window.currentUserRole.nombre) || (window.currentUser && window.currentUser.email) || '')}</small>` : ''}</span></a>`
      + (sesion ? htmlSync() : `<span class="vt-off" role="status">${ic('wifi-off', { cls: 'sm' })}${esc(T('sinConexion'))}</span>`)
      + (sesion ? htmlNave() : '')
      + (sesion ? `<span class="vt-langs">${langSeg(lang)}</span>` : '')
      + (sesion && rol() !== OP ? `<button type="button" class="vt-ib" data-vt="buscar" aria-label="${esc(T('buscar'))}" title="${esc(T('buscar'))}">${ic('search')}</button>` : '')
      + (sesion && rol() !== OP ? `<a class="vt-ib" href="index.html" data-vt="avisos" aria-label="${esc(T('avisos'))}" title="${esc(T('avisos'))}">${ic('bell')}${n ? `<b class="vt-dot">${n > 99 ? '99+' : n}</b>` : ''}</a>` : '');
  }
  function langSeg(lang) {
    return `<span class="vt-seg2" role="group" aria-label="${esc(C('idioma'))}">` + ['es', 'en', 'tr'].map(l => `<button type="button" data-vt-lang="${l}" lang="${l}" aria-pressed="${l === lang}">${l.toUpperCase()}</button>`).join('') + '</span>';
  }
  function temaSeg() {
    const t = temaActual();
    return `<span class="vt-seg2" role="group" aria-label="${esc(T('tema'))}">`
      + [['light', 'sun', 'tema_claro'], ['dark', 'moon', 'tema_oscuro'], ['sol', 'contrast', 'tema_sol'], ['auto', 'monitor', 'tema_auto']].map(([v, i, k]) => `<button type="button" data-vt-tema="${v}" aria-pressed="${v === t}" title="${esc(T(k))}">${esc(T(k))}</button>`).join('') + '</span>';
  }

  // ── Barra inferior y menú lateral ──
  function pintarTabbar() {
    if (!window.currentUserRole) return;
    if (!tabbar) { tabbar = document.createElement('nav'); tabbar.className = 'vt-tabbar'; tabbar.id = 'vtTabbar'; document.body.appendChild(tabbar); }
    tabbar.setAttribute('aria-label', T('menu'));
    const act = tabActiva();
    const n = +(sessionStorage.getItem('vtHoyN') || 0) || 0;
    tabbar.innerHTML = barra().map(([id, i, k, dest]) => {
      if (id === 'fab') return `<button type="button" class="vt-fab" data-vt="${dest}" data-tab="${dest}" aria-label="${esc(T(k))}"><i>${ic(i)}</i><span>${esc(T(k))}</span></button>`;
      const cur = id === act ? ' aria-current="page"' : '';
      const dot = id === 'index' && n ? `<b class="vt-dot">${n > 99 ? '99+' : n}</b>` : '';
      if (dest === 'mas') return `<button type="button" class="vt-tab" data-vt="mas" data-tab="mas"${cur}>${ic(i)}<span>${esc(T(k))}</span></button>`;
      return `<a class="vt-tab" href="${dest}" data-tab="${id}"${cur}>${ic(i)}<span>${esc(T(k))}</span>${dot}</a>`;
    }).join('');
  }
  // ── Grupos desplegables (acordeón) del menú Más y del menú lateral ──
  // Abierto por defecto: el grupo de la pantalla actual. Lo que la persona abre o
  // cierra se recuerda en este celular (localStorage vtGrupos).
  const LS_GRP = 'vtGrupos';
  function gruposGuardados() { try { const o = JSON.parse(lsGet(LS_GRP) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  function grupoAbierto(g, actual) {
    const guard = gruposGuardados();
    if (typeof guard[g] === 'boolean') return guard[g];
    return PAGINAS.some(p => p.g === g && p.id === actual);
  }
  function guardarGrupo(g, abierto) { const o = gruposGuardados(); o[g] = !!abierto; lsSet(LS_GRP, JSON.stringify(o)); }
  let _grpSeq = 0;
  // donde: 'm' (Más), 's' (menú lateral), 't' (index.html#todo: todos abiertos, sin recordar)
  function htmlGrupos(actual, donde) {
    const mias = paginasDelRol().filter(p => donde !== 't' || (p.id !== 'todo' && p.id !== 'index'));
    return GRUPOS.map(g => {
      const items = mias.filter(p => p.g === g);
      if (!items.length) return '';
      const id = 'vtG-' + (donde || 'm') + '-' + g + '-' + (++_grpSeq);
      const ab = donde === 't' ? true : grupoAbierto(g, actual);
      return `<div class="vt-grp vt-acc${ab ? ' abierto' : ''}" data-grp="${g}"><h3><button type="button" class="vt-acc-h" data-vt-grp="${g}" aria-expanded="${ab}" aria-controls="${id}"><span>${esc(T(g))}</span>${ic('chevron-down', { cls: 'sm' })}</button></h3>`
        + `<div class="vt-acc-b" id="${id}" role="region" aria-label="${esc(T(g))}"><div>` + items.map(p => `<a class="vt-item" href="${p.href}" data-pg="${p.id}" title="${esc(T(p.k))}"${p.id === actual ? ' aria-current="page"' : ''}${ab ? '' : ' tabindex="-1"'}>${ic(p.ic)}<span>${esc(T(p.k))}</span></a>`).join('') + '</div></div></div>';
    }).join('');
  }
  function alternarGrupo(btn) {
    const grp = btn.closest('.vt-acc'); if (!grp) return;
    const ab = !grp.classList.contains('abierto');
    grp.classList.toggle('abierto', ab);
    btn.setAttribute('aria-expanded', String(ab));
    grp.querySelectorAll('.vt-acc-b a').forEach(a => { if (ab) a.removeAttribute('tabindex'); else a.setAttribute('tabindex', '-1'); });
    if (!grp.closest('#todo')) guardarGrupo(grp.getAttribute('data-grp'), ab);
  }
  // Menú lateral en modo "solo iconos" (escritorio), recordado en este celular
  function rail() { return lsGet('vtRail') === '1'; }
  function setRail(on) { lsSet('vtRail', on ? '1' : null); document.documentElement.classList.toggle('vt-rail', !!on); if (side) pintarSide(); }
  function pintarSide() {
    if (!window.currentUserRole) return;
    if (!side) { side = document.createElement('aside'); side.className = 'vt-side'; side.id = 'vtSide'; document.body.appendChild(side); }
    const u = window.currentUserRole || {};
    const fab = barra().find(x => x[0] === 'fab');
    side.setAttribute('aria-label', T('menu'));
    document.documentElement.classList.toggle('vt-rail', rail());
    side.innerHTML = `<button type="button" class="vt-ib vt-railbtn" data-vt="rail" aria-pressed="${rail()}" aria-label="${esc(T(rail() ? 'expandirMenu' : 'contraerMenu'))}" title="${esc(T(rail() ? 'expandirMenu' : 'contraerMenu'))}">${ic(rail() ? 'chevron-right' : 'chevron-left')}</button><a class="vt-wm" href="${rol() === OP ? 'reportar.html' : 'index.html'}">${window.VTIcons ? VTIcons.mono({ size: 34 }) : ''}<span><b>Void<em>Tech</em></b><small>${esc(C('appNombre'))}</small></span></a>`
      + (fab ? `<button type="button" class="vt-btn cta vt-new" data-vt="${fab[3]}">${ic(fab[1])}${esc(T(fab[3] === 'scan' ? 'act_escanear' : 'tab_nuevo'))}</button>` : '')
      + htmlGrupos(location.hash === '#todo' ? 'todo' : idPagina(), 's')
      + `<div style="margin-top:auto"></div><button type="button" class="vt-item" data-vt="mas">${ic('user')}<span>${esc(u.nombre || '')}</span>${ic('settings', { cls: 'sm' })}</button>`;
    if (rol() === ADM) { let c = null; try { c = JSON.parse(lsGet('vtLogo') || 'null'); } catch (e) {} if (c && c.data) ponerLogo(c.data); }
  }

  // ── Hojas ──
  let hojaAbierta = null, focoPrevio = null;
  function abrirHoja(id, html, o) {
    cerrarHoja();
    o = o || {};
    focoPrevio = document.activeElement;
    const bg = document.createElement('div');
    bg.className = 'vt-sheet-bg'; bg.id = id;
    bg.innerHTML = `<div class="vt-sheet" role="dialog" aria-modal="true" aria-labelledby="${id}-t"><div class="vt-grab"></div>`
      + `<div class="vt-sheet-h"><h2 id="${id}-t">${esc(o.titulo || '')}</h2><button type="button" class="vt-ib" data-vt="cerrar" aria-label="${esc(T('cerrar'))}">${ic('x')}</button></div>${html}</div>`;
    bg.addEventListener('click', e => { if (e.target === bg) cerrarHoja(); });
    document.body.appendChild(bg);
    hojaAbierta = bg;
    document.documentElement.style.overflow = 'hidden';
    const f = bg.querySelector(o.foco || '[data-vt="cerrar"]'); if (f) setTimeout(() => f.focus(), 30);
    return bg;
  }
  function cerrarHoja() {
    if (!hojaAbierta) return;
    hojaAbierta.remove(); hojaAbierta = null;
    document.documentElement.style.overflow = '';
    if (focoPrevio && focoPrevio.focus) try { focoPrevio.focus(); } catch (e) {}
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (scanAbierto) cerrarScanner(); else cerrarHoja(); } });

  function iniciales(n) { return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase(); }
  function abrirMas() {
    const u = window.currentUserRole || {};
    const lang = window.i18n ? i18n.getLang() : 'es';
    const nv = selectNave();
    abrirHoja('vtMas', `<div class="vt-user"><span class="vt-av">${esc(iniciales(u.nombre || (window.currentUser && window.currentUser.email)))}</span><div><b>${esc(u.nombre || '')}</b><small>${esc(C('rol_' + (u.rol || '')))}${window.currentUser && window.currentUser.email ? ' · ' + esc(window.currentUser.email) : ''}</small></div></div>`
      + `<div class="vt-set"><label><span>${ic('globe', { cls: 'md' })} ${esc(C('idioma'))}</span>${langSeg(lang)}</label>`
      + `<label class="vt-set-tema"><span><span data-vt-tema-ic>${ic(iconoTema(), { cls: 'md' })}</span> ${esc(T('tema'))}</span>${temaSeg()}</label>`
      + (nv ? `<label><span>${ic('factory', { cls: 'md' })} ${esc(T('nave'))}</span>${nv}</label>` : '') + '</div>'
      + htmlGrupos(location.hash === '#todo' ? 'todo' : idPagina())
      + `<button type="button" class="vt-out" data-vt="salir">${ic('logout')}${esc(T('salir'))}</button><div class="vt-ver">${esc(T('version', { v: VERSION }))}</div>`,
      { titulo: T('mas') });
  }
  function accionesNuevo() {
    const a = [];
    a.push({ id: 'scan', ic: 'scan', k: 'act_escanear', d: 'act_escanear_d', main: true });
    if (tiene(MANT.concat([OP]))) a.push({ id: 'reportar', ic: 'siren', k: 'act_reportar', d: 'act_reportar_d', href: 'reportar.html' });
    if (tiene(MANT)) a.push({ id: 'registrar', ic: 'clipboard', k: 'act_registrar', d: 'act_registrar_d', href: 'bitacora.html#nuevo' });
    if (tiene(MANT)) a.push({ id: 'checklist', ic: 'clipboard-check', k: 'act_checklist', d: 'act_checklist_d', href: 'checklist.html' });
    return a;
  }
  function abrirNuevo() {
    abrirHoja('vtNuevo', `<div class="vt-acts">` + accionesNuevo().map(x => x.href
      ? `<a class="vt-act" href="${x.href}" data-act="${x.id}"><i>${ic(x.ic)}</i><span>${esc(T(x.k))}<small>${esc(T(x.d))}</small></span></a>`
      : `<button type="button" class="vt-act${x.main ? ' main' : ''}" data-vt="scan" data-act="${x.id}"><i>${ic(x.ic)}</i><span>${esc(T(x.k))}<small>${esc(T(x.d))}</small></span></button>`).join('') + '</div>',
      { titulo: T('nuevo_titulo') });
  }

  // ══════ ESCÁNER (cámara + BarcodeDetector; respaldo jsQR; último recurso: escribir) ══════
  const JSQR_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js', 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js'];
  let scanAbierto = null, scanStream = null, scanTimer = null, scanDetector = null, scanCanvas = null, _jsqrProm = null;
  function cargarJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (_jsqrProm) return _jsqrProm;
    _jsqrProm = JSQR_URLS.reduce((p, url) => p.catch(() => new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = url; s.async = true;
      s.onload = () => (window.jsQR ? res(window.jsQR) : rej(new Error('jsQR'))); s.onerror = () => { s.remove(); rej(new Error('jsQR')); };
      document.head.appendChild(s);
    })), Promise.reject(new Error('start')));
    _jsqrProm.catch(() => { _jsqrProm = null; });
    return _jsqrProm;
  }
  // Texto del QR → id de equipo. Formatos de la app (no cambian):
  //   <base>/equipo.html?id=<id>  (etiquetas-qr.html)  ·  checklist.html?equipo=<id>
  //   hoja-vida.html?equipo=<id> / ?id=<id>  ·  reportar.html?equipo=<id>
  // También: el id pelado, o el nombre / código de la máquina (sin acentos).
  function parsearQr(texto) {
    const t = String(texto || '').trim();
    if (!t) return null;
    const idx = typeof fbEquiposIndice === 'function' ? fbEquiposIndice() : [];
    if (/^[a-z][a-z0-9+.-]*:|\.html\b/i.test(t)) {
      let u = null;
      try { u = new URL(t, location.href); } catch (e) { u = null; }
      if (u) {
        const f = u.pathname.split('/').pop();
        const id = u.searchParams.get('id') || u.searchParams.get('equipo');
        if (id && ['equipo.html', 'checklist.html', 'hoja-vida.html', 'reportar.html', 'bitacora.html'].includes(f)) return { id, fuente: 'url' };
      }
      return null;
    }
    if (idx.some(e => e.id === t)) return { id: t, fuente: 'id' };
    const k = norm(t).replace(/\s+/g, '');
    const hit = idx.find(e => norm(e.nombre).replace(/\s+/g, '') === k);
    return hit ? { id: hit.id, fuente: 'nombre' } : null;
  }
  function destinoEquipo(id) {
    const r = rol();
    if (MANT.includes(r)) return 'hoja-vida.html?id=' + encodeURIComponent(id);
    if (r === OP) return 'reportar.html?equipo=' + encodeURIComponent(id);
    if (r === ALM) return 'almacen.html?equipo=' + encodeURIComponent(id);
    return 'equipo.html?id=' + encodeURIComponent(id);
  }
  function irEquipo(id) {
    const e = (typeof fbEquiposIndice === 'function' ? fbEquiposIndice() : []).find(x => x.id === id);
    scanMsg(T('scan_abriendo', { n: e ? e.nombre : id }));
    vibrar(25);
    cerrarScanner();
    window.__vtUltimoScan = { id, destino: destinoEquipo(id) };
    location.href = destinoEquipo(id);
  }
  function scanMsg(t, err) { const m = scanAbierto && scanAbierto.querySelector('.vt-scan-msg'); if (m) { m.textContent = t; m.classList.toggle('err', !!err); } }
  function abrirScanner() {
    cerrarHoja();
    if (scanAbierto) return;
    const d = document.createElement('div');
    d.className = 'vt-scan'; d.id = 'vtScan';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'vtScanT');
    d.innerHTML = `<div class="vt-scan-top"><h2 id="vtScanT">${esc(T('scan_titulo'))}</h2><button type="button" class="vt-ib" data-vt="scan-cerrar" aria-label="${esc(T('cerrar'))}">${ic('x')}</button></div>`
      + `<div class="vt-scan-vid"><video playsinline muted autoplay></video><div class="vt-scan-frame" aria-hidden="true"></div></div>`
      + `<div class="vt-scan-msg" role="status" aria-live="polite">${esc(T('scan_iniciando'))}</div>`
      + `<div class="vt-scan-hits" id="vtScanHits"></div>`
      + `<form class="vt-scan-man" id="vtScanMan"><input type="text" id="vtScanIn" autocomplete="off" placeholder="${esc(T('scan_manual'))}" aria-label="${esc(T('scan_manual'))}"/><button type="submit">${esc(T('scan_abrir'))}</button></form>`;
    document.body.appendChild(d);
    scanAbierto = d;
    document.documentElement.style.overflow = 'hidden';
    d.querySelector('#vtScanMan').addEventListener('submit', ev => { ev.preventDefault(); manual(d.querySelector('#vtScanIn').value, true); });
    d.querySelector('#vtScanIn').addEventListener('input', ev => manual(ev.target.value, false));
    iniciarCamara();
  }
  function manual(v, abrir) {
    const hits = scanAbierto && scanAbierto.querySelector('#vtScanHits');
    const p = parsearQr(v);
    if (abrir && p) { irEquipo(p.id); return; }
    const q = norm(v);
    const lista = q.length < 2 ? [] : (typeof fbEquiposIndice === 'function' ? fbEquiposIndice() : []).filter(e => e.activo !== false && [e.nombre, e.id, e.localidad, e.linea].some(x => norm(x).includes(q))).slice(0, 8);
    if (hits) hits.innerHTML = lista.map(e => `<a href="${esc(destinoEquipo(e.id))}" data-eq="${esc(e.id)}">${ic('cog')}<span>${esc(e.nombre)}</span><small>${esc(e.localidad || '')}</small></a>`).join('');
    if (abrir) { if (lista.length === 1) irEquipo(lista[0].id); else if (!lista.length) scanMsg(T('scan_noEncontrado'), true); }
  }
  async function iniciarCamara() {
    const video = scanAbierto && scanAbierto.querySelector('video');
    const sinCamara = (k) => { scanMsg(T(k), true); const i = scanAbierto && scanAbierto.querySelector('#vtScanIn'); if (i) i.focus(); scanAbierto && scanAbierto.classList.add('manual'); };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return sinCamara('scan_sinCamara');
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (e) {
      return sinCamara(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? 'scan_denegada' : 'scan_sinCamara');
    }
    if (!scanAbierto) { pararCamara(); return; }
    video.srcObject = scanStream;
    try { await video.play(); } catch (e) {}
    let leer = null;
    try {
      if ('BarcodeDetector' in window) {
        const f = window.BarcodeDetector.getSupportedFormats ? await window.BarcodeDetector.getSupportedFormats() : ['qr_code'];
        if (!f || f.includes('qr_code')) { scanDetector = new window.BarcodeDetector({ formats: ['qr_code'] }); leer = async () => { const r = await scanDetector.detect(video); return r && r[0] ? r[0].rawValue : null; }; }
      }
    } catch (e) { scanDetector = null; }
    if (!leer) {
      try {
        const jsQR = await cargarJsQR();
        scanCanvas = document.createElement('canvas');
        const cx = scanCanvas.getContext('2d', { willReadFrequently: true });
        leer = async () => {
          const w = video.videoWidth, h = video.videoHeight; if (!w || !h) return null;
          const s = Math.min(1, 640 / Math.max(w, h)); scanCanvas.width = Math.round(w * s); scanCanvas.height = Math.round(h * s);
          cx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
          const img = cx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
          const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
          return r ? r.data : null;
        };
      } catch (e) { pararCamara(); return sinCamara('scan_sinCamara'); }
    }
    scanMsg(T('scan_apunta'));
    const ciclo = async () => {
      if (!scanAbierto || !scanStream) return;
      let txt = null;
      try { txt = await leer(); } catch (e) { txt = null; }
      if (!scanAbierto) return;
      if (txt) {
        const p = parsearQr(txt);
        if (p) { irEquipo(p.id); return; }
        scanMsg(T('scan_otroQr'), true);
      }
      scanTimer = setTimeout(ciclo, 250);
    };
    ciclo();
  }
  function pararCamara() {
    clearTimeout(scanTimer); scanTimer = null;
    if (scanStream) { try { scanStream.getTracks().forEach(t => t.stop()); } catch (e) {} }
    scanStream = null; scanDetector = null;
    const v = scanAbierto && scanAbierto.querySelector('video'); if (v) { try { v.srcObject = null; } catch (e) {} }
  }
  function cerrarScanner() {
    pararCamara();
    if (scanAbierto) { scanAbierto.remove(); scanAbierto = null; document.documentElement.style.overflow = ''; }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && scanAbierto) cerrarScanner(); });
  window.addEventListener('pagehide', () => { if (scanAbierto) cerrarScanner(); });

  // ══════ BUSCADOR GLOBAL ══════
  const LS_REC = 'vtBusquedas';
  function recientes() { try { const a = JSON.parse(lsGet(LS_REC) || '[]'); return Array.isArray(a) ? a.filter(x => typeof x === 'string').slice(0, 6) : []; } catch (e) { return []; } }
  function guardarReciente(q) { q = String(q || '').trim(); if (q.length < 2) return; const a = recientes().filter(x => norm(x) !== norm(q)); a.unshift(q); lsSet(LS_REC, JSON.stringify(a.slice(0, 6))); }
  let _repCache = null, _otTimer = null, _otSeq = 0;
  function repuestosEnCache() {
    if (_repCache) return Promise.resolve(_repCache);
    if (!tiene(MANT.concat([ALM])) || typeof db === 'undefined') return Promise.resolve([]);
    // Solo lo que ya está en el celular (source: 'cache' → 0 lecturas).
    return db.collection('equipos').get({ source: 'cache' }).then(sn => {
      const out = [];
      sn.docs.forEach(d => { const e = d.data() || {}; (Array.isArray(e.repuestos) ? e.repuestos : []).forEach(p => { const nom = p.r || p.descripcion || p.nombre || ''; const cod = p.codigo || p.m || ''; if (nom || cod) out.push({ nom, cod, eqId: d.id, eq: e.nombre || '' }); }); });
      _repCache = out; return out;
    }).catch(() => []);
  }
  // Folio: "OT-123", "ot 0123", "123" → "OT-0123"; "QR-AB12CD34" tal cual.
  function folioDe(q) {
    const s = String(q || '').trim().toUpperCase().replace(/\s+/g, '');
    let m = /^OT-?P?([A-Z0-9]+)$/.exec(s);
    if (m && /^OT-?P/.test(s)) return 'OT-P' + m[1];
    if (m && /^\d+$/.test(m[1])) return 'OT-' + m[1].padStart(4, '0');
    if ((m = /^#?(\d{1,6})$/.exec(s))) return 'OT-' + m[1].padStart(4, '0');
    if ((m = /^QR-?([A-Z0-9]{6,12})$/.exec(s))) return 'QR-' + m[1];
    return null;
  }
  function hl(txt, q) {
    const t = String(txt || ''); const n = norm(t), k = norm(q);
    const i = k ? n.indexOf(k) : -1;
    if (i < 0) return esc(t);
    return esc(t.slice(0, i)) + '<mark class="vt-hl">' + esc(t.slice(i, i + k.length)) + '</mark>' + esc(t.slice(i + k.length));
  }
  function destinoOt(o) {
    if (['pendiente', 'en_atencion'].includes(o.estado) && ['operador', 'qr'].includes(o.origen)) return 'bitacora.html#avisos';
    if (['planificada', 'rechazada'].includes(o.estado) && (o.origen === 'checklist' || o.tipoReporte === 'proyecto')) return 'bitacora.html#ot=' + encodeURIComponent(o.id);
    return 'bitacora.html#buscar=' + encodeURIComponent(o.folio || o.Title || '');
  }
  function abrirBuscar() {
    const bg = abrirHoja('vtBuscar', `<div class="vt-sbox">${ic('search')}<input type="search" id="vtQ" autocomplete="off" enterkeyhint="search" placeholder="${esc(T('s_placeholder'))}" aria-label="${esc(T('buscar'))}"/></div><div class="vt-res" id="vtRes" aria-live="polite"></div>`,
      { titulo: T('buscar'), foco: '#vtQ' });
    const inp = bg.querySelector('#vtQ');
    inp.addEventListener('input', () => buscar(inp.value));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const a = bg.querySelector('#vtRes a'); guardarReciente(inp.value); if (a) a.click(); } });
    bg.querySelector('#vtRes').addEventListener('click', e => {
      const r = e.target.closest('[data-rec]'); if (r) { inp.value = r.getAttribute('data-rec'); buscar(inp.value); inp.focus(); return; }
      if (e.target.closest('[data-vt="rec-borrar"]')) { lsSet(LS_REC, null); buscar(''); return; }
      if (e.target.closest('a')) guardarReciente(inp.value);
    });
    // Sin catálogo en el celular todavía: se pide una vez (caché de 12 h de firebase-init).
    if (typeof fbEquiposIndice === 'function' && !fbEquiposIndice().length && tiene(MANT.concat([ALM, OP])) && typeof fbEquiposCatalogo === 'function') fbEquiposCatalogo(false).then(() => buscar(inp.value)).catch(() => {});
    buscar('');
  }
  async function buscar(q) {
    const res = document.getElementById('vtRes'); if (!res) return;
    const k = norm(q);
    clearTimeout(_otTimer);
    if (k.length < 2) {
      const rec = recientes();
      res.innerHTML = (rec.length ? `<div class="vt-grp"><h3>${esc(T('s_recientes'))} <button type="button" class="vt-help" style="width:auto;border-radius:12px;padding:0 10px;height:26px;font-weight:600" data-vt="rec-borrar">${esc(T('s_borrar'))}</button></h3></div><div class="vt-recent">${rec.map(x => `<button type="button" data-rec="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : '')
        + `<div class="vt-empty">${esc(T('s_ayuda'))}</div>`;
      return;
    }
    const grupos = [];
    // Equipos (catálogo en el celular, sin acentos): nombre, código (id), área, línea
    const eqs = (typeof fbEquiposIndice === 'function' ? fbEquiposIndice() : []).filter(e => [e.nombre, e.id, e.localidad, e.linea, e.planta].some(x => norm(x).includes(k)))
      .sort((a, b) => (norm(a.nombre).startsWith(k) ? 0 : 1) - (norm(b.nombre).startsWith(k) ? 0 : 1) || String(a.nombre).localeCompare(String(b.nombre), 'es', { numeric: true })).slice(0, 8);
    if (eqs.length && rol() !== RH) grupos.push(`<div class="vt-grp"><h3>${esc(T('s_equipos'))}</h3>` + eqs.map(e => `<a class="vt-item" href="${esc(destinoEquipo(e.id))}" data-res="eq" data-id="${esc(e.id)}">${ic('cog')}<span><b>${hl(e.nombre, q)}</b><small>${hl([e.localidad, e.linea, e.planta].filter(Boolean).join(' · '), q)}</small></span>${e.criticidad ? `<span class="fbc fbc-${e.criticidad}">${e.criticidad}</span>` : ''}</a>`).join('') + '</div>');
    // Pantallas del rol
    const pags = paginasDelRol().filter(p => [T(p.k), p.d ? T(p.d) : '', p.id].concat(p.alias || []).some(x => norm(x).includes(k))).slice(0, 6);
    // Repuestos (si ya están en el celular)
    const reps = (await repuestosEnCache()).filter(r => norm(r.nom).includes(k) || norm(r.cod).includes(k)).slice(0, 6);
    if (document.getElementById('vtRes') !== res) return;
    if (reps.length) grupos.push(`<div class="vt-grp"><h3>${esc(T('s_repuestos'))}</h3>` + reps.map(r => `<a class="vt-item" href="${tiene(MANT) ? 'hoja-vida.html?id=' + encodeURIComponent(r.eqId) : 'almacen.html?equipo=' + encodeURIComponent(r.eqId)}" data-res="rep">${ic('package')}<span><b>${hl(r.nom || r.cod, q)}</b><small>${r.cod && r.nom ? hl(r.cod, q) + ' · ' : ''}${esc(r.eq)}</small></span></a>`).join('') + '</div>');
    if (pags.length) grupos.push(`<div class="vt-grp"><h3>${esc(T('s_paginas'))}</h3>` + pags.map(p => `<a class="vt-item" href="${p.href}" data-res="pg">${ic(p.ic)}<span><b>${hl(T(p.k), q)}</b>${p.d ? `<small>${esc(T(p.d))}</small>` : ''}</span></a>`).join('') + '</div>');
    // OT por folio (consulta exacta; también el campo viejo Title)
    const folio = tiene(MANT) ? folioDe(q) : null;
    const otBox = folio ? `<div class="vt-grp" id="vtResOt"><h3>${esc(T('s_ots'))}</h3><div class="vt-empty">${esc(T('s_buscandoOt'))}</div></div>` : '';
    res.innerHTML = otBox + grupos.join('') + (!grupos.length && !folio ? `<div class="vt-empty">${esc(T('s_nada', { q }))}</div>` : '');
    if (folio) {
      const seq = ++_otSeq;
      _otTimer = setTimeout(() => buscarOt(folio).then(ots => {
        const box = document.getElementById('vtResOt'); if (!box || seq !== _otSeq) return;
        box.innerHTML = `<h3>${esc(T('s_ots'))}</h3>` + (ots.length ? ots.map(o => `<a class="vt-item" href="${esc(destinoOt(o))}" data-res="ot" data-id="${esc(o.id)}">${ic('file')}<span><b class="mono">${esc(o.folio || o.Title || o.id)}</b><small>${esc(o.EQUIPO || o.equipoNombre || '')} · ${esc(C('est_' + (o.estado || 'completada')))}</small></span></a>`).join('') : `<div class="vt-empty">${esc(T('s_otNo', { f: folio }))}</div>`);
      }), 350);
    }
  }
  const _otMem = new Map();
  function buscarOt(folio) {
    if (_otMem.has(folio)) return _otMem.get(folio);
    const col = db.collection('ots');
    const p = Promise.all([col.where('folio', '==', folio).limit(3).get(), col.where('Title', '==', folio).limit(3).get()]).then(([a, b]) => {
      const m = new Map(); [a, b].forEach(s => s.docs.forEach(d => m.set(d.id, { id: d.id, ...d.data() }))); return [...m.values()];
    }).catch(() => []);
    _otMem.set(folio, p);
    return p;
  }

  // ── Acceso bloqueado (lo decide firebase-init.js; aquí se muestra) ──
  function pintarBloqueo() {
    const b = window.__vtBloqueo; if (!b || document.querySelector('.vt-lock')) return;
    document.documentElement.classList.add('vt-bloq');
    const d = document.createElement('section');
    d.className = 'vt-lock'; d.setAttribute('role', 'alert'); d.id = 'vtLock';
    d.innerHTML = `<i>${ic('lock')}</i><h2 data-i18n="shell.lock_titulo">${esc(T('lock_titulo'))}</h2><p data-i18n="${esc(b.clave)}">${esc(C(b.clave))}</p><a href="${rol() === OP ? 'reportar.html' : 'index.html'}">${ic('home', { cls: 'sm' })}<span data-i18n="shell.lock_ir">${esc(T('lock_ir'))}</span></a>`;
    hdr && hdr.nextSibling ? document.body.insertBefore(d, hdr.nextSibling) : document.body.appendChild(d);
  }

  // (v3 etapa 3a) La misma tarjeta, dentro de una sección de una pantalla (p. ej.
  // Almacén → Solicitudes para Técnico/Supervisor). clave: texto i18n.
  function bloqueoEn(el, clave) {
    if (!el) return;
    el.innerHTML = `<section class="vt-lock vt-lock-in" role="alert"><i>${ic('lock')}</i><h2 data-i18n="shell.lock_titulo">${esc(T('lock_titulo'))}</h2><p data-i18n="${esc(clave)}">${esc(C(clave))}</p></section>`;
  }

  // ── Clicks de la estructura ──
  document.addEventListener('click', e => {
    const lang = e.target.closest && e.target.closest('[data-vt-lang]');
    if (lang) { if (window.i18n) i18n.setLang(lang.getAttribute('data-vt-lang')); return; }
    const gb = e.target.closest && e.target.closest('[data-vt-grp]');
    if (gb) { e.preventDefault(); alternarGrupo(gb); return; }
    const tm = e.target.closest && e.target.closest('[data-vt-tema]');
    if (tm) { setTema(tm.getAttribute('data-vt-tema')); return; }
    const b = e.target.closest && e.target.closest('[data-vt]');
    if (!b) return;
    const a = b.getAttribute('data-vt');
    if (a === 'mas') { e.preventDefault(); abrirMas(); }
    else if (a === 'nuevo') { e.preventDefault(); abrirNuevo(); }
    else if (a === 'scan') { e.preventDefault(); abrirScanner(); }
    else if (a === 'buscar') { e.preventDefault(); abrirBuscar(); }
    else if (a === 'cerrar') { e.preventDefault(); cerrarHoja(); }
    else if (a === 'scan-cerrar') { e.preventDefault(); cerrarScanner(); }
    else if (a === 'rail') { e.preventDefault(); setRail(!rail()); }
    else if (a === 'salir') { e.preventDefault(); if (typeof fbLogout === 'function') fbLogout(); }
    else if (a === 'avisos' && PAGINA === 'index.html' && !location.hash) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  // Enlaces internos de la misma página con #hash (p. ej. reportar.html#estado estando ya en reportar)
  window.addEventListener('hashchange', () => { pintarTabbar(); if (side) pintarSide(); });

  // ── Ayuda "?" corta: <button class="vt-help" data-ayuda="clave i18n | texto">?</button> ──
  let pop = null;
  function cerrarPop() { if (!pop) return; if (pop._de) { pop._de.setAttribute('aria-expanded', 'false'); pop._de.removeAttribute('aria-describedby'); } pop.remove(); pop = null; }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pop) cerrarPop(); });
  window.addEventListener('scroll', () => { if (pop) cerrarPop(); }, { passive: true });
  // Botones "?" sin texto para el lector de pantalla: se les pone "Ayuda".
  function etiquetarAyudas(root) { (root || document).querySelectorAll('[data-ayuda]:not([aria-label])').forEach(b => { b.setAttribute('aria-label', T('ayuda')); if (!b.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', 'false'); }); }
  document.addEventListener('click', e => {
    const h = e.target.closest && e.target.closest('[data-ayuda]');
    if (pop && (!h || pop._de !== h)) cerrarPop();
    if (!h) return;
    e.preventDefault();
    if (pop) { cerrarPop(); return; }
    const k = h.getAttribute('data-ayuda');
    pop = document.createElement('div'); pop.className = 'vt-pop'; pop.setAttribute('role', 'tooltip'); pop._de = h; pop.id = 'vtPop';
    h.setAttribute('aria-expanded', 'true'); h.setAttribute('aria-describedby', 'vtPop');
    pop.innerHTML = esc(window.i18n && i18n.has(k) ? i18n.t(k) : k) + (h.hasAttribute('data-guia') ? ` <a href="guia.html${esc(h.getAttribute('data-guia'))}">${esc(T('masEnGuia'))}</a>` : '');
    document.body.appendChild(pop);
    const r = h.getBoundingClientRect(), w = pop.offsetWidth;
    pop.style.left = Math.max(16, Math.min(window.innerWidth - w - 16, r.left + r.width / 2 - w / 2)) + 'px';
    pop.style.top = (r.bottom + 8) + 'px';
  }, true);


  // ══════ ESTADO DE SINCRONIZACIÓN (barra superior) ══════
  // Conectado · Guardando… · Sin conexión, y cuántos cambios faltan por subir.
  // Sin lecturas: se cuentan las escrituras de este celular que Firestore todavía
  // no confirmó (set / update / delete / add / batch.commit: su promesa se cumple
  // cuando el servidor las recibe), db.waitForPendingWrites() para las que quedaron
  // de antes de recargar y db.onSnapshotsInSync() para refrescar.
  const sync = { pend: 0, previas: false, red: navigator.onLine !== false, envuelto: false };
  function estadoSync() { if (!sync.red) return 'off'; if (sync.pend > 0 || sync.previas) return 'sync'; return 'ok'; }
  function htmlSync() {
    const st = estadoSync(), n = sync.pend;
    const icn = st === 'off' ? 'cloud-off' : st === 'sync' ? 'refresh' : 'cloud-check';
    const txt = st === 'off' ? T('sinConexion') : st === 'sync' ? T('sync_guardando') : T('sync_ok');
    const det = n ? TN('sync_pend', n) : (st === 'ok' ? T('sync_ok_d') : st === 'sync' ? T('sync_previas') : T('sync_off_d'));
    return `<span class="vt-sync${st === 'off' ? ' vt-off' : ''}" data-st="${st}" role="status" aria-live="polite" title="${esc(txt + ' · ' + det)}">${ic(icn, { cls: 'sm' })}`
      + `<span class="vt-sync-t">${esc(txt)}</span>${n ? `<b class="vt-sync-n" aria-label="${esc(det)}">${n > 99 ? '99+' : n}</b>` : ''}<span class="vt-sr">${esc(det)}</span></span>`;
  }
  function pintarSync() {
    const el = hdr && hdr.querySelector('.vt-sync');
    if (!el) return;
    const t = document.createElement('div'); t.innerHTML = htmlSync();
    const nu = t.firstChild;
    if (el.getAttribute('data-st') !== nu.getAttribute('data-st') || el.textContent !== nu.textContent) el.replaceWith(nu);
    document.documentElement.setAttribute('data-sync', estadoSync());
  }
  function envolverEscrituras() {
    if (sync.envuelto || typeof db === 'undefined' || !db || typeof db.collection !== 'function') return;
    sync.envuelto = true;
    let dentro = 0;
    const seguir = (o, self, args) => {
      if (dentro) return o.apply(self, args);           // add() que llama a set() por dentro: una sola
      dentro++;
      let p; try { p = o.apply(self, args); } finally { dentro--; }
      if (p && typeof p.then === 'function') {
        sync.pend++; pintarSync();
        const fin = () => { sync.pend = Math.max(0, sync.pend - 1); pintarSync(); };
        p.then(fin, fin);
      }
      return p;
    };
    const parchar = (proto, ms) => { if (!proto) return; ms.forEach(m => { const o = proto[m]; if (typeof o !== 'function' || o.__vtSync) return; const w = function () { return seguir(o, this, arguments); }; w.__vtSync = true; proto[m] = w; }); };
    try {
      const col = db.collection('__vt_sync'), ref = col.doc('x');   // solo referencias: no lee nada
      parchar(Object.getPrototypeOf(ref), ['set', 'update', 'delete']);
      parchar(Object.getPrototypeOf(col), ['add']);
      if (typeof db.batch === 'function') parchar(Object.getPrototypeOf(db.batch()), ['commit']);
    } catch (e) { console.warn('sync:', e && e.message); }
    try {
      if (typeof db.waitForPendingWrites === 'function') {
        let listo = false;
        db.waitForPendingWrites().then(() => { listo = true; if (sync.previas) { sync.previas = false; pintarSync(); } }).catch(() => {});
        setTimeout(() => { if (!listo) { sync.previas = true; pintarSync(); } }, 1500);
      }
      if (typeof db.onSnapshotsInSync === 'function') db.onSnapshotsInSync(() => pintarSync());
    } catch (e) {}
  }
  function redCambio() { sync.red = navigator.onLine !== false; pintarSync(); }
  window.addEventListener('online', redCambio); window.addEventListener('offline', redCambio);

  // ══════ AVISOS CORTOS (toast) con "Deshacer" ══════
  //   vtToast('Guardado', 'ok' | 'err' | 'warn' | 'info')
  //   vtToast('Repuesto quitado', { deshacer: () => …, ms: 6000 })
  // Icono + texto (nunca solo color), role=status (role=alert si es error), vibración corta.
  let tEl = null, tTimer = null;
  const LEAD = /^[\s‍️]*(\p{Extended_Pictographic})[️‍]*\s*/u;
  // Respaldo: si a un aviso le llega un símbolo al inicio, se cambia por su icono (✓ ⚠ ✗ …).
  const TIPO_EMO = { '\u2705': 'ok', '\u26A0': 'warn', '\u274C': 'err', '\u26D4': 'err', '\u{1F512}': 'err', '\u{1F4F5}': 'warn', '\u{1F4F6}': 'warn', '\u{1F6AB}': 'err', '\u2139': 'info' };
  function normTipo(t) {
    if (t === true || /^(err|error|danger|bad|mal)$/i.test(t || '')) return 'err';
    if (/^(warn|warning|aviso|alerta)$/i.test(t || '')) return 'warn';
    if (/^(ok|success|exito|éxito|good)$/i.test(t || '')) return 'ok';
    if (/^info$/i.test(t || '')) return 'info';
    return '';
  }
  function vibrar(p) { try { if (p && navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function ocultarToast() { if (tEl) { tEl.classList.remove('show'); tEl.removeAttribute('data-undo'); } clearTimeout(tTimer); }
  // Lo que espera a que el aviso se cierre (p. ej. borrar el archivo si no se deshizo):
  // se hace también si otro aviso lo reemplaza o si se sale de la pantalla.
  let pendCerrar = null;
  function cerrarPendiente() { const f = pendCerrar; pendCerrar = null; if (f) try { f(); } catch (e) {} }
  window.addEventListener('pagehide', cerrarPendiente);
  function vtToast(msg, o) {
    if (o == null || typeof o !== 'object') o = { tipo: o };
    cerrarPendiente();
    let txt = String(msg == null ? '' : msg);
    let tipo = normTipo(o.tipo);
    const m = LEAD.exec(txt);
    if (m) { if (!tipo) tipo = TIPO_EMO[m[1]] || ''; txt = txt.slice(m[0].length); }
    txt = txt.replace(/\s*\p{Extended_Pictographic}[️‍]*/gu, '');
    if (!document.body) return;
    if (!tEl) {
      tEl = document.createElement('div'); tEl.id = 'vtToast'; tEl.className = 'vt-toast';
      document.body.appendChild(tEl);
    }
    clearTimeout(tTimer);
    const icono = { ok: 'check-circle', err: 'x-circle', warn: 'alert', info: 'info' }[tipo];
    tEl.setAttribute('role', tipo === 'err' ? 'alert' : 'status');
    tEl.setAttribute('aria-live', tipo === 'err' ? 'assertive' : 'polite');
    tEl.className = 'vt-toast' + (tipo ? ' ' + tipo : '');
    tEl.innerHTML = (icono ? ic(icono) : '') + '<span class="vt-toast-m"></span>'
      + (o.deshacer ? `<button type="button" class="vt-toast-b">${ic('undo', { cls: 'sm' })}<span>${esc(T('deshacer'))}</span></button>` : '');
    tEl.querySelector('.vt-toast-m').textContent = txt;
    if (o.deshacer) {
      tEl.setAttribute('data-undo', '');
      tEl.querySelector('.vt-toast-b').onclick = () => { pendCerrar = null; ocultarToast(); vibrar(12); try { o.deshacer(); } catch (e) { console.error(e); } };
    }
    void tEl.offsetWidth; tEl.classList.add('show');
    vibrar(tipo === 'err' ? [30, 50, 30] : tipo === 'ok' || o.deshacer ? 15 : 0);
    pendCerrar = o.alCerrar || null;
    tTimer = setTimeout(() => { ocultarToast(); cerrarPendiente(); }, o.ms || (o.deshacer ? 6500 : tipo === 'err' ? 5200 : 3400));
    return tEl;
  }
  // Acción reversible: se hace ya y el aviso ofrece "Deshacer" (en vez de confirm()).
  function vtDeshacer(msg, deshacer, o) { return vtToast(msg, Object.assign({ tipo: 'ok', deshacer }, o || {})); }
  window.vtToast = vtToast; window.vtDeshacer = vtDeshacer; window.vtVibrar = vibrar;

  // ══════ Esqueleto de carga (en vez de "Cargando…") ══════
  //   el.innerHTML = VTShell.esqueleto(3)  ·  o en el HTML: <div class="vt-sk-list" aria-busy="true"><i></i><i></i><i></i></div>
  function esqueleto(n, o) {
    o = o || {};
    return `<div class="vt-sk-list${o.cls ? ' ' + o.cls : ''}" aria-busy="true" role="status"><span class="vt-sr">${esc(C('cargando'))}</span>` + '<i></i>'.repeat(Math.max(1, n || 3)) + '</div>';
  }

  // ══════ Ayudas largas → una línea + "?" ══════
  // Los párrafos de explicación largos de las pantallas (.section-intro, .nota, .card-sub…)
  // se acortan a su primera oración; el resto se lee en el "?" (mismo texto, sin perder nada).
  const SEL_LARGA = '.section-intro, .cardsub, .card-sub, .nota, .modal-sub, .info-box, .hint, .banner, .sub-help';
  const MAX_AYUDA = 160;
  function condensar(el) {
    if (!el || el.hasAttribute('data-vt-corto') || el.closest('.vt-pop, .vt-sheet, [data-no-corto], #printArea, .rep-paper, .papel')) return;
    if (el.querySelector('a, button, input, select, textarea, [data-ayuda], canvas, svg:not(.vt-ico), table, ul, ol')) return;
    let src = '';
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) src += window.i18n && i18n.fuente ? i18n.fuente(n) : n.data;
    src = src.replace(/\s+/g, ' ').trim();
    if (src.length <= MAX_AYUDA) return;
    const m = /^([\s\S]{25,150}?[.:;])\s+(?=[¿¡A-ZÁÉÍÓÚÑ0-9"“(])/.exec(src);
    if (!m) return;
    el.setAttribute('data-vt-corto', '');
    el.textContent = m[1] + ' ';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'vt-help'; b.textContent = '?';
    b.setAttribute('data-ayuda', src); b.setAttribute('aria-label', T('ayuda')); b.setAttribute('aria-expanded', 'false');
    el.appendChild(b);
  }
  // Botones que solo tienen un icono: si la pantalla no les puso nombre, se les da uno por su
  // icono (o su title) para el lector de pantalla. El texto se traduce como cualquier otro.
  const NOMBRE_ICONO = { trash: 'Eliminar', pencil: 'Editar', x: 'Cerrar', 'x-circle': 'Cerrar', plus: 'Agregar', minus: 'Quitar', save: 'Guardar', search: 'Buscar',
    download: 'Descargar', upload: 'Subir archivo', printer: 'Imprimir', refresh: 'Actualizar', camera: 'Tomar foto', image: 'Ver foto', eye: 'Ver', copy: 'Copiar', link: 'Abrir enlace',
    'chevron-left': 'Anterior', 'chevron-right': 'Siguiente', 'arrow-up': 'Mover arriba', 'arrow-down': 'Mover abajo', 'arrow-left': 'Volver', help: 'Ayuda', info: 'Información', settings: 'Ajustes',
    lock: 'Clave', calendar: 'Fecha', clock: 'Hora', filter: 'Filtrar', 'check-circle': 'Confirmar', check: 'Confirmar', undo: 'Deshacer', external: 'Abrir', qr: 'Código QR', file: 'Ver archivo', book: 'Ver manual' };
  function etiquetarIconos(root) {
    (root || document).querySelectorAll('button:not([aria-label]), a[href]:not([aria-label]), [role="button"]:not([aria-label])').forEach(b => {
      if ((b.textContent || '').replace(/\s+/g, '').length) return;
      const t = b.getAttribute('title');
      const i = b.querySelector('[data-icon], svg[data-i]');
      const n = i && (i.getAttribute('data-icon') || i.getAttribute('data-i'));
      const lab = t || (n && NOMBRE_ICONO[n]) || '';
      if (lab) b.setAttribute('aria-label', lab);
    });
  }
  function condensarEn(root) {
    try { etiquetarIconos(root); } catch (e) {} if (!root || !root.querySelectorAll) return; if (root.matches && root.matches(SEL_LARGA)) condensar(root); root.querySelectorAll(SEL_LARGA).forEach(condensar); }
  let _condT = null;
  function vigilarAyudas() {
    condensarEn(document.body);
    if (!window.MutationObserver) return;
    new MutationObserver(muts => {
      if (_condT) return;
      if (!muts.some(m => m.addedNodes.length)) return;
      _condT = setTimeout(() => { _condT = null; condensarEn(document.body); }, 60);
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ── Pintar todo ──
  function pintar() {
    if (!document.body) return;
    pintarHeader();
    pintarTabbar();
    pintarSide();
    pintarBloqueo();
    if (window.VTIcons) VTIcons.hydrate(document);
    etiquetarAyudas(document);
    document.documentElement.setAttribute('data-sync', estadoSync());
  }
  function estadoRed() { document.documentElement.classList.toggle('vt-offline', navigator.onLine === false); }
  window.addEventListener('online', estadoRed); window.addEventListener('offline', estadoRed);
  window.addEventListener('idioma-cambiado', () => { pintar(); if (hojaAbierta) { const id = hojaAbierta.id; if (id === 'vtMas') abrirMas(); else if (id === 'vtNuevo') abrirNuevo(); else if (id === 'vtBuscar') abrirBuscar(); } });
  if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', pintarMetaTema); } catch (e) {} }

  // ── Logo subido por el Administrador (Incentivos → /incentivos_config/logo { data }) ──
  // Solo para el Administrador (las reglas no dejan leerlo a nadie más) y solo en su menú
  // lateral y al imprimir. Nunca se espera por él: se usa la copia del celular y se
  // refresca en segundo plano como mucho una vez al día (1 lectura).
  function logoAdmin() {
    if (rol() !== ADM || typeof db === 'undefined') return;
    let c = null; try { c = JSON.parse(lsGet('vtLogo') || 'null'); } catch (e) {}
    if (c && c.data) ponerLogo(c.data);
    if (c && Date.now() - (c.ts || 0) < 86400000) return;
    db.collection('incentivos_config').doc('logo').get().then(sn => {
      const d = sn.exists ? sn.data() : null;
      const data = d && typeof d.data === 'string' && /^data:image\//.test(d.data) && d.data.length < 400000 ? d.data : '';
      lsSet('vtLogo', JSON.stringify({ ts: Date.now(), data }));
      if (data) ponerLogo(data);
    }).catch(() => {});
  }
  function ponerLogo(data) {
    let pl = document.getElementById('vtPrintLogo');
    if (!pl) { pl = document.createElement('div'); pl.id = 'vtPrintLogo'; pl.className = 'vt-print-logo'; document.body.insertBefore(pl, document.body.firstChild); }
    pl.innerHTML = '<img alt="" src="' + esc(data) + '"/>';
    if (side) { const m = side.querySelector('.vt-wm .vt-mono'); if (m && m.tagName.toLowerCase() === 'svg') m.outerHTML = '<span class="vt-mono"><img alt="" src="' + esc(data) + '"/></span>'; }
  }

  function arrancar() {
    envolverEscrituras();
    try { vigilarAyudas(); } catch (e) {}
    estadoRed();
    pintarMetaTema();
    pintar();
    const ses = window.fbSesion || window.fbReady;
    if (ses && ses.then) ses.then(() => { envolverEscrituras(); pintar(); logoAdmin(); if (typeof fbCargarPlantas === 'function') fbCargarPlantas().then(() => pintarHeader()).catch(() => {}); }).catch(() => {});
    // El catálogo puede llegar después (naves del selector)
    if (typeof fbOnCatalogo === 'function') fbOnCatalogo(() => { if (window.currentUserRole) pintarHeader(); });
  }

  window.VTShell = {
    VERSION, PAGINAS, GRUPOS, ACCESO, barra, paginasDelRol, tabActiva, pintar, htmlGrupos,
    bloqueoEn, // tarjeta "Sin acceso" dentro de una sección (Almacén → Solicitudes)
    activo: id => { activo = id || ''; pintar(); },
    abrirMas, abrirNuevo, abrirScanner, cerrarScanner, abrirBuscar, cerrarHoja, buscar,
    parsearQr, folioDe, destinoEquipo, setTema, temaActual, setRail, rail,
    setBadge: n => { try { sessionStorage.setItem('vtHoyN', String(n || 0)); } catch (e) {} pintarHeader(); pintarTabbar(); },
    _scan: () => ({ abierto: !!scanAbierto, stream: !!scanStream }),
    toast: vtToast, deshacer: vtDeshacer, vibrar, esqueleto, condensar: condensarEn, sync: () => ({ estado: estadoSync(), pendientes: sync.pend, previas: sync.previas }),
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
