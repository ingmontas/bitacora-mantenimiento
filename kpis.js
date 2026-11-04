// kpis.js — (v3 etapa 3a, nov 2026) INDICADORES DE MANTENIMIENTO, UNA SOLA VEZ
// ══════════════════════════════════════════════════════════════════════
// Las fórmulas de Análisis MOVIDAS tal cual desde analisis.html (no se
// reescribió la matemática): calcKpis (MTBF, MTTR, disponibilidad, % correctivo,
// paro, respuesta), computePredictive (MTBF y riesgo por equipo), calcPlanificado
// (trabajo planificado vs reactivo), calcBacklog, calcCumplimiento (preventivo al
// día), calcVencidas (órdenes vencidas) y calcReincidencia, con sus ayudas
// (fechas, tipos, estados). Las usan:
//   · analisis.html (todas las pestañas)
//   · hoja-vida.html (tiles del equipo: días entre fallas = mtbfDeFechas)
//   · bitacora.html "Mi semana" (reparación promedio = promedio de correctivos con tiempo)
//   · Hoy (hoy.js): el resumen de indicadores que Análisis guarda (leerSnap)
// Análisis le pasa con VTKpis.contexto(Ellipsis) lo que depende de su pantalla
// (clave de equipo canónica, criticidad, checklists leídos, filtros). Sin
// contexto se usan valores neutros (clave por equipoId o por nombre).
// Sin lecturas de Firestore.
// ══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  if (window.VTKpis) return;
  const C = {
    eqKey: r => (r.equipoId ? 'id:' + r.equipoId : 'n:' + (fbEquipoKey(r.equipo || r.tipoMaquina) || '?')),
    eqArea: () => 'Sin área', eqLabelOf: () => 'Equipo',
    equiposPorNombre: () => ({}), critPorId: () => ({}), ventanaCk: () => 30,
    ckAn: () => ({ desde: '', docs: [], err: '' }), equiposDocs: () => null, equiposDocsErr: () => false, tecnico: () => '',
  };
  const eqKey = r => C.eqKey(r), eqArea = k => C.eqArea(k), eqLabelOf = k => C.eqLabelOf(k);
  function contexto(o) { Object.assign(C, o || {}); }

  function parseFecha(s){
    const d = fbParseFecha(s); if (!d) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    return (d.getMonth()+1 === +m[2] && d.getDate() === +m[3]) ? d : null;
  }
  const daysBetween = (a,b) => Math.round((b-a)/86400000);
  function today0(){ const d = new Date(); d.setHours(0,0,0,0); return d; }
  const fmtDate = d => d ? d.toLocaleDateString('es-DO') : '—';
  const splitTecnicos = s => s ? s.split(',').map(x=>x.trim()).filter(Boolean) : [];
  const isCorr = r => (r.tipoMant||'').toLowerCase()==='correctivo';
  const isPrev = r => ['preventivo','predictivo'].includes((r.tipoMant||'').toLowerCase());
  const isProy = r => !!r.proyecto || (r.tipoMant||'').toLowerCase()==='proyecto';
  const paroDe = r => r.minMaquina;
  const paroTecnicoDe = r => isProy(r) ? 0 : r.minMaquina;
  function calcKpis(scopeRows, ref){
    const correctivos = scopeRows.filter(isCorr), preventivos = scopeRows.filter(isPrev);
    const totalDowntimeAll = scopeRows.reduce((s,r)=>s+paroDe(r),0);
    const totalDowntime = correctivos.reduce((s,r)=>s+r.minMaquina,0);
    const pctCorr = scopeRows.length ? Math.round(correctivos.length/scopeRows.length*100) : 0;
    const predKpi = computePredictive(scopeRows, ref);
    const mtbfs = predKpi.filter(p=>p.mtbf!=null).map(p=>p.mtbf);
    const mtbfAvg = mtbfs.length ? mtbfs.reduce((a,b)=>a+b,0)/mtbfs.length : null;
    const corrM = correctivos.filter(r=>r.minMaquina>0);
    const mttrAvg = corrM.length ? corrM.reduce((s,r)=>s+r.minMaquina,0)/corrM.length : null;
    const corrT = correctivos.filter(r=>r.minTecnico>0);
    const tecAvg = corrT.length ? corrT.reduce((s,r)=>s+r.minTecnico,0)/corrT.length : null;
    const mtbfMin = mtbfAvg!=null ? mtbfAvg*1440 : null;
    const disp = (mtbfMin!=null && mttrAvg!=null && (mtbfMin+mttrAvg)>0) ? mtbfMin/(mtbfMin+mttrAvg)*100 : null;
    const prevCheck = preventivos.filter(r=>r.tiempoRespuestaMin!=null);
    const avgResp = prevCheck.length ? prevCheck.reduce((s,r)=>s+r.tiempoRespuestaMin,0)/prevCheck.length : null;
    return {correctivos, preventivos, totalDowntimeAll, totalDowntime, pctCorr, mtbfs, mtbfAvg, corrM, mttrAvg, corrT, tecAvg, disp, prevCheck, avgResp};
  }
  const topFreq = list => {
    const c = {}; list.forEach(v=>{ if(v) c[v]=(c[v]||0)+1; });
    const s = Object.entries(c).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));
    return s.length ? {value:s[0][0], count:s[0][1]} : null;
  };
  function buildPlan(risk, pieza, mtbf, daysSince){
    let b;
    if (risk==='critico') b='Intervención inmediata: según el historial, esta falla ya debió repetirse. Programar inspección esta semana.';
    else if (risk==='alto') b='Programar mantenimiento preventivo en los próximos 7 días, antes de la fecha estimada de falla.';
    else if (risk==='medio') b='Incluir en el plan de mantenimiento preventivo del próximo mes.';
    else if (risk==='bajo') b='Mantener en monitoreo rutinario; el intervalo entre fallas es amplio ('+(mtbf?mtbf.toFixed(0):'?')+' días).';
    else if (risk==='inactivo') b='Sin fallas correctivas en '+daysSince+' días (más del doble de su MTBF). Verifica si la causa se eliminó y documenta qué funcionó; el pronóstico se recalcula con la próxima falla.';
    else b='Registrar más eventos correctivos de este equipo para una recomendación confiable (mínimo 3 días distintos con falla).';
    if (risk!=='inactivo' && pieza && pieza.count>=2) b += ' Enfocar la revisión en: '+pieza.value+' (repite en '+pieza.count+' fallas).';
    return b;
  }
  function computePredictive(rows, refDate){
    const groups = {};
    rows.filter(isCorr).forEach(r=>{
      const d = parseFecha(r.fecha); if (!d) return;
      const key = eqKey(r);
      if (!groups[key]) groups[key] = {key, area:eqArea(key), equipo:eqLabelOf(key), dates:[], downtime:[], entries:[]};
      groups[key].dates.push(d);
      groups[key].downtime.push(r.minMaquina);
      groups[key].entries.push({date:d, falla:r.falla, pieza:r.pieza, tecnicos:r.tecnicos});
    });
    return Object.values(groups).map(g=>{
      g.entries.sort((a,b)=>a.date-b.date);
      // días distintos: varias OTs del mismo equipo el mismo día cuentan como un solo evento
      const uniq = [...new Set(g.dates.map(d=>d.getTime()))].sort((a,b)=>a-b).map(t=>new Date(t));
      const n = uniq.length, lastD = uniq[n-1];
      const daysSince = daysBetween(lastD, refDate);
      let mtbf=null, nextDate=null, daysUntil=null, risk='na';
      if (n>=3){
        let s=0; for(let i=1;i<n;i++) s+=daysBetween(uniq[i-1],uniq[i]);
        mtbf = s/(n-1);
        nextDate = new Date(lastD.getTime()+mtbf*86400000);
        daysUntil = daysBetween(refDate, nextDate);
        // un equipo que dejó de fallar no se queda en "Crítico" para siempre
        if (daysSince > Math.max(2*mtbf, mtbf+30)) risk = 'inactivo';
        else risk = daysUntil<0?'critico':daysUntil<=7?'alto':daysUntil<=30?'medio':'bajo';
      }
      const last = g.entries[g.entries.length-1];
      const tec = topFreq(g.entries.map(e=>e.tecnicos));
      return {area:g.area, equipo:g.equipo, key:g.key, fallas:g.dates.length, mtbf, nextDate, daysUntil, daysSince, risk, last:lastD,
        avgDowntime:g.downtime.reduce((s,x)=>s+x,0)/g.downtime.length, lastFalla:last?last.falla:'',
        tecnico:tec?tec.value:'—', plan:buildPlan(risk, topFreq(g.entries.map(e=>e.pieza)), mtbf, daysSince)};
    });
  }
  const META_PLAN = 80;
  const BACKLOG_ESTADOS = ['pendiente','planificada','en_atencion','rechazada','en_revision'];
  const BACKLOG_LBL = {pendiente:'Pendiente', planificada:'Planificada', en_atencion:'En atención', rechazada:'Devuelta', en_revision:'En revisión'};
  function clasePlan(r){
    if (r.fechaPlanificada) return 'plan';
    if (isPrev(r) || r.origen==='checklist' || isProy(r)) return 'plan';
    if (isCorr(r)) return 'reac';
    return '';
  }
  const semPlan = p => p==null ? '' : p>=META_PLAN ? 'verde' : p>=60 ? 'amarillo' : 'rojo';
  function calcPlanificado(rows){
    let plan=0, reac=0, sin=0, hPlan=0, hReac=0;
    const meses = {};
    rows.forEach(r=>{
      const c = clasePlan(r);
      if (!c){ sin++; return; }
      const m = String(r.fecha||'').slice(0,7), g = meses[m] = meses[m] || {mes:m, plan:0, reac:0};
      if (c==='plan'){ plan++; hPlan += r.minTecnico/60; g.plan++; } else { reac++; hReac += r.minTecnico/60; g.reac++; }
    });
    const pct = (plan+reac) ? plan/(plan+reac)*100 : null;
    const porMes = Object.values(meses).sort((a,b)=>a.mes.localeCompare(b.mes)).map(g=>({...g, pct: (g.plan+g.reac) ? g.plan/(g.plan+g.reac)*100 : null}));
    const pctH = (hPlan+hReac)>0 ? hPlan/(hPlan+hReac)*100 : null;
    return {plan, reac, sin, pct, sem: semPlan(pct), hPlan, hReac, pctH, porMes};
  }
  const tipoOtAbierta = o => o.TIPO_MANTENIMIENTO ? String(o.TIPO_MANTENIMIENTO) : o.tipoReporte==='proyecto' ? 'Proyecto' : o.origen==='checklist' ? 'Predictivo' : 'Correctivo';
  const keyOtAbierta = o => eqKey({equipoId:o.equipoId||'', equipo:o.equipoNombre||o.EQUIPO||'', tipoMaquina:o.TIPO_MAQUINA||''});
  function calcBacklog(ots, hist, nTec, horasSemana, ref){
    ref = ref || today0();
    const prom = {}; let sumG=0, nG=0;
    hist.filter(r=>r.minTecnico>0).forEach(r=>{ const k = eqKey(r)+'|'+String(r.tipoMant||'').toLowerCase(); const p = prom[k] = prom[k] || {s:0,n:0}; p.s += r.minTecnico; p.n++; sumG += r.minTecnico; nG++; });
    const promG = nG ? sumG/nG : 0;
    const lista = ots.filter(o=>BACKLOG_ESTADOS.includes(o.estado)).map(o=>{
      const tipo = tipoOtAbierta(o), k = keyOtAbierta(o)+'|'+tipo.toLowerCase();
      let min, fuente;
      if (o.estado==='en_revision'){ min = 0; fuente = 'ya hecho (en revisión)'; }
      else if (prom[k]){ min = prom[k].s/prom[k].n; fuente = 'promedio del equipo ('+prom[k].n+')'; }
      else { min = promG; fuente = nG ? 'promedio general' : 'sin historial'; }
      const c = fechaCreacionAn(o); const edad = c ? Math.max(0, daysBetween(c, ref)) : null;
      const id = o.equipoId || C.equiposPorNombre()[fbEquipoKey(o.equipoNombre||o.EQUIPO)] || '';
      const crit = (id && (C.critPorId()[id] || (typeof fbCriticidadDeEquipo==='function' ? fbCriticidadDeEquipo(id) : ''))) || '';
      return {id:o.id, folio:o.folio||o.Title||o.id, equipo:o.equipoNombre||o.EQUIPO||'Equipo', estado:o.estado, tipo, min, fuente, edad, crit};
    });
    const horas = lista.reduce((s,x)=>s+x.min,0)/60;
    const capacidad = nTec>0 ? nTec*horasSemana : 0;
    const semanas = capacidad>0 ? horas/capacidad : null;
    const edad = {a:0,b:0,c:0,sin:0};
    lista.forEach(x=>{ if (x.edad==null) edad.sin++; else if (x.edad<=7) edad.a++; else if (x.edad<=30) edad.b++; else edad.c++; });
    const porCrit = {A:{n:0,h:0},B:{n:0,h:0},C:{n:0,h:0},N:{n:0,h:0}};
    lista.forEach(x=>{ const g = porCrit[x.crit||'N']; g.n++; g.h += x.min/60; });
    const porEstado = {}; lista.forEach(x=>{ porEstado[x.estado] = (porEstado[x.estado]||0)+1; });
    const sem = semanas==null ? '' : (semanas>=2 && semanas<=4) ? 'verde' : (semanas<2 || semanas<=8) ? 'amarillo' : 'rojo';
    return {lista, n:lista.length, horas, nTec, horasSemana, capacidad, semanas, sem, edad, porCrit, porEstado, promG};
  }
  const ESTADOS_ABIERTOS_AN = ['pendiente','planificada','en_revision','rechazada','validada','en_atencion'];
  const ESTADO_LBL_AN = {pendiente:'pendiente', planificada:'planificada', en_revision:'en revisión', rechazada:'rechazada', validada:'validada', en_atencion:'en atención'};
  const DIAS_SIN_PLAN_AN = 7, DIAS_REINC_AN = 90, CK_VENTANA_MAX_AN = 90;
  function desdeDias(dias){ const d = today0(); d.setDate(d.getDate()-(dias-1)); return fbFechaLocal(d); }
  function fechaCreacionAn(o){
    const c = o.createdAt;
    let d = null;
    if (c && typeof c.toDate === 'function') { try { d = c.toDate(); } catch(e) {} }
    else if (c && typeof c.seconds === 'number') d = new Date(c.seconds*1000);
    if (!d) d = parseFecha(o.fechaReporte||'');
    if (!d || isNaN(d)) return null;
    d = new Date(d); d.setHours(0,0,0,0); return d;
  }
  const pctTxt = p => p==null ? '—' : (Math.round(p*10)/10).toLocaleString('es-DO')+'%';
  function calcCumplimiento(eqDocs, ckDocs, enAreaEq){
    const ref = today0();
    const diasCk = C.ventanaCk();
    const desdeCk = desdeDias(diasCk);
    const ckOk = !!C.ckAn().desde && C.ckAn().desde <= desdeCk && !C.ckAn().err;
    const ckVent = ckOk ? ckDocs.filter(c=>c.fecha >= desdeCk && c.fecha <= fbFechaLocal(ref)) : [];
    const ultCk = {}, diasCkEq = {};
    (ckOk ? ckDocs : []).forEach(c=>{ if (!ultCk[c.equipoId] || c.fecha > ultCk[c.equipoId]) ultCk[c.equipoId] = c.fecha; });
    ckVent.forEach(c=>{ (diasCkEq[c.equipoId] = diasCkEq[c.equipoId] || new Set()).add(c.fecha); });
    let prevVal = '—', prevCls = '', prevFoot = 'cargando equipos…', vencPrev = [], nFrec = 0, pAlDia = null;
    let progTot = 0, hechosTot = 0;
    if (eqDocs){
      const conFrec = eqDocs.filter(e=>(Number(e.checklistFrecuenciaDias)>0 || Number(e.checklistFrecuenciaHoras)>0) && enAreaEq(e));
      nFrec = conFrec.length;
      conFrec.forEach(e=>{
        const f = Number(e.checklistFrecuenciaDias)||0, fh = Number(e.checklistFrecuenciaHoras)||0;
        const ultDoc = String(e.checklistUltimaFecha||''), ultNueva = ultCk[e.id] && ultCk[e.id] > ultDoc ? ultCk[e.id] : '';
        let vencido = false, diasV = null, nunca = false, horasTxt = '';
        if (f>0){
          let prox = String(e.checklistProximaFecha||'');
          // un checklist más nuevo que el catálogo en caché, o equipo sin próxima fecha: se calcula
          const base = ultNueva || (!prox ? ultDoc : '');
          const bD = parseFecha(base);
          if (bD){ const p = new Date(bD); p.setDate(p.getDate()+f); prox = fbFechaLocal(p); }
          const pD = parseFecha(prox);
          if (!pD){ vencido = true; nunca = true; }
          else if (pD < ref){ vencido = true; diasV = daysBetween(pD, ref); }
          if (f <= diasCk && ckOk){
            const prog = Math.floor(diasCk / f), hechos = (diasCkEq[e.id] ? diasCkEq[e.id].size : 0);
            progTot += prog; hechosTot += Math.min(hechos, prog);
          }
        }
        // con un checklist más nuevo que el catálogo el horómetro ya se reinició
        if (fh>0 && !ultNueva){
          const h = (Number(e.horometroActual)||0) - (Number(e.horometroUltimoService)||0);
          if (h >= fh){ vencido = true; horasTxt = h.toLocaleString('es-DO')+'/'+fh.toLocaleString('es-DO')+' h'; }
        }
        if (vencido) vencPrev.push({nombre:e.nombre||'Equipo sin nombre', area:e.localidad||'Sin área', diasV, nunca, horasTxt});
      });
      pAlDia = nFrec ? (nFrec - vencPrev.length)/nFrec*100 : null;
      prevVal = pctTxt(pAlDia);
      prevCls = pAlDia==null ? '' : pAlDia>=90 ? 'accent-teal' : pAlDia>=75 ? 'accent-amber' : 'accent-red';
      const pVent = progTot ? hechosTot/progTot*100 : null;
      const ventTxt = C.ckAn().err ? 'checklists: no se pudieron leer' : !ckOk ? 'checklists: cargando…'
        : progTot ? `checklists ${diasCk} d: ${hechosTot}/${progTot} (${pctTxt(pVent)})` : `sin checklists programados en ${diasCk} d`;
      prevFoot = C.equiposDocsErr() ? 'no se pudo leer el catálogo de equipos' : nFrec ? `${nFrec - vencPrev.length} de ${nFrec} equipos al día · ${ventTxt}` : 'ningún equipo tiene frecuencia de checklist';
    }
    vencPrev.sort((a,b)=>(b.nunca-a.nunca) || ((b.diasV??-1)-(a.diasV??-1)) || a.nombre.localeCompare(b.nombre));
    return {diasCk, ckOk, nFrec, vencPrev, pAlDia, progTot, hechosTot, prevVal, prevCls, prevFoot};
  }
  function calcVencidas(ots, enAreaOt){
    const ref = today0();
    const vencOts = [];
    (ots||[]).forEach(o=>{
      if (!ESTADOS_ABIERTOS_AN.includes(o.estado)) return;
      const eqDoc = o.equipoId && C.equiposDocs() ? C.equiposDocs().find(e=>e.id===o.equipoId) : null;
      const area = o.equipoLocalidad || (eqDoc && eqDoc.localidad) || 'Sin área';
      if (!enAreaOt(o, area, eqDoc)) return;
      if (C.tecnico() && !splitTecnicos(o.asignadoA||'').includes(C.tecnico())) return;
      const pD = parseFecha(String(o.fechaPlanificada||''));
      let dias = null, motivo = '';
      if (pD){ if (pD < ref){ dias = daysBetween(pD, ref); motivo = 'plan '+fmtDate(pD); } }
      // (20 oct 2026) Un proyecto sin planificar no está "vencido": solo cuenta
      // por su fecha planificada, como las demás OTs planificadas.
      else if (o.estado === 'pendiente' && o.tipoReporte !== 'proyecto'){
        const c = fechaCreacionAn(o);
        if (c){ const edad = daysBetween(c, ref); if (edad > DIAS_SIN_PLAN_AN){ dias = edad - DIAS_SIN_PLAN_AN; motivo = 'sin planificar hace '+edad+' d'; } }
      }
      if (dias == null) return;
      vencOts.push({folio:o.folio||o.Title||o.id, equipo:o.equipoNombre||o.EQUIPO||(eqDoc&&eqDoc.nombre)||'Equipo sin nombre', area,
        asignado:o.asignadoA||'', estado:ESTADO_LBL_AN[o.estado]||o.estado, dias, motivo});
    });
    vencOts.sort((a,b)=>b.dias-a.dias || String(a.folio).localeCompare(String(b.folio)));
    return vencOts;
  }
  function calcReincidencia(rowsAll, scopeRows){
    const causaKey = r => String(r.causa||'').trim().toLowerCase().replace(/\s+/g,' ');
    const fechasPar = {}; // equipo|causa → días (ms) con correctivo en todo lo cargado
    rowsAll.filter(isCorr).forEach(r=>{ const c = causaKey(r), d = parseFecha(r.fecha); if (!c || !d) return;
      (fechasPar[eqKey(r)+'|'+c] = fechasPar[eqKey(r)+'|'+c] || []).push(d.getTime()); });
    const corrScope = scopeRows.filter(isCorr);
    let nReinc = 0, sinCausa = 0;
    const pares = {};
    corrScope.forEach(r=>{
      const c = causaKey(r), d = parseFecha(r.fecha);
      if (!c || !d){ sinCausa++; return; }
      const k = eqKey(r)+'|'+c, t = d.getTime();
      const rep = (fechasPar[k]||[]).some(x=>{ const dd = daysBetween(new Date(x), d); return dd>=1 && dd<=DIAS_REINC_AN; });
      const p = pares[k] = pares[k] || {key:eqKey(r), causa:String(r.causa).trim(), total:0, reinc:0, last:0};
      p.total++; if (t > p.last) p.last = t;
      if (rep){ nReinc++; p.reinc++; }
    });
    const pReinc = corrScope.length ? nReinc/corrScope.length*100 : null;
    const paresTop = Object.values(pares).filter(p=>p.reinc>0).sort((a,b)=>b.reinc-a.reinc||b.total-a.total||b.last-a.last);
    return {corrScope, nReinc, sinCausa, pReinc, paresTop};
  }

  // ── Ayudas para las demás pantallas (mismas cuentas) ──
  // Días promedio entre fallas: fechas (Date) de días DISTINTOS con correctivo, en orden; mínimo 3.
  // Es el mismo intervalo promedio que usa computePredictive (suma de días entre fallas / n−1).
  function mtbfDeFechas(uniq) {
    const n = uniq.length;
    if (n < 3) return null;
    let s = 0; for (let i = 1; i < n; i++) s += daysBetween(uniq[i - 1], uniq[i]);
    return s / (n - 1);
  }
  // Promedio (null si no hay datos), como en calcKpis (MTTR / tiempo técnico).
  const promedio = l => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
  // Resumen que Análisis deja en el celular para Hoy (vtKpiSnap).
  const SNAP = 'vtKpiSnap';
  function guardarSnap(o) { try { localStorage.setItem(SNAP, JSON.stringify(o)); } catch (e) {} }
  function leerSnap() { try { return JSON.parse(localStorage.getItem(SNAP) || 'null'); } catch (e) { return null; } }

  window.VTKpis = { contexto, parseFecha, daysBetween, today0, fmtDate, splitTecnicos, isCorr, isPrev, isProy, paroDe, paroTecnicoDe, calcKpis, topFreq, buildPlan, computePredictive, META_PLAN, BACKLOG_ESTADOS, BACKLOG_LBL, clasePlan, semPlan, calcPlanificado, tipoOtAbierta, keyOtAbierta, calcBacklog, ESTADOS_ABIERTOS_AN, ESTADO_LBL_AN, DIAS_SIN_PLAN_AN, DIAS_REINC_AN, CK_VENTANA_MAX_AN, desdeDias, fechaCreacionAn, pctTxt, calcCumplimiento, calcVencidas, calcReincidencia, mtbfDeFechas, promedio, guardarSnap, leerSnap };
})();
