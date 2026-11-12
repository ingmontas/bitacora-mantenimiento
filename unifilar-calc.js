// unifilar-calc.js — (9 nov 2026) Unifilar Pro, entrega 2: cálculos del diagrama unifilar.
// Funciones puras (sin Firebase ni pantalla): reciben la lista de elementos de un plano
// y devuelven, por elemento, tensión, carga conectada, corriente, uso, corriente de
// cortocircuito disponible y caída de tensión, más la lista de errores y avisos.
// Métodos (aproximados, para revisión del ingeniero responsable):
//  · Corriente de motores: NEC tabla 430.250 (trifásicos, 460 V; otras tensiones a escala).
//  · Cortocircuito: método punto a punto (Bussmann) con barra infinita en el primario,
//    aporte de motores 4 × FLA en bornes del transformador, constantes C de cobre en
//    tubería de acero; a través de un transformador aguas abajo, fórmula de Bussmann.
//  · Caída de tensión: VD = √3·K·I·L / CM (K = 12.9 cobre), acumulada desde el transformador.
(function (root) {
  'use strict';
  const R3 = Math.sqrt(3);
  const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; };
  // Tensión de línea en V a partir de "480Y/277 V", "208Y/120", "12.47 kV", "480 V", "277"
  function voltios(s) {
    const t = String(s || '').replace(',', '.');
    const m = /([\d.]+)\s*(k?v)?/i.exec(t);
    if (!m) return 0;
    let v = parseFloat(m[1]) || 0;
    if ((/kv/i.test(m[2] || '') || /k\s*v/i.test(t)) && v < 1000) v *= 1000; // "12.47 kV" → 12470; "12470 V kV" se queda en 12470
    return v;
  }
  // NEC 430.250 — motores trifásicos, corriente a plena carga a 460 V
  const FLA460 = { 0.5: 1.1, 0.75: 1.6, 1: 2.1, 1.5: 3, 2: 3.4, 3: 4.8, 5: 7.6, 7.5: 11, 10: 14, 15: 21, 20: 27, 25: 34, 30: 40, 40: 52, 50: 65, 60: 77, 75: 96, 100: 124, 125: 156, 150: 180, 200: 240, 250: 302, 300: 361, 350: 414, 400: 477, 450: 515, 500: 590 };
  function flaMotor(hp, v) {
    hp = num(hp); if (!hp) return 0;
    const ks = Object.keys(FLA460).map(Number).sort((a, b) => a - b);
    let a460;
    if (FLA460[hp] !== undefined) a460 = FLA460[hp];
    else { // interpolación lineal entre potencias de la tabla
      let lo = ks[0], hi = ks[ks.length - 1];
      for (const k of ks) { if (k <= hp) lo = k; if (k >= hp) { hi = k; break; } }
      a460 = hi === lo ? FLA460[lo] * hp / lo : FLA460[lo] + (FLA460[hi] - FLA460[lo]) * (hp - lo) / (hi - lo);
    }
    v = v || 460;
    // NEC: la columna de 230 V es 2 × la de 460 V y la de 208 V ≈ 2.2 ×; otras tensiones a escala
    const f = v <= 210 ? 2.2 : v <= 240 ? 2 : v >= 440 && v <= 500 ? 1 : 460 / v; // columnas NEC de 208, 230 y 460 V
    return a460 * f;
  }
  // Conductor: "4 × (3#500 kcmil + 1#3/0 T)" → { n: 4, cal: '500' }; "3#4/0 + 1#4 T" → { n: 1, cal: '4/0' }
  function conductor(s) {
    const t = String(s || '').replace(/\s+/g, ' ');
    const pm = /(\d+)\s*[×xX*]?\s*\(/.exec(t);
    const m = /(\d+)\s*#\s*([\d/]+)/.exec(t) || /()#\s*([\d/]+)/.exec(t);
    if (!m) return null;
    // "2×(3#4/0)" o "2(3#4/0)" = 2 juegos en paralelo; "6#4/0" = 6 conductores de fase = 2 por fase
    const k = parseInt(m[1], 10) || 0;
    const n = pm ? Math.max(1, parseInt(pm[1], 10)) : (k >= 6 ? Math.floor(k / 3) : 1);
    return { n, cal: m[2] };
  }
  // Constantes C (cobre, tres conductores en tubería de acero, 600 V) y área en circular mils
  const C = { '14': 389, '12': 617, '10': 982, '8': 1559, '6': 2425, '4': 3806, '3': 4774, '2': 5907, '1': 7293, '1/0': 8925, '2/0': 10755, '3/0': 12844, '4/0': 15082, '250': 16483, '300': 18177, '350': 19704, '400': 20566, '500': 22185, '600': 22965, '750': 24137 };
  const CM = { '14': 4110, '12': 6530, '10': 10380, '8': 16510, '6': 26240, '4': 41740, '3': 52620, '2': 66360, '1': 83690, '1/0': 105600, '2/0': 133100, '3/0': 167800, '4/0': 211600 };
  const cmDe = cal => CM[cal] || (num(cal) >= 250 ? num(cal) * 1000 : 0);

  function calcular(lista, opts) {
    opts = opts || {};
    const N = new Map(lista.map(n => [n.id, n]));
    const hijos = new Map(); lista.forEach(n => { const p = N.has(n.padreId) ? n.padreId : ''; if (!hijos.has(p)) hijos.set(p, []); hijos.get(p).push(n); });
    const kids = id => hijos.get(id) || [];
    const R = new Map(); lista.forEach(n => R.set(n.id, { v: 0, kva: 0, i: 0, fla: 0, motFla: 0, isc: 0, vd: 0, vdTot: 0, uso: null, propio: 0, problemas: [] }));
    const vSis = voltios(opts.sistema) || 480;
    // 1) Tensión de cada elemento (de arriba hacia abajo)
    const ponerV = (n, vPadre) => {
      const e = n.e || {}, r = R.get(n.id);
      let v = vPadre;
      if (n.tipo === 'acometida') v = voltios((e.kv ? e.kv + ' kV' : '')) || vPadre;
      if (n.tipo === 'transformador') v = voltios(e.vs) || vPadre;
      if (['tablero', 'ccm', 'generador', 'inversor'].includes(n.tipo) && voltios(e.v)) v = voltios(e.v); // (v73) inversor
      if (n.tipo === 'carga' && voltios(e.v)) r.vCarga = voltios(e.v);
      r.v = v;
      kids(n.id).forEach(h => ponerV(h, v));
    };
    kids('').forEach(n => ponerV(n, n.tipo === 'acometida' ? 0 : vSis));
    // 2) Carga propia de cada carga (kVA) y corriente de motores
    lista.forEach(n => {
      if (n.tipo !== 'carga') return;
      const e = n.e || {}, r = R.get(n.id);
      const v = r.vCarga || r.v || vSis;
      const mono = v > 0 && v <= 277 && !/3/.test(String(e.fases || ''));
      let fla = num(e.fla);
      if (!fla && num(e.hp)) fla = flaMotor(e.hp, v);
      let kva = 0;
      if (fla) kva = (mono ? v * fla : R3 * v * fla) / 1000;
      else if (num(e.kw)) kva = num(e.kw) / (num(e.fp) || 0.9);
      r.propio = kva; r.fla = fla;
      if (n.cargaTipo === 'motor' || num(e.hp)) r.motFla = fla || (kva * 1000 / (R3 * (v || vSis)));
    });
    // 3) Carga conectada acumulada (de abajo hacia arriba)
    const sumar = n => { const r = R.get(n.id); let kva = r.propio, mot = r.motFla; kids(n.id).forEach(h => { const s = sumar(h); kva += s.kva; mot += s.mot; }); r.kva = kva; r.motAcum = mot; return { kva, mot }; };
    kids('').forEach(sumar);
    lista.forEach(n => { const r = R.get(n.id); const v = r.v || vSis; r.i = r.kva && v ? r.kva * 1000 / (R3 * v) : 0; if (n.tipo === 'carga' && r.fla) r.i = r.fla; });
    // 4) Cortocircuito y caída de tensión (de arriba hacia abajo)
    const bajar = (n, iscPadre, vdPadre, vPadre) => {
      const e = n.e || {}, r = R.get(n.id);
      let isc = iscPadre, vdTot = vdPadre;
      // tramo de cable que llega a este elemento (su conductor y largo)
      const cd = conductor(n.calibre), L = num(e.largo) * 3.281;
      const vTramo = r.v || vPadre || vSis;
      if (cd && L > 0 && isc > 0 && C[cd.cal]) {
        const f = R3 * L * isc / (C[cd.cal] * cd.n * vTramo);
        isc = isc / (1 + f);
      }
      if (cd && L > 0 && r.i > 0 && cmDe(cd.cal)) {
        const vd = R3 * 12.9 * r.i * L / (cmDe(cd.cal) * cd.n);
        r.vd = vTramo ? vd / vTramo * 100 : 0;
        vdTot += r.vd;
      }
      if (n.tipo === 'transformador') {
        const kva = num(e.kva), z = num(e.z), vs = voltios(e.vs) || r.v, vp = voltios(e.vp) || vPadre;
        if (kva && z && vs) {
          const fla = kva * 1000 / (R3 * vs);
          if (iscPadre > 0 && vp) { const f = iscPadre * vp * R3 * z / (100000 * kva); isc = iscPadre * (vp / vs) / (1 + f); }
          else isc = fla * 100 / z;
          isc += 4 * (r.motAcum || 0); // aporte de motores
          r.iscInf = !(iscPadre > 0 && vp);
        } else isc = 0;
        vdTot = 0; // la caída se cuenta desde el transformador
      }
      if (n.tipo === 'acometida') isc = 0;
      r.isc = isc; r.vdTot = vdTot;
      kids(n.id).forEach(h => bajar(h, isc, vdTot, r.v || vPadre));
    };
    kids('').forEach(n => bajar(n, 0, 0, vSis));
    // 5) Revisiones: capacidad de cortocircuito, sobrecarga, uso y caída
    const prob = (n, nivel, clave, p) => R.get(n.id).problemas.push({ id: n.id, nombre: n.nombre, nivel, clave, p: p || {} });
    lista.forEach(n => {
      const e = n.e || {}, r = R.get(n.id);
      const padre = N.get(n.padreId), iscLinea = padre ? R.get(padre.id).isc : r.isc;
      if (['interruptor', 'tablero', 'ccm', 'transferencia', 'interruptor_mt', 'reconectador'].includes(n.tipo) && num(e.kaic)) {
        const disp = (['interruptor', 'interruptor_mt', 'reconectador'].includes(n.tipo) ? iscLinea : r.isc) / 1000;
        if (disp > num(e.kaic)) prob(n, 'error', 'kaic', { ka: disp.toFixed(1), cap: num(e.kaic) });
      }
      let cap = 0;
      if (n.tipo === 'transformador') { cap = num(e.kva); if (cap) r.uso = r.kva / cap * 100; }
      else if (['interruptor', 'tablero', 'ccm', 'transferencia', 'fusible', 'seccionador', 'interruptor_mt', 'reconectador', 'diferencial', 'contactor', 'arrancador_suave', 'reactor'].includes(n.tipo) && num(e.amp)) { r.uso = r.i / num(e.amp) * 100; }
      else if (n.tipo === 'inversor' && num(e.kw)) r.uso = r.kva / (num(e.kw) / 0.9) * 100; // (v73)
      else if (n.tipo === 'ups' && num(e.kva)) r.uso = r.kva / num(e.kva) * 100;
      if (r.uso !== null && r.kva > 0) {
        if (r.uso > 100) prob(n, 'error', 'sobrecarga', { uso: Math.round(r.uso) });
        else if (r.uso > 80) prob(n, 'aviso', 'uso80', { uso: Math.round(r.uso) });
      }
      if (r.vd > 3) prob(n, 'aviso', 'vd3', { vd: r.vd.toFixed(1) });
      if (r.vdTot > 5 && n.tipo === 'carga') prob(n, 'aviso', 'vd5', { vd: r.vdTot.toFixed(1) });
    });
    // Planta de emergencia: cuánto de la carga de su transferencia puede tomar
    lista.forEach(n => {
      if (n.tipo !== 'transferencia' || !n.respaldoId || !N.has(n.respaldoId)) return;
      const g = N.get(n.respaldoId), eg = g.e || {}, cap = num(eg.kva) || (num(eg.kw) ? num(eg.kw) / 0.8 : 0);
      const r = R.get(n.id), rg = R.get(g.id);
      if (cap && r.kva) { rg.cubre = cap / r.kva * 100; if (rg.cubre < 100) prob(g, 'aviso', 'gen', { pct: Math.round(rg.cubre) }); }
    });
    const problemas = []; R.forEach(r => problemas.push(...r.problemas));
    problemas.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'error' ? -1 : 1));
    return { R, problemas, errores: problemas.filter(p => p.nivel === 'error').length, avisos: problemas.filter(p => p.nivel === 'aviso').length };
  }
  const api = { calcular, voltios, flaMotor, conductor, C, CM };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.UnifilarCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
