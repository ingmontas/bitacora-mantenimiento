// criticidad.js — (28 oct 2026) CRITICIDAD A / B / C POR EQUIPO
// ══════════════════════════════════════════════════════════════════════
// Práctica de mantenimiento de clase mundial: no todas las máquinas pesan
// igual. Cada equipo se evalúa con 5 preguntas (seguridad, producción,
// calidad, costo de reparación y qué tan seguido falla) y queda:
//   A · Crítico     riesgo GRAVE para personas o ambiente, o 19 puntos o más
//   B · Importante  de 13 a 17 puntos, o si al fallar para la línea / planta
//   C · Normal      11 puntos o menos
// Cada respuesta vale 1, 3 o 5 puntos (total de 5 a 25, siempre impar). El Administrador
// puede cambiar el nivel calculado escribiendo el motivo.
//
// Datos (campos NUEVOS y opcionales en /equipos/{id}; nada se borra):
//   criticidad         'A' | 'B' | 'C'   (sin el campo = "Sin evaluar")
//   criticidadDetalle  { seguridad, produccion, calidad, costo, frecuencia,
//                        puntos, calculada, regla, manual, motivo,
//                        correctivos12m }   ó  { origen: 'importado', motivo }
//   criticidadPor      nombre de quien evaluó
//   criticidadEn       fecha y hora ISO (texto: así "Deshacer" / restaurar
//                      equipo en Inventario no la cambia de tipo)
// Quién: Encargado de mantenimiento y Administrador (también en
// firestore.rules). Lecturas: NINGUNA extra — todo sale del catálogo de
// equipos con caché de 12 h (fbEquiposCatalogo). Solo el asistente, al abrir
// un equipo, lee sus OTs (fbOtsDeEquipo, en memoria por página) para sugerir
// la frecuencia de fallas. Al guardar se corrige la copia del celular (índice
// de equipos + catálogo en caché) para que todas las pantallas lo vean ya.
// Esta misma hoja trae la ventana inferior (fbSheet) que usa seguridad.js.
// ══════════════════════════════════════════════════════════════════════
(function () {
  const NIVELES = {
    A: { t: 'A · Crítico', c: 'fbc-A', d: 'Si falla hay riesgo grave o se pierde mucho. Primero en la cola, con LOTO siempre.' },
    B: { t: 'B · Importante', c: 'fbc-B', d: 'Afecta la producción o la calidad, pero hay forma de seguir.' },
    C: { t: 'C · Normal', c: 'fbc-C', d: 'Si falla, el impacto es bajo.' },
  };
  const PREGUNTAS = [
    { k: 'seguridad', corto: 'Personas / ambiente', q: '¿Si falla, hay riesgo para las personas o el ambiente?', ops: [
      [1, 'No, ninguno', 'Nadie se puede lastimar por esta falla'],
      [3, 'Sí, algo leve', 'Una cortada, un golpe o un derrame pequeño'],
      [5, 'Sí, grave', 'Lesión seria, incendio, explosión o daño al ambiente'],
    ] },
    { k: 'produccion', corto: 'Producción', q: '¿Si falla, qué le pasa a la producción?', ops: [
      [1, 'No le pasa nada', 'Hay otra máquina o se puede esperar'],
      [3, 'Baja la producción', 'La línea sigue, pero más lenta'],
      [5, 'Para la línea o la planta', 'No se produce hasta que se arregle'],
    ] },
    { k: 'calidad', corto: 'Calidad', q: '¿Si falla, afecta la calidad del producto?', ops: [
      [1, 'No', 'El producto sale igual'],
      [3, 'Un poco', 'Hay que reprocesar o separar producto'],
      [5, 'Mucho', 'Producto malo que llega al cliente o se bota'],
    ] },
    { k: 'costo', corto: 'Costo de reparación', q: '¿Cuánto cuesta y cuánto tarda repararlo?', ops: [
      [1, 'Poco', 'Piezas en almacén, se arregla en horas'],
      [3, 'Medio', 'Hay que comprar piezas o tarda un día o dos'],
      [5, 'Mucho', 'Pieza cara o importada, o tarda días / semanas'],
    ] },
    { k: 'frecuencia', corto: 'Qué tan seguido falla', q: '¿Qué tan seguido falla?', ops: [
      [1, 'Casi nunca', '2 veces al año o menos'],
      [3, 'A veces', 'De 3 a 11 veces al año'],
      [5, 'Seguido', '12 veces al año o más (una vez al mes o más)'],
    ] },
  ];
  const CAMPOS = ['criticidad', 'criticidadDetalle', 'criticidadPor', 'criticidadEn'];
  const esc = s => fbEsc(s);
  const rol = (...r) => typeof userHasRole === 'function' && userHasRole(...r);
  const puedeEvaluar = () => rol('ADMINISTRADOR', 'ENCARGADO_MANTENIMIENTO');
  const puedeCambiarNivel = () => rol('ADMINISTRADOR');
  const quien = () => (window.currentUserRole && window.currentUserRole.nombre) || (window.currentUser && window.currentUser.email) || '';
  function aviso(msg, tipo) {
    if (typeof window.showToast === 'function') return window.showToast(msg, tipo === 'warn' ? 'warn' : tipo === 'error' ? 'error' : undefined);
    if (typeof window.toast === 'function') return window.toast(msg, tipo);
    try { console.log(msg); } catch (e) {}
  }

  // ── Cálculo ──
  // Umbrales transparentes (se muestran tal cual en el asistente):
  function calcular(det) {
    det = det || {};
    const pts = PREGUNTAS.reduce((s, p) => s + (Number(det[p.k]) || 0), 0);
    const completo = PREGUNTAS.every(p => [1, 3, 5].includes(Number(det[p.k])));
    let nivel = '', regla = '';
    if (completo) {
      if (Number(det.seguridad) === 5) { nivel = 'A'; regla = 'seguridad'; }
      else if (pts >= 19) { nivel = 'A'; regla = 'puntos'; }
      else if (pts >= 13) { nivel = 'B'; regla = 'puntos'; }
      else if (Number(det.produccion) === 5) { nivel = 'B'; regla = 'produccion'; }
      else { nivel = 'C'; regla = 'puntos'; }
    }
    return { puntos: pts, nivel, regla, completo };
  }
  const UMBRALES = [
    ['A', 'Riesgo GRAVE para personas o ambiente, o 19 puntos o más'],
    ['B', 'De 13 a 17 puntos, o si al fallar para la línea o la planta'],
    ['C', '11 puntos o menos'],
  ];
  function umbralesHtml(res) {
    return `<div class="fbsh-caja" data-umbrales><b>¿Cómo se calcula?</b> Cada respuesta vale 1, 3 o 5 puntos (total de 5 a 25).
      <table style="margin-top:6px;">${UMBRALES.map(([n, t]) => `<tr${res && res.nivel === n ? ' style="font-weight:800"' : ''}><td style="width:1%;white-space:nowrap;">${badge(n)}</td><td>${esc(t)}${res && res.nivel === n ? ' ←' : ''}</td></tr>`).join('')}</table></div>`;
  }

  // ── Lectura (0 lecturas: objeto del catálogo o índice del celular) ──
  function nivelDe(e) {
    if (!e) return '';
    if (typeof e === 'string') return typeof fbCriticidadDeEquipo === 'function' ? fbCriticidadDeEquipo(e) : '';
    if (['A', 'B', 'C'].includes(e.criticidad)) return e.criticidad;
    return (e.id && typeof fbCriticidadDeEquipo === 'function') ? fbCriticidadDeEquipo(e.id) : '';
  }
  function badge(n, opts) {
    opts = opts || {};
    if (!NIVELES[n]) return opts.vacio ? `<span class="fbc fbc-N" title="Criticidad sin evaluar">${opts.corto ? '—' : 'Sin evaluar'}</span>` : '';
    return `<span class="fbc ${NIVELES[n].c}" data-crit="${n}" title="Criticidad ${esc(NIVELES[n].t)}">${opts.corto ? n : NIVELES[n].t}</span>`;
  }
  const texto = n => NIVELES[n] ? NIVELES[n].t : 'Sin evaluar';
  const orden = n => ({ A: 0, B: 1, C: 2 }[n] ?? 3);

  // ── Oyentes: las pantallas se repintan cuando cambia una criticidad ──
  const _oyentes = [];
  function onCambio(cb) { if (typeof cb === 'function') _oyentes.push(cb); }
  function avisarCambio(ids) {
    _oyentes.forEach(cb => { try { cb(ids); } catch (e) { console.error(e); } });
    // Catálogo de 12 h: se vuelve a entregar la copia del celular (ya trae lo
    // que se acaba de guardar; 0 lecturas del servidor).
    if (typeof fbRefrescarEquipos === 'function') setTimeout(() => fbRefrescarEquipos(true).catch(() => {}), 50);
  }

  // ── Guardar (sin esperar al servidor: sin señal se sube después) ──
  // lista: [{ eq, nivel, detalle }]. Devuelve la promesa del servidor.
  function guardarVarios(lista) {
    if (!lista.length) return Promise.resolve();
    const por = quien(), en = new Date().toISOString();
    const previos = [];
    const lotes = [];
    for (let i = 0; i < lista.length; i += 400) {
      const b = db.batch();
      lista.slice(i, i + 400).forEach(({ eq, nivel, detalle }) => {
        const datos = { criticidad: nivel, criticidadDetalle: detalle, criticidadPor: por, criticidadEn: en };
        const ant = {}; CAMPOS.forEach(k => { ant[k] = eq[k]; });
        previos.push({ eq, ant, antIdx: nivelDe(eq.id) });
        b.update(db.collection('equipos').doc(eq.id), datos);
        Object.assign(eq, datos);
        if (typeof fbIndiceCriticidad === 'function') fbIndiceCriticidad(eq.id, nivel);
      });
      lotes.push(b.commit());
    }
    avisarCambio(lista.map(x => x.eq.id));
    return Promise.all(lotes).catch(err => {
      // El servidor lo rechazó: se deshace en este celular.
      previos.forEach(({ eq, ant, antIdx }) => { CAMPOS.forEach(k => { if (ant[k] === undefined) delete eq[k]; else eq[k] = ant[k]; }); if (typeof fbIndiceCriticidad === 'function') fbIndiceCriticidad(eq.id, antIdx); });
      avisarCambio(lista.map(x => x.eq.id));
      aviso(err && err.code === 'permission-denied' ? '⛔ No se guardó la criticidad: solo el Encargado o el Administrador pueden cambiarla.' : '❌ No se guardó la criticidad: ' + ((err && err.message) || err), 'error');
      throw err;
    });
  }

  // ── Ventana inferior compartida (también la usa seguridad.js) ──
  let _sheet = null;
  function sheet(html, opts) {
    opts = opts || {};
    cerrarSheet(true);
    const bg = document.createElement('div');
    bg.className = 'fbsh-bg'; bg.id = opts.id || 'fbSheet';
    bg.innerHTML = `<div class="fbsh" role="dialog" aria-modal="true"></div>`;
    const el = bg.firstChild;
    el.innerHTML = html;
    const s = { bg, el, opts, set(h) { el.innerHTML = h; el.scrollTop = 0; }, close: () => cerrarSheet() };
    bg.addEventListener('click', e => { if (e.target === bg && !opts.fijo) cerrarSheet(); });
    document.body.appendChild(bg);
    _sheet = s;
    return s;
  }
  function cerrarSheet(silencio) {
    if (!_sheet) return;
    const s = _sheet; _sheet = null;
    s.bg.remove();
    if (!silencio && s.opts.onClose) { try { s.opts.onClose(); } catch (e) { console.error(e); } }
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && _sheet && !_sheet.opts.fijo) cerrarSheet(); });

  // ── Frecuencia sugerida con las OTs de la app (correctivos en 12 meses) ──
  function sugerirFrecuencia(eq) {
    if (typeof fbOtsDeEquipo !== 'function' || !eq || !eq.id) return Promise.resolve(null);
    return fbOtsDeEquipo(eq).then(ots => {
      const desde = fbFechaLocal(new Date(Date.now() - 365 * 86400000));
      const n = otsDelEquipo(eq, ots).filter(o => String(o.TIPO_MANTENIMIENTO || '').toLowerCase() === 'correctivo' && String(o.FECHA || '') >= desde).length;
      return { n, valor: n >= 12 ? 5 : n >= 3 ? 3 : 1 };
    }).catch(() => null);
  }

  // ══════ ASISTENTE (5 preguntas) ══════
  function catalogoMem() { return _cat || []; }
  function buscarEquipo(x) {
    if (x && typeof x === 'object') return x;
    return catalogoMem().find(e => e.id === x) || null;
  }
  function abrirAsistente(equipo, opts) {
    opts = opts || {};
    if (!puedeEvaluar()) { aviso('⛔ La criticidad la evalúa el Encargado de mantenimiento o el Administrador.', 'error'); return; }
    const pedir = equipo && typeof equipo === 'object' ? Promise.resolve(equipo) : cargarCatalogo().then(() => buscarEquipo(equipo));
    pedir.then(eq => {
      if (!eq) { aviso('Equipo no encontrado', 'error'); return; }
      const prev = eq.criticidadDetalle || {};
      const st = { eq, paso: 0, det: {}, sug: null, cambio: '', motivo: '' };
      PREGUNTAS.forEach(p => { if ([1, 3, 5].includes(Number(prev[p.k]))) st.det[p.k] = Number(prev[p.k]); });
      if (prev.manual && prev.calculada !== eq.criticidad) { st.cambio = eq.criticidad || ''; st.motivo = prev.motivo || ''; }
      const s = sheet('', { id: 'fbCritSheet', onClose: opts.onClose });
      const pintar = () => s.set(st.paso < PREGUNTAS.length ? htmlPregunta(st) : htmlResultado(st));
      s.el.addEventListener('click', ev => {
        const b = ev.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'x') return cerrarSheet();
        if (a === 'op') { st.det[PREGUNTAS[st.paso].k] = +b.dataset.v; st.paso++; return pintar(); }
        if (a === 'atras') { st.paso = Math.max(0, st.paso - 1); return pintar(); }
        if (a === 'ir') { st.paso = +b.dataset.p; return pintar(); }
        if (a === 'guardar') return guardarAsistente(st, s, opts);
      });
      s.el.addEventListener('change', ev => { if (ev.target.id === 'fbcCambio') { st.cambio = ev.target.value; pintar(); } });
      s.el.addEventListener('input', ev => { if (ev.target.id === 'fbcMotivo') st.motivo = ev.target.value; });
      pintar();
      sugerirFrecuencia(eq).then(sug => { st.sug = sug; if (_sheet === s && st.paso === PREGUNTAS.length - 1) pintar(); });
    });
  }
  function cabecera(st) {
    return `<div class="fbsh-head"><div><h3>🎯 Criticidad del equipo</h3><small>${esc(st.eq.nombre || '')}${st.eq.localidad ? ' · ' + esc(st.eq.localidad) : ''}</small></div>
      <button type="button" class="fbsh-x" data-a="x" aria-label="Cerrar">✕</button></div>`;
  }
  function htmlPregunta(st) {
    const p = PREGUNTAS[st.paso];
    const sel = st.det[p.k];
    let sug = '';
    if (p.k === 'frecuencia') {
      sug = st.sug ? `<div class="fbsh-caja info" data-sug="${st.sug.valor}">📊 Según la Bitácora: <b>${st.sug.n} correctivo${st.sug.n === 1 ? '' : 's'}</b> en los últimos 12 meses → sugerido <b>${esc(p.ops.find(o => o[0] === st.sug.valor)[1])}</b>.</div>` : `<div class="fbsh-nota">Buscando cuántos correctivos tuvo en la Bitácora…</div>`;
    }
    const marcado = sel || (p.k === 'frecuencia' && st.sug ? st.sug.valor : 0);
    return cabecera(st)
      + `<div class="fbsh-dots">${PREGUNTAS.map((x, i) => `<i class="${i <= st.paso ? 'on' : ''}"></i>`).join('')}</div>
      <div class="fbsh-nota">Pregunta ${st.paso + 1} de ${PREGUNTAS.length}</div>
      <div class="fbsh-t" style="font-size:16.5px;">${esc(p.q)}</div>${sug}
      ${p.ops.map(([v, t, d]) => `<button type="button" class="fbsh-op${marcado === v ? ' sel' : ''}" data-a="op" data-v="${v}"><span class="pt">${v} ${v === 1 ? 'punto' : 'puntos'}</span>${esc(t)}<small>${esc(d)}</small></button>`).join('')}
      <div class="fbsh-acc">${st.paso ? '<button type="button" class="fbsh-btn sec" data-a="atras">← Atrás</button>' : ''}
        ${PREGUNTAS.every(x => st.det[x.k]) ? `<button type="button" class="fbsh-btn sec" data-a="ir" data-p="${PREGUNTAS.length}">Ver resultado →</button>` : ''}</div>
      <details style="margin-top:10px;"><summary style="cursor:pointer;font-weight:700;min-height:40px;display:flex;align-items:center;">¿Cómo se calcula?</summary>${umbralesHtml(null)}</details>`;
  }
  function htmlResultado(st) {
    const r = calcular(st.det);
    const final = st.cambio && st.cambio !== r.nivel ? st.cambio : r.nivel;
    const filas = PREGUNTAS.map((p, i) => { const v = st.det[p.k]; const op = p.ops.find(o => o[0] === v); return `<tr><td>${esc(p.corto)}<br><span style="color:var(--color-muted)">${esc(op ? op[1] : '—')}</span></td><td class="n"><button type="button" class="fbsh-btn sec sm" data-a="ir" data-p="${i}" aria-label="Cambiar ${esc(p.corto)}">${v || '—'} pts ✎</button></td></tr>`; }).join('');
    const porque = r.regla === 'seguridad' ? 'porque hay riesgo grave para las personas o el ambiente' : r.regla === 'produccion' ? 'porque al fallar para la línea o la planta' : `por los puntos (${r.puntos} de 25)`;
    return cabecera(st)
      + `<div class="fbsh-res" data-resultado="${esc(final)}">${badge(final)}<div class="pts">${r.puntos} de 25 puntos · calculado ${esc(texto(r.nivel))} ${esc(porque)}</div>
        ${final !== r.nivel ? `<div class="fbsh-caja warn" style="text-align:left;">Nivel cambiado por el Administrador (calculado: ${esc(texto(r.nivel))}).</div>` : ''}</div>
      <table>${filas}</table>
      ${umbralesHtml(r)}
      ${puedeCambiarNivel() ? `<div class="fbsh-sec"><b>¿No estás de acuerdo? (solo Administrador)</b>
        <select id="fbcCambio" aria-label="Cambiar el nivel"><option value="">Dejar el calculado (${esc(texto(r.nivel))})</option>${['A', 'B', 'C'].filter(n => n !== r.nivel).map(n => `<option value="${n}"${st.cambio === n ? ' selected' : ''}>Cambiar a ${esc(texto(n))}</option>`).join('')}</select>
        ${st.cambio && st.cambio !== r.nivel ? `<textarea id="fbcMotivo" maxlength="300" placeholder="Motivo del cambio (obligatorio)">${esc(st.motivo)}</textarea>` : ''}</div>` : ''}
      <div class="fbsh-err" id="fbcErr"></div>
      <div class="fbsh-acc"><button type="button" class="fbsh-btn sec" data-a="atras">← Atrás</button><button type="button" class="fbsh-btn ok" data-a="guardar">💾 Guardar ${esc(texto(final))}</button></div>`;
  }
  function guardarAsistente(st, s, opts) {
    const r = calcular(st.det);
    if (!r.completo) { st.paso = PREGUNTAS.findIndex(p => !st.det[p.k]); s.set(htmlPregunta(st)); return; }
    const manual = !!(st.cambio && st.cambio !== r.nivel && puedeCambiarNivel());
    const motivo = (st.motivo || '').trim();
    if (manual && !motivo) { const e = s.el.querySelector('#fbcErr'); if (e) e.textContent = 'Escribe el motivo del cambio.'; const t = s.el.querySelector('#fbcMotivo'); if (t) t.focus(); return; }
    const nivel = manual ? st.cambio : r.nivel;
    const detalle = { seguridad: st.det.seguridad, produccion: st.det.produccion, calidad: st.det.calidad, costo: st.det.costo, frecuencia: st.det.frecuencia,
      puntos: r.puntos, calculada: r.nivel, regla: r.regla, manual };
    if (manual) detalle.motivo = motivo.slice(0, 300);
    if (st.sug) detalle.correctivos12m = st.sug.n;
    const sinSenal = typeof navigator !== 'undefined' && navigator.onLine === false;
    guardarVarios([{ eq: st.eq, nivel, detalle }]).then(() => { if (sinSenal) aviso('☁️ Criticidad de ' + (st.eq.nombre || '') + ' subida al servidor'); }).catch(() => {});
    aviso(sinSenal ? '💾 Criticidad guardada en el celular — se sube al volver la señal' : '✅ ' + (st.eq.nombre || 'Equipo') + ': ' + texto(nivel), sinSenal ? 'warn' : undefined);
    cerrarSheet(true);
    if (opts.onGuardado) { try { opts.onGuardado(nivel, st.eq); } catch (e) { console.error(e); } }
  }

  // ══════ LISTA "EVALUAR CRITICIDAD" (equipos de la nave elegida) ══════
  let _cat = null;
  function cargarCatalogo() {
    return fbEquiposCatalogo(false).then(sn => { _cat = sn.docs.map(d => ({ id: d.id, ...(d.data() || {}) })); return _cat; });
  }
  function equiposNave() {
    return catalogoMem().filter(e => e.nombre && e.activo !== false && (typeof fbEquipoEnNave !== 'function' || fbEquipoEnNave(e)))
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es', { numeric: true }));
  }
  function abrirLista(opts, st0) {
    opts = opts || {};
    if (!puedeEvaluar()) { aviso('⛔ La criticidad la evalúa el Encargado de mantenimiento o el Administrador.', 'error'); return; }
    const st = st0 || { filtro: 'todos', q: '', vista: 'lista', previa: null };
    const s = sheet('<div class="fbsh-nota">Cargando equipos…</div>', { id: 'fbCritLista', onClose: opts.onClose });
    const pintar = () => { if (_sheet !== s && !document.getElementById('fbCritLista')) return; s.set(st.vista === 'importar' ? htmlImportar(st) : htmlLista(st)); };
    const pintarFilas = () => { const c = s.el.querySelector('#fbcFilas'); if (c) c.innerHTML = filasLista(st); else pintar(); };
    s.el.addEventListener('click', ev => {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'x') return cerrarSheet();
      if (a === 'f') { st.filtro = b.dataset.f; return pintar(); }
      if (a === 'eval') {
        const eq = catalogoMem().find(e => e.id === b.dataset.id);
        return abrirAsistente(eq, { onGuardado: () => setTimeout(() => abrirLista(opts, st), 0), onClose: () => setTimeout(() => abrirLista(opts, st), 0) });
      }
      if (a === 'imp') { st.vista = 'importar'; st.previa = null; return pintar(); }
      if (a === 'volver') { st.vista = 'lista'; return pintar(); }
      if (a === 'archivo') { const f = s.el.querySelector('#fbcArchivo'); if (f) f.click(); return; }
      if (a === 'plantilla') return plantilla();
      if (a === 'revisar') { st.previa = revisarImport(s.el.querySelector('#fbcPegar').value); st.texto = s.el.querySelector('#fbcPegar').value; return pintar(); }
      if (a === 'guardarImp') {
        if (!st.previa || !st.previa.listos.length) return;
        const n = st.previa.listos.length;
        const sinSenal = navigator.onLine === false;
        guardarVarios(st.previa.listos.map(x => ({ eq: x.eq, nivel: x.nivel, detalle: x.motivo ? { origen: 'importado', motivo: x.motivo } : { origen: 'importado' } })))
          .then(() => { if (sinSenal) aviso('☁️ Criticidad de ' + n + ' equipo(s) subida'); }).catch(() => {});
        aviso(sinSenal ? `💾 Criticidad de ${n} equipo(s) guardada en el celular — se sube al volver la señal` : `✅ Criticidad de ${n} equipo(s) guardada`, sinSenal ? 'warn' : undefined);
        st.vista = 'lista'; st.previa = null; st.texto = '';
        return pintar();
      }
    });
    s.el.addEventListener('input', ev => { if (ev.target.id === 'fbcBuscar') { st.q = ev.target.value; pintarFilas(); } });
    s.el.addEventListener('change', ev => {
      if (ev.target.id !== 'fbcArchivo') return;
      const f = ev.target.files && ev.target.files[0]; ev.target.value = '';
      if (!f) return;
      leerArchivo(f).then(txt => { st.texto = txt; st.previa = revisarImport(txt); pintar(); }).catch(e => aviso('No se pudo leer el archivo: ' + e.message, 'error'));
    });
    cargarCatalogo().then(pintar).catch(e => s.set(`<div class="fbsh-caja err">No se pudieron leer los equipos: ${esc(e.message)}</div><div class="fbsh-acc"><button type="button" class="fbsh-btn sec" data-a="x">Cerrar</button></div>`));
    window.__fbCritLista = st;
  }
  function conteos(lista) {
    const c = { A: 0, B: 0, C: 0, N: 0 };
    lista.forEach(e => { const n = nivelDe(e); c[n || 'N']++; });
    return c;
  }
  function htmlLista(st) {
    const lista = equiposNave();
    const c = conteos(lista), tot = lista.length, ev = tot - c.N;
    const pct = tot ? Math.round(ev / tot * 100) : 0;
    const F = [['todos', 'Todos', tot], ['N', 'Sin evaluar', c.N], ['A', 'A', c.A], ['B', 'B', c.B], ['C', 'C', c.C]];
    return `<div class="fbsh-head"><div><h3>🎯 Evaluar criticidad</h3><small>🏭 ${esc(typeof fbNaveTexto === 'function' ? fbNaveTexto() : '')}</small></div><button type="button" class="fbsh-x" data-a="x" aria-label="Cerrar">✕</button></div>
      <div style="font-weight:800;" id="fbcProgreso">${ev} de ${tot} evaluados</div>
      <div class="fbsh-prog"><i style="width:${pct}%"></i></div>
      <div class="fbsh-nota">A ${c.A} · B ${c.B} · C ${c.C} · Sin evaluar ${c.N}</div>
      <div class="fbsh-filtros">${F.map(([k, t, n]) => `<button type="button" data-a="f" data-f="${k}" class="${st.filtro === k ? 'sel' : ''}">${esc(t)} (${n})</button>`).join('')}</div>
      <input type="search" id="fbcBuscar" placeholder="Buscar equipo o área…" value="${esc(st.q)}" autocomplete="off" aria-label="Buscar equipo"/>
      <div id="fbcFilas">${filasLista(st)}</div>
      <div class="fbsh-acc"><button type="button" class="fbsh-btn sec" data-a="imp">📥 Cargar desde Excel o pegar</button></div>
      <details style="margin-top:8px;"><summary style="cursor:pointer;font-weight:700;min-height:40px;display:flex;align-items:center;">¿Cómo se calcula?</summary>${umbralesHtml(null)}</details>`;
  }
  function filasLista(st) {
    const q = fbEquipoKey(st.q || '');
    const lista = equiposNave().filter(e => {
      const n = nivelDe(e);
      if (st.filtro === 'N' && n) return false;
      if (['A', 'B', 'C'].includes(st.filtro) && n !== st.filtro) return false;
      return !q || fbEquipoKey(e.nombre).includes(q) || fbEquipoKey(e.localidad).includes(q);
    });
    if (!lista.length) return '<div class="fbsh-nota" style="padding:14px 0;text-align:center;">No hay equipos en esta lista.</div>';
    return lista.map(e => { const n = nivelDe(e); return `<div class="fbsh-fila" data-eq="${esc(e.id)}"><div><b>${esc(e.nombre)}</b><small>${esc(e.localidad || '')}${e.criticidadPor ? ' · ' + esc(e.criticidadPor) : ''}</small></div>${badge(n, { vacio: true })}<button type="button" class="fbsh-btn sec sm" data-a="eval" data-id="${esc(e.id)}">${n ? 'Cambiar' : 'Evaluar'}</button></div>`; }).join('');
  }

  // ── Carga masiva: Equipo · Criticidad (· Motivo) ──
  function nivelDeTexto(t) {
    const k = fbEquipoKey(t);
    if (!k) return '';
    if (/^(a|critico|critica|alta)$/.test(k) || /^a[·.\-]/.test(k)) return 'A';
    if (/^(b|importante|media)$/.test(k) || /^b[·.\-]/.test(k)) return 'B';
    if (/^(c|normal|baja)$/.test(k) || /^c[·.\-]/.test(k)) return 'C';
    return null;
  }
  function partirFila(linea) {
    let sep = '\t';
    if (!linea.includes('\t')) sep = linea.includes(';') ? ';' : ',';
    const cols = []; let cur = '', q = false;
    for (let i = 0; i < linea.length; i++) {
      const ch = linea[i];
      if (ch === '"') { if (q && linea[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === sep && !q) { cols.push(cur); cur = ''; }
      else cur += ch;
    }
    cols.push(cur);
    return cols.map(c => c.replace(/\s+/g, ' ').trim());
  }
  function revisarImport(txt) {
    const lineas = String(txt || '').split(/\r?\n/).filter(l => l.trim());
    const nave = equiposNave(), todos = catalogoMem();
    const idx = lista => { const m = new Map(); lista.forEach(e => [e.nombre, e.codigo].forEach(n => { const k = fbEquipoKey(n); if (!k) return; m.set(k, m.has(k) && m.get(k) !== e ? null : e); })); return m; };
    const mN = idx(nave), mT = idx(todos);
    const listos = [], noEnc = [], malos = [], repetidos = [], otraNave = [];
    const vistos = new Set();
    lineas.forEach((l, i) => {
      const c = partirFila(l);
      if (i === 0 && /^(equipo|nombre|maquina|máquina)/i.test(c[0] || '')) return; // encabezado
      if (!c[0]) return;
      const k = fbEquipoKey(c[0]);
      const e = mN.get(k);
      if (e === undefined && mT.get(k)) { otraNave.push(c[0]); return; } // solo los equipos de la nave elegida
      if (e === null) { repetidos.push(c[0]); return; }
      if (!e) { noEnc.push(c[0]); return; }
      const n = nivelDeTexto(c[1]);
      if (!n) { malos.push(c[0] + ' (' + (c[1] || 'vacío') + ')'); return; }
      if (vistos.has(e.id)) { const x = listos.find(y => y.eq.id === e.id); x.nivel = n; x.motivo = (c[2] || '').slice(0, 300); return; }
      vistos.add(e.id);
      listos.push({ eq: e, nivel: n, antes: nivelDe(e), motivo: (c[2] || '').slice(0, 300) });
    });
    return { listos, noEnc, malos, repetidos, otraNave };
  }
  function htmlImportar(st) {
    const p = st.previa;
    let prev = '';
    if (p) {
      prev += p.listos.length ? `<div class="fbsh-caja ok" data-listos="${p.listos.length}">✅ ${p.listos.length} equipo(s) listos para guardar</div>` + p.listos.slice(0, 200).map(x => `<div class="fbsh-fila"><div><b>${esc(x.eq.nombre)}</b><small>${x.antes ? 'Antes: ' + esc(texto(x.antes)) : 'Sin evaluar'}${x.motivo ? ' · ' + esc(x.motivo) : ''}</small></div>${badge(x.nivel)}</div>`).join('') : '<div class="fbsh-caja warn">Ningún equipo listo. Revisa los nombres (iguales a Inventario) y la criticidad (A, B o C).</div>';
      if (p.noEnc.length) prev += `<div class="fbsh-caja warn">⚠️ No encontrados en Inventario (no se cargan): ${esc(p.noEnc.join(', '))}</div>`;
      if (p.otraNave.length) prev += `<div class="fbsh-caja warn">⚠️ De otra nave (cambia la nave arriba para cargarlos): ${esc(p.otraNave.join(', '))}</div>`;
      if (p.repetidos.length) prev += `<div class="fbsh-caja warn">⚠️ Nombre repetido en varios equipos (no se carga, evalúalo uno por uno): ${esc(p.repetidos.join(', '))}</div>`;
      if (p.malos.length) prev += `<div class="fbsh-caja warn">⚠️ Criticidad no válida (usa A, B o C): ${esc(p.malos.join(', '))}</div>`;
    }
    return `<div class="fbsh-head"><div><h3>📥 Cargar criticidad</h3><small>Columnas: Equipo · Criticidad (A, B o C) · Motivo (opcional)</small></div><button type="button" class="fbsh-x" data-a="x" aria-label="Cerrar">✕</button></div>
      <div class="fbsh-nota">Pega desde Excel (copiar y pegar las columnas) o abre un archivo .xlsx / .csv. El nombre del equipo debe ser igual al de Inventario. La carga masiva guarda solo el nivel; las 5 preguntas se pueden contestar después.</div>
      <div class="fbsh-acc" style="margin-top:4px;"><button type="button" class="fbsh-btn sec sm" data-a="archivo">📂 Abrir archivo</button><button type="button" class="fbsh-btn sec sm" data-a="plantilla">⬇ Plantilla</button></div>
      <input type="file" id="fbcArchivo" accept=".xlsx,.xls,.csv,.txt" style="display:none"/>
      <textarea id="fbcPegar" style="min-height:120px;font-family:var(--font-mono);font-size:13px;" placeholder="Equipo&#9;Criticidad&#10;WEAVING 5&#9;A&#10;COMPRESOR 2&#9;B">${esc(st.texto || '')}</textarea>
      <div id="fbcPrevia">${prev}</div>
      <div class="fbsh-acc"><button type="button" class="fbsh-btn sec" data-a="volver">← Volver</button><button type="button" class="fbsh-btn sec" data-a="revisar">🔍 Revisar</button>
        <button type="button" class="fbsh-btn ok" data-a="guardarImp" ${p && p.listos.length ? '' : 'disabled'}>💾 Guardar ${p && p.listos.length ? p.listos.length : ''}</button></div>`;
  }
  async function leerArchivo(f) {
    if (/\.(xlsx|xls)$/i.test(f.name)) {
      if (!window.XLSX) await new Promise((ok, mal) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; sc.onload = ok; sc.onerror = () => mal(new Error('No se pudo cargar el lector de Excel. Revisa la conexión o guarda el archivo como CSV.')); document.head.appendChild(sc); });
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      return XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]], { FS: '\t', blankrows: false });
    }
    return f.text();
  }
  function plantilla() {
    const ej = equiposNave().slice(0, 3).map(e => e.nombre);
    const filas = [['Equipo', 'Criticidad', 'Motivo']].concat((ej.length ? ej : ['WEAVING 5', 'COMPRESOR 2']).map((n, i) => [n, ['A', 'B', 'C'][i % 3], '']));
    const csv = '﻿' + filas.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'plantilla-criticidad.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // Resumen de la evaluación para la Hoja de vida (HTML ya escapado).
  function detalleHtml(e) {
    const n = nivelDe(e), d = (e && e.criticidadDetalle) || {};
    if (!n) return `<div>${badge('', { vacio: true })} <span class="fbsh-nota" style="display:inline">Este equipo todavía no tiene criticidad.</span></div>`;
    const cuando = e.criticidadEn ? String(e.criticidadEn).slice(0, 10) : '';
    let h = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${badge(n)}<span style="color:var(--color-muted);font-size:12.5px;">${esc(NIVELES[n].d)}</span></div>`;
    if (PREGUNTAS.every(p => d[p.k])) {
      h += `<table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px;">${PREGUNTAS.map(p => { const op = p.ops.find(o => o[0] === Number(d[p.k])); return `<tr><td style="padding:4px 0;border-bottom:1px dashed var(--color-border);">${esc(p.corto)}</td><td style="padding:4px 0;border-bottom:1px dashed var(--color-border);">${esc(op ? op[1] : '—')}</td><td style="padding:4px 0;border-bottom:1px dashed var(--color-border);text-align:right;font-weight:800;">${esc(d[p.k])}</td></tr>`; }).join('')}
        <tr><td colspan="2" style="padding:4px 0;font-weight:800;">Total</td><td style="padding:4px 0;text-align:right;font-weight:800;">${esc(d.puntos)} / 25</td></tr></table>`;
    } else if (d.origen === 'importado') h += `<div style="font-size:12.5px;color:var(--color-muted);margin-top:6px;">Cargada desde Excel (sin las 5 preguntas).</div>`;
    if (d.manual) h += `<div style="font-size:12.5px;margin-top:6px;">✋ Cambiado por el Administrador (calculado: ${esc(texto(d.calculada))})${d.motivo ? ': ' + esc(d.motivo) : ''}</div>`;
    else if (d.motivo) h += `<div style="font-size:12.5px;margin-top:6px;">Motivo: ${esc(d.motivo)}</div>`;
    h += `<div style="font-size:12px;color:var(--color-muted);margin-top:6px;">Evaluó ${esc(e.criticidadPor || '—')}${cuando ? ' · ' + esc(cuando) : ''}</div>`;
    return h;
  }

  window.FB_CRIT_PREGUNTAS = PREGUNTAS;
  window.fbCritCalcular = calcular;
  window.fbCritNivel = nivelDe;
  window.fbCritBadge = badge;
  window.fbCritTexto = texto;
  window.fbCritOrden = orden;
  window.fbCritPuedeEvaluar = puedeEvaluar;
  window.fbCritAbrirAsistente = abrirAsistente;
  window.fbCritAbrirLista = abrirLista;
  window.fbCritOnCambio = onCambio;
  window.fbCritGuardarVarios = guardarVarios;
  window.fbCritRevisarImport = (t) => revisarImport(t);
  window.fbCritDetalleHtml = detalleHtml;
  window.fbCritUmbralesHtml = umbralesHtml;
  window.fbCritSugerirFrecuencia = sugerirFrecuencia;
  window.fbSheet = sheet;
  window.fbSheetCerrar = cerrarSheet;
  window.fbAviso = aviso;
})();
