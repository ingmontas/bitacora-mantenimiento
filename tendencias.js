// tendencias.js — (28 oct 2026) TENDENCIAS DE MEDICIONES (predictivo real)
// ══════════════════════════════════════════════════════════════════════
// Los puntos de checklist con medición ({p, unidad, min, max}) guardan la
// lectura en /checklists.items[] = { punto, resultado, valor, unidad, min, max }.
// Aquí se juntan las lecturas de un equipo + punto en el tiempo y se avisa
// ANTES de que la lectura se salga del rango:
//   ⛔ Fuera de rango  la última lectura ya está fuera (mín / máx).
//   ⚠️ Tendencia       las últimas 3 lecturas van siempre hacia un límite
//                      (cada una más cerca que la anterior) Y la recta de las
//                      últimas 5 lecturas (mínimos cuadrados, días en el eje x)
//                      cruza ese límite antes de 2 intervalos de checklist
//                      (intervalo = frecuencia del equipo en días o, si no
//                      tiene, la mediana entre esas lecturas).
//   🟡 Cerca del límite la última lectura está a 10 % o menos del límite
//                      (10 % del rango mín–máx; con un solo límite, 10 % de
//                      su valor).
// Urgencia: fuera > tendencia > cerca; después criticidad A > B > C > sin
// evaluar; después menos días hasta el límite.
// Lecturas: este archivo NO lee nada; cada pantalla le pasa los checklists
// que ya tiene (ver cada pantalla). Crear una OT desde una alerta usa el
// mismo documento y el mismo control de repetidas que el checklist
// (fbOtChecklistDoc / fbOtChecklistAbierta): 1 escritura + el folio.
// ══════════════════════════════════════════════════════════════════════
(function () {
  const N_AJUSTE = 5, N_SEGUIDAS = 3, INTERVALOS = 2, PCT_CERCA = 0.10;
  const numOk = v => v !== undefined && v !== null && v !== '' && !isNaN(Number(v));
  const esc = s => fbEsc(s);
  const K = s => fbEquipoKey(s);
  const msDe = c => { const t = c && c.createdAt; if (t && typeof t.toMillis === 'function') return t.toMillis(); if (t && typeof t.seconds === 'number') return t.seconds * 1000; return 0; };
  const diasDe = f => { const d = fbParseFecha(f); return d ? d.getTime() / 86400000 : null; };

  // ── Lecturas por equipo + punto ──
  // checklists: [{id, equipoId, equipoNombre, equipoLocalidad, planta, fecha, createdAt, items:[…]}]
  // → Map clave 'equipoId|punto' → { equipoId, equipoNombre, equipoLocalidad, planta, punto, lecturas:[{fecha, valor, min, max, unidad, ckId, ms}] }
  function agrupar(checklists) {
    const m = new Map();
    (checklists || []).forEach(c => {
      if (!c || !c.equipoId || !fbParseFecha(c.fecha)) return;
      (Array.isArray(c.items) ? c.items : []).forEach(i => {
        if (!i || !i.punto || !numOk(i.valor)) return;
        if (!numOk(i.min) && !numOk(i.max)) return; // sin límites no hay tendencia que vigilar
        const k = c.equipoId + '|' + K(i.punto);
        let g = m.get(k);
        if (!g) { g = { key: k, equipoId: c.equipoId, equipoNombre: c.equipoNombre || '', equipoLocalidad: c.equipoLocalidad || '', planta: c.planta || '', punto: String(i.punto), lecturas: [] }; m.set(k, g); }
        g.lecturas.push({ fecha: String(c.fecha), valor: Number(i.valor), min: numOk(i.min) ? Number(i.min) : null, max: numOk(i.max) ? Number(i.max) : null, unidad: String(i.unidad || ''), ckId: c.id || '', ms: msDe(c) });
      });
    });
    m.forEach(g => {
      const vistos = new Set();
      g.lecturas = g.lecturas.filter(l => { const id = l.ckId ? l.ckId : l.fecha + '|' + l.valor; if (vistos.has(id)) return false; vistos.add(id); return true; })
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.ms - b.ms);
      const u = g.lecturas[g.lecturas.length - 1];
      if (u) { g.unidad = u.unidad; if (!g.equipoNombre) g.equipoNombre = ''; }
    });
    return m;
  }

  // Recta de mínimos cuadrados y = a + b·x
  function ajuste(xs, ys) {
    const n = xs.length; if (n < 2) return null;
    const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
    let sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
    if (sxx === 0) return null;
    const b = sxy / sxx;
    return { a: my - b * mx, b };
  }
  const mediana = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); const h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

  // lecturas (ordenadas) + opts { intervaloDias } → alerta o null
  // { nivel: 'fuera'|'tendencia'|'cerca', ultimo, min, max, unidad, limite: 'max'|'min', proyectado,
  //   diasAlLimite, intervalo, texto, ajuste:{a,b,x0}, xs }
  function evaluar(lecturas, opts) {
    opts = opts || {};
    const L = (lecturas || []).filter(l => numOk(l.valor) && fbParseFecha(l.fecha));
    if (!L.length) return null;
    const u = L[L.length - 1];
    const min = u.min, max = u.max, v = u.valor, uni = u.unidad ? ' ' + u.unidad : '';
    if (min == null && max == null) return null;
    const base = { ultimo: v, fecha: u.fecha, min, max, unidad: u.unidad || '', n: L.length };
    if ((max != null && v > max) || (min != null && v < min)) {
      const lim = max != null && v > max ? 'max' : 'min';
      return { ...base, nivel: 'fuera', limite: lim, diasAlLimite: 0, texto: `Última lectura ${fmt(v)}${uni} fuera del rango (${lim === 'max' ? 'máx. ' + fmt(max) : 'mín. ' + fmt(min)}${uni})` };
    }
    // ── tendencia ──
    let tend = null;
    if (L.length >= N_SEGUIDAS) {
      const ult = L.slice(-N_SEGUIDAS).map(l => l.valor);
      const sube = ult.every((x, i) => i === 0 || x > ult[i - 1]);
      const baja = ult.every((x, i) => i === 0 || x < ult[i - 1]);
      const lim = sube && max != null ? 'max' : baja && min != null ? 'min' : '';
      if (lim) {
        const P = L.slice(-N_AJUSTE);
        const x0 = diasDe(P[0].fecha);
        let xs = P.map(l => diasDe(l.fecha) - x0);
        if (xs.every(x => x === xs[0])) xs = P.map((l, i) => i); // todas el mismo día: por orden
        const f = ajuste(xs, P.map(l => l.valor));
        const difs = []; for (let i = 1; i < xs.length; i++) if (xs[i] > xs[i - 1]) difs.push(xs[i] - xs[i - 1]);
        const intervalo = Number(opts.intervaloDias) > 0 ? Number(opts.intervaloDias) : (mediana(difs) || 1);
        if (f && ((lim === 'max' && f.b > 0) || (lim === 'min' && f.b < 0))) {
          const xL = xs[xs.length - 1], xP = xL + INTERVALOS * intervalo;
          const proy = f.a + f.b * xP;
          const limV = lim === 'max' ? max : min;
          const cruza = lim === 'max' ? proy > limV : proy < limV;
          if (cruza) {
            const enX = (limV - f.a) / f.b; // x donde la recta toca el límite
            const dias = Math.max(0, Math.round(enX - xL));
            tend = { ...base, nivel: 'tendencia', limite: lim, proyectado: proy, diasAlLimite: dias, intervalo, ajuste: { a: f.a, b: f.b, x0 }, xs,
              texto: `${lim === 'max' ? 'Sube' : 'Baja'} en las últimas ${N_SEGUIDAS} lecturas: llegaría al ${lim === 'max' ? 'máximo' : 'mínimo'} (${fmt(limV)}${uni}) en unos ${dias} día${dias === 1 ? '' : 's'} (en ${INTERVALOS} checklists: ${fmt(proy)}${uni})` };
          }
        }
      }
    }
    if (tend) return tend;
    // ── cerca del límite ──
    const margen = lim => (min != null && max != null) ? (max - min) * PCT_CERCA : Math.abs(lim) * PCT_CERCA;
    const cMax = max != null && (max - v) <= margen(max), cMin = min != null && (v - min) <= margen(min);
    if (cMax || cMin) {
      const lim = cMax && cMin ? ((max - v) <= (v - min) ? 'max' : 'min') : cMax ? 'max' : 'min';
      return { ...base, nivel: 'cerca', limite: lim, diasAlLimite: null, texto: `Última lectura ${fmt(v)}${uni} muy cerca del ${lim === 'max' ? 'máximo (' + fmt(max) : 'mínimo (' + fmt(min)}${uni})` };
    }
    return null;
  }
  function fmt(n) { if (!isFinite(n)) return '—'; const r = Math.round(n * 100) / 100; return r.toLocaleString('es-DO', { maximumFractionDigits: 2 }); }

  const RANGO = { fuera: 0, tendencia: 1, cerca: 2 };
  const CRIT = { A: 0, B: 1, C: 2 };
  function ordenar(lista) {
    return lista.sort((a, b) => RANGO[a.alerta.nivel] - RANGO[b.alerta.nivel] || (CRIT[a.crit] ?? 3) - (CRIT[b.crit] ?? 3)
      || (a.alerta.diasAlLimite ?? 1e9) - (b.alerta.diasAlLimite ?? 1e9) || String(a.equipoNombre).localeCompare(String(b.equipoNombre), 'es'));
  }
  // Todas las alertas de unos checklists. frecDe(equipoId) → días; critDe(equipoId) → 'A'|'B'|'C'|''.
  function alertas(checklists, opts) {
    opts = opts || {};
    const out = [];
    agrupar(checklists).forEach(g => {
      const a = evaluar(g.lecturas, { intervaloDias: opts.frecDe ? opts.frecDe(g.equipoId) : null });
      if (a) out.push({ ...g, alerta: a, crit: opts.critDe ? opts.critDe(g.equipoId) || '' : '' });
    });
    return ordenar(out);
  }
  const NIVEL_TXT = { fuera: '⛔ Fuera de rango', tendencia: '⚠️ Tendencia', cerca: '🟡 Cerca del límite' };
  function badge(a) { return a ? `<span class="tend-badge tend-${a.nivel}" data-tend="${a.nivel}">${NIVEL_TXT[a.nivel]}</span>` : ''; }

  // ── OT desde el checklist (mismo documento y mismo control de repetidas) ──
  const ESTADOS_ABIERTAS = ['pendiente', 'planificada', 'en_revision', 'rechazada', 'validada'];
  // ¿Ya hay una OT de checklist abierta para ese punto del equipo? (igual que submitChecklist)
  function otAbierta(ots, equipoId, punto) {
    return (ots || []).find(o => o && o.equipoId === equipoId && o.origen === 'checklist' && ESTADOS_ABIERTAS.includes(o.estado)
      && (o.puntoChecklist === punto || (o.descripcionFalla || '').startsWith(punto))) || null;
  }
  // p = { folio, equipo:{id,nombre,localidad}, planta, descripcionFalla, punto, foto, causa, prioridad, checklistId, creador, extra }
  function otDoc(p) {
    const e = p.equipo || {};
    return {
      origen: 'checklist',
      estado: 'pendiente',
      folio: p.folio,
      equipoId: e.id,
      ...(p.planta ? { planta: p.planta } : {}),
      equipoNombre: e.nombre || '',
      equipoLocalidad: e.localidad || '',
      descripcionFalla: p.descripcionFalla,
      puntoChecklist: p.punto,
      ...(p.foto ? { foto: p.foto } : {}),
      causaFalla: p.causa || '',
      prioridad: p.prioridad || 'media',
      checklistId: p.checklistId || null,
      asignadoA: null,
      fechaPlanificada: null,
      creadoPor: p.creador || '',
      creadoPorUid: (window.currentUser && window.currentUser.uid) || '',
      createdAt: fbTimestamp(),
      ...(p.extra || {}),
    };
  }
  // Desde una alerta (Análisis / Hoja de vida). g = grupo con alerta; ots = OTs abiertas en memoria.
  async function crearOtDesdeAlerta(g, ots, opts) {
    opts = opts || {};
    const ya = otAbierta(ots, g.equipoId, g.punto);
    if (ya) return { existente: ya.folio || ya.id };
    const a = g.alerta, uni = a.unidad ? ' ' + a.unidad : '';
    const ult = g.lecturas[g.lecturas.length - 1] || {};
    const rango = a.min != null && a.max != null ? `${fmt(a.min)} – ${fmt(a.max)}${uni}` : a.min != null ? `mín. ${fmt(a.min)}${uni}` : `máx. ${fmt(a.max)}${uni}`;
    const folio = await fbFolioNuevo();
    const eq = { id: g.equipoId, nombre: g.equipoNombre || (opts.equipo && opts.equipo.nombre) || '', localidad: g.equipoLocalidad || (opts.equipo && opts.equipo.localidad) || '' };
    const planta = (typeof fbPlantaDeEquipo === 'function' ? fbPlantaDeEquipo(eq.id) : '') || g.planta || '';
    const quien = (window.currentUserRole && window.currentUserRole.nombre) || (window.currentUser && window.currentUser.email) || '';
    const doc = otDoc({ folio, equipo: eq, planta, punto: g.punto, prioridad: a.nivel === 'fuera' || g.crit === 'A' ? 'alta' : 'media', checklistId: ult.ckId || null, creador: quien,
      descripcionFalla: `${g.punto} (${NIVEL_TXT[a.nivel].replace(/^\S+\s/, '')}: lectura ${fmt(a.ultimo)}${uni}, rango ${rango}) — ${a.texto}`.slice(0, 1000),
      extra: { origenAlerta: 'tendencia', alertaNivel: a.nivel } });
    const ref = db.collection('ots').doc();
    ref.set(doc).catch(e => (typeof fbAviso === 'function' ? fbAviso : console.warn)('❌ La OT no se guardó: ' + (e && e.code === 'permission-denied' ? 'permiso denegado' : (e && e.message) || e), 'error'));
    const local = { id: ref.id, ...doc };
    if (Array.isArray(ots)) ots.push(local); // así un segundo toque no la repite
    return { creada: local };
  }

  // ── Gráfica (Chart.js): lecturas, banda mín–máx, límites con su nombre y proyección ──
  function CT(v, d) { try { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d; } catch (e) { return d; } }
  const SERIE = '#3987e5';
  function etiquetaFecha(f) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ''); return m ? m[3] + '/' + m[2] : f; }
  function chartConfig(g) {
    const L = g.lecturas.slice(-20), a = g.alerta;
    const u = L[L.length - 1] || {};
    const min = u.min, max = u.max, uni = u.unidad ? ' ' + u.unidad : '';
    const labels = L.map(l => etiquetaFecha(l.fecha));
    const proy = a && a.nivel === 'tendencia' ? a.proyectado : null;
    if (proy != null) labels.push('en ' + INTERVALOS + ' checklists');
    const n = labels.length;
    const serie = L.map(l => l.valor).concat(proy != null ? [null] : []);
    const ds = [];
    const lineaCte = (v) => Array(n).fill(v);
    const banda = CT('--color-success-soft', 'rgba(16,185,129,.16)'), lim = CT('--color-danger', '#dc2626');
    if (min != null) ds.push({ label: 'Mínimo', data: lineaCte(min), borderColor: lim, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: false, _lim: 'mín. ' + fmt(min) + uni });
    if (max != null) ds.push({ label: 'Máximo', data: lineaCte(max), borderColor: lim, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, fill: min != null ? '-1' : false, backgroundColor: banda, _lim: 'máx. ' + fmt(max) + uni });
    ds.push({ label: g.punto, data: serie, borderColor: SERIE, backgroundColor: SERIE, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0, fill: false, spanGaps: false });
    if (proy != null) ds.push({ label: 'Proyección', data: Array(n - 2).fill(null).concat([L[L.length - 1].valor, proy]), borderColor: SERIE, borderDash: [3, 3], borderWidth: 2, pointRadius: [0, 4], pointStyle: 'rectRot', fill: false });
    const etiquetasLimite = {
      id: 'fbTendLimites',
      afterDatasetsDraw(chart) {
        const { ctx, chartArea } = chart;
        ctx.save(); ctx.font = '600 11px Barlow, system-ui, sans-serif'; ctx.fillStyle = CT('--color-danger-text', '#b91c1c'); ctx.textAlign = 'right';
        chart.data.datasets.forEach((d, i) => {
          if (!d._lim) return;
          const meta = chart.getDatasetMeta(i); const p = meta && meta.data && meta.data[meta.data.length - 1]; if (!p) return;
          ctx.fillText(d._lim, chartArea.right - 2, p.y + (d.label === 'Máximo' ? -5 : 13));
        });
        ctx.restore();
      },
    };
    return {
      type: 'line',
      data: { labels, datasets: ds },
      options: { maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, datalabels: { display: false },
          tooltip: { filter: it => it.dataset.label !== 'Mínimo' && it.dataset.label !== 'Máximo' && it.raw != null, callbacks: { label: c => (c.dataset.label === 'Proyección' ? 'Proyección: ' : '') + fmt(c.raw) + uni } } },
        scales: { x: { ticks: { color: CT('--chart-muted', '#52627a'), maxRotation: 0, autoSkip: true }, grid: { display: false } },
          y: { ticks: { color: CT('--chart-muted', '#52627a') }, grid: { color: CT('--chart-grid', '#e3e8ef') }, grace: '8%' } } },
      plugins: [etiquetasLimite],
    };
  }
  function dibujar(canvas, g) {
    if (!canvas || typeof Chart === 'undefined') return null;
    try { return new Chart(canvas, chartConfig(g)); } catch (e) { console.error('Gráfica de tendencia:', e); return null; }
  }
  // Tabla accesible de las lecturas (también sirve sin Chart.js).
  function tablaHtml(g) {
    return `<div class="tend-tabla"><table><thead><tr><th>Fecha</th><th>Lectura</th><th>Rango</th></tr></thead><tbody>${g.lecturas.slice(-20).reverse().map(l => `<tr><td>${esc(l.fecha)}</td><td><b>${esc(fmt(l.valor))}</b> ${esc(l.unidad)}</td><td>${l.min != null ? esc(fmt(l.min)) : '—'} – ${l.max != null ? esc(fmt(l.max)) : '—'}</td></tr>`).join('')}</tbody></table></div>`;
  }

  window.FB_TEND = { N_AJUSTE, N_SEGUIDAS, INTERVALOS, PCT_CERCA, NIVEL_TXT };
  window.fbTendAgrupar = agrupar;
  window.fbTendEvaluar = evaluar;
  window.fbTendAlertas = alertas;
  window.fbTendOrdenar = ordenar;
  window.fbTendBadge = badge;
  window.fbTendChartConfig = chartConfig;
  window.fbTendDibujar = dibujar;
  window.fbTendTablaHtml = tablaHtml;
  window.fbTendFmt = fmt;
  window.fbTendCrearOt = crearOtDesdeAlerta;
  window.fbOtChecklistDoc = otDoc;
  window.fbOtChecklistAbierta = otAbierta;
})();
