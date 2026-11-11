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

  // Semáforo genérico: mayor es mejor (verde ≥ v, amarillo ≥ a) o menor es mejor (invertido)
  function semaforo(valor, verde, amarillo, menorEsMejor) {
    if (valor == null || isNaN(valor)) return '';
    if (menorEsMejor) return valor <= verde ? 'verde' : valor <= amarillo ? 'amarillo' : 'rojo';
    return valor >= verde ? 'verde' : valor >= amarillo ? 'amarillo' : 'rojo';
  }

  const api = { cumplimientoPlan, respuestaAvisos, diasAvisoATrabajo, horasEnOT, semaforo, minutosEntre: entre };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.VTTablero = api;
})(typeof window !== 'undefined' ? window : globalThis);
