// oee-calc.js — (10 nov 2026) Paros y OEE: cálculo puro (sin Firebase), lo usan oee.html y las pruebas.
//
// OEE = Disponibilidad × Rendimiento × Calidad (método de Nakajima, como lo explica Vorne / OEE.com):
//   Tiempo del turno            = Σ minutos de los turnos registrados (/produccion)
//   Tiempo planificado          = turno − paros que NO cuentan (comida, sin programa, reunión, preventivo programado)
//   Tiempo operativo            = planificado − paros que sí cuentan (fallas, cambios, falta de material…)
//   Disponibilidad              = operativo / planificado
//   Rendimiento                 = (producción total ÷ ritmo ideal) / operativo
//   Calidad                     = (total − malas) / total
// Los minutos de máquina parada por falla salen de las OTs de mantenimiento (TOTAL_MIN_MAQUINA): no se
// vuelven a anotar como paro, así no se cuentan dos veces. Solo cuentan los días que tienen turno registrado.
(function (raiz) {
  'use strict';
  // clase: 'fuera' = fuera del tiempo planificado (no baja el OEE) · 'plan' = parada planificada · 'noplan' = no planificada
  const CATEGORIAS = [
    { k: 'falla', t: 'Falla de máquina (mantenimiento)', clase: 'noplan', ot: true },
    { k: 'material', t: 'Falta de material', clase: 'noplan' },
    { k: 'operador', t: 'Falta de operador', clase: 'noplan' },
    { k: 'calidad', t: 'Problema de calidad o ajuste de proceso', clase: 'noplan' },
    { k: 'servicios', t: 'Falta de energía, aire o agua', clase: 'noplan' },
    { k: 'otro', t: 'Otro', clase: 'noplan' },
    { k: 'cambio', t: 'Cambio de producto o ajuste', clase: 'plan' },
    { k: 'limpieza', t: 'Limpieza', clase: 'plan' },
    { k: 'comida', t: 'Comida o descanso', clase: 'fuera' },
    { k: 'sinprograma', t: 'Sin programa de producción', clase: 'fuera' },
    { k: 'reunion', t: 'Reunión o capacitación', clase: 'fuera' },
    { k: 'preventivo', t: 'Mantenimiento preventivo programado', clase: 'fuera', ot: true },
  ];
  const CAT = {}; CATEGORIAS.forEach(c => { CAT[c.k] = c; });
  // Las que se anotan a mano en /paros (las otras dos salen de las OTs)
  const CAT_MANUAL = CATEGORIAS.filter(c => !c.ot).map(c => c.k);
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const FECHA = /^\d{4}-\d{2}-\d{2}$/;

  // 'YYYY-MM-DDTHH:MM' → minutos desde 1970 (hora local)
  function minutosDe(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(s || ''));
    if (!m) return null;
    return Math.floor(new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime() / 60000);
  }
  function duracion(inicio, fin) {
    const a = minutosDe(inicio), b = minutosDe(fin);
    if (a == null || b == null) return null;
    return Math.max(0, b - a);
  }
  // Minutos de un paro: cerrado = min guardado; abierto = lo que lleva hasta ahora.
  function minParo(p, ahora) {
    if (!p || p.estado === 'anulado') return 0;
    if (p.estado === 'abierto') {
      const a = minutosDe(p.inicio); if (a == null) return 0;
      const n = Math.floor((ahora instanceof Date ? ahora : new Date()).getTime() / 60000);
      return Math.max(0, Math.min(1440 * 14, n - a));
    }
    return Math.max(0, num(p.min));
  }
  // OT → { equipoId, fecha, min, cat } o null si no cuenta (anulada, proyecto, avisos sin cerrar, sin minutos)
  function otComoParo(d) {
    if (!d || d.estado === 'anulada' || d.tipoReporte === 'proyecto') return null;
    if (['operador', 'checklist', 'qr'].includes(d.origen) && d.estado !== 'completada') return null;
    const min = num(d.TOTAL_MIN_MAQUINA);
    const fecha = String(d.FECHA || '');
    if (!(min > 0) || !FECHA.test(fecha) || !d.equipoId) return null;
    const t = String(d.TIPO_MANTENIMIENTO || '').toLowerCase();
    const cat = t === 'correctivo' ? 'falla' : (t === 'preventivo' || t === 'predictivo') ? 'preventivo' : null;
    if (!cat) return null;
    return { equipoId: d.equipoId, fecha, min, cat, ot: d.folio || d.Title || '' };
  }
  function nivel(oee) {
    if (oee == null) return '';
    if (oee >= 0.85) return 'mundial';
    if (oee >= 0.60) return 'tipico';
    if (oee >= 0.40) return 'bajo';
    return 'critico';
  }

  // datos: { produccion: [], paros: [], ots: [docs crudos de /ots], desde, hasta, ahora }
  function calcular(datos) {
    const desde = datos.desde || '0000-00-00', hasta = datos.hasta || '9999-12-31';
    const enRango = f => FECHA.test(f) && f >= desde && f <= hasta;
    const ahora = datos.ahora || new Date();
    const prods = (datos.produccion || []).filter(p => p && p.equipoId && enRango(p.fecha) && num(p.minTurno) > 0);
    // todos los paros del rango (para el Pareto), con su minuto y clase
    const paros = [];
    (datos.paros || []).forEach(p => {
      if (!p || p.estado === 'anulado' || !CAT[p.categoria] || !enRango(p.fecha)) return;
      paros.push({ equipoId: p.equipoId, fecha: p.fecha, min: minParo(p, ahora), cat: p.categoria, abierto: p.estado === 'abierto' });
    });
    (datos.ots || []).forEach(d => { const x = otComoParo(d); if (x && enRango(x.fecha)) paros.push(x); });

    const dia = (e, f) => e + '|' + f;
    const conTurno = new Set(prods.map(p => dia(p.equipoId, p.fecha)));
    const E = new Map();
    const eq = id => { if (!E.has(id)) E.set(id, { equipoId: id, turnos: 0, minTurno: 0, fuera: 0, plan: 0, noplan: 0, total: 0, malas: 0, idealMin: 0, sinRitmo: 0, unidad: '', porCat: {}, sinTurno: 0 }); return E.get(id); };
    prods.forEach(p => {
      const x = eq(p.equipoId); x.turnos++; x.minTurno += num(p.minTurno);
      const tot = Math.max(0, num(p.total)), malas = Math.min(tot, Math.max(0, num(p.malas))), r = num(p.ritmoIdeal);
      x.total += tot; x.malas += malas; if (!x.unidad && p.unidad) x.unidad = p.unidad;
      if (r > 0) x.idealMin += tot / r * 60; else if (tot > 0) x.sinRitmo++;
    });
    const pareto = {}; let sinTurnoMin = 0;
    paros.forEach(p => {
      pareto[p.cat] = (pareto[p.cat] || 0) + p.min;
      const x = eq(p.equipoId);
      if (!conTurno.has(dia(p.equipoId, p.fecha))) { x.sinTurno += p.min; sinTurnoMin += p.min; return; }
      x[CAT[p.cat].clase] += p.min;
      x.porCat[p.cat] = (x.porCat[p.cat] || 0) + p.min;
    });
    // indicadores de un grupo de sumas
    const ind = x => {
      const planificado = Math.max(0, x.minTurno - x.fuera);
      const perdido = Math.min(planificado, x.plan + x.noplan);
      const operativo = planificado - perdido;
      const A = planificado > 0 ? operativo / planificado : null;
      let P = null, Pcrudo = null;
      if (operativo > 0 && !x.sinRitmo && x.total > 0) { Pcrudo = x.idealMin / operativo; P = Math.min(1, Pcrudo); }
      else if (operativo === 0 && planificado > 0 && x.total === 0) P = 0;
      const Q = x.total > 0 ? (x.total - x.malas) / x.total : null;
      const oee = A != null && P != null && Q != null ? A * P * Q : (A === 0 ? 0 : null);
      return { planificado, operativo, perdido, A, P, Q, oee, nivel: nivel(oee), rendimientoAlto: Pcrudo != null && Pcrudo > 1.05 };
    };
    const equipos = [];
    E.forEach(x => {
      const top = Object.entries(x.porCat).sort((a, b) => b[1] - a[1])[0];
      equipos.push(Object.assign({}, x, ind(x), { topCat: top ? top[0] : '', topMin: top ? top[1] : 0 }));
    });
    equipos.sort((a, b) => (a.oee == null) - (b.oee == null) || (a.oee || 0) - (b.oee || 0) || b.perdido - a.perdido);
    // planta: suma de todos los equipos con turno
    const tot = { minTurno: 0, fuera: 0, plan: 0, noplan: 0, total: 0, malas: 0, idealMin: 0, sinRitmo: 0, turnos: 0 };
    equipos.forEach(x => { if (x.turnos) Object.keys(tot).forEach(k => { tot[k] += x[k]; }); });
    const planta = Object.assign(tot, ind(tot));
    // (v71) TEEP y paros como % del tiempo planificado (campos nuevos; los de arriba no cambian).
    // Tiempo calendario = 24 h por cada máquina y día con turno registrado.
    planta.calendario = conTurno.size * 1440;
    planta.teep = planta.oee != null && planta.calendario > 0 ? Math.min(planta.oee, planta.oee * planta.planificado / planta.calendario) : null;
    planta.pNoPlan = planta.planificado > 0 ? Math.min(planta.planificado, planta.noplan) / planta.planificado : null;
    planta.pPlan = planta.planificado > 0 ? Math.min(planta.planificado, planta.plan) / planta.planificado : null;
    // tendencia por día (planta)
    const D = new Map();
    prods.forEach(p => {
      if (!D.has(p.fecha)) D.set(p.fecha, { fecha: p.fecha, minTurno: 0, fuera: 0, plan: 0, noplan: 0, total: 0, malas: 0, idealMin: 0, sinRitmo: 0 });
      const d = D.get(p.fecha), t = Math.max(0, num(p.total)), r = num(p.ritmoIdeal);
      d.minTurno += num(p.minTurno); d.total += t; d.malas += Math.min(t, Math.max(0, num(p.malas)));
      if (r > 0) d.idealMin += t / r * 60; else if (t > 0) d.sinRitmo++;
    });
    paros.forEach(p => { const d = D.get(p.fecha); if (d && conTurno.has(dia(p.equipoId, p.fecha))) d[CAT[p.cat].clase] += p.min; });
    const dias = [...D.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).map(d => Object.assign({ fecha: d.fecha }, ind(d)));
    const paretoL = Object.entries(pareto).filter(([, m]) => m > 0).map(([k, m]) => ({ cat: k, min: m, clase: CAT[k].clase })).sort((a, b) => b.min - a.min);
    return { planta, equipos, dias, pareto: paretoL, sinTurnoMin, paros: paros.length };
  }

  const api = { CATEGORIAS, CAT, CAT_MANUAL, calcular, duracion, minutosDe, minParo, otComoParo, nivel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.OEECalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
