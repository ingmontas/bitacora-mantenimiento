// hoy.js — (v3, nov 2026) Pantalla "Hoy" (index.html): lo que cada persona
// tiene que atender, ordenado por urgencia, con un toque para ir al lugar.
// Solo se muestran las tarjetas que tienen algo.
//
// LECTURAS (plan gratis: 50.000 al día): consultas pequeñas de igualdad / 'in'
// con límite, sin orden ni índices compuestos; el resultado se guarda 3 minutos
// en sessionStorage (volver a Hoy dentro de ese tiempo no lee nada).
// Técnico, primera vez: ~10–20 lecturas (presupuesto ≤ 25). Repetir: 0 (+1 del usuario al abrir la página).
//   ots            estado in [pendiente, en_atencion] (+ planificada, rechazada, en_revision para supervisión)  límite 20 / 40
//   ots            asignadoA == yo, estado in [planificada, rechazada]                                          límite 15
//   equipos        checklistProximaFecha <= hoy (o la copia del catálogo en el celular: 0 lecturas)           límite 20
//   permisos_trabajo  tecnicoUid == yo, estado in [abierto, por_autorizar, autorizado] · estado == por_autorizar  límite 10
//   ots            rcaRequerido == true                                                                          límite 20
//   solicitudes_repuestos  tecnicoUid == yo, estado == pendiente · estado == pendiente (Almacén)              límite 10 / 30
//   herramientas_asignadas tecnico == yo, aceptada == false                                                    límite 10
//   herramientas_arqueos   rrhh.estado == enviado (RR.HH.)                                                    límite 30
//   config/respaldo (Administrador, 1 lectura)
// Indicadores y alertas de tendencia: copia que deja Análisis en el celular (0 lecturas).
// ══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const TTL = 3 * 60 * 1000;
  const ADM = 'ADMINISTRADOR', ENC = 'ENCARGADO_MANTENIMIENTO', SUP = 'SUPERVISOR', TEC = 'TECNICO', ALM = 'ALMACEN', RH = 'RRHH';
  const T = (k, p) => (window.i18n && i18n.has('hoy.' + k) ? i18n.t('hoy.' + k, p) : k);
  const TN = (k, n, p) => (window.i18n ? i18n.tn('hoy.' + k, n, p) : String(n));
  const C = (k, p) => (window.i18n && i18n.has(k) ? i18n.t(k, p) : k);
  const S = (k, p) => (window.i18n && i18n.has('shell.' + k) ? i18n.t('shell.' + k, p) : k);
  const esc = s => fbEsc(s);
  const ic = (n, c) => (window.VTIcons ? VTIcons.icon(n, { cls: c || '' }) : '');
  const tx = (doc, campo) => (window.traductor ? traductor.html(doc, campo, { col: 'ots' }) : esc(doc[campo] || ''));
  const K = s => fbEquipoKey(s);
  const ms = v => (v && typeof v.toMillis === 'function') ? v.toMillis() : (v && typeof v.seconds === 'number') ? v.seconds * 1000 : (typeof v === 'number' ? v : 0);
  const rolDe = () => (window.currentUserRole && window.currentUserRole.rol) || '';
  const esSup = () => [ADM, ENC, SUP].includes(rolDe());
  const diasHasta = f => { const d = fbParseFecha(f); if (!d) return null; const h = fbParseFecha(fbHoy()); return Math.round((d - h) / 86400000); };
  // Copia de rca.js (no se carga aquí): 'pendiente' | 'por_validar' | 'validada' | null
  const rcaLleno = r => !!(r && typeof r === 'object' && String(r.causa || '').trim());
  const rcaEstado = o => (!o || o.rcaRequerido !== true) ? (rcaLleno(o && o.rca) ? (o.rca.validada ? 'validada' : 'por_validar') : null) : (!rcaLleno(o.rca) ? 'pendiente' : (o.rca.validada ? 'validada' : 'por_validar'));

  // Documento → objeto simple (las fechas de Firestore pasan a milisegundos: se puede guardar en sessionStorage)
  function plano(d) {
    const x = Object.assign({ id: d.id }, d.data());
    ['createdAt', 'creadoEn', 'asignadaEn', 'actualizado'].forEach(k => { if (x[k] != null) x[k] = ms(x[k]); });
    if (x.rca && x.rca.en && typeof x.rca.en !== 'string') x.rca = Object.assign({}, x.rca, { en: ms(x.rca.en) });
    return x;
  }
  const docs = sn => sn.docs.map(plano);
  function claveCache() { return 'vtHoy:' + ((window.currentUser && window.currentUser.uid) || '') + ':' + (fbNaveActiva() || '*'); }
  function leerCache() {
    try { const c = JSON.parse(sessionStorage.getItem(claveCache()) || 'null'); if (c && c.v === 1 && Date.now() - c.ts < TTL) return c; } catch (e) {}
    return null;
  }
  function guardarCache(d) { try { sessionStorage.setItem(claveCache(), JSON.stringify(Object.assign({ v: 1, ts: Date.now() }, d))); } catch (e) {} }

  // Nombre de técnico del usuario (el mismo que usan Bitácora y Herramientas)
  function yo() { const u = window.currentUserRole || {}; return String(u.tecnico || u.nombre || '').trim(); }
  function esMio(texto) {
    const u = window.currentUserRole || {};
    const mios = [u.tecnico, u.nombre, u.tecnicoCorto].filter(Boolean).map(K);
    return String(texto || '').split(',').map(x => K(x)).some(x => x && mios.includes(x));
  }

  // ── Carga (una vez cada 3 min) ──
  async function cargar(forzar) {
    if (!forzar) { const c = leerCache(); if (c) return c; }
    const r = rolDe(), uid = window.currentUser && window.currentUser.uid;
    const col = n => db.collection(n);
    const out = { errores: [] };
    const tareas = [];
    const tarea = (k, p, f) => tareas.push(p.then(v => { out[k] = f ? f(v) : v; }).catch(e => { out[k] = null; out.errores.push(k + ': ' + ((e && (e.code || e.message)) || e)); }));
    const mant = [ADM, ENC, SUP, TEC].includes(r);
    if (mant) {
      tarea('abiertas', col('ots').where('estado', 'in', esSup() ? ['pendiente', 'en_atencion', 'planificada', 'rechazada', 'en_revision'] : ['pendiente', 'en_atencion']).limit(esSup() ? 40 : 20).get(), docs);
      tarea('rca', col('ots').where('rcaRequerido', '==', true).limit(20).get(), docs);
    }
    if (r === TEC || (mant && (window.currentUserRole || {}).tecnico)) {
      if (yo()) tarea('misTrabajos', col('ots').where('asignadoA', '==', yo()).where('estado', 'in', ['planificada', 'rechazada']).limit(15).get(), docs);
      if (uid) tarea('loto', col('permisos_trabajo').where('tecnicoUid', '==', uid).where('estado', 'in', ['abierto', 'por_autorizar', 'autorizado']).limit(10).get(), docs);
      if (uid) tarea('misSol', col('solicitudes_repuestos').where('tecnicoUid', '==', uid).where('estado', '==', 'pendiente').limit(10).get(), docs);
      if (yo()) tarea('herr', col('herramientas_asignadas').where('tecnico', '==', yo()).where('aceptada', '==', false).limit(10).get(), docs);
    }
    if (r === TEC) {
      // Checklists de hoy / vencidos: la copia del catálogo si está fresca (0 lecturas); si no, solo los equipos que vencen.
      let fresca = false;
      try { fresca = Date.now() - (+localStorage.getItem('fbEquiposSync') || 0) < 12 * 3600 * 1000; } catch (e) {}
      const hoy = fbHoy();
      const p = fresca
        ? col('equipos').get({ source: 'cache' }).then(sn => sn.docs.map(plano).filter(e => e.checklistProximaFecha && e.checklistProximaFecha <= hoy)).catch(() => col('equipos').where('checklistProximaFecha', '<=', hoy).limit(20).get().then(docs))
        : col('equipos').where('checklistProximaFecha', '<=', hoy).limit(20).get().then(docs);
      tarea('ckDue', p, l => l.filter(e => e.activo !== false).map(e => ({ id: e.id, nombre: e.nombre, localidad: e.localidad || '', planta: e.planta || '', checklistProximaFecha: e.checklistProximaFecha, criticidad: e.criticidad || '' })));
    }
    if (esSup()) tarea('porAutorizar', col('permisos_trabajo').where('estado', '==', 'por_autorizar').limit(10).get(), docs);
    if (r === ALM || r === ADM) tarea('almSol', col('solicitudes_repuestos').where('estado', '==', 'pendiente').limit(30).get(), docs);
    if (r === ALM) {
      tarea('bajoMin', fbEquiposCatalogo(false), sn => {
        const l = [];
        sn.docs.forEach(d => { const e = d.data() || {}; if (e.activo === false) return; (Array.isArray(e.repuestos) ? e.repuestos : []).forEach(p => {
          const q = parseFloat(p.q != null && p.q !== '' ? p.q : p.cantidad), mn = parseFloat(p.min != null && p.min !== '' ? p.min : p.minimo);
          if (isNaN(q)) return;
          if (q <= 0 || (!isNaN(mn) && mn > 0 && q < mn)) l.push({ eqId: d.id, equipo: e.nombre || '', planta: e.planta || '', localidad: e.localidad || '', nombre: p.r || p.descripcion || p.codigo || '', codigo: p.codigo || p.m || '', q, min: isNaN(mn) ? null : mn });
        }); });
        return l;
      });
    }
    if (r === RH) tarea('cargos', col('herramientas_arqueos').where('rrhh.estado', '==', 'enviado').limit(30).get(), docs);
    if (r === ADM) tarea('respaldo', col('config').doc('respaldo').get(), s => { const d = s.exists ? s.data() : null; return { ultimo: d && d.ultimo ? ms(d.ultimo) : null }; });
    await Promise.all(tareas);
    guardarCache(out);
    out.ts = Date.now();
    return out;
  }

  // ── Tarjetas ──
  function critBadge(n) { return ['A', 'B', 'C'].includes(n) ? `<span class="fbc fbc-${n}" title="${esc(C('crit_' + n))}">${n}</span>` : ''; }
  function card(o) {
    // o: { id, ic, tono: 'danger'|'warn'|'info'|'ok'|'', titulo, n, items:[{href, t, meta, badge, desc}], mas: {href, n}, cuerpo, score }
    const items = (o.items || []).slice(0, o.max || 3);
    const resto = (o.n != null ? o.n : (o.items || []).length) - items.length;
    return `<section class="hoy-card ${o.tono || ''}" data-card="${o.id}" aria-labelledby="hc-${o.id}">
      <header><span class="hoy-ic">${ic(o.ic)}</span><h2 id="hc-${o.id}">${esc(o.titulo)}</h2>${o.n != null ? `<b class="hoy-n">${o.n}</b>` : ''}</header>
      ${o.cuerpo || ''}
      ${items.map(it => `<a class="hoy-it" href="${esc(it.href)}" data-item="${o.id}"><span class="hoy-it-b"><span class="hoy-it-t">${it.t}${it.badge ? ' ' + it.badge : ''}</span>${it.meta ? `<small>${it.meta}</small>` : ''}${it.desc ? `<span class="hoy-it-d">${it.desc}</span>` : ''}</span>${ic('chevron-right', 'sm')}</a>`).join('')}
      ${o.mas ? `<a class="hoy-mas" href="${esc(o.mas.href)}" data-mas="${o.id}">${resto > 0 ? esc(TN('masN', resto)) + ' · ' : ''}${esc(T('verTodo'))}${ic('arrow-right', 'sm')}</a>` : ''}
    </section>`;
  }
  const badge = (tono, txt, i) => `<span class="vt-badge ${tono}">${i ? ic(i) : ''}${esc(txt)}</span>`;
  function dueTxt(f) {
    const d = diasHasta(f);
    if (d == null) return { txt: '', tono: '' };
    if (d < 0) return { txt: TN('atrasado', -d), tono: 'danger', urg: true };
    if (d === 0) return { txt: T('venceHoy'), tono: 'warn', urg: true };
    return { txt: T('paraEl', { f: i18n.fmtDate(f, 'dayMonth') }), tono: '' };
  }

  function construir(D) {
    const r = rolDe();
    const cards = [];
    const enNave = x => fbEnNave(x);
    const abiertas = (D.abiertas || []).filter(enNave);
    // 1) Avisos abiertos (operador / QR): parada y criticidad A primero
    const avisos = abiertas.filter(o => ['pendiente', 'en_atencion'].includes(o.estado) && ['operador', 'qr'].includes(o.origen));
    const critDe = o => (o.equipoId && fbCriticidadDeEquipo(o.equipoId)) || '';
    avisos.sort((a, b) => (b.maquinaParada === true) - (a.maquinaParada === true) || (critDe(a) === 'A' ? 0 : 1) - (critDe(b) === 'A' ? 0 : 1) || (a.createdAt || 0) - (b.createdAt || 0));
    if (avisos.length) {
      const grave = avisos.some(o => o.maquinaParada === true || critDe(o) === 'A');
      cards.push({ id: 'avisos', ic: 'siren', tono: grave ? 'danger' : 'warn', titulo: T('c_avisos'), n: avisos.length, score: grave ? 100 : 80, mas: { href: 'bitacora.html#avisos' },
        items: avisos.map(o => ({ href: 'bitacora.html#avisos', t: esc(o.equipoNombre || o.EQUIPO || '—') + ' ' + critBadge(critDe(o)),
          badge: o.maquinaParada === true ? badge('danger', T('parada'), 'stop') : badge('warn', T('falla'), 'alert'),
          meta: [o.folio ? `<span class="mono">${esc(o.folio)}</span>` : '', o.horaParada ? esc(T('desde', { h: i18n.fmtTime(o.horaParada) })) : '', o.estado === 'en_atencion' ? esc(T('enAtencion', { t: o.asignadoA || '—' })) : ''].filter(Boolean).join(' · '),
          desc: tx(o, 'descripcionFalla') })) });
    }
    // 2) Mis trabajos asignados (vence hoy / atrasado primero)
    const mis = (D.misTrabajos || []).filter(o => o.origen === 'checklist' || o.tipoReporte === 'proyecto');
    if (mis.length) {
      mis.sort((a, b) => String(a.fechaPlanificada || '9').localeCompare(String(b.fechaPlanificada || '9')));
      const urg = mis.some(o => o.estado === 'rechazada' || dueTxt(o.fechaPlanificada).urg);
      cards.push({ id: 'misTrabajos', ic: 'calendar-check', tono: urg ? 'warn' : 'info', titulo: T('c_misTrabajos'), n: mis.length, score: urg ? 85 : 50, mas: { href: 'bitacora.html#avisos' },
        items: mis.map(o => { const du = dueTxt(o.fechaPlanificada); return { href: 'bitacora.html#ot=' + encodeURIComponent(o.id), t: esc(o.equipoNombre || '—'),
          badge: o.estado === 'rechazada' ? badge('danger', T('devuelta', { m: o.notaRevision || '' }).replace(/:\s*$/, '')) : (du.txt ? badge(du.tono || 'mut', du.txt, 'calendar') : ''),
          meta: [`<span class="mono">${esc(o.folio || '')}</span>`, esc(o.tipoReporte === 'proyecto' ? T('proyecto') : T('checklist'))].join(' · '), desc: tx(o, 'descripcionFalla') }; }) });
    }
    // 3) Checklists de hoy / vencidos (mis naves)
    const ck = (D.ckDue || []).filter(e => fbEquipoEnNave(e)).sort((a, b) => String(a.checklistProximaFecha).localeCompare(String(b.checklistProximaFecha)));
    if (ck.length) {
      const venc = ck.some(e => diasHasta(e.checklistProximaFecha) < 0);
      cards.push({ id: 'checklists', ic: 'clipboard-check', tono: venc ? 'warn' : 'info', titulo: T('c_checklists'), n: ck.length, score: venc ? 70 : 60, mas: { href: 'checklist.html' },
        items: ck.map(e => { const d = diasHasta(e.checklistProximaFecha); return { href: 'checklist.html?equipo=' + encodeURIComponent(e.id), t: esc(e.nombre || '—') + ' ' + critBadge(e.criticidad || fbCriticidadDeEquipo(e.id)),
          badge: d < 0 ? badge('danger', TN('vencido', -d)) : badge('warn', T('tocaHoy')), meta: esc(e.localidad || '') }; }) });
    }
    // 4) Mis LOTO abiertos
    const loto = (D.loto || []);
    if (loto.length) cards.push({ id: 'loto', ic: 'shield', tono: 'warn', titulo: T('c_loto'), n: loto.length, score: 75, mas: { href: 'bitacora.html#avisos' },
      items: loto.map(p => ({ href: 'bitacora.html#avisos', t: esc(p.equipoNombre || '—'), badge: badge(p.estado === 'por_autorizar' ? 'warn' : 'info', T('loto_' + p.estado)), meta: p.otFolio ? `<span class="mono">${esc(p.otFolio)}</span>` : '' })) });
    // 5) RCA: mías pendientes (técnico) · por validar (supervisión)
    const rcas = (D.rca || []).filter(enNave);
    const rcaMias = r === TEC || (window.currentUserRole || {}).tecnico ? rcas.filter(o => rcaEstado(o) === 'pendiente' && esMio(o.TECNICOS)) : [];
    if (rcaMias.length) cards.push({ id: 'rca', ic: 'search-check', tono: 'warn', titulo: T('c_rca'), n: rcaMias.length, score: 55,
      items: rcaMias.map(o => ({ href: o.equipoId ? 'hoja-vida.html?id=' + encodeURIComponent(o.equipoId) + '#cardRca' : 'bitacora.html#buscar=' + encodeURIComponent(o.folio || ''), t: esc(o.EQUIPO || '—'), badge: badge('danger', T('rca_pend')), meta: `<span class="mono">${esc(o.folio || '')}</span>` + (o.FECHA ? ' · ' + esc(i18n.fmtDate(o.FECHA, 'dayMonth')) : '') })) });
    // 6) Mis solicitudes de repuesto (pendientes en almacén)
    const sol = (D.misSol || []);
    if (sol.length) cards.push({ id: 'solicitudes', ic: 'package', tono: 'info', titulo: T('c_solicitudes'), n: sol.length, score: 40,
      items: sol.map(s => ({ href: s.otFolio ? 'bitacora.html#buscar=' + encodeURIComponent(s.otFolio) : 'bitacora.html#historial', t: esc(s.descripcion || s.codigo || '—'), meta: [esc(T('pide', { n: s.cantidad })), esc(s.equipo || s.equipoNombre || ''), s.otFolio ? `<span class="mono">${esc(s.otFolio)}</span>` : ''].filter(Boolean).join(' · ') })) });
    // 7) Herramientas por aceptar
    const herr = (D.herr || []).filter(a => a.estado === 'activa' || !a.estado);
    if (herr.length) cards.push({ id: 'herramientas', ic: 'hammer', tono: 'info', titulo: T('c_herramientas'), n: herr.length, score: 45, mas: { href: 'herramientas.html#mis' },
      items: herr.map(a => ({ href: 'herramientas.html#mis', t: esc(a.nombre || a.codigo || '—'), meta: `<span class="mono">${esc(a.codigo || '')}</span>` })) });
    // ── Supervisión ──
    if (esSup()) {
      const perm = (D.porAutorizar || []).filter(enNave);
      if (perm.length) cards.push({ id: 'permisos', ic: 'shield-check', tono: 'danger', titulo: T('c_permisos'), n: perm.length, score: 90, mas: { href: 'bitacora.html#avisos' },
        items: perm.map(p => ({ href: 'bitacora.html#avisos', t: esc(p.equipoNombre || '—'), meta: esc(p.tecnico || '') + (p.riesgos ? ' · ' + esc(Object.keys(p.riesgos).filter(k => p.riesgos[k] === true).join(', ')) : ''), desc: p.nota ? (window.traductor ? traductor.html(p, 'nota') : esc(p.nota)) : '' })) });
      const rev = abiertas.filter(o => o.estado === 'en_revision');
      if (rev.length) cards.push({ id: 'validar', ic: 'check-circle', tono: 'warn', titulo: T('c_validar'), n: rev.length, score: 65, mas: { href: 'bitacora.html#validar' },
        items: rev.map(o => ({ href: 'bitacora.html#validar', t: esc(o.equipoNombre || o.EQUIPO || '—'), badge: badge('mut', T('revision')), meta: `<span class="mono">${esc(o.folio || '')}</span>` + (o.TECNICOS ? ' · ' + esc(o.TECNICOS) : ''), desc: tx(o, o.DESCRIPCION_SOLUCION ? 'DESCRIPCION_SOLUCION' : 'descripcionFalla') })) });
      const rcaVal = rcas.filter(o => rcaEstado(o) === 'por_validar');
      if (rcaVal.length) cards.push({ id: 'rcaVal', ic: 'search-check', tono: 'warn', titulo: T('c_rcaVal'), n: rcaVal.length, score: 50,
        items: rcaVal.map(o => ({ href: o.equipoId ? 'hoja-vida.html?id=' + encodeURIComponent(o.equipoId) + '#cardRca' : 'analisis.html#rca', t: esc(o.EQUIPO || '—'), badge: badge('warn', T('rca_val')), meta: `<span class="mono">${esc(o.folio || '')}</span>`, desc: o.rca && o.rca.causa ? (window.traductor ? traductor.html(o, 'rca.causa', { col: 'ots' }) : esc(o.rca.causa)) : '' })) });
      let tend = null; try { tend = JSON.parse(localStorage.getItem('vtTendSnap') || 'null'); } catch (e) {}
      if (tend && Date.now() - tend.ts < 36 * 3600 * 1000) {
        const al = (tend.alertas || []).filter(a => a.nivel !== 'cerca' && (!a.equipoId || fbEquipoEnNave({ id: a.equipoId, planta: fbPlantaDeEquipo(a.equipoId) })));
        if (al.length) cards.push({ id: 'tend', ic: 'trend', tono: al.some(a => a.nivel === 'fuera') ? 'danger' : 'warn', titulo: T('c_tend'), n: al.length, score: 58, mas: { href: 'analisis.html#tend' },
          items: al.map(a => ({ href: a.equipoId ? 'hoja-vida.html?id=' + encodeURIComponent(a.equipoId) + '#cardTend' : 'analisis.html#tend', t: esc(a.equipo || '—'), badge: badge(a.nivel === 'fuera' ? 'danger' : 'warn', T('tend_' + a.nivel)), meta: esc(a.punto || '') })) });
      }
      const plan = abiertas.filter(o => o.estado === 'pendiente' && (o.origen === 'checklist' || o.tipoReporte === 'proyecto'));
      if (plan.length) cards.push({ id: 'planificar', ic: 'calendar', tono: 'info', titulo: T('c_planificar'), n: plan.length, score: 62, mas: { href: 'bitacora.html#planificar' },
        items: plan.map(o => ({ href: 'bitacora.html#planificar', t: esc(o.equipoNombre || '—'), badge: badge('mut', o.tipoReporte === 'proyecto' ? T('proyecto') : T('checklist')), meta: `<span class="mono">${esc(o.folio || '')}</span> · ${esc(T('planificar'))}`, desc: tx(o, 'descripcionFalla') })) });
      if (abiertas.length) {
        const a = avisos.length, p = abiertas.filter(o => o.estado === 'planificada').length, rv = rev.length;
        cards.push({ id: 'backlog', ic: 'layers', tono: '', titulo: T('c_backlog'), n: abiertas.length, score: 30, mas: { href: 'analisis.html' },
          cuerpo: `<p class="hoy-p">${esc(T('backlogSub', { a, p, r: rv }))}</p>` });
      }
    }
    // ── Almacén ──
    const alm = (D.almSol || []).filter(enNave);
    if (alm.length) cards.push({ id: 'almSol', ic: 'package', tono: r === ALM ? 'danger' : 'info', titulo: T('c_almSol'), n: alm.length, score: r === ALM ? 80 : 40, mas: { href: 'almacen.html#solicitudes' },
      items: alm.sort((a, b) => (a.creadoEn || 0) - (b.creadoEn || 0)).map(s => ({ href: 'almacen.html#solicitudes', t: esc(s.descripcion || s.codigo || '—'), meta: [esc(T('pide', { n: s.cantidad })), esc(s.tecnico || ''), esc(s.equipo || s.equipoNombre || '')].filter(Boolean).join(' · ') })) });
    const bm = (D.bajoMin || []).filter(x => fbEquipoEnNave({ id: x.eqId, planta: x.planta, localidad: x.localidad }));
    if (bm.length) cards.push({ id: 'bajoMin', ic: 'archive', tono: bm.some(x => x.q <= 0) ? 'danger' : 'warn', titulo: T('c_bajoMin'), n: bm.length, score: 60, mas: { href: 'almacen.html#compras' },
      items: bm.sort((a, b) => a.q - b.q).map(x => ({ href: 'almacen.html?equipo=' + encodeURIComponent(x.eqId), t: esc(x.nombre || '—'), badge: x.q <= 0 ? badge('danger', T('sinStock')) : '', meta: esc(T('stock', { q: x.q, m: x.min == null ? '—' : x.min })) + ' · ' + esc(x.equipo) })) });
    // ── RR.HH. ──
    const cargos = (D.cargos || []);
    if (cargos.length) {
      const total = cargos.reduce((s, a) => s + (Number(a.totalCargo) || 0), 0);
      cards.push({ id: 'cargos', ic: 'coins', tono: 'warn', titulo: T('c_cargos'), n: cargos.length, score: 70, mas: { href: 'herramientas.html#rrhh' },
        cuerpo: `<p class="hoy-p">${esc(T('cargo_total', { m: i18n.fmtMoney(total, 'DOP') }))}</p>`,
        items: cargos.map(a => ({ href: 'herramientas.html#rrhh', t: esc(a.tecnico || '—'), meta: esc(i18n.fmtMoney(Number(a.totalCargo) || 0, 'DOP')) + (a.fecha ? ' · ' + esc(i18n.fmtDate(a.fecha, 'dayMonth')) : '') })) });
    }
    // ── Administrador: indicadores y recordatorios ──
    if (r === ADM) {
      const k = window.VTKpis ? VTKpis.leerSnap() : null; // (v3 etapa 3a) el resumen que calcula Análisis (kpis.js)
      const kv = (l, v) => `<div class="hoy-kpi"><b>${v}</b><small>${esc(l)}</small></div>`;
      const fmtHM = m => (m == null ? '—' : m >= 60 ? Math.floor(m / 60) + 'h ' + Math.round(m % 60) + 'm' : Math.round(m) + ' min');
      cards.push({ id: 'kpis', ic: 'chart', tono: '', titulo: T('c_kpis'), score: 25, mas: { href: 'analisis.html' },
        cuerpo: k ? `<div class="hoy-kpis">${kv(T('kpi_ots'), esc(i18n.fmtNum(k.ots, 0)))}${kv(T('kpi_corr'), k.pctCorr == null ? '—' : esc(i18n.fmtNum(k.pctCorr, 0)) + '%')}${kv(T('kpi_mttr'), esc(fmtHM(k.mttr)))}${kv(T('kpi_disp'), k.disp == null ? '—' : esc(i18n.fmtNum(k.disp, 1)) + '%')}${kv(T('kpi_riesgo'), esc(String(k.riesgo || 0)))}</div><p class="hoy-p sm">${esc(T('kpi_de', { t: i18n.fmtRel(k.ts) }))}</p>`
          : `<p class="hoy-p">${esc(T('kpi_sin'))}</p>` });
      if (D.respaldo) {
        const dias = D.respaldo.ultimo ? Math.floor((Date.now() - D.respaldo.ultimo) / 86400000) : null;
        if (dias == null || dias > 30) cards.push({ id: 'respaldo', ic: 'save', tono: 'warn', titulo: T('c_respaldo'), score: 35,
          cuerpo: `<p class="hoy-p">${esc(dias == null ? T('respaldo_nunca') : T('respaldo_dias', { n: dias }))}</p><a class="vt-btn" href="admin.html#respaldo">${ic('download')}${esc(T('respaldo_acc'))}</a>` });
      }
      let pos = 0; try { pos = +localStorage.getItem('vtPlanPospuesto') || 0; } catch (e) {}
      if (Date.now() - pos > 7 * 86400000) cards.push({ id: 'plan', ic: 'gauge', tono: '', titulo: T('c_plan'), score: 20,
        cuerpo: `<p class="hoy-p">${esc(T('plan_txt'))}</p><div class="hoy-btns"><a class="vt-btn" href="admin.html#uso">${ic('gauge')}${esc(T('plan_acc'))}</a><button type="button" class="vt-btn" data-hoy="posponer">${esc(T('posponer'))}</button></div>` });
    }
    cards.sort((a, b) => b.score - a.score);
    return cards;
  }

  // ── Pintar ──
  let _ultimo = null;
  function saludo() {
    const h = new Date().getHours();
    const u = window.currentUserRole || {};
    const nombre = String(u.nombre || '').split(/\s+/)[0] || '';
    return T(h < 12 ? 'saludo_m' : h < 19 ? 'saludo_t' : 'saludo_n', { n: nombre });
  }
  function render(D) {
    const box = document.getElementById('hoy'); if (!box) return;
    _ultimo = D;
    const cards = construir(D);
    const urgentes = cards.filter(c => c.n != null && !['backlog', 'kpis'].includes(c.id)).reduce((s, c) => s + (c.score >= 60 ? c.n : 0), 0);
    if (window.VTShell) VTShell.setBadge(urgentes);
    const naveTxt = typeof fbNaveTexto === 'function' ? (fbNaveActiva() || (fbMisNaves() ? S('misNaves') : S('todasNaves'))) : '';
    const reales = cards.filter(c => !['kpis', 'plan', 'respaldo'].includes(c.id));
    box.innerHTML = `<div class="hoy-hi"><div><h1>${esc(saludo())}</h1><p>${esc(i18n.fmtDate(new Date(), 'weekday'))}${naveTxt ? ' · ' + esc(naveTxt) : ''}</p></div>
        <button type="button" class="vt-ib" data-hoy="recargar" aria-label="${esc(T('actualizar'))}" title="${esc(T('actualizar'))}">${ic('refresh')}</button></div>`
      + (navigator.onLine === false ? `<div class="hoy-off" role="status">${ic('wifi-off', 'sm')} ${esc(T('offline'))}</div>` : '')
      + (D.errores && D.errores.length ? `<div class="hoy-off" role="status">${ic('alert', 'sm')} ${esc(T('error', { e: D.errores.join(', ') }))}</div>` : '')
      + (!reales.length ? `<section class="hoy-ok" data-card="alDia">${ic('check-circle', 'xl')}<h2>${esc(T('alDia'))}</h2><p>${esc(T('alDiaSub'))}</p></section>` : '')
      + `<div class="hoy-cards">${cards.map(card).join('')}</div>`
      + `<p class="hoy-ts">${esc(T('actualizado', { t: i18n.fmtRel(D.ts || Date.now()) }))} · <a href="index.html#todo">${esc(T('todo'))}</a></p>`;
    window.__hoy = { cards: cards.map(c => ({ id: c.id, n: c.n, score: c.score })), lecturas: (window.__fbReads || []).reduce((s, x) => s + (x.n || 0), 0) };
  }
  async function mostrar(forzar) {
    const box = document.getElementById('hoy'); if (!box) return;
    if (!_ultimo) box.innerHTML = `<div class="hoy-hi"><div><h1>${esc(saludo())}</h1><p>${esc(T('cargando'))}</p></div></div><div class="hoy-sk"></div><div class="hoy-sk"></div>`;
    try { render(await cargar(forzar)); }
    catch (e) { console.warn('Hoy:', e); box.innerHTML = `<div class="hoy-off">${esc(T('error', { e: (e && e.message) || e }))}</div>`; }
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-hoy]'); if (!b) return;
    if (b.getAttribute('data-hoy') === 'recargar') mostrar(true);
    if (b.getAttribute('data-hoy') === 'posponer') { try { localStorage.setItem('vtPlanPospuesto', String(Date.now())); } catch (x) {} if (_ultimo) render(_ultimo); }
  });
  window.addEventListener('idioma-cambiado', () => { if (_ultimo) render(_ultimo); });
  window.addEventListener('online', () => { if (_ultimo) render(_ultimo); });
  window.addEventListener('offline', () => { if (_ultimo) render(_ultimo); });
  window.VTHoy = { cargar, construir, render, mostrar, rcaEstado };
})();
