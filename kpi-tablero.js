// kpi-tablero.js — (10 nov 2026, v71) KPI NUEVOS DEL TABLERO (cálculo puro, sin Firebase).
// Lo usa analisis.html (Resumen → "Tablero de KPI") y las pruebas (t_tablero.js).
// Salen de los mismos datos que Análisis ya tiene en memoria: CERO lecturas nuevas.
// No cambia ningún indicador existente (kpis.js sigue igual).
//
//  cumplimientoPlan  OT planificadas hechas a tiempo: de las OT con fecha planificada dentro de la ventana
//                    (últimos N días, hasta ayer), las que se hicieron a más tardar ese día ÷ todas
//                    (hechas tarde + las que siguen abiertas con la fecha ya pasada). Lo de hoy aún no cuenta.
//  respuestaAvisos   Avisos de producción / QR: minutos entre la hora de parada (H_INICIO) y la llegada del
//                    técnico (H_TECNICO). Meta: 15 min con máquina parada, 30 sin parada (las de Incentivos).
//  diasAvisoATrabajo Días entre que se creó el aviso y el día en que se hizo el trabajo.
//  horasEnOT         Horas-técnico registradas en OT (minutos de técnico × técnicos de la OT) ÷ horas disponibles
//                    (técnicos × horas por semana × semanas del período). Aproximación del "wrench time".
(function (raiz) {
  'use strict';
  const FECHA = /^\d{4}-\d{2}-\d{2}$/;
  const horaAMin = h => { const m = /^(\d{1,2}):(\d{2})/.exec(String(h || '')); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const entre = (a, b) => { const x = horaAMin(a), y = horaAMin(b); if (x == null || y == null) return null; return y >= x ? y - x : y + 1440 - x; };
  const dia = s => { if (!FECHA.test(String(s || ''))) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmt = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const esAviso = r => ['operador', 'qr'].includes(r.origen) && !r.proyecto;
  const nTecs = t => String(t || '').split(',').map(s => s.trim()).filter(Boolean).length;

  // hechas: filas de OT con trabajo registrado (fecha) · abiertas: OT abiertas (fechaPlanificada, estado)
  function cumplimientoPlan(hechas, abiertas, hoy, dias) {
    hoy = hoy instanceof Date ? hoy : new Date(); dias = dias || 28;
    const h0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const ayer = new Date(h0); ayer.setDate(ayer.getDate() - 1);
    const desde = new Date(h0); desde.setDate(desde.getDate() - dias);
    const a = fmt(desde), b = fmt(ayer);
    const enV = f => FECHA.test(String(f || '')) && f >= a && f <= b;
    let aTiempo = 0, tarde = 0, pendientes = 0;
    const vistos = new Set();
    (hechas || []).forEach(r => {
      if (!enV(r.fechaPlanificada) || !FECHA.test(String(r.fecha || ''))) return;
      if (r.ot) { if (vistos.has(r.ot)) return; vistos.add(r.ot); }
      if (r.fecha <= r.fechaPlanificada) aTiempo++; else tarde++;
    });
    (abiertas || []).forEach(o => {
      if (!enV(o.fechaPlanificada)) return;
      if (['completada', 'anulada', 'validada', 'en_revision'].includes(o.estado)) return; // ya reportadas: salen en "hechas"
      pendientes++;
    });
    const total = aTiempo + tarde + pendientes;
    return { aTiempo, tarde, pendientes, total, pct: total ? aTiempo / total * 100 : null, desde: a, hasta: b };
  }

  function respuestaAvisos(rows, metaParada, metaFalla) {
    metaParada = metaParada || 15; metaFalla = metaFalla || 30;
    const lista = [];
    (rows || []).forEach(r => {
      if (!esAviso(r)) return;
      const m = entre(r.hInicio, r.hTecnico);
      if (m == null || m > 720) return; // más de 12 h: hora mal escrita, no se cuenta
      const parada = r.maquinaParada === true || String(r.paroPlanta || '').toLowerCase() === 'si' || String(r.paroPlanta || '').toLowerCase() === 'sí';
      lista.push({ min: m, ok: m <= (parada ? metaParada : metaFalla) });
    });
    const n = lista.length;
    const prom = n ? lista.reduce((s, x) => s + x.min, 0) / n : null;
    const orden = lista.map(x => x.min).sort((x, y) => x - y);
    const mediana = n ? (n % 2 ? orden[(n - 1) / 2] : (orden[n / 2 - 1] + orden[n / 2]) / 2) : null;
    return { n, prom, mediana, dentro: lista.filter(x => x.ok).length, pct: n ? lista.filter(x => x.ok).length / n * 100 : null };
  }

  function diasAvisoATrabajo(rows) {
    const v = [];
    (rows || []).forEach(r => {
      if (!esAviso(r) || !r.creadoMs) return;
      const d = dia(r.fecha); if (!d) return;
      const c = new Date(r.creadoMs); const c0 = new Date(c.getFullYear(), c.getMonth(), c.getDate());
      const n = Math.round((d - c0) / 86400000);
      if (n >= 0 && n <= 365) v.push(n);
    });
    const n = v.length;
    return { n, prom: n ? v.reduce((s, x) => s + x, 0) / n : null, mismoDia: n ? v.filter(x => x === 0).length / n * 100 : null };
  }

  // tecnico: si viene, solo sus OT y 1 persona disponible
  function horasEnOT(rows, nTec, horasSemana, dias, tecnico, incluye) {
    let min = 0;
    (rows || []).forEach(r => {
      const mt = Number(r.minTecnico) || 0; if (!(mt > 0)) return;
      if (tecnico) { if (incluye && incluye(r, tecnico)) min += mt; return; }
      min += mt * Math.max(1, nTecs(r.tecnicos));
    });
    const personas = tecnico ? 1 : (Number(nTec) || 0);
    const disp = personas * (Number(horasSemana) || 0) * ((Number(dias) || 0) / 7);
    return { horas: min / 60, disponibles: disp, pct: disp > 0 ? min / 60 / disp * 100 : null, personas };
  }

  // (v72) Libro de Excel con formato para el tablero (lo usa analisis.html → "Exportar tablero a Excel").
  // L: filas de filasTablero ({g} = grupo; {k,t,v,m,s,d,n,nf,ir} = indicador). n = número crudo para Excel
  // (porcentajes 0–100, días, minutos); nf = 'pct' | 'd' | 'hm' | '0' | '0.0'. Sin n se escribe el texto v.
  // o = { titulo, sub, tx (traduce), base (URL de la app para los enlaces "Ver"), def (definiciones por k) }
  const COL = { navy: 'FF14213D', navy2: 'FF1E2D4A', amb: 'FFF59E0B', gris: 'FF5B6577', linea: 'FFDDE3EC', grupo: 'FFEEF2F7', blanco: 'FFFFFFFF',
    verde: ['FFDCFCE7', 'FF166534'], amarillo: ['FFFEF3C7', 'FF92400E'], rojo: ['FFFEE2E2', 'FF991B1B'] };
  const EST = { verde: 'En meta', amarillo: 'Cerca de la meta', rojo: 'Fuera de meta' };
  function libroExcel(ExcelJS, L, o) {
    o = o || {}; const tx = o.tx || (x => x), def = o.def || {};
    const wb = new ExcelJS.Workbook(); wb.creator = 'Mantenimiento 2026'; wb.created = new Date();
    const ws = wb.addWorksheet(tx('Tablero KPI'), { views: [{ showGridLines: false }], properties: { tabColor: { argb: COL.amb } } });
    const W = [42, 15, 15, 21, 64]; W.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    const fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: c } });
    const fino = { style: 'thin', color: { argb: COL.linea } };
    const banda = (r, txt, f, alto, color) => { ws.mergeCells(r, 1, r, 5); const c = ws.getCell(r, 1); c.value = txt; c.font = f; c.fill = fill(color || COL.navy); c.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(r).height = alto; };
    banda(1, o.titulo || tx('Tablero de KPI'), { bold: true, size: 18, color: { argb: COL.blanco } }, 34);
    banda(2, o.sub || '', { size: 11, color: { argb: 'FFCBD5E1' } }, 20);
    ws.mergeCells(3, 1, 3, 5); ws.getCell(3, 1).fill = fill(COL.amb); ws.getRow(3).height = 4;
    // resumen del semáforo
    const ind = L.filter(x => !x.g), cuenta = k => ind.filter(x => x.s === k).length;
    const tiles = [['verde', tx('En meta'), cuenta('verde')], ['amarillo', tx('Cerca de la meta'), cuenta('amarillo')], ['rojo', tx('Fuera de meta'), cuenta('rojo')], [null, tx('Indicadores con meta'), cuenta('verde') + cuenta('amarillo') + cuenta('rojo')]];
    ws.getRow(4).height = 8; ws.getRow(5).height = 18; ws.getRow(6).height = 30;
    const tcol = [[1, 1], [2, 3], [4, 4], [5, 5]];
    tiles.forEach(([k, t, n], i) => { const [a, b] = tcol[i]; if (a !== b) { ws.mergeCells(5, a, 5, b); ws.mergeCells(6, a, 6, b); }
      const c1 = ws.getCell(5, a), c2 = ws.getCell(6, a), col = k ? COL[k] : [COL.grupo, COL.navy];
      c1.value = t; c1.font = { bold: true, size: 10, color: { argb: col[1] } }; c1.fill = fill(col[0]); c1.alignment = { horizontal: 'center', vertical: 'bottom' };
      c2.value = n; c2.font = { bold: true, size: 20, color: { argb: col[1] } }; c2.fill = fill(col[0]); c2.alignment = { horizontal: 'center', vertical: 'middle' }; c2.numFmt = '0';
      for (let j = a; j <= b; j++) { ws.getCell(5, j).fill = fill(col[0]); ws.getCell(6, j).fill = fill(col[0]); } });
    ws.getRow(7).height = 10;
    const H = 8; const cab = ws.getRow(H);
    [tx('Indicador'), tx('Valor'), tx('Meta'), tx('Estado'), tx('Detalle')].forEach((t, i) => { const c = cab.getCell(i + 1); c.value = t; c.font = { bold: true, color: { argb: COL.blanco } }; c.fill = fill(COL.navy2); c.alignment = { vertical: 'middle', horizontal: i === 1 || i === 2 ? 'center' : 'left', indent: i === 0 || i === 4 ? 1 : 0 }; });
    cab.height = 24;
    let r = H;
    const FMT = { pct: '0.0%', d: '0.0 "d"', hm: '[h]"h" mm"m"', '0': '0', '0.0': '0.0' };
    L.forEach(x => {
      r++; const row = ws.getRow(r);
      if (x.g) { ws.mergeCells(r, 1, r, 5); const c = ws.getCell(r, 1); c.value = tx(x.g); c.font = { bold: true, size: 12, color: { argb: COL.navy } }; c.fill = fill(COL.grupo); c.alignment = { vertical: 'middle', indent: 1 };
        c.border = { left: { style: 'thick', color: { argb: COL.amb } } }; row.height = 22; return; }
      const est = x.s && COL[x.s] ? COL[x.s] : null;
      const a = row.getCell(1); a.value = tx(x.t); a.font = { bold: true, size: 11, color: { argb: COL.navy } }; a.alignment = { vertical: 'middle', indent: 1, wrapText: true };
      const b = row.getCell(2);
      if (typeof x.n === 'number' && isFinite(x.n) && FMT[x.nf]) { b.value = x.nf === 'pct' ? x.n / 100 : x.nf === 'hm' ? x.n / 1440 : x.n; b.numFmt = FMT[x.nf]; }
      else if (x.ir && x.ir[0] === 'href' && o.base) { b.value = { text: tx(x.v) + ' →', hyperlink: o.base + x.ir[1] }; }
      else b.value = tx(x.v);
      b.font = b.value && b.value.hyperlink ? { bold: true, color: { argb: 'FF2563EB' }, underline: true } : { bold: true, size: 13, color: { argb: est ? est[1] : COL.navy } };
      b.alignment = { horizontal: 'center', vertical: 'middle' };
      const c = row.getCell(3); c.value = tx(x.m); c.font = { color: { argb: COL.gris } }; c.alignment = { horizontal: 'center', vertical: 'middle' };
      const d = row.getCell(4);
      if (est) { d.value = '● ' + tx(EST[x.s]); d.font = { bold: true, color: { argb: est[1] } }; d.fill = fill(est[0]); }
      else { d.value = '—'; d.font = { color: { argb: 'FF9AA4B2' } }; }
      d.alignment = { horizontal: 'center', vertical: 'middle' };
      const e = row.getCell(5); e.value = tx(x.d); e.font = { size: 10, color: { argb: COL.gris } }; e.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
      if (def[x.k]) e.note = tx(def[x.k]);
      for (let j = 1; j <= 5; j++) row.getCell(j).border = { bottom: fino };
      row.height = String(x.d || '').length > 70 ? 32 : 22;
    });
    r += 2; ws.mergeCells(r, 1, r, 5);
    const pie = ws.getCell(r, 1); pie.value = tx('Semáforo: verde = en meta · amarillo = cerca de la meta · rojo = fuera de meta. Pasa el cursor sobre el detalle para ver cómo se calcula. Datos de Mantenimiento 2026.');
    pie.font = { italic: true, size: 9, color: { argb: COL.gris } }; pie.alignment = { wrapText: true };
    ws.getRow(r).height = 28;
    ws.views = [{ state: 'frozen', ySplit: H, showGridLines: false }];
    ws.pageSetup = { orientation: 'landscape', paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true, printTitlesRow: H + ':' + H,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 } };
    ws.headerFooter = { oddFooter: '&L&8' + (o.titulo || '').replace(/&/g, '&&') + '&R&8' + tx('Página') + ' &P / &N' };
    // hoja 2: cómo se calcula
    const ks = ind.filter(x => def[x.k]);
    if (ks.length) {
      const w2 = wb.addWorksheet(tx('Cómo se calcula'), { views: [{ showGridLines: false }] });
      [42, 80, 15].forEach((w, i) => { w2.getColumn(i + 1).width = w; });
      w2.mergeCells(1, 1, 1, 3); const t2 = w2.getCell(1, 1); t2.value = tx('Cómo se calcula cada indicador'); t2.font = { bold: true, size: 16, color: { argb: COL.blanco } }; t2.fill = fill(COL.navy); t2.alignment = { vertical: 'middle', indent: 1 }; w2.getRow(1).height = 30;
      const h2 = w2.getRow(3); [tx('Indicador'), tx('Fórmula'), tx('Meta')].forEach((t, i) => { const c = h2.getCell(i + 1); c.value = t; c.font = { bold: true, color: { argb: COL.blanco } }; c.fill = fill(COL.navy2); c.alignment = { vertical: 'middle', indent: 1 }; }); h2.height = 22;
      ks.forEach((x, i) => { const rr = w2.getRow(4 + i); rr.getCell(1).value = tx(x.t); rr.getCell(1).font = { bold: true, color: { argb: COL.navy } };
        rr.getCell(2).value = tx(def[x.k]); rr.getCell(2).font = { color: { argb: COL.gris } }; rr.getCell(3).value = tx(x.m); rr.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
        [1, 2].forEach(j => { rr.getCell(j).alignment = { wrapText: true, vertical: 'middle', indent: 1 }; });
        for (let j = 1; j <= 3; j++) rr.getCell(j).border = { bottom: fino }; rr.height = 30; });
      w2.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
      w2.pageSetup = { orientation: 'landscape', paperSize: 1, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    }
    return wb;
  }

  // Semáforo genérico: mayor es mejor (verde ≥ v, amarillo ≥ a) o menor es mejor (invertido)
  function semaforo(valor, verde, amarillo, menorEsMejor) {
    if (valor == null || isNaN(valor)) return '';
    if (menorEsMejor) return valor <= verde ? 'verde' : valor <= amarillo ? 'amarillo' : 'rojo';
    return valor >= verde ? 'verde' : valor >= amarillo ? 'amarillo' : 'rojo';
  }

  const api = { cumplimientoPlan, respuestaAvisos, diasAvisoATrabajo, horasEnOT, semaforo, minutosEntre: entre, libroExcel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.VTTablero = api;
})(typeof window !== 'undefined' ? window : globalThis);
