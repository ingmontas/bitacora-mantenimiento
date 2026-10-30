// rca.js — (28 oct 2026) ANÁLISIS DE CAUSA RAÍZ (RCA) y AJUSTES DE INDICADORES
// ══════════════════════════════════════════════════════════════════════
// Práctica de clase mundial: cuando una falla se repite (o para mucho tiempo
// un equipo A · Crítico) no basta con repararla: hay que buscar POR QUÉ pasó.
//
// ¿Cuándo se pide? Al registrar o cerrar un CORRECTIVO en la Bitácora si:
//  1) es una REINCIDENCIA: el mismo equipo ya tuvo un trabajo con la MISMA
//     causa de falla hace N días o menos (N = rcaDiasReincidencia, 15 por
//     defecto). Es la MISMA regla del criterio "Calidad" de Incentivos
//     (incentivos.html → calcular(), punto 4): mismo equipo (equipoId o
//     nombre sin acentos/espacios), misma causa, trabajo anterior no anulado
//     ni proyecto, y este correctivo cae entre ese día y N días después
//     (el mismo día solo si empezó después). Incentivos NO se toca.
//  2) o el equipo es A · Crítico y la máquina estuvo parada MÁS de
//     rcaParoMinA minutos (120 por defecto).
// Nunca se bloquea el trabajo del técnico: puede guardar sin llenarlo y queda
// "🔍 RCA pendiente". El Supervisor no puede validar el análisis (ni una OT
// con RCA pendiente en Checklist) hasta que esté lleno (también en las reglas).
//
// Datos (campos NUEVOS de la OT, nada se borra ni se renombra):
//   rcaRequerido  true
//   rcaMotivo     texto corto ("Reincidencia: …" / "Equipo A con paro de …")
//   rca { porques:[5 textos], categoria ('maquina'|'metodo'|'material'|
//         'mano_obra'|'medicion'|'medio_ambiente'), causa, accion,
//         responsable, fechaCompromiso 'AAAA-MM-DD', por, porUid, en (ISO),
//         validada, validadaPor, validadaPorUid, validadaEn,
//         cumplida, cumplidaEn, cumplidaPor }
// Configuración: /config/kpis { horasSemanaTecnico (44), rcaDiasReincidencia
// (15), rcaParoMinA (120) } — la cambia el Administrador (reglas de /config).
// Lecturas: 1 de /config/kpis por celular cada 6 h. La reincidencia se busca
// en las OTs que la Bitácora ya tiene en memoria (0 lecturas).
// Requiere criticidad.js (ventana fbSheet).
// ══════════════════════════════════════════════════════════════════════
(function () {
  const CFG_DEF = { horasSemanaTecnico: 44, rcaDiasReincidencia: 15, rcaParoMinA: 120 };
  const LIM = { horasSemanaTecnico: [1, 84], rcaDiasReincidencia: [0, 90], rcaParoMinA: [0, 10080] };
  const LS_CFG = 'fbKpiCfg', CFG_TTL = 6 * 3600 * 1000;
  const CATS = [
    ['maquina', 'Máquina', 'La máquina misma: desgaste, pieza rota, diseño'],
    ['metodo', 'Método', 'Cómo se hace: procedimiento, ajuste, frecuencia del preventivo'],
    ['material', 'Material', 'Materia prima, repuesto o lubricante malo o equivocado'],
    ['mano_obra', 'Mano de obra', 'Falta de entrenamiento, experiencia, cansancio'],
    ['medicion', 'Medición', 'Instrumento sin calibrar, lectura equivocada'],
    ['medio_ambiente', 'Medio ambiente', 'Polvo, calor, humedad, agua, vibración del lugar'],
  ];
  const catTexto = k => (CATS.find(c => c[0] === k) || [k, k || '—'])[1];
  const esc = s => fbEsc(s);
  const K = s => fbEquipoKey(s);
  const rol = (...r) => typeof userHasRole === 'function' && userHasRole(...r);
  const esSupervisor = () => rol('ADMINISTRADOR', 'ENCARGADO_MANTENIMIENTO', 'SUPERVISOR');
  const uid = () => (window.currentUser && window.currentUser.uid) || '';
  const miNombre = () => { const u = window.currentUserRole || {}; return String(u.tecnico || u.nombre || (window.currentUser && window.currentUser.email) || ''); };
  const aviso = (m, t) => (typeof fbAviso === 'function' ? fbAviso(m, t) : console.log(m));
  const sinSenal = () => typeof navigator !== 'undefined' && navigator.onLine === false;
  const sumarDias = (f, n) => { const d = fbParseFecha(f); if (!d) return ''; d.setDate(d.getDate() + n); return fbFechaLocal(d); };
  const diasEntre = (a, b) => { const x = fbParseFecha(a), y = fbParseFecha(b); return x && y ? Math.round((y - x) / 86400000) : null; };

  // ── Configuración /config/kpis ──
  let _cfg = null, _cfgProm = null;
  function limpiarCfg(d) {
    d = d || {};
    const c = { ...CFG_DEF };
    Object.keys(CFG_DEF).forEach(k => { const v = Number(d[k]); if (d[k] != null && d[k] !== '' && isFinite(v) && v >= LIM[k][0] && v <= LIM[k][1]) c[k] = v; });
    return c;
  }
  function config(forzar) {
    if (_cfg && !forzar) return Promise.resolve(_cfg);
    if (_cfgProm && !forzar) return _cfgProm;
    let copia = null;
    try { copia = JSON.parse(localStorage.getItem(LS_CFG) || 'null'); } catch (e) {}
    if (!forzar && copia && copia.cfg && Date.now() - (copia.t || 0) < CFG_TTL) { _cfg = limpiarCfg(copia.cfg); return Promise.resolve(_cfg); }
    _cfgProm = (async () => {
      try {
        await window.fbReady;
        const s = await db.collection('config').doc('kpis').get();
        _cfg = limpiarCfg(s.exists ? s.data() : null);
        try { localStorage.setItem(LS_CFG, JSON.stringify({ cfg: _cfg, t: Date.now() })); } catch (e) {}
      } catch (e) { _cfg = limpiarCfg(copia && copia.cfg); }
      _cfgProm = null;
      return _cfg;
    })();
    return _cfgProm;
  }
  const configSync = () => _cfg || CFG_DEF;
  function guardarConfig(c) {
    const d = limpiarCfg(c);
    _cfg = d;
    try { localStorage.setItem(LS_CFG, JSON.stringify({ cfg: d, t: Date.now() })); } catch (e) {}
    return db.collection('config').doc('kpis').set({ ...d, actualizadoPor: miNombre(), actualizadoEn: fbTimestamp() }, { merge: true });
  }

  // ── Reincidencia (misma regla que Incentivos, criterio 4) ──
  const anulada = o => o.estado === 'anulada';
  const realizado = o => !anulada(o) && (!(['operador', 'qr', 'checklist'].includes(o.origen) && o.estado !== 'completada') || !!o.reportadoEnBitacora);
  const esProyecto = o => o.tipoReporte === 'proyecto' || String(o.TIPO_MANTENIMIENTO || '').toLowerCase() === 'proyecto';
  const esCorrectivo = o => String(o.TIPO_MANTENIMIENTO || '').toLowerCase() === 'correctivo';
  function mismoEquipo(a, b) {
    if (a.equipoId && b.equipoId) return a.equipoId === b.equipoId;
    const ka = K(a.EQUIPO || a.equipoNombre), kb = K(b.EQUIPO || b.equipoNombre);
    return !!ka && ka === kb;
  }
  // nuevo: el correctivo que se guarda; otras: OTs en memoria. Devuelve la OT
  // anterior que "volvió a fallar" (la más reciente) o null.
  function buscarReincidencia(nuevo, otras, dias) {
    if (!nuevo || !esCorrectivo(nuevo) || esProyecto(nuevo)) return null;
    const causa = K(nuevo.CAUSA_FALLA || nuevo.causaFalla), f = nuevo.FECHA;
    if (!causa || !fbParseFecha(f)) return null;
    dias = Math.max(0, Math.round(dias));
    const hN = fbHoraAMin(nuevo.H_INICIO);
    return (otras || []).filter(p => p && p.id !== nuevo.id && p.FECHA && realizado(p) && !esProyecto(p) && mismoEquipo(p, nuevo)
      && K(p.CAUSA_FALLA || p.causaFalla) === causa && f <= sumarDias(p.FECHA, dias)
      && (p.FECHA < f || (p.FECHA === f && hN != null && fbHoraAMin(p.H_INICIO) != null && hN > fbHoraAMin(p.H_INICIO))))
      .sort((a, b) => String(b.FECHA).localeCompare(String(a.FECHA)) || (fbHoraAMin(b.H_INICIO) || 0) - (fbHoraAMin(a.H_INICIO) || 0))[0] || null;
  }
  function critDe(o) {
    const id = o.equipoId || (typeof fbEquipoIdPorNombre === 'function' ? fbEquipoIdPorNombre(o.EQUIPO || o.equipoNombre) : '');
    return id && typeof fbCriticidadDeEquipo === 'function' ? fbCriticidadDeEquipo(id) : '';
  }
  // ¿Este correctivo necesita RCA? → { requerido, motivo, previa, reincidencia, critico }
  function evaluar(nuevo, otras, cfg) {
    cfg = cfg || configSync();
    const out = { requerido: false, motivo: '', previa: null, reincidencia: false, critico: false };
    if (!nuevo || !esCorrectivo(nuevo) || esProyecto(nuevo)) return out;
    const prev = buscarReincidencia(nuevo, otras, cfg.rcaDiasReincidencia);
    const paro = Math.max(0, Number(nuevo.TOTAL_MIN_MAQUINA) || 0);
    const crit = critDe(nuevo) === 'A' && paro > cfg.rcaParoMinA;
    const partes = [];
    if (prev) {
      const n = diasEntre(prev.FECHA, nuevo.FECHA);
      partes.push(`Reincidencia: volvió a fallar por «${nuevo.CAUSA_FALLA || nuevo.causaFalla}» ${n ? n + (n === 1 ? ' día' : ' días') + ' después de' : 'el mismo día de'} ${prev.folio || prev.Title || prev.id}`);
    }
    if (crit) partes.push(`Equipo A · Crítico con ${paro} min de paro (más de ${cfg.rcaParoMinA})`);
    out.requerido = !!(prev || crit); out.previa = prev; out.reincidencia = !!prev; out.critico = crit;
    out.motivo = partes.join(' · ').slice(0, 300);
    return out;
  }

  // ── Estado del RCA de una OT ──
  const lleno = r => !!(r && typeof r === 'object' && String(r.causa || '').trim());
  function completo(r) {
    if (!r) return false;
    const pq = (Array.isArray(r.porques) ? r.porques : []).filter(x => String(x || '').trim()).length;
    return pq >= 3 && CATS.some(c => c[0] === r.categoria) && !!String(r.causa || '').trim() && !!String(r.accion || '').trim()
      && !!String(r.responsable || '').trim() && !!fbParseFecha(r.fechaCompromiso);
  }
  // 'pendiente' | 'por_validar' | 'validada' | null (no requiere)
  function estado(o) {
    if (!o || o.rcaRequerido !== true) return lleno(o && o.rca) ? (o.rca.validada ? 'validada' : 'por_validar') : null;
    if (!lleno(o.rca)) return 'pendiente';
    return o.rca.validada ? 'validada' : 'por_validar';
  }
  // Acción correctiva: 'cumplida' | 'vencida' | 'abierta' | null
  function estadoAccion(o, hoy) {
    const r = o && o.rca; if (!lleno(r)) return null;
    if (r.cumplida) return 'cumplida';
    hoy = hoy || fbHoy();
    return r.fechaCompromiso && r.fechaCompromiso < hoy ? 'vencida' : 'abierta';
  }
  const ESTADO_TXT = { pendiente: '🔍 RCA pendiente', por_validar: '🔍 RCA por validar', validada: '✅ RCA validado' };
  function badge(o) {
    const e = estado(o); if (!e) return '';
    const cls = e === 'pendiente' ? 'rca-pend' : e === 'por_validar' ? 'rca-val' : 'rca-ok';
    return `<span class="rca-badge ${cls}" data-rca-estado="${e}">${ESTADO_TXT[e]}</span>`;
  }

  // ── Formulario (ventana inferior) ──
  // opts: { titulo, motivo, rca (previo), despues: texto del botón "llenar después" | null,
  //         onGuardar(rca), onDespues(), onVolver() }
  function abrirForm(ot, opts) {
    opts = opts || {};
    const prev = opts.rca || (ot && ot.rca) || {};
    const st = {
      porques: [0, 1, 2, 3, 4].map(i => String((prev.porques || [])[i] || '')),
      categoria: prev.categoria || '', causa: prev.causa || '', accion: prev.accion || '',
      responsable: prev.responsable || miNombre(), fechaCompromiso: prev.fechaCompromiso || sumarDias(fbHoy(), 7), err: '',
    };
    window.__fbRcaForm = st;
    const s = fbSheet('', { id: 'fbRcaSheet', fijo: true });
    const pintar = () => {
      s.set(`<div class="fbsh-head"><div><h3>🔍 Análisis de causa raíz</h3><small>${esc((ot && (ot.EQUIPO || ot.equipoNombre)) || '')}${ot && (ot.folio || ot.Title) ? ' · ' + esc(ot.folio || ot.Title) : ''}</small></div></div>
        ${opts.motivo ? `<div class="fbsh-caja warn" data-rca-motivo>${esc(opts.motivo)}</div>` : ''}
        <div class="fbsh-nota">Pregunta <b>¿por qué?</b> una y otra vez hasta llegar al origen. Mínimo 3 respuestas. Ejemplo: se rompió la correa → ¿por qué? estaba floja → ¿por qué? nadie la tensa → ¿por qué? no está en el preventivo.</div>
        ${st.porques.map((v, i) => `<label class="fbsh-t" style="font-size:13.5px;margin:8px 0 0;" for="fbRcaP${i}">${i + 1}. ¿Por qué?${i < 3 ? ' *' : ''}</label><input type="text" id="fbRcaP${i}" data-pq="${i}" maxlength="200" value="${esc(v)}" placeholder="${i === 0 ? '¿Por qué pasó la falla?' : '¿Y por qué pasó eso?'}"/>`).join('')}
        <div class="fbsh-sec"><b>¿De qué tipo es la causa? (Ishikawa) *</b>
          <div class="rca-cats">${CATS.map(([k, t, d]) => `<button type="button" class="fbsh-op${st.categoria === k ? ' sel' : ''}" data-cat="${k}">${esc(t)}<small>${esc(d)}</small></button>`).join('')}</div></div>
        <div class="fbsh-sec"><b>Causa raíz *</b><textarea id="fbRcaCausa" maxlength="300" placeholder="En una frase: lo que de verdad provocó la falla">${esc(st.causa)}</textarea>
          <b style="margin-top:8px;">Acción para que no vuelva a pasar *</b><textarea id="fbRcaAccion" maxlength="300" placeholder="Qué se va a hacer (no solo reparar)">${esc(st.accion)}</textarea>
          <label class="fbsh-t" style="font-size:13.5px;margin:8px 0 0;" for="fbRcaResp">Responsable *</label><input type="text" id="fbRcaResp" maxlength="100" value="${esc(st.responsable)}"/>
          <label class="fbsh-t" style="font-size:13.5px;margin:8px 0 0;" for="fbRcaFecha">Fecha compromiso *</label><input type="date" id="fbRcaFecha" value="${esc(st.fechaCompromiso)}"/></div>
        <div class="fbsh-err" id="fbRcaErr">${esc(st.err)}</div>
        <div class="fbsh-acc">${opts.onVolver ? '<button type="button" class="fbsh-btn sec" data-a="volver">← Volver</button>' : ''}${opts.despues ? `<button type="button" class="fbsh-btn sec" data-a="despues">${esc(opts.despues)}</button>` : '<button type="button" class="fbsh-btn sec" data-a="cerrar">Cancelar</button>'}<button type="button" class="fbsh-btn ok" data-a="guardar">💾 Guardar análisis</button></div>`);
    };
    s.el.addEventListener('input', ev => {
      const t = ev.target;
      if (t.dataset.pq) st.porques[+t.dataset.pq] = t.value;
      if (t.id === 'fbRcaCausa') st.causa = t.value;
      if (t.id === 'fbRcaAccion') st.accion = t.value;
      if (t.id === 'fbRcaResp') st.responsable = t.value;
      if (t.id === 'fbRcaFecha') st.fechaCompromiso = t.value.trim();
    });
    s.el.addEventListener('click', ev => {
      const c = ev.target.closest('[data-cat]');
      if (c) { st.categoria = c.dataset.cat; s.el.querySelectorAll('[data-cat]').forEach(b => b.classList.toggle('sel', b === c)); return; }
      const b = ev.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'volver') { fbSheetCerrar(true); opts.onVolver(); return; }
      if (a === 'despues') { fbSheetCerrar(true); if (opts.onDespues) opts.onDespues(); return; }
      if (a === 'cerrar') { fbSheetCerrar(true); return; }
      if (a === 'guardar') {
        const v = id => { const e = s.el.querySelector('#' + id); return e ? e.value : null; };
        st.porques = st.porques.map((x, i) => { const y = v('fbRcaP' + i); return y == null ? x : y; });
        [['causa', 'fbRcaCausa'], ['accion', 'fbRcaAccion'], ['responsable', 'fbRcaResp'], ['fechaCompromiso', 'fbRcaFecha']].forEach(([k, id]) => { const y = v(id); if (y != null) st[k] = k === 'fechaCompromiso' ? y.trim() : y; });
        const r = { porques: st.porques.map(x => String(x || '').trim().slice(0, 200)), categoria: st.categoria, causa: st.causa.trim().slice(0, 300), accion: st.accion.trim().slice(0, 300),
          responsable: st.responsable.trim().slice(0, 100), fechaCompromiso: st.fechaCompromiso };
        const falta = [];
        if (r.porques.filter(Boolean).length < 3) falta.push('al menos 3 porqués');
        if (!CATS.some(x => x[0] === r.categoria)) falta.push('el tipo de causa');
        if (!r.causa) falta.push('la causa raíz');
        if (!r.accion) falta.push('la acción');
        if (!r.responsable) falta.push('el responsable');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.fechaCompromiso) || !fbParseFecha(r.fechaCompromiso)) falta.push('la fecha compromiso (AAAA-MM-DD)');
        if (falta.length) { st.err = 'Falta: ' + falta.join(', ') + '.'; const e = s.el.querySelector('#fbRcaErr'); if (e) { e.textContent = st.err; e.scrollIntoView({ block: 'center' }); } return; }
        const rca = { ...r, por: miNombre().slice(0, 100), porUid: uid(), en: new Date().toISOString() };
        fbSheetCerrar(true);
        if (opts.onGuardar) opts.onGuardar(rca);
      }
    });
    pintar();
    return s;
  }

  // ── Escrituras (sin esperar al servidor) ──
  function escribir(otId, cambios, ok, accion) {
    const p = db.collection('ots').doc(otId).update(cambios);
    p.catch(e => aviso(e && e.code === 'permission-denied' ? '⛔ Firebase no dejó ' + accion + ' (revisa tu rol o que el análisis esté lleno).' : '❌ No se pudo ' + accion + ': ' + ((e && e.message) || e), 'error'));
    aviso(sinSenal() ? '💾 Guardado en el celular — se sube al volver la señal' : ok, sinSenal() ? 'warn' : undefined);
    return p;
  }
  // Guarda (o corrige) el análisis de una OT ya guardada. Conserva validada/cumplida.
  function guardar(ot, rca) {
    const c = {};
    ['porques', 'categoria', 'causa', 'accion', 'responsable', 'fechaCompromiso', 'por', 'porUid', 'en'].forEach(k => { c['rca.' + k] = rca[k]; });
    if (ot.rca && ot.rca.validada) { c['rca.validada'] = false; } // si se cambia, hay que volver a validarlo
    c.editadoPor = miNombre(); c.editadoEn = fbTimestamp();
    ot.rca = { ...(ot.rca || {}), ...rca, ...(ot.rca && ot.rca.validada ? { validada: false } : {}) };
    return escribir(ot.id, c, '✅ Análisis de causa raíz guardado', 'guardar el análisis');
  }
  function validar(ot) {
    if (!esSupervisor()) { aviso('⛔ El análisis lo valida un Supervisor, Encargado o Administrador.', 'error'); return Promise.resolve(false); }
    if (!lleno(ot.rca)) { aviso('⚠️ Todavía falta llenar el análisis de causa raíz: no se puede validar.', 'warn'); return Promise.resolve(false); }
    const c = { 'rca.validada': true, 'rca.validadaPor': miNombre().slice(0, 100), 'rca.validadaPorUid': uid(), 'rca.validadaEn': new Date().toISOString() };
    ot.rca = { ...ot.rca, validada: true, validadaPor: c['rca.validadaPor'] };
    return escribir(ot.id, c, '✅ Análisis validado', 'validar el análisis');
  }
  function marcarCumplida(ot) {
    if (!lleno(ot.rca)) return Promise.resolve(false);
    const c = { 'rca.cumplida': true, 'rca.cumplidaEn': fbHoy(), 'rca.cumplidaPor': miNombre().slice(0, 100) };
    ot.rca = { ...ot.rca, cumplida: true, cumplidaEn: c['rca.cumplidaEn'], cumplidaPor: c['rca.cumplidaPor'] };
    return escribir(ot.id, c, '✅ Acción marcada como cumplida', 'marcar la acción');
  }

  // ── Pareto (conteo de mayor a menor + % acumulado) ──
  function pareto(lista, claveDe, textoDe) {
    const m = new Map();
    lista.forEach(x => { const k = claveDe(x); if (!k) return; const v = m.get(k) || { k, t: textoDe ? textoDe(x) : k, n: 0 }; v.n++; m.set(k, v); });
    const out = [...m.values()].sort((a, b) => b.n - a.n || String(a.t).localeCompare(String(b.t), 'es'));
    const tot = out.reduce((s, x) => s + x.n, 0); let acc = 0;
    out.forEach(x => { acc += x.n; x.pct = tot ? Math.round(x.n / tot * 1000) / 10 : 0; x.acum = tot ? Math.round(acc / tot * 1000) / 10 : 0; });
    return out;
  }
  // Resumen del RCA (HTML ya escapado) para listas y la Hoja de vida.
  function detalleHtml(o) {
    const r = o.rca || {};
    if (!lleno(r)) return `<div class="fbsh-nota">${esc(o.rcaMotivo || '')}</div>`;
    const ea = estadoAccion(o);
    return `<div class="rca-det"><div><b>Tipo:</b> ${esc(catTexto(r.categoria))}</div>
      <ol class="rca-pq">${(r.porques || []).filter(x => String(x || '').trim()).map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      <div><b>Causa raíz:</b> ${esc(r.causa)}</div><div><b>Acción:</b> ${esc(r.accion)}</div>
      <div class="rca-meta">👤 ${esc(r.responsable || '—')} · 📅 ${esc(r.fechaCompromiso || '—')} ·
        <span class="rca-acc rca-acc-${ea}" data-accion="${ea}">${ea === 'cumplida' ? '✅ Cumplida' + (r.cumplidaEn ? ' ' + esc(r.cumplidaEn) : '') : ea === 'vencida' ? '⏰ Vencida' : '⏳ Abierta'}</span>${r.validada ? ' · validó ' + esc(r.validadaPor || '') : ''}</div></div>`;
  }

  window.FB_RCA_CATS = CATS;
  window.FB_KPI_CFG_DEF = CFG_DEF;
  window.fbKpiConfig = config;
  window.fbKpiConfigSync = configSync;
  window.fbKpiGuardarConfig = guardarConfig;
  window.fbRcaBuscarReincidencia = buscarReincidencia;
  window.fbRcaEvaluar = evaluar;
  window.fbRcaEstado = estado;
  window.fbRcaEstadoAccion = estadoAccion;
  window.fbRcaLleno = lleno;
  window.fbRcaCompleto = completo;
  window.fbRcaBadge = badge;
  window.fbRcaCatTexto = catTexto;
  window.fbRcaAbrirForm = abrirForm;
  window.fbRcaGuardar = guardar;
  window.fbRcaValidar = validar;
  window.fbRcaMarcarCumplida = marcarCumplida;
  window.fbRcaPareto = pareto;
  window.fbRcaDetalleHtml = detalleHtml;
})();
