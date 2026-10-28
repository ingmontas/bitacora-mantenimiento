// seguridad.js — (28 oct 2026) LOTO Y PERMISO DE TRABAJO
// ══════════════════════════════════════════════════════════════════════
// Antes de empezar un trabajo en una máquina el técnico pasa por un paso
// corto "Antes de empezar — Seguridad":
//   1) ¿Requiere bloqueo (LOTO)? Es OBLIGATORIO si el equipo es criticidad A
//      (o la que diga /config/seguridad) o si el tipo de trabajo está en la
//      lista del Administrador; si no, lo decide el técnico.
//   2) Lista LOTO: avisé a producción, apagué, identifiqué energías, bloqueé
//      con candado y tarjeta (número de candado), liberé energía residual,
//      verifiqué energía cero y EPP.
//   3) Riesgos especiales (altura, espacio confinado, trabajo en caliente,
//      eléctrico energizado NFPA 70E): necesitan que un Supervisor o
//      Encargado AUTORICE desde su celular ("Permisos por autorizar").
//   Al terminar: "Retirar bloqueo" (herramientas, personal, guardas, candado,
//   aviso a producción) con la hora.
// Nunca se bloquea al técnico: todo se guarda en el celular y se sube solo
// con la señal (persistencia de Firestore); lo que falta se muestra claro.
//
// Colección NUEVA /permisos_trabajo/{id}:
//   otId, otFolio, equipoId, equipoNombre, planta, tecnico, tecnicoUid,
//   tipoTrabajo, criticidad, lotoObligatorio, lotoMotivo,
//   loto { requerido, avisoProduccion, apagado, energias[], bloqueado,
//          candado, energiaResidual, energiaCero, epp[], completo, hora },
//   riesgos { altura, confinado, caliente, electricoEnergizado },
//   requiereAutorizacion, estado 'abierto'|'por_autorizar'|'autorizado'|
//   'cerrado'|'rechazado', fecha, horaInicio, creadoEn (hora del servidor),
//   creadoMs (hora del celular, para mostrar sin señal),
//   autorizadoPor / autorizadoPorUid / autorizadoEn / notaAutorizacion,
//   retiro { herramientas, personal, guardas, candado, aviso, hora, por },
//   cerradoEn.  En la OT se agrega solo `permisoId` (campo nuevo).
// Configuración: /config/seguridad { lotoTipos[], lotoCriticidades[], epp[] }.
// Lecturas: 1 de /config/seguridad por celular cada 6 h; el técnico escucha
// SOLO sus permisos abiertos (tecnicoUid == yo y estado 'in' [...]: solo
// igualdades, sin índice compuesto); el Supervisor+ escucha solo los
// 'por_autorizar'. Requiere criticidad.js (ventana fbSheet).
// ══════════════════════════════════════════════════════════════════════
(function () {
  const COL = 'permisos_trabajo';
  const ABIERTOS = ['abierto', 'por_autorizar', 'autorizado', 'rechazado'];
  const ESTADO_TXT = { abierto: '🔒 Bloqueo abierto', por_autorizar: '⏳ Por autorizar', autorizado: '✅ Autorizado', cerrado: '🔓 Cerrado', rechazado: '✋ Rechazado' };
  const ENERGIAS = [['electrica', 'Eléctrica'], ['neumatica', 'Neumática (aire)'], ['hidraulica', 'Hidráulica (aceite)'], ['mecanica', 'Mecánica / gravedad'], ['termica', 'Térmica (calor / frío)'], ['quimica', 'Química']];
  const RIESGOS = [
    ['altura', 'Trabajo en altura', 'Más de 1.8 m del piso: escalera, andamio, techo'],
    ['confinado', 'Espacio confinado', 'Tanque, silo, fosa, ducto: entrada y salida difícil'],
    ['caliente', 'Trabajo en caliente', 'Soldar, cortar o esmerilar'],
    ['electricoEnergizado', 'Eléctrico energizado (NFPA 70E)', 'Trabajar con la corriente conectada'],
  ];
  const PASOS = [
    ['avisoProduccion', '1. Avisé a producción / al operador', 'Que sepan que la máquina va a estar parada'],
    ['apagado', '2. Apagué el equipo', 'Con su botón o parada normal'],
    ['energias', '3. Identifiqué las energías', 'Marca todas las que tiene la máquina'],
    ['bloqueado', '4. Bloqueé con mi candado y tarjeta', 'En cada punto de corte; escribe el número del candado'],
    ['energiaResidual', '5. Liberé la energía que queda', 'Purgar aire, bajar presión, bloquear piezas que caen, esperar que pare'],
    ['energiaCero', '6. Verifiqué energía cero', 'Intenté arrancar y no arrancó; medí si es eléctrico'],
    ['epp', '7. Tengo puesto mi EPP', 'Equipo de protección personal'],
  ];
  const RETIRO = [
    ['herramientas', 'Retiré herramientas y materiales'],
    ['personal', 'Todo el personal está fuera de la zona'],
    ['guardas', 'Guardas y protecciones puestas'],
    ['candado', 'Retiré mi candado y tarjeta'],
    ['aviso', 'Avisé a producción que el equipo está listo'],
  ];
  const CFG_DEF = { lotoTipos: [], lotoCriticidades: ['A'], epp: ['Lentes de seguridad', 'Guantes', 'Casco', 'Botas de seguridad', 'Protección auditiva', 'Careta o protección de cara', 'Arnés (trabajo en altura)', 'Ropa contra arco eléctrico'] };
  const TIPOS = ['Correctivo', 'Preventivo', 'Predictivo', 'Proyecto'];
  const LS_CFG = 'fbSegCfg', CFG_TTL = 6 * 3600 * 1000;
  const H12 = 12 * 3600 * 1000;
  const esc = s => fbEsc(s);
  const rol = (...r) => typeof userHasRole === 'function' && userHasRole(...r);
  const esSupervisor = () => rol('ADMINISTRADOR', 'ENCARGADO_MANTENIMIENTO', 'SUPERVISOR');
  const esTecnicoOMas = () => rol('ADMINISTRADOR', 'ENCARGADO_MANTENIMIENTO', 'SUPERVISOR', 'TECNICO');
  const uid = () => (window.currentUser && window.currentUser.uid) || '';
  const miNombre = () => { const u = window.currentUserRole || {}; return String(u.tecnico || u.nombre || (window.currentUser && window.currentUser.email) || ''); };
  const ahoraHM = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const aviso = (m, t) => (typeof fbAviso === 'function' ? fbAviso(m, t) : console.log(m));
  const sinSenal = () => typeof navigator !== 'undefined' && navigator.onLine === false;
  const msDe = p => { const t = p && p.creadoEn; if (t && typeof t.toMillis === 'function') return t.toMillis(); return Number(p && p.creadoMs) || 0; };
  const tieneRiesgo = r => !!r && RIESGOS.some(([k]) => r[k] === true);
  const riesgosTxt = r => RIESGOS.filter(([k]) => r && r[k] === true).map(x => x[1]);
  const lotoHecho = p => !!(p && p.loto && p.loto.requerido && p.loto.completo);

  // ── Configuración (/config/seguridad) ──
  let _cfg = null, _cfgProm = null;
  function limpiarCfg(d) {
    d = d || {};
    const arr = (v, def) => Array.isArray(v) ? v.map(x => String(x || '').trim()).filter(Boolean) : def.slice();
    return { lotoTipos: arr(d.lotoTipos, CFG_DEF.lotoTipos), lotoCriticidades: arr(d.lotoCriticidades, CFG_DEF.lotoCriticidades).filter(x => ['A', 'B', 'C'].includes(x)), epp: arr(d.epp, CFG_DEF.epp) };
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
        const s = await db.collection('config').doc('seguridad').get();
        _cfg = limpiarCfg(s.exists ? s.data() : null);
        try { localStorage.setItem(LS_CFG, JSON.stringify({ cfg: _cfg, t: Date.now() })); } catch (e) {}
      } catch (e) {
        _cfg = limpiarCfg(copia && copia.cfg); // sin señal o sin permiso: la copia o lo de fábrica
      }
      _cfgProm = null;
      return _cfg;
    })();
    return _cfgProm;
  }
  function guardarConfig(c) {
    const d = limpiarCfg(c);
    _cfg = d;
    try { localStorage.setItem(LS_CFG, JSON.stringify({ cfg: d, t: Date.now() })); } catch (e) {}
    return db.collection('config').doc('seguridad').set({ ...d, actualizadoPor: miNombre(), actualizadoEn: fbTimestamp() }, { merge: true });
  }
  function lotoObligatorio(nivel, tipo, cfg) {
    cfg = cfg || _cfg || CFG_DEF;
    if (nivel && cfg.lotoCriticidades.includes(nivel)) return { si: true, motivo: 'Equipo ' + (typeof fbCritTexto === 'function' ? fbCritTexto(nivel) : nivel) };
    if (tipo && cfg.lotoTipos.some(t => fbEquipoKey(t) === fbEquipoKey(tipo))) return { si: true, motivo: 'Trabajo ' + tipo };
    return { si: false, motivo: '' };
  }

  // ── Mis permisos abiertos y permisos por autorizar (listeners) ──
  let _mios = [], _miosListo = false, _miosUnsub = null;
  let _porAut = [], _porAutListo = false, _porAutUnsub = null, _porAutErr = '';
  const _pend = new Set();
  const _oyentes = [];
  function onCambio(cb) { if (typeof cb === 'function') _oyentes.push(cb); }
  function avisar() { _oyentes.forEach(cb => { try { cb(); } catch (e) { console.error(e); } }); }
  function docA(d) { if (d.metadata && d.metadata.hasPendingWrites) _pend.add(d.id); else _pend.delete(d.id); return { id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }; }
  function escuchar() {
    if (!esTecnicoOMas() || !uid()) return;
    if (!_miosUnsub) {
      _miosUnsub = db.collection(COL).where('tecnicoUid', '==', uid()).where('estado', 'in', ABIERTOS)
        .onSnapshot({ includeMetadataChanges: true }, sn => { _mios = sn.docs.map(docA); _miosListo = true; avisar(); },
          err => { console.warn('No se pudieron leer tus permisos de trabajo:', err.message); _miosListo = true; avisar(); });
    }
    if (esSupervisor() && !_porAutUnsub) {
      _porAutUnsub = db.collection(COL).where('estado', '==', 'por_autorizar')
        .onSnapshot({ includeMetadataChanges: true }, sn => { _porAut = sn.docs.map(docA); _porAutListo = true; _porAutErr = ''; avisar(); },
          err => { _porAutErr = err.message || String(err); _porAutListo = true; avisar(); });
    }
  }
  const mios = () => _mios.filter(p => ABIERTOS.includes(p.estado));
  // Lo que tiene que autorizar ESTE supervisor (los suyos los autoriza otro) y de su nave.
  const porAutorizar = () => _porAut.filter(p => p.estado === 'por_autorizar' && p.tecnicoUid !== uid() && (typeof fbEnNave !== 'function' || fbEnNave(p)))
    .sort((a, b) => msDe(a) - msDe(b));
  const _cerrados = new Map(); // cerrados en esta visita (ya no vienen en el listener)
  const permisoDeOt = (otId, conCerrados) => {
    if (!otId) return null;
    const p = mios().find(x => x.otId === otId);
    if (p || !conCerrados) return p || null;
    return [..._cerrados.values()].find(x => x.otId === otId) || null;
  };
  // Igual que permisoDeOt(…, true) y, si no está en memoria, 1 consulta pequeña por otId
  // (p. ej. el técnico retiró el bloqueo y recargó la app antes de registrar la OT).
  function buscarDeOt(otId) {
    const p = permisoDeOt(otId, true);
    if (p || !otId) return Promise.resolve(p);
    const q = db.collection(COL).where('otId', '==', otId).get()
      .then(sn => { const l = sn.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.tecnicoUid === uid()).sort((a, b) => msDe(b) - msDe(a)); return l[0] || null; })
      .catch(() => null);
    return Promise.race([q, new Promise(r => setTimeout(() => r(null), 4000))]);
  }

  // ══════ PASO "ANTES DE EMPEZAR — SEGURIDAD" ══════
  // ctx = { equipo:{id,nombre,planta,localidad,criticidad}, ot:{id,folio}, tipo,
  //         onListo(permiso|null), onCancelar() }
  function abrirPaso(ctx) {
    ctx = ctx || {};
    const eq = ctx.equipo || {};
    const nivel = typeof fbCritNivel === 'function' ? fbCritNivel(eq) : '';
    const s = fbSheet('<div class="fbsh-nota">Cargando…</div>', { id: 'fbSegPaso', fijo: true });
    config().then(cfg => {
      const obl = lotoObligatorio(nivel, ctx.tipo, cfg);
      const st = { requiere: obl.si ? true : null, ck: {}, energias: new Set(), epp: new Set(), candado: '', riesgos: {}, err: '' };
      window.__fbSegPaso = st;
      const pintar = () => s.set(htmlPaso(ctx, eq, nivel, obl, cfg, st));
      s.el.addEventListener('click', ev => {
        const b = ev.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'req') { if (obl.si) return; st.requiere = b.dataset.v === 'si'; return pintar(); }
        if (a === 'cancelar') { fbSheetCerrar(true); if (ctx.onCancelar) ctx.onCancelar(); return; }
        if (a === 'listo') return guardarPaso(ctx, eq, nivel, obl, st, s);
      });
      s.el.addEventListener('change', ev => {
        const t = ev.target;
        if (t.dataset.paso) st.ck[t.dataset.paso] = t.checked;
        if (t.dataset.en) { if (t.checked) st.energias.add(t.dataset.en); else st.energias.delete(t.dataset.en); }
        if (t.dataset.epp) { if (t.checked) st.epp.add(t.dataset.epp); else st.epp.delete(t.dataset.epp); }
        if (t.dataset.riesgo) { st.riesgos[t.dataset.riesgo] = t.checked; const n = s.el.querySelector('#fbsAutNota'); if (n) n.style.display = tieneRiesgo(st.riesgos) ? '' : 'none'; }
      });
      s.el.addEventListener('input', ev => { if (ev.target.id === 'fbsCandado') st.candado = ev.target.value; });
      pintar();
    });
  }
  function htmlPaso(ctx, eq, nivel, obl, cfg, st) {
    const ck = k => st.ck[k] ? ' checked' : '';
    const loto = st.requiere === true ? `<div class="fbsh-sec" id="fbsLoto"><b>🔒 Bloqueo y etiquetado (LOTO)</b>
      ${PASOS.map(([k, t, d]) => {
        let extra = '';
        if (k === 'energias') extra = `<div class="fbsh-chips">${ENERGIAS.map(([v, tx]) => `<label class="fbsh-ck"><input type="checkbox" data-en="${v}"${st.energias.has(v) ? ' checked' : ''}/>${esc(tx)}</label>`).join('')}</div>`;
        if (k === 'bloqueado') extra = `<div style="margin-left:32px;"><input type="text" id="fbsCandado" maxlength="40" inputmode="text" placeholder="Número de candado (ej. 12)" value="${esc(st.candado)}" aria-label="Número de candado"/></div>`;
        if (k === 'epp') extra = `<div class="fbsh-chips">${cfg.epp.map(v => `<label class="fbsh-ck"><input type="checkbox" data-epp="${esc(v)}"${st.epp.has(v) ? ' checked' : ''}/>${esc(v)}</label>`).join('')}</div>`;
        const conCk = !['energias', 'epp'].includes(k);
        return `<label class="fbsh-ck paso">${conCk ? `<input type="checkbox" data-paso="${k}"${ck(k)}/>` : '<span style="width:22px;flex:0 0 22px;text-align:center;">•</span>'}<span>${esc(t)}<small>${esc(d)}</small></span></label>${extra}`;
      }).join('')}</div>` : '';
    return `<div class="fbsh-head"><div><h3>🦺 Antes de empezar — Seguridad</h3><small>${esc(eq.nombre || 'Equipo')}${ctx.ot && ctx.ot.folio ? ' · ' + esc(ctx.ot.folio) : ''} ${typeof fbCritBadge === 'function' ? fbCritBadge(nivel) : ''}</small></div></div>
      <div class="fbsh-t">¿Hay que bloquear la máquina (LOTO)?</div>
      ${obl.si ? `<div class="fbsh-caja err" data-obligatorio="1">Obligatorio: ${esc(obl.motivo)}. Haz el bloqueo antes de meter las manos.</div>` : '<div class="fbsh-nota">Si vas a meter las manos, quitar guardas o hay piezas que se pueden mover: <b>sí</b>.</div>'}
      <div class="fbsh-seg"><button type="button" data-a="req" data-v="si" class="${st.requiere === true ? 'sel' : ''}">Sí, bloquear</button><button type="button" data-a="req" data-v="no" class="${st.requiere === false ? 'sel' : ''}"${obl.si ? ' disabled' : ''}>No hace falta</button></div>
      ${loto}
      <div class="fbsh-sec"><b>⚠️ Riesgos especiales</b><div class="fbsh-nota">Si marcas alguno, un Supervisor o Encargado tiene que autorizar desde su celular antes de hacer esa parte del trabajo.</div>
        ${RIESGOS.map(([k, t, d]) => `<label class="fbsh-ck paso"><input type="checkbox" data-riesgo="${k}"${st.riesgos[k] ? ' checked' : ''}/><span>${esc(t)}<small>${esc(d)}</small></span></label>`).join('')}
        <div class="fbsh-caja warn" id="fbsAutNota" style="${tieneRiesgo(st.riesgos) ? '' : 'display:none'}">Se enviará a "Permisos por autorizar". Puedes ir preparando; no hagas el trabajo especial hasta que salga <b>✅ Autorizado</b>.</div></div>
      <div class="fbsh-err" id="fbsErr">${esc(st.err)}</div>
      <div class="fbsh-acc"><button type="button" class="fbsh-btn sec" data-a="cancelar">Ahora no</button><button type="button" class="fbsh-btn ok" data-a="listo">✅ Listo, empezar</button></div>`;
  }
  function guardarPaso(ctx, eq, nivel, obl, st, s) {
    const err = m => { st.err = m; const e = s.el.querySelector('#fbsErr'); if (e) { e.textContent = m; e.scrollIntoView({ block: 'center' }); } };
    if (st.requiere === null) return err('Contesta si hay que bloquear la máquina.');
    const esp = tieneRiesgo(st.riesgos);
    if (st.requiere) {
      const falta = PASOS.filter(([k]) => !['energias', 'epp'].includes(k) && !st.ck[k]).map(x => x[1].split('.')[0]);
      if (falta.length) return err('Falta marcar el paso ' + falta.join(', ') + ' del LOTO.');
      if (!st.energias.size) return err('Marca al menos una energía (paso 3).');
      if (!String(st.candado || '').trim()) return err('Escribe el número de tu candado (paso 4).');
      if (!st.epp.size) return err('Marca tu EPP (paso 7).');
    }
    fbSheetCerrar(true);
    if (!st.requiere && !esp) { if (ctx.onListo) ctx.onListo(null); return; } // nada que guardar
    const ref = db.collection(COL).doc();
    const riesgos = {}; RIESGOS.forEach(([k]) => { riesgos[k] = st.riesgos[k] === true; });
    const loto = st.requiere ? {
      requerido: true, avisoProduccion: true, apagado: true, energias: [...st.energias], bloqueado: true, candado: String(st.candado).trim().slice(0, 40),
      energiaResidual: true, energiaCero: true, epp: [...st.epp].slice(0, 20), completo: true, hora: ahoraHM(),
    } : { requerido: false };
    const doc = {
      otId: (ctx.ot && ctx.ot.id) || '', otFolio: (ctx.ot && ctx.ot.folio) || '',
      equipoId: eq.id || '', equipoNombre: String(eq.nombre || '').slice(0, 120),
      planta: String((typeof fbPlantaDeEquipo === 'function' && eq.id ? fbPlantaDeEquipo(eq) : '') || eq.planta || '').slice(0, 80),
      tecnico: miNombre().slice(0, 100), tecnicoUid: uid(), tipoTrabajo: String(ctx.tipo || ''),
      criticidad: nivel || '', lotoObligatorio: !!obl.si, lotoMotivo: obl.motivo || '',
      loto, riesgos, requiereAutorizacion: esp, estado: esp ? 'por_autorizar' : 'abierto',
      fecha: fbHoy(), horaInicio: ahoraHM(), creadoEn: fbTimestamp(), creadoMs: Date.now(),
    };
    const local = { id: ref.id, ...doc, creadoEn: null };
    // Sin esperar al servidor: sin señal queda en el celular y se sube solo.
    ref.set(doc).catch(e => aviso('❌ El permiso de trabajo no se subió: ' + (e && e.code === 'permission-denied' ? 'Firebase lo rechazó (permiso denegado).' : (e && e.message) || e), 'error'));
    if (!_mios.some(p => p.id === ref.id)) { _mios = _mios.concat([local]); _pend.add(ref.id); }
    avisar();
    aviso(esp ? '⏳ Permiso enviado — espera la autorización del supervisor para el trabajo especial' : (sinSenal() ? '💾 Bloqueo guardado en el celular — se sube al volver la señal' : '🔒 Bloqueo registrado. Trabaja seguro.'), esp || sinSenal() ? 'warn' : undefined);
    if (ctx.onListo) ctx.onListo(local);
  }

  // ══════ RETIRAR BLOQUEO (al terminar) ══════
  // opts.onListo(retiro) — quien llama guarda el cierre (con cerrarEnLote o cerrar).
  // opts.saltar = texto del botón para dejarlo abierto (no bloquea al técnico).
  function abrirRetiro(p, opts) {
    opts = opts || {};
    const conLoto = !!(p.loto && p.loto.requerido);
    const items = RETIRO.filter(([k]) => conLoto || k !== 'candado');
    const st = {};
    const s = fbSheet('', { id: 'fbSegRetiro', fijo: true });
    const pintar = (err) => s.set(`<div class="fbsh-head"><div><h3>🔓 Retirar bloqueo</h3><small>${esc(p.equipoNombre || '')}${p.loto && p.loto.candado ? ' · candado ' + esc(p.loto.candado) : ''}</small></div></div>
      <div class="fbsh-nota">Antes de devolver la máquina a producción:</div>
      ${items.map(([k, t]) => `<label class="fbsh-ck"><input type="checkbox" data-r="${k}"${st[k] ? ' checked' : ''}/>${esc(t)}</label>`).join('')}
      <label class="fbsh-ck" style="gap:8px;">Hora<input type="time" id="fbsRetHora" value="${esc(st.hora || ahoraHM())}" style="max-width:140px;margin:0;"/></label>
      <div class="fbsh-err">${esc(err || '')}</div>
      <div class="fbsh-acc">${opts.saltar ? `<button type="button" class="fbsh-btn sec" data-a="saltar">${esc(opts.saltar)}</button>` : '<button type="button" class="fbsh-btn sec" data-a="saltar">Ahora no</button>'}<button type="button" class="fbsh-btn ok" data-a="ok">🔓 Retirar y cerrar</button></div>`);
    s.el.addEventListener('change', ev => { const t = ev.target; if (t.dataset.r) st[t.dataset.r] = t.checked; if (t.id === 'fbsRetHora') st.hora = t.value; });
    s.el.addEventListener('click', ev => {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'saltar') { fbSheetCerrar(true); if (opts.onSaltar) opts.onSaltar(); return; }
      if (b.dataset.a === 'ok') {
        const falta = items.filter(([k]) => !st[k]);
        if (falta.length) return pintar('Falta: ' + falta.map(x => x[1].toLowerCase()).join('; ') + '.');
        const hora = (s.el.querySelector('#fbsRetHora') || {}).value || ahoraHM();
        const retiro = { herramientas: true, personal: true, guardas: true, candado: conLoto, aviso: true, hora, por: miNombre().slice(0, 100) };
        fbSheetCerrar(true);
        if (opts.onListo) opts.onListo(retiro);
      }
    });
    pintar();
  }
  function cambiosCierre(retiro, extra) { return { estado: 'cerrado', retiro, cerradoEn: fbTimestamp(), ...(extra || {}) }; }
  // Agrega el cierre del permiso a un lote.
  function cerrarEnLote(batch, p, retiro, extra) {
    batch.update(db.collection(COL).doc(p.id), cambiosCierre(retiro, extra));
    marcarLocal(p.id, { estado: 'cerrado', retiro, ...(extra || {}) });
  }
  // extra = { otId, otFolio } si se cierra al guardar la OT; callado = sin mensaje.
  function cerrar(p, retiro, extra, callado) {
    db.collection(COL).doc(p.id).update(cambiosCierre(retiro, extra)).catch(e => aviso('❌ No se cerró el permiso de trabajo: ' + (e && e.code === 'permission-denied' ? 'Firebase lo rechazó (¿ya estaba cerrado?).' : (e && e.message) || e), 'error'));
    marcarLocal(p.id, { estado: 'cerrado', retiro, ...(extra || {}) });
    if (!callado) aviso(sinSenal() ? '💾 Bloqueo retirado (en el celular) — se sube al volver la señal' : '🔓 Bloqueo retirado. Equipo devuelto a producción.', sinSenal() ? 'warn' : undefined);
  }
  function marcarLocal(id, cambios) {
    if (cambios.estado === 'cerrado') { const p = _mios.find(x => x.id === id) || _cerrados.get(id); if (p) _cerrados.set(id, { ...p, ...cambios }); }
    _mios = _mios.map(p => p.id === id ? { ...p, ...cambios } : p).filter(p => ABIERTOS.includes(p.estado));
    _porAut = _porAut.map(p => p.id === id ? { ...p, ...cambios } : p).filter(p => p.estado === 'por_autorizar');
    avisar();
  }
  // Enlazar el permiso con la OT si se creó antes de tener su id (Bitácora nueva).
  function enlazarOt(p, otId, folio, batch) {
    if (!p || !otId || p.otId === otId) return;
    const c = { otId, otFolio: folio || '' };
    if (batch) batch.update(db.collection(COL).doc(p.id), c); else db.collection(COL).doc(p.id).update(c).catch(() => {});
    marcarLocal(p.id, c);
  }

  // ══════ AUTORIZAR (Supervisor / Encargado / Administrador) ══════
  function decidir(p, aprobar, nota) {
    if (!esSupervisor()) { aviso('⛔ Solo Supervisor, Encargado o Administrador autorizan permisos.', 'error'); return Promise.resolve(false); }
    if (p.tecnicoUid === uid()) { aviso('⛔ Tu propio permiso lo tiene que autorizar otra persona.', 'error'); return Promise.resolve(false); }
    const c = { estado: aprobar ? 'autorizado' : 'rechazado', autorizadoPor: miNombre().slice(0, 100), autorizadoPorUid: uid(), autorizadoEn: fbTimestamp(), notaAutorizacion: String(nota || '').trim().slice(0, 300) };
    db.collection(COL).doc(p.id).update(c).catch(e => aviso(e && e.code === 'permission-denied' ? '⚠️ No se pudo: el permiso ya cambió (lo cerró el técnico o lo decidió otro supervisor).' : '❌ No se guardó la autorización: ' + ((e && e.message) || e), 'error'));
    marcarLocal(p.id, c);
    aviso(aprobar ? (sinSenal() ? '💾 Autorizado en tu celular — se sube al volver la señal' : '✅ Permiso autorizado') : '✋ Permiso rechazado', aprobar ? (sinSenal() ? 'warn' : undefined) : 'warn');
    return Promise.resolve(true);
  }
  function abrirAutorizar(p) {
    const s = fbSheet('', { id: 'fbSegAut' });
    const pintar = err => s.set(`<div class="fbsh-head"><div><h3>🦺 Autorizar permiso de trabajo</h3><small>${esc(p.equipoNombre || '')} ${typeof fbCritBadge === 'function' ? fbCritBadge(p.criticidad) : ''}</small></div><button type="button" class="fbsh-x" data-a="x" aria-label="Cerrar">✕</button></div>
      ${detalleHtml(p)}
      <textarea id="fbsNotaAut" maxlength="300" placeholder="Nota (obligatoria si rechazas): condiciones, quién vigila…"></textarea>
      <div class="fbsh-err">${esc(err || '')}</div>
      <div class="fbsh-acc"><button type="button" class="fbsh-btn mal" data-a="no">✋ Rechazar</button><button type="button" class="fbsh-btn ok" data-a="si">✅ Autorizar</button></div>`);
    s.el.addEventListener('click', ev => {
      const b = ev.target.closest('[data-a]'); if (!b) return;
      if (b.dataset.a === 'x') return fbSheetCerrar();
      const nota = (s.el.querySelector('#fbsNotaAut') || {}).value || '';
      if (b.dataset.a === 'no' && !nota.trim()) return pintar('Escribe por qué lo rechazas.');
      if (b.dataset.a === 'si' || b.dataset.a === 'no') { fbSheetCerrar(true); decidir(p, b.dataset.a === 'si', nota); }
    });
    pintar();
  }

  // ── HTML ──
  function estadoHtml(p) { const e = (p && p.estado) || ''; return `<span class="fbs-est fbs-${esc(e)}" data-estado="${esc(e)}">${esc(ESTADO_TXT[e] || e || '—')}</span>`; }
  function horaDe(p) { const ms = msDe(p); if (!ms) return p.horaInicio || ''; const d = new Date(ms); return fbFechaLocal(d).slice(8, 10) + '/' + fbFechaLocal(d).slice(5, 7) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function detalleHtml(p) {
    const l = p.loto || {}, r = riesgosTxt(p.riesgos);
    const en = (l.energias || []).map(k => (ENERGIAS.find(x => x[0] === k) || [k, k])[1]);
    return `<table>
      <tr><td>Técnico</td><td>${esc(p.tecnico || '—')}</td></tr>
      <tr><td>Desde</td><td>${esc(horaDe(p))}${p.otFolio ? ' · ' + esc(p.otFolio) : ''}${p.tipoTrabajo ? ' · ' + esc(p.tipoTrabajo) : ''}</td></tr>
      <tr><td>LOTO</td><td>${l.requerido ? `✅ Hecho${l.candado ? ' · candado <b>' + esc(l.candado) + '</b>' : ''}${en.length ? '<br>Energías: ' + esc(en.join(', ')) : ''}${(l.epp || []).length ? '<br>EPP: ' + esc(l.epp.join(', ')) : ''}` : 'No requerido'}</td></tr>
      <tr><td>Riesgos</td><td>${r.length ? '<b>' + esc(r.join(', ')) + '</b>' : 'Ninguno especial'}</td></tr>
      ${p.autorizadoPor ? `<tr><td>${p.estado === 'rechazado' ? 'Rechazó' : 'Autorizó'}</td><td>${esc(p.autorizadoPor)}${p.notaAutorizacion ? ' — ' + esc(p.notaAutorizacion) : ''}</td></tr>` : ''}
      ${p.retiro ? `<tr><td>Retiro</td><td>🔓 ${esc(p.retiro.hora || '')} · ${esc(p.retiro.por || '')}</td></tr>` : ''}
    </table>`;
  }
  // Tarjeta para el formulario / avisos (sin datos en onclick: solo el id del documento).
  function tarjetaHtml(p, opts) {
    opts = opts || {};
    const pend = _pend.has(p.id);
    const r = riesgosTxt(p.riesgos);
    const msg = p.estado === 'por_autorizar' ? '⏳ Falta la autorización del supervisor para: ' + r.join(', ') + '. No hagas esa parte del trabajo todavía.'
      : p.estado === 'rechazado' ? '✋ Rechazado' + (p.notaAutorizacion ? ': ' + p.notaAutorizacion : '') + '. No hagas el trabajo especial; habla con tu supervisor.'
      : p.estado === 'autorizado' ? '✅ Autorizado por ' + (p.autorizadoPor || 'el supervisor') + (p.notaAutorizacion ? ' — ' + p.notaAutorizacion : '') : '';
    return `<div class="fbs-card ${esc(p.estado)}" data-permiso="${esc(p.id)}">
      <div class="t"><span>🦺 ${esc(p.equipoNombre || 'Permiso de trabajo')}${p.otFolio ? ' · ' + esc(p.otFolio) : ''}</span>${estadoHtml(p)}</div>
      <div class="m">${p.loto && p.loto.requerido ? '🔒 LOTO hecho' + (p.loto.candado ? ' · candado ' + esc(p.loto.candado) : '') : 'Sin bloqueo'} · desde ${esc(horaDe(p))}${pend ? ' · 📵 sin subir todavía' : ''}</div>
      ${msg ? `<div class="m" style="color:var(--color-text);font-weight:700;">${esc(msg)}</div>` : ''}
      ${opts.acciones === false ? '' : `<div class="acc"><button type="button" class="fbsh-btn sec sm" data-seg="retirar" data-id="${esc(p.id)}">🔓 Retirar bloqueo</button></div>`}
    </div>`;
  }
  function tarjetaAutorizarHtml(p) {
    const r = riesgosTxt(p.riesgos);
    return `<div class="fbs-card por_autorizar" data-por-autorizar="${esc(p.id)}">
      <div class="t"><span>${esc(p.equipoNombre || '—')} ${typeof fbCritBadge === 'function' ? fbCritBadge(p.criticidad) : ''}</span><span class="m" style="margin:0;">${esc(horaDe(p))}</span></div>
      <div class="m">👤 ${esc(p.tecnico || '—')}${p.otFolio ? ' · ' + esc(p.otFolio) : ''} · ${p.loto && p.loto.requerido ? '🔒 LOTO hecho' : 'sin LOTO'}${_pend.has(p.id) ? ' · 📵 sin subir' : ''}</div>
      <div class="m" style="color:var(--color-warn-text);font-weight:800;">⚠️ ${esc(r.join(', '))}</div>
      <div class="acc"><button type="button" class="fbsh-btn ok sm" data-seg="autorizar" data-id="${esc(p.id)}">Revisar y autorizar</button></div>
    </div>`;
  }
  // Sección completa para Avisos (Bitácora): por autorizar (supervisor) + mis bloqueos.
  function seccionHtml() {
    let h = '';
    if (esSupervisor()) {
      const l = porAutorizar();
      h += `<div class="av-sec" id="seg-por-autorizar">🦺 Permisos por autorizar <small>${_porAutErr ? '⚠️ ' + esc(_porAutErr) : !_porAutListo ? 'cargando…' : l.length ? l.length + ' esperando' : 'ninguno'}</small></div>` + l.map(tarjetaAutorizarHtml).join('');
    }
    const m = mios();
    if (m.length) h += `<div class="av-sec" id="seg-mios">🔒 Mis bloqueos abiertos <small>${m.length}</small></div>` + m.map(p => tarjetaHtml(p)).join('');
    return h ? h + '<div class="av-sep"></div>' : '';
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-seg]'); if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.seg === 'retirar') { const p = _mios.find(x => x.id === id); if (p) abrirRetiro(p, { onListo: r => cerrar(p, r) }); }
    if (b.dataset.seg === 'autorizar') { const p = _porAut.find(x => x.id === id); if (p) abrirAutorizar(p); }
  });

  // ══════ REPORTE (Análisis → 🦺 Seguridad) e historial por equipo ══════
  function permisosDeEquipo(equipoId) {
    if (!equipoId) return Promise.resolve([]);
    return db.collection(COL).where('equipoId', '==', equipoId).get().then(sn => sn.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).sort((a, b) => msDe(b) - msDe(a)));
  }
  // 2 consultas de un solo campo: los creados desde 'desdeMs' y los que siguen abiertos.
  function cargarReporte(desdeMs) {
    const col = db.collection(COL);
    return Promise.all([
      col.where('creadoEn', '>=', firebase.firestore.Timestamp.fromMillis(desdeMs)).get(),
      col.where('estado', 'in', ['abierto', 'por_autorizar', 'autorizado']).get(),
    ]).then(([a, b]) => {
      const m = new Map();
      [...a.docs, ...b.docs].forEach(d => m.set(d.id, { id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }));
      return { permisos: [...m.values()].sort((x, y) => msDe(y) - msDe(x)), desdeMs };
    });
  }
  // ots: OTs/filas del período con { id|_id, equipoId, permisoId }; critDe(ot) → 'A'|'B'|'C'|''.
  function calcularReporte(o) {
    const permisos = o.permisos || [], ahora = o.ahora || Date.now(), desdeMs = o.desdeMs || 0;
    const porId = new Map(permisos.map(p => [p.id, p]));
    const porOt = new Map(); permisos.forEach(p => { if (p.otId) porOt.set(p.otId, p); });
    const otsA = (o.ots || []).filter(r => o.critDe(r) === 'A');
    const conLoto = otsA.filter(r => { const p = (r.permisoId && porId.get(r.permisoId)) || porOt.get(r.id || r._id); return p ? lotoHecho(p) : !!r.permisoId; });
    const enPeriodo = permisos.filter(p => msDe(p) >= desdeMs);
    const abiertos12 = permisos.filter(p => ['abierto', 'autorizado', 'por_autorizar'].includes(p.estado) && msDe(p) && ahora - msDe(p) > H12).sort((a, b) => msDe(a) - msDe(b));
    return {
      otsA: otsA.length, otsAConLoto: conLoto.length, pctLotoA: otsA.length ? Math.round(conLoto.length / otsA.length * 100) : null,
      otsASinLoto: otsA.filter(r => !conLoto.includes(r)),
      abiertos12h: abiertos12, porAutorizar: permisos.filter(p => p.estado === 'por_autorizar'),
      total: enPeriodo.length, conLotoTotal: enPeriodo.filter(lotoHecho).length,
      especiales: enPeriodo.filter(p => tieneRiesgo(p.riesgos)).length,
      rechazados: enPeriodo.filter(p => p.estado === 'rechazado').length,
      cerradosSinAutorizacion: enPeriodo.filter(p => p.estado === 'cerrado' && p.requiereAutorizacion && !p.autorizadoPorUid).length,
      enPeriodo,
    };
  }
  function filasExcel(permisos, ahora) {
    ahora = ahora || Date.now();
    return permisos.map(p => {
      const l = p.loto || {}, ms = msDe(p);
      const d = ms ? new Date(ms) : null;
      const abiertoH = ms && ['abierto', 'autorizado', 'por_autorizar'].includes(p.estado) ? Math.round((ahora - ms) / 360000) / 10 : '';
      return [d ? fbFechaLocal(d) : (p.fecha || ''), p.horaInicio || '', p.equipoNombre || '', p.criticidad || 'Sin evaluar', p.tecnico || '', p.otFolio || '', p.tipoTrabajo || '',
        l.requerido ? 'Sí' : 'No', l.candado || '', (l.energias || []).map(k => (ENERGIAS.find(x => x[0] === k) || [k, k])[1]).join(', '), (l.epp || []).join(', '),
        riesgosTxt(p.riesgos).join(', '), (ESTADO_TXT[p.estado] || p.estado || '').replace(/^\S+\s/, ''), p.autorizadoPor || '', p.notaAutorizacion || '', (p.retiro && p.retiro.hora) || '', abiertoH];
    });
  }
  const COLUMNAS_EXCEL = [{ t: 'Fecha', w: 12 }, { t: 'Hora inicio', w: 10 }, { t: 'Equipo', w: 24 }, { t: 'Criticidad', w: 11 }, { t: 'Técnico', w: 24 }, { t: 'OT', w: 12 }, { t: 'Tipo', w: 12 },
    { t: 'LOTO', w: 7 }, { t: 'Candado', w: 10 }, { t: 'Energías', w: 28 }, { t: 'EPP', w: 30 }, { t: 'Riesgos especiales', w: 30 }, { t: 'Estado', w: 14 },
    { t: 'Autorizó / rechazó', w: 22 }, { t: 'Nota', w: 28 }, { t: 'Hora retiro', w: 11 }, { t: 'Horas abierto', w: 12 }];

  // Los listeners NO arrancan solos: solo la Bitácora los abre (fbSegEscuchar), así
  // Hoja de vida y Análisis no gastan lecturas en ellos.

  window.FB_SEG = { ENERGIAS, RIESGOS, PASOS, RETIRO, TIPOS, CFG_DEF, COLUMNAS_EXCEL, ESTADO_TXT };
  window.fbSegConfig = config;
  window.fbSegGuardarConfig = guardarConfig;
  window.fbSegLotoObligatorio = lotoObligatorio;
  window.fbSegAbrirPaso = abrirPaso;
  window.fbSegAbrirRetiro = abrirRetiro;
  window.fbSegCerrar = cerrar;
  window.fbSegCerrarEnLote = cerrarEnLote;
  window.fbSegEnlazarOt = enlazarOt;
  window.fbSegAbrirAutorizar = abrirAutorizar;
  window.fbSegDecidir = decidir;
  window.fbSegMios = mios;
  window.fbSegPorAutorizar = porAutorizar;
  window.fbSegPermisoDeOt = permisoDeOt;
  window.fbSegBuscarDeOt = buscarDeOt;
  window.fbSegOnCambio = onCambio;
  window.fbSegEscuchar = escuchar;
  window.fbSegTarjetaHtml = tarjetaHtml;
  window.fbSegSeccionHtml = seccionHtml;
  window.fbSegEstadoHtml = estadoHtml;
  window.fbSegDetalleHtml = detalleHtml;
  window.fbSegPermisosDeEquipo = permisosDeEquipo;
  window.fbSegCargarReporte = cargarReporte;
  window.fbSegCalcularReporte = calcularReporte;
  window.fbSegFilasExcel = filasExcel;
  window.fbSegMs = msDe;
  window.fbSegLotoHecho = lotoHecho;
  window.fbSegRiesgosTxt = riesgosTxt;
  window.fbSegTieneRiesgo = tieneRiesgo;
})();
