// capex-calc.js — (29 oct 2026) 💼 CAPEX: modelo de datos y CÁLCULOS (funciones puras).
// Lo usa capex.html (y lo prueba t_capex.js con window.CX). Sin lecturas ni escrituras:
// solo números, fechas y las ayudas de firebase-init.js (fbParseFecha, fbFechaLocal, fbHoy,
// fbEquipoKey, fbNaveDe, fbClaveNombre, fbCriticidadDeEquipo).
// ══════════════════════════════════════════════════════════════════════
// MODELO /capex/{id} (campos; todos los montos en la moneda de su línea)
//  codigo CAPEX-AAAA-001 · titulo · descripcion · justificacion{problema, beneficio}
//  tipo · prioridad · planta (nave) · area · linea · equipoIds[] · equipos[{id,nombre,criticidad}]
//  solicitante · solicitanteUid · creadoPorUid · fechaSolicitud · anioFiscal (número)
//  moneda 'DOP'|'USD' (base) · tasaCambio (RD$ por US$, propia del proyecto)
//  trabajos[{descripcion, responsable, tipoRecurso, horas, dias, costo, moneda, orden, dependeDe}]
//  repuestos[{descripcion, codigo, cantidad, unidad, costoUnitario, moneda, proveedor, enStock, leadTimeDias}]
//  otrosCostos[{concepto, detalle, monto, moneda}] · contingenciaPct · itbisAplica · itbisPct · totales{…}
//  beneficios{paroEvitado, energia, repuestos, manoObra, otros, vidaUtilAnios, tasaDescuentoPct}
//  estado borrador → enviado → aprobado | rechazado | en_espera → en_ejecucion → cerrado (y cancelado)
//  historial[{estado, por, uid, en, nota}] (solo crece) · aprobacion{por, uid, en, montoAprobado, moneda, tasaCambio, nota}
//  cronograma{fechaInicio, fechaFinProyectada, duracionDias, leadTimeMax, items[{i, ini, fin}], hitos[{k, fecha}]}
//  avance{ "i": {pct, ini, fin} } · gastoReal[{id, fecha, tipo real|compromiso, categoria, concepto, documento, ref, monto, moneda, nota, por, porUid, en}] (solo crece)
// ══════════════════════════════════════════════════════════════════════
const K = s => fbEquipoKey(s);
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const num = v => { if (v == null || v === '') return 0; const n = Number(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const numOk = v => v !== '' && v != null && isFinite(Number(String(v).replace(',', '.')));

const ESTADOS = ['borrador', 'enviado', 'en_espera', 'aprobado', 'rechazado', 'en_ejecucion', 'cerrado', 'cancelado'];
const TIPOS = ['reemplazo', 'mejora', 'seguridad', 'capacidad', 'energia', 'calidad', 'ambiental', 'cumplimiento'];
const PRIORIDADES = ['alta', 'media', 'baja'];
const RECURSOS = ['mo_interna', 'contratista', 'ingenieria', 'instalacion', 'puesta_marcha'];
const RESPONSABLES = ['interno', 'contratista'];
const CONCEPTOS = ['flete', 'aduana', 'impuestos', 'permisos', 'seguro', 'capacitacion', 'otro'];
const UNIDADES = ['und', 'm', 'kg', 'l', 'gal', 'juego', 'caja'];
const CATS = ['trabajo', 'repuesto', 'otro'];
const MONEDAS = ['DOP', 'USD'];
const ESPERA_MATERIALES = ['instalacion', 'puesta_marcha']; // esperan los repuestos
const APROBADOS = ['aprobado', 'en_ejecucion', 'cerrado'];
const EDITABLES = ['borrador', 'rechazado', 'en_espera'];

// ══════ CÁLCULOS (funciones puras, las prueba t_capex.js) ══════
function conv(v, de, a, tasa) {
  v = Number(v) || 0; tasa = Number(tasa) || 0;
  if (de === a) return v;
  if (de === 'USD' && a === 'DOP') return v * tasa;
  if (de === 'DOP' && a === 'USD') return tasa > 0 ? v / tasa : 0;
  return v;
}
const baseDe = p => (p && p.moneda === 'USD' ? 'USD' : 'DOP');
const monLinea = (m, B) => (m === 'USD' || m === 'DOP' ? m : B);
// Subtotal = trabajos + repuestos + otros; contingencia = subtotal × %;
// ITBIS = % × (subtotal − mano de obra interna − impuestos ya incluidos en "otros").
function calcTotales(p) {
  const B = baseDe(p), T = Number(p.tasaCambio) || 0;
  const c = (v, m) => conv(v, monLinea(m, B), B, T);
  let trabajos = 0, moInterna = 0, repuestos = 0, otros = 0, otrosImp = 0;
  (p.trabajos || []).forEach(x => { const v = c(num(x.costo), x.moneda); trabajos += v; if (x.tipoRecurso === 'mo_interna') moInterna += v; });
  (p.repuestos || []).forEach(x => { repuestos += c(num(x.cantidad) * num(x.costoUnitario), x.moneda); });
  (p.otrosCostos || []).forEach(x => { const v = c(num(x.monto), x.moneda); otros += v; if (x.concepto === 'impuestos') otrosImp += v; });
  const subtotal = trabajos + repuestos + otros;
  const contPct = num(p.contingenciaPct), itbisPct = num(p.itbisPct);
  const contingencia = subtotal * contPct / 100;
  const baseItbis = Math.max(0, subtotal - moInterna - otrosImp);
  const itbis = p.itbisAplica ? baseItbis * itbisPct / 100 : 0;
  const total = subtotal + contingencia + itbis;
  return { B, T, trabajos, moInterna, repuestos, otros, otrosImp, subtotal, contPct, contingencia, baseItbis, itbisPct, itbisAplica: !!p.itbisAplica, itbis, total, totalDOP: conv(total, B, 'DOP', T), totalUSD: conv(total, B, 'USD', T) };
}
const ahorroAnual = b => { b = b || {}; return num(b.paroEvitado) + num(b.energia) + num(b.repuestos) + num(b.manoObra) + num(b.otros); };
function vpn(I, A, n, r) { let s = -I; for (let k = 1; k <= n; k++) s += A / Math.pow(1 + r, k); return s; }
// TIR por bisección (flujo: −I hoy y A cada año durante n años). null si no hay cambio de signo.
function tir(I, A, n) {
  if (!(I > 0) || !(A > 0) || !(n >= 1)) return null;
  let lo = -0.9999, hi = 10, flo = vpn(I, A, n, lo), fhi = vpn(I, A, n, hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 400; i++) {
    const mid = (lo + hi) / 2, f = vpn(I, A, n, mid);
    if (Math.abs(f) < 1e-9 || hi - lo < 1e-12) return mid;
    if ((f > 0) === (flo > 0)) { lo = mid; flo = f; } else hi = mid;
  }
  return (lo + hi) / 2;
}
function calcFinanzas(p, tot) {
  tot = tot || calcTotales(p);
  const b = p.beneficios || {};
  const I = tot.total, A = ahorroAnual(b), n = Math.max(0, Math.round(num(b.vidaUtilAnios))), r = num(b.tasaDescuentoPct) / 100;
  const payback = A > 0 && I > 0 ? I / A : null;
  const roi = I > 0 && n > 0 ? (A * n - I) / I * 100 : null;
  const npv = I > 0 && n > 0 ? vpn(I, A, n, r) : null;
  const ir = tir(I, A, n);
  return { I, A, n, r: r * 100, payback, roi, npv, irr: ir == null ? null : ir * 100, irrNoConv: ir == null && I > 0 && A > 0 && n > 0 };
}
function duracionTrabajo(x) { const d = Math.round(num(x.dias)); if (d > 0) return d; const h = num(x.horas); return h > 0 ? Math.max(1, Math.ceil(h / 8)) : 1; }
const sumarDias = (f, n) => { const d = fbParseFecha(f); if (!d) return ''; d.setDate(d.getDate() + n); return fbFechaLocal(d); };
const diasEntre = (a, b) => Math.round((fbParseFecha(b) - fbParseFecha(a)) / 86400000);
// Cronograma: cada trabajo empieza al inicio o cuando termina el trabajo del que
// depende; la instalación y la puesta en marcha además esperan el mayor tiempo
// de entrega de los repuestos. Días calendario; fin = último día (inclusive).
function calcCronograma(p, fechaInicio) {
  const ts = p.trabajos || [];
  const lead = Math.max(0, ...(p.repuestos || []).map(r => Math.round(num(r.leadTimeDias))));
  const items = new Array(ts.length).fill(null), enCurso = new Array(ts.length).fill(false);
  const calc = i => {
    if (items[i]) return items[i];
    if (enCurso[i]) return null; // dependencia circular: se ignora
    enCurso[i] = true;
    const x = ts[i]; let ini = 0;
    const dep = x.dependeDe;
    if (dep !== null && dep !== undefined && dep !== '' && Number(dep) !== i && ts[Number(dep)]) { const d = calc(Number(dep)); if (d) ini = Math.max(ini, d.fin); }
    const espera = ESPERA_MATERIALES.includes(x.tipoRecurso) && lead > 0;
    if (espera) ini = Math.max(ini, lead);
    const dur = duracionTrabajo(x);
    items[i] = { i, ini, fin: ini + dur, dur, espera };
    enCurso[i] = false;
    return items[i];
  };
  ts.forEach((_, i) => calc(i));
  const duracion = Math.max(0, lead, ...items.map(x => x.fin));
  const f0 = fechaInicio || fbHoy();
  const fin = duracion > 0 ? sumarDias(f0, duracion - 1) : f0;
  const hitos = [{ k: 'h_inicio', d: 0, fecha: f0 }];
  if (lead > 0) hitos.push({ k: 'h_materiales', d: lead, fecha: sumarDias(f0, lead) });
  hitos.push({ k: 'h_fin', d: duracion, fecha: fin });
  return { fechaInicio: f0, fechaFinProyectada: fin, duracionDias: duracion, leadTimeMax: lead,
    items: items.map(x => ({ ...x, desde: sumarDias(f0, x.ini), hasta: sumarDias(f0, x.fin - 1) })), hitos };
}
// Ejecución: aprobado vs comprometido (OC abiertas) vs real (facturas y pagos).
function calcEjecucion(p) {
  const B = baseDe(p), T = Number(p.tasaCambio) || 0;
  const ap = p.aprobacion || null;
  const aprobado = ap ? conv(num(ap.montoAprobado), monLinea(ap.moneda, B), B, Number(ap.tasaCambio) || T) : 0;
  const gs = (p.gastoReal || []).map(g => ({ ...g, base: conv(num(g.monto), monLinea(g.moneda, B), B, T) }));
  const real = gs.filter(g => g.tipo !== 'compromiso').reduce((s, g) => s + g.base, 0);
  const porCat = {}; CATS.forEach(c => { porCat[c] = 0; });
  gs.filter(g => g.tipo !== 'compromiso').forEach(g => { porCat[CATS.includes(g.categoria) ? g.categoria : 'otro'] += g.base; });
  let comp = 0;
  gs.filter(g => g.tipo === 'compromiso').forEach(oc => {
    const k = K(oc.documento);
    const facturado = k ? gs.filter(g => g.tipo !== 'compromiso' && K(g.ref) === k).reduce((s, g) => s + g.base, 0) : 0;
    comp += Math.max(0, oc.base - facturado);
  });
  const pct = aprobado > 0 ? real / aprobado * 100 : null;
  const sem = pct == null ? 'na' : pct > 100 ? 'bad' : pct >= 90 ? 'warn' : 'ok';
  return { B, T, aprobado, real, comp, exposicion: real + comp, disponible: aprobado - real - comp, desviacion: real + comp - aprobado, pct, sem, porCat, n: gs.length };
}
function avanceTotal(p, cr) {
  const av = p.avance || {}; let a = 0, s = 0;
  (cr.items || []).forEach(x => { const v = av[String(x.i)] || {}; s += x.dur; a += x.dur * Math.min(100, Math.max(0, num(v.pct))) / 100; });
  return s > 0 ? a / s * 100 : 0;
}
// Atraso de cada trabajo vs su fin planificado (en días; 0 = a tiempo).
function atrasoTrabajo(item, av, hoy) {
  av = av || {}; hoy = hoy || fbHoy();
  if (av.fin) return Math.max(0, diasEntre(item.hasta, av.fin));
  if (num(av.pct) < 100 && hoy > item.hasta) return diasEntre(item.hasta, hoy);
  return 0;
}
const CRIT_ORD = { A: 0, B: 1, C: 2, '': 3 };
const critValida = c => (['A', 'B', 'C'].includes(c) ? c : '');
const critDe = p => { const l = (p.equipoIds || []).map(id => critValida(fbCriticidadDeEquipo(id) || ((p.equipos || []).find(e => e && e.id === id) || {}).criticidad)).filter(Boolean); return l.sort((a, b) => CRIT_ORD[a] - CRIT_ORD[b])[0] || ''; };
const naveKey = n => (n ? fbClaveNombre('plantas', n) : '');
// Portafolio: solicitado = todo lo que se mandó a aprobar (sin borradores ni
// cancelados); aprobado y real = aprobados, en ejecución y cerrados.
function calcPortafolio(lista) {
  const z = () => ({ DOP: 0, USD: 0 });
  const add = (o, v, B, T) => { o.DOP += conv(v, B, 'DOP', T); o.USD += conv(v, B, 'USD', T); };
  const P = { n: lista.length, porEstado: {}, sol: z(), apr: z(), real: z(), comp: z(), borr: z(), porNave: new Map(), porTipo: new Map(), filas: [] };
  ESTADOS.forEach(e => { P.porEstado[e] = 0; });
  lista.forEach(p => {
    const tot = calcTotales(p), fin = calcFinanzas(p, tot), ej = calcEjecucion(p), B = tot.B, T = tot.T;
    const est = ESTADOS.includes(p.estado) ? p.estado : 'borrador';
    P.porEstado[est]++;
    const nave = fbNaveDe(p) || '', nk = naveKey(nave) || '~';
    if (!P.porNave.has(nk)) P.porNave.set(nk, { nombre: nave, n: 0, sol: z(), apr: z(), real: z() });
    const tp = TIPOS.includes(p.tipo) ? p.tipo : 'mejora';
    if (!P.porTipo.has(tp)) P.porTipo.set(tp, { tipo: tp, n: 0, sol: z(), apr: z(), real: z() });
    const N = P.porNave.get(nk), TP = P.porTipo.get(tp); N.n++; TP.n++;
    const enviado = !['borrador', 'cancelado'].includes(est);
    if (est === 'borrador') add(P.borr, tot.total, B, T);
    if (enviado) { add(P.sol, tot.total, B, T); add(N.sol, tot.total, B, T); add(TP.sol, tot.total, B, T); }
    if (APROBADOS.includes(est)) {
      [P.apr, N.apr, TP.apr].forEach(o => add(o, ej.aprobado, B, T));
      [P.real, N.real, TP.real].forEach(o => add(o, ej.real, B, T));
      add(P.comp, ej.comp, B, T);
    }
    P.filas.push({ p, tot, fin, ej, crit: critDe(p), nave, est });
  });
  P.filas.sort((a, b) => CRIT_ORD[a.crit] - CRIT_ORD[b.crit] || (a.fin.payback == null) - (b.fin.payback == null) || (a.fin.payback || 0) - (b.fin.payback || 0) || b.tot.total - a.tot.total);
  return P;
}

// Copias que se guardan en el documento (para el Excel y para auditar): totales y cronograma.
function totalesGuardados(p) { const x = calcTotales(p); return { trabajos: r2(x.trabajos), repuestos: r2(x.repuestos), otros: r2(x.otros), subtotal: r2(x.subtotal), contingencia: r2(x.contingencia), itbis: r2(x.itbis), total: r2(x.total), totalDOP: r2(x.totalDOP), totalUSD: r2(x.totalUSD), moneda: x.B, tasaCambio: x.T }; }
function cronoGuardado(p, f) { const c = calcCronograma(p, f); return { fechaInicio: c.fechaInicio, fechaFinProyectada: c.fechaFinProyectada, duracionDias: c.duracionDias, leadTimeMax: c.leadTimeMax, items: c.items.map(x => ({ i: x.i, ini: x.ini, fin: x.fin })), hitos: c.hitos.map(x => ({ k: x.k, fecha: x.fecha })) }; }
