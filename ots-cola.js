// ots-cola.js — (v3 etapa 3a, nov 2026) COLA DE OTs "por planificar / por validar"
// ══════════════════════════════════════════════════════════════════════
// Código MOVIDO tal cual desde la pestaña "OTs" de checklist.html (mismas
// escrituras, mismos permisos, mismos textos): planificar (Encargado/Admin),
// validar / no concluido (Supervisor+), cerrar y cerrar directo (Admin),
// anular con motivo (Admin), costo de repuestos y foto de la OT.
// La cola ahora se ve en Trabajos (bitacora.html#planificar / #validar).
// checklist.html también lo carga: sigue escuchando las OTs de checklist en
// curso para no repetir una OT del mismo punto (fbOtChecklistAbierta) y usa
// las ayudas comunes (todayStr, mensajeErrorPermiso, nombreUsuarioActual…).
// Lecturas: las mismas 2 consultas acotadas de siempre (loadOts); en Trabajos
// se abren solo al entrar a "Por planificar" o "Por validar".
// ══════════════════════════════════════════════════════════════════════
(function () {
  if (document.getElementById('otcCss')) return;
  const st = document.createElement('style'); st.id = 'otcCss';
  st.textContent = `
.otc .item-row{background:var(--color-surface);border-radius:10px;padding:13px;margin-bottom:10px;border:1px solid var(--color-border);border-left:3px solid var(--color-border-strong);}
.otc .item-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;gap:8px;}
.otc .item-title{font-weight:700;font-size:14px;overflow-wrap:anywhere;}
.otc .item-sub{font-size:12px;color:var(--color-muted);margin-top:2px;overflow-wrap:anywhere;}
.otc .row{display:flex;gap:10px;flex-wrap:wrap;}
.otc .row .field{flex:1;min-width:0;}
.otc .field{margin-bottom:10px;}
.otc .field label{display:block;font-size:11.5px;font-weight:700;color:var(--color-muted);margin-bottom:5px;}
.otc select,.otc input,.otc textarea{width:100%;background:var(--color-input-bg,var(--color-surface-2));border:1px solid var(--color-border);border-radius:8px;padding:9px 11px;color:var(--color-text);font-size:14px;font-family:inherit;}
.otc textarea{min-height:60px;resize:vertical;}
.otc .tag{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;white-space:nowrap;}
.otc .tag-falla{background:#e6676722;color:var(--color-danger-text);border:1px solid #e6676744;}
.otc .tag-pendiente{background:#F59E0B22;color:var(--color-accent-text);border:1px solid #F59E0B44;}
.otc .tag-planificada{background:#3987e522;color:var(--color-primary-text);border:1px solid #3987e544;}
.otc .tag-completada{background:#199e7022;color:var(--color-success-text);border:1px solid #199e7044;}
.otc .tag-prioridad-alta{background:#d03b3b22;color:var(--color-danger-text);border:1px solid #d03b3b44;}
.otc .tag-prioridad-media{background:#F59E0B22;color:var(--color-accent-text);border:1px solid #F59E0B44;}
.otc .tag-prioridad-baja{background:#199e7022;color:var(--color-success-text);border:1px solid #199e7044;}
.otc .tag-origen-check{background:#0891B222;color:var(--color-info-text);border:1px solid #0891B244;}
.otc .tag-origen-proy{background:#A78BFA22;color:var(--color-purple-text);border:1px solid #A78BFA44;}
.otc .ot-bita{margin-top:6px;padding:8px 10px;border-radius:8px;background:#0891B214;border:1px solid #0891B240;font-size:12px;line-height:1.5;}
.otc .ot-bita b{color:var(--color-info-text);}
.otc .ot-aviso-cierre{margin-top:8px;padding:9px 10px;border-radius:8px;background:#F59E0B14;border:1px solid #F59E0B66;font-size:12.5px;line-height:1.5;}
.otc .empty{text-align:center;padding:40px 16px;color:var(--color-muted);}
.otc .empty .emoji{display:block;margin-bottom:10px;}
.otc .empty .emoji .vt-ico{width:36px;height:36px;}
.otc .vt-ico{width:15px;height:15px;vertical-align:-2px;}
#modalAnularOt.modal-bg{display:none;position:fixed;inset:0;background:var(--color-overlay);z-index:650;align-items:center;justify-content:center;padding:20px;}
#modalAnularOt.modal-bg.open{display:flex;}
#modalAnularOt .modal{background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-border);border-radius:14px;padding:20px;max-width:480px;width:100%;}
#modalAnularOt textarea{width:100%;min-height:80px;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:8px;padding:9px 11px;color:var(--color-text);font-family:inherit;}
`;
  document.head.appendChild(st);
  const montar = () => { if (!document.getElementById('modalAnularOt')) document.body.insertAdjacentHTML('beforeend', `<!-- MODAL: anular OT con motivo obligatorio (23 oct 2026 — solo Administrador) -->
<div class="modal-bg otc" id="modalAnularOt" onclick="if (event.target === this) cerrarModalAnularOt()">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="anularOtTitulo">
    <h3 id="anularOtTitulo"><span data-icon="ban"></span> Anular OT</h3>
    <div class="modal-sub" id="anularOtSub"></div>
    <div class="field" style="margin-bottom:6px;">
      <label for="anularOtMotivo">Motivo (obligatorio)</label>
      <textarea id="anularOtMotivo" maxlength="300" placeholder="Ej: duplicada, ya no aplica, reporte por error…"></textarea>
    </div>
    <div id="anularOtErr" style="font-size:12px;color:var(--color-danger-text);font-weight:700;margin-bottom:6px;"></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="cerrarModalAnularOt()">Cancelar</button>
      <button class="btn btn-primary" id="anularOtOk" style="background:var(--red);" onclick="confirmarAnularOt()"><span data-icon="ban"></span> Anular</button>
    </div>
  </div>
</div>`); };
  if (document.body) montar(); else document.addEventListener('DOMContentLoaded', montar);
})();

let currentOts = [];          // desde /ots: origen checklist + proyectos, estado en curso (onSnapshot)
const currentOtsTodas = () => currentOts;
// (25 oct 2026, Etapa 2) Técnico que puede tomar una OT: sin naves asignadas o de la nave de la OT.
function tecParaOt(t, o) {
  if (typeof fbNaveDe !== 'function' || !t || !Array.isArray(t.plantas) || !t.plantas.length) return true;
  const n = fbNaveDe(o);
  return !n || t.plantas.some(p => fbMismoNombre('plantas', p, n));
}

// (5 oct 2026) Traduce el "permission-denied" de Firestore a un mensaje en
// español que diga QUIÉN puede hacer esa acción, en vez del texto en inglés.
function mensajeErrorPermiso(e, accion) {
  const esPermiso = e && (e.code === 'permission-denied' || /permission|insufficient/i.test(e.message || ''));
  if (!esPermiso) return 'Error: ' + ((e && e.message) || e);
  const porAccion = {
    checklist: 'Tu usuario no tiene permiso para guardar checklists u OTs.',
    planificar: 'Solo Administrador o Encargado puede planificar una OT.',
    realizar: 'Solo Técnico, Supervisor, Encargado o Administrador puede marcar el trabajo como realizado.',
    validar: 'Solo Supervisor, Encargado o Administrador puede validar una OT.',
    rechazar: 'Solo Supervisor, Encargado o Administrador puede marcar una OT como no concluida.',
    cerrar: 'Solo el Administrador puede cerrar una OT de checklist.',
    anular: 'Solo el Administrador puede anular una OT (y no si ya está cerrada).',
    configurar: 'Solo Administrador o Encargado puede cambiar la frecuencia o el horómetro.',
    horometro: 'Tu usuario no tiene permiso para actualizar el horómetro.',
  };
  return '' + (porAccion[accion] || 'No tienes permiso para esta acción.');
}

function nombreUsuarioActual() {
  return (window.currentUserRole && window.currentUserRole.nombre) || (window.currentUser && window.currentUser.email) || '';
}


// (v3 etapa 3a) misma fecha local de siempre: la común de firebase-init.js
function todayStr() { return fbHoy(); }

function openModalGeneric(id) { document.getElementById(id).classList.add('open'); }
function closeModalGeneric(id) { document.getElementById(id).classList.remove('open'); }

// Foto guardada en /fotos_repuestos (se lee solo cuando alguien la pide).
const _fotosChecklist = {};
function verFotoChecklist(ref, btn) {
  const id = String(ref || '').replace(/^foto:/, '');
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return;
  const pinta = d => {
    if (!d || !/^data:image\/(jpeg|png);base64,/.test(d)) { btn.textContent = 'Foto no disponible'; return; }
    const img = document.createElement('img');
    img.src = d; img.alt = 'foto'; img.style.cssText = 'max-width:100%;border-radius:8px;margin-top:6px;display:block;';
    btn.replaceWith(img);
  };
  if (_fotosChecklist[id]) return pinta(_fotosChecklist[id]);
  btn.textContent = 'Cargando…'; btn.disabled = true;
  db.collection('fotos_repuestos').doc(id).get().then(s => { const d = s.exists ? s.data().data : ''; _fotosChecklist[id] = d; pinta(d); })
    .catch(() => { btn.textContent = 'No se pudo cargar la foto'; });
}


// ══════ OTs PENDIENTES / PLANIFICADAS ══════
function loadOts() {
  if (window._otcEscuchando) return; window._otcEscuchando = true; // (v3 etapa 3a) una sola vez por pantalla
  // NOTA: se ordena en el cliente (no con .orderBy() en la consulta) para
  // no depender de crear un índice compuesto en Firebase solo por combinar
  // where('origen',...) con orderBy('createdAt',...) — con el volumen de
  // OTs que maneja esta planta, ordenar en JS es más que suficiente.
  //
  // ESTADOS (21 sep 2026 — flujo de revisión/cierre):
  //  pendiente → planificada (Encargado/Admin asigna técnico+fecha)
  //  → en_revision (el técnico marca "trabajo realizado")
  //  → rechazada (Supervisor/Encargado/Admin dice "no concluido", con nota;
  //     el técnico corrige y la vuelve a marcar realizada) O
  //  → validada (Supervisor/Encargado/Admin dice "buena y válida")
  //  → completada (SOLO Administrador hace el cierre final)
  // Administrador también puede "Cerrar directo" desde cualquier estado, sin
  // pasar por los pasos intermedios (pedido explícito del usuario).
  // (5 oct 2026) Cuota gratis de Firebase: antes se escuchaban TODAS las OTs de
  // checklist de todos los años (también las completadas, que no se muestran).
  // Ahora solo las que están en curso. '==' + 'in' son filtros de igualdad:
  // no hace falta índice compuesto.
  //
  // (20 oct 2026) Segundo listener, igual de acotado: los proyectos / mejoras
  // que reporta producción (tipoReporte 'proyecto', origen operador o QR) en
  // los mismos estados. También son solo igualdades ('==' + 'in'): sin índice
  // compuesto. Los dos se unen por id.
  const ESTADOS = ['pendiente', 'planificada', 'en_revision', 'rechazada', 'validada'];
  const partes = { checklist: [], proyecto: [] };
  const unir = () => {
    // Orden: primero por prioridad (alta arriba de todo), y dentro de cada
    // prioridad, la más reciente primero — así una guarda de seguridad rota
    // no se pierde debajo de diez limpiezas pendientes.
    const rangoPrioridad = { alta: 0, media: 1, baja: 2 };
    const porId = new Map();
    partes.checklist.concat(partes.proyecto).forEach(o => porId.set(o.id, o));
    currentOts = [...porId.values()]
      .filter(o => ESTADOS.includes(o.estado))
      .sort((a, b) => {
        const rp = (rangoPrioridad[a.prioridad] ?? 1) - (rangoPrioridad[b.prioridad] ?? 1);
        if (rp !== 0) return rp;
        return (b.createdAt && b.createdAt.seconds || 0) - (a.createdAt && a.createdAt.seconds || 0);
      });
    renderOts();
  };
  db.collection('ots').where('origen', '==', 'checklist').where('estado', 'in', ESTADOS).onSnapshot((snap) => {
    partes.checklist = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    unir();
  }, (err) => console.warn('Error leyendo OTs:', err.message));
  db.collection('ots').where('tipoReporte', '==', 'proyecto').where('estado', 'in', ESTADOS).onSnapshot((snap) => {
    partes.proyecto = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    unir();
  }, (err) => console.warn('Error leyendo proyectos:', err.message));
}
// (20 oct 2026) Proyecto / mejora de producción vs. falla de checklist (predictivo).
const otcEsProyecto = o => !!o && o.tipoReporte === 'proyecto'; // (= esProyectoOt de Bitácora)
const fmtDdMm = f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f || ''); return m ? m[3] + '/' + m[2] : (f || ''); };
// Resumen de lo que el técnico reportó en la Bitácora (para la revisión). Sin costos.
function resumenBitacoraOt(o) {
  if (!o.reportadoEnBitacora) return '';
  const reps = (Array.isArray(o.REPUESTOS) ? o.REPUESTOS : []).filter(i => i && i.descripcion).map(i => fbEsc(i.cantidad) + ' × ' + fbEsc(i.descripcion));
  return `<div class="ot-bita"><span data-icon="clipboard"></span> <b>Reportado en Bitácora</b>${o.FECHA ? ' el ' + fbEsc(fmtDdMm(o.FECHA)) : ''}${o.TECNICOS ? ' · ' + fbEsc(o.TECNICOS) : ''}
    ${o.DESCRIPCION_SOLUCION ? `<div><span data-icon="check"></span> ${fbEsc(o.DESCRIPCION_SOLUCION)}</div>` : ''}
    <div style="color:var(--muted);">${o.REPUESTOS_USADOS === 'si' ? 'Repuestos: ' + (reps.join(', ') || '—') : 'Sin repuestos'}${o.H_TECNICO && o.H_FINAL ? ' · ' + fbEsc(o.H_TECNICO) + '–' + fbEsc(o.H_FINAL) : ''}</div></div>`;
}
// (20 oct 2026) "Cerrar directo" de una OT que nadie reportó en la Bitácora:
// se permite, pero primero se avisa aquí mismo (sin ventana del navegador).
const _avisoCierreSinBitacora = new Set();

// (23 oct 2026) Estados desde los que el Administrador puede anular (nunca 'completada').
const ESTADOS_ANULABLES = ['pendiente', 'en_atencion', 'planificada', 'rechazada', 'en_revision', 'validada'];
const OT_ESTADO_TAG = {
  pendiente:   { clase: 'tag-pendiente',   texto: 'Pendiente' },
  planificada: { clase: 'tag-planificada', texto: 'Planificada' },
  en_revision: { clase: 'tag-planificada', texto: 'En revisión' },
  rechazada:   { clase: 'tag-falla',       texto: 'No concluida' },
  validada:    { clase: 'tag-completada',  texto: 'Validada · falta cierre' },
};

// (v3 etapa 3a) Las tarjetas se pintan en las secciones de Trabajos (bitacora.html):
// "Por planificar" (pendiente, planificada, devuelta) y "Por validar" (en revisión,
// validada). Mismas tarjetas, botones y permisos que la pestaña OTs de Checklist.
const OTC_VISTAS = [
  { el: 'ots-planificar', estados: ['pendiente', 'planificada', 'rechazada'], vacio: 'shell.t_vacioPlanificar' },
  { el: 'ots-validar', estados: ['en_revision', 'validada'], vacio: 'shell.t_vacioValidar' },
];
const otcEnNave = r => typeof fbEnNave !== 'function' || fbEnNave(r); // (25 oct 2026) nave elegida
const otcTecnicos = () => (typeof TECNICOS_LISTA !== 'undefined' ? TECNICOS_LISTA : (window._tecLista || []));
const otcEquipos = () => (typeof currentEquipos !== 'undefined' ? currentEquipos : (typeof _equiposCanonicos !== 'undefined' ? _equiposCanonicos : []));
function otcConteo() { const l = currentOtsTodas().filter(otcEnNave); const n = {}; OTC_VISTAS.forEach(v => { n[v.el] = l.filter(o => v.estados.includes(o.estado)).length; }); return n; }
function renderOts() {
  const puedePlanificar = typeof userHasRole === 'function' && userHasRole('ADMINISTRADOR', 'ENCARGADO_MANTENIMIENTO');
  const puedeRevisar = typeof userHasRole === 'function' && userHasRole('ADMINISTRADOR', 'ENCARGADO_MANTENIMIENTO', 'SUPERVISOR');
  const puedeMarcarHecho = typeof userHasRole === 'function' && userHasRole('ADMINISTRADOR', 'ENCARGADO_MANTENIMIENTO', 'SUPERVISOR', 'TECNICO');
  const esAdminCierre = typeof userHasRole === 'function' && userHasRole('ADMINISTRADOR');
  if (typeof window.otcAlPintar === 'function') try { window.otcAlPintar(otcConteo()); } catch (e) {}
  OTC_VISTAS.forEach(vista => {
  const wrap = document.getElementById(vista.el);
  if (!wrap) return;
  const currentOts = currentOtsTodas().filter(otcEnNave).filter(o => vista.estados.includes(o.estado)); // (25 oct 2026) nave elegida
  if (!currentOts.length) {
    wrap.innerHTML = `<div class="empty"><span class="emoji"><span data-icon="check-circle"></span></span><p>${fbEsc(window.i18n ? i18n.t(vista.vacio) : 'No hay OTs pendientes por planificar.')}</p></div>`;
    return;
  }
  wrap.innerHTML = currentOts.map(o => {
    const tag = OT_ESTADO_TAG[o.estado] || { clase: 'tag-pendiente', texto: fbEsc(o.estado || '—') };
    let acciones = '';

    if (o.estado === 'pendiente' && puedePlanificar) {
      acciones = `
        <div class="row" style="margin-top:10px;">
          <div class="field" style="margin-bottom:0;">
            <select id="ot-tec-${o.id}"><option value="">Asignar a...</option>${otcTecnicos().filter(t => tecParaOt(t, o)).map(t => `<option value="${fbEsc(t.nombre)}">${fbEsc(t.corto || t.nombre)}</option>`).join('')}</select>
          </div>
          <div class="field" style="margin-bottom:0;max-width:130px;">
            <input type="date" id="ot-fecha-${o.id}" value="${todayStr()}"/>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="planificarOt('${o.id}')"><span data-icon="calendar"></span> Planificar</button>`;
    } else if (o.estado === 'planificada' || o.estado === 'rechazada') {
      acciones = `<div class="item-sub" style="margin-top:6px;"><span data-icon="user"></span> ${fbEsc(o.asignadoA || '—')} · <span data-icon="calendar"></span> ${fbEsc(o.fechaPlanificada || '—')}</div>`;
      if (o.estado === 'rechazada' && o.notaRevision) {
        acciones += `<div class="item-sub" style="margin-top:4px;color:var(--color-danger-text);"><span data-icon="alert"></span> ${o.revisadoPor ? fbEsc(o.revisadoPor) + ': ' : ''}${fbEsc(o.notaRevision)}</div>`;
      }
      if (o.estado === 'rechazada') acciones += resumenBitacoraOt(o);
      // (20 oct 2026) Todo trabajo realizado se reporta en la Bitácora: el
      // botón abre el formulario de la Bitácora en modo "registrar esta OT"
      // (mismo documento; al guardar pasa a revisión). Antes era "Marcar realizada".
      if (puedeMarcarHecho) {
        acciones += `<a class="btn btn-secondary btn-sm" style="margin-top:8px;display:inline-block;text-decoration:none;" href="bitacora.html#ot=${encodeURIComponent(o.id)}">${o.estado === 'rechazada' ? '<span data-icon="clipboard"></span> Corregir en Bitácora' : '<span data-icon="clipboard"></span> Registrar en Bitácora'}</a>`;
      }
    } else if (o.estado === 'en_revision') {
      acciones = `<div class="item-sub" style="margin-top:6px;"><span data-icon="user"></span> ${fbEsc(o.asignadoA || '—')} · Trabajo realizado, en espera de revisión</div>` + resumenBitacoraOt(o);
      if (puedeRevisar) {
        acciones += `
          <div class="field" style="margin-top:8px;margin-bottom:6px;">
            <label>Nota de revisión (obligatoria si no está concluido)</label>
            <textarea id="ot-nota-rev-${o.id}" placeholder="Qué falta o qué se debe corregir..."></textarea>
          </div>
          <div class="row">
            <button class="btn btn-primary btn-sm" onclick="validarOt('${o.id}')"><span data-icon="check-circle"></span> Buena y válida</button>
            <button class="btn btn-secondary btn-sm" onclick="rechazarOt('${o.id}')"><span data-icon="alert"></span> No concluido</button>
          </div>`;
      }
    } else if (o.estado === 'validada') {
      acciones = `<div class="item-sub" style="margin-top:6px;"><span data-icon="user"></span> ${fbEsc(o.asignadoA || '—')} · Validado por ${fbEsc(o.revisadoPor || '—')}</div>` + resumenBitacoraOt(o);
      if (esAdminCierre) {
        acciones += `<button class="btn btn-primary btn-sm" style="margin-top:8px;" onclick="cerrarOtFinal('${o.id}')"><span data-icon="lock"></span> Cerrar OT</button>`;
      }
    }

    // Atajo del Administrador: cerrar de una vez, sin pasar por revisión/validación.
    if (esAdminCierre && o.estado !== 'completada') {
      if (_avisoCierreSinBitacora.has(o.id) && !o.reportadoEnBitacora) {
        acciones += `<div class="ot-aviso-cierre"><span data-icon="alert"></span> <b>Este trabajo no se reportó en la Bitácora.</b> Si la cierras así, queda sin solución, técnicos ni repuestos registrados, y en Incentivos cuenta como "no reportada en Bitácora".
          <div class="row" style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="cerrarOtDirecto('${o.id}', true)">Cerrar de todas formas</button><button class="btn btn-secondary btn-sm" onclick="cancelarCierreDirecto('${o.id}')">Cancelar</button></div></div>`;
      } else {
        acciones += `<button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="cerrarOtDirecto('${o.id}')"><span data-icon="zap"></span> Cerrar directo</button>`;
      }
    }
    // (23 oct 2026) Solo el Administrador anula (borrado suave, con motivo) una
    // OT de checklist o una solicitud / proyecto de producción.
    if (esAdminCierre && ESTADOS_ANULABLES.includes(o.estado)) {
      acciones += `<button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="abrirAnularOt('${fbEsc(o.id)}')"><span data-icon="ban"></span> Anular</button>`;
    }
    const tagOrigen = otcEsProyecto(o) ? '<span class="tag tag-origen-proy"><span data-icon="ruler"></span> Proyecto</span>' : '<span class="tag tag-origen-check"><span data-icon="clipboard-check"></span> Checklist (predictivo)</span>';

    return `
      <div class="item-row" style="cursor:default;">
        <div class="item-header">
          <div class="item-title">${fbEsc(o.folio || o.id)} · ${fbEsc(o.equipoNombre || '')}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
            ${tagOrigen}
            ${o.prioridad ? `<span class="tag tag-prioridad-${fbEsc(o.prioridad)}">${o.prioridad === 'alta' ? '<span data-icon="dot" style="color:var(--color-danger)"></span>' : o.prioridad === 'baja' ? '<span data-icon="dot" style="color:var(--color-success)"></span>' : '<span data-icon="dot" style="color:var(--color-warn)"></span>'} ${fbEsc(o.prioridad)}</span>` : ''}
            <span class="tag ${tag.clase}">${tag.texto}</span>${typeof fbRcaBadge === 'function' ? fbRcaBadge(o) : ''}
          </div>
        </div>
        <div class="item-sub">${o.equipoLocalidad ? '<span data-icon="pin"></span> ' + fbEsc(o.equipoLocalidad) + ' · ' : ''}${o.causaFalla ? '[' + fbEsc(o.causaFalla) + '] ' : ''}${fbEsc(o.descripcionFalla || '')}</div>${otcEsProyecto(o) && o.creadoPor ? `<div class="item-sub">Pidió: ${fbEsc(o.creadoPor)}${o.fechaReporte ? ' · ' + fbEsc(fmtDdMm(o.fechaReporte)) : ''}</div>` : ''}${o.foto ? `<button type="button" class="btn btn-secondary btn-sm" style="margin-top:6px;" onclick="event.stopPropagation();verFotoChecklist('${fbEsc(o.foto)}', this)"><span data-icon="camera"></span> Ver foto</button>` : ''}
        ${acciones}
        ${o.folio ? `
        <div style="margin-top:8px;">
          <button class="btn btn-secondary btn-sm" onclick="verCostoRepuestosOt('${o.id}')"><span data-icon="coins"></span> Ver costo de repuestos</button>
          <div id="costo-ot-${o.id}" class="item-sub" style="margin-top:6px;"></div>
        </div>` : ''}
      </div>`;
  }).join('');
  if (window.VTIcons) VTIcons.hydrate(wrap);
  });
}

// (5 oct 2026) Toda actualización de OT deja editadoPor/editadoEn, y si
// Firestore la rechaza por permisos se dice en español quién sí puede.
function camposEdicionOt() {
  return { editadoPor: nombreUsuarioActual(), editadoEn: fbTimestamp() };
}

async function planificarOt(otId) {
  const tec = document.getElementById('ot-tec-' + otId).value;
  const fecha = document.getElementById('ot-fecha-' + otId).value;
  if (!tec || !fecha) { showToast('Elige técnico y fecha', 'warn'); return; }
  try {
    await db.collection('ots').doc(otId).update({ estado: 'planificada', asignadoA: tec, fechaPlanificada: fecha, ...camposEdicionOt() });
    showToast('OT planificada ');
  } catch (e) {
    showToast(mensajeErrorPermiso(e, 'planificar'), 'error');
  }
}

// (20 oct 2026) Ya no hay "Marcar realizada" aquí: el técnico registra el
// trabajo en la Bitácora (bitacora.html#ot=<id>) y ese guardado pasa la OT a
// revisión con todos los datos (solución, técnicos, repuestos, herramientas).

async function validarOt(otId) {
  const nota = (document.getElementById('ot-nota-rev-' + otId) || {}).value || '';
  // (28 oct 2026) Una OT con análisis de causa raíz pendiente no se valida (también en firestore.rules).
  const otV = (currentOts || []).find(o => o.id === otId);
  if (otV && otV.rcaRequerido === true && !(typeof fbRcaLleno === 'function' && fbRcaLleno(otV.rca))) {
    showToast('Falta el análisis de causa raíz (RCA) de esta OT. Se llena en la Bitácora (Historial); después se puede validar.', 'warn');
    return;
  }
  try {
    await db.collection('ots').doc(otId).update({
      estado: 'validada',
      revisadoPor: (window.currentUserRole && window.currentUserRole.nombre) || '',
      revisadoEn: fbTimestamp(),
      revisionResultado: 'buena',
      notaRevision: nota.trim(),
      ...camposEdicionOt(),
    });
    showToast('OT validada — falta el cierre ');
  } catch (e) {
    showToast(mensajeErrorPermiso(e, 'validar'), 'error');
  }
}

async function rechazarOt(otId) {
  const nota = ((document.getElementById('ot-nota-rev-' + otId) || {}).value || '').trim();
  if (!nota) { showToast('Escribe qué falta o qué se debe corregir', 'warn'); return; }
  try {
    await db.collection('ots').doc(otId).update({
      estado: 'rechazada',
      revisadoPor: (window.currentUserRole && window.currentUserRole.nombre) || '',
      revisadoEn: fbTimestamp(),
      revisionResultado: 'rechazada',
      // (20 oct 2026) Contador para Incentivos: revisionResultado se pisa con
      // 'buena' cuando después se valida; este número queda.
      vecesRechazada: firebase.firestore.FieldValue.increment(1),
      notaRevision: nota,
      ...camposEdicionOt(),
    });
    showToast('OT regresada como no concluida', 'warn');
  } catch (e) {
    showToast(mensajeErrorPermiso(e, 'rechazar'), 'error');
  }
}

// ══════ CIERRE FINAL (Administrador) ══════
// Al cerrar, además de marcar la OT como completada, se cargan los mismos
// campos que usa Bitácora/Análisis (TIPO_MANTENIMIENTO, EQUIPO, TECNICOS...)
// para que esta actividad aparezca en el panel de Análisis clasificada como
// "Preventivo" (a favor, no como correctivo) y con su tiempo de respuesta —
// desde que se creó la OT (por una falla detectada en el checklist) hasta
// que se cerró. No se toca TOTAL_MIN_MAQUINA/TOTAL_MIN_TECNICO (quedan en 0)
// para no alterar los cálculos de paro de máquina que ya existen en
// Análisis — el tiempo de respuesta se guarda aparte, en su propio campo.
function calcularTiempoRespuestaMin(ot) {
  const creado = ot.createdAt && typeof ot.createdAt.toMillis === 'function' ? ot.createdAt.toMillis() : null;
  if (!creado) return null;
  return Math.max(0, Math.round((Date.now() - creado) / 60000));
}

// (5 oct 2026) Para que Análisis la cuente bien: FECHA es el día en que
// el trabajo se HIZO (trabajoRealizadoEn), no el día del cierre (que puede
// ser una semana después); si no se marcó como realizado, hoy. Se agregan
// SEMANA (ISO, la misma de Análisis), PLANTA (la del equipo, si la tiene) y
// equipoId (para la hoja de vida, aunque se renombre el equipo).
function fechaTrabajoRealizado(ot) {
  const ts = ot.trabajoRealizadoEn;
  if (ts && typeof ts.toDate === 'function') return fbFechaLocal(ts.toDate());
  return todayStr();
}

// (20 oct 2026) Solo se llenan los campos que FALTAN: si el técnico ya
// reportó el trabajo en la Bitácora (fecha, horas, solución, técnicos,
// repuestos…), el cierre no los pisa. Tipo: 'Predictivo' para las OTs de
// checklist y 'Proyecto' para los proyectos (antes las de checklist se
// cerraban como 'Preventivo').
function camposParaAnalisis(ot, tiempoRespuestaMin) {
  const base = camposAnalisisBase(ot, tiempoRespuestaMin);
  const out = {};
  Object.keys(base).forEach(k => { const v = ot[k]; if (v === undefined || v === null || v === '') out[k] = base[k]; });
  return out;
}
function camposAnalisisBase(ot, tiempoRespuestaMin) {
  const proy = otcEsProyecto(ot);
  const fecha = fechaTrabajoRealizado(ot);
  const equipo = otcEquipos().find(x => x.id === ot.equipoId);
  return {
    Title: ot.folio || ot.id,
    FECHA: fecha,
    SEMANA: fbSemanaISO(fecha),
    PLANTA: (equipo && (equipo.planta || equipo.plantaNombre)) || '',
    equipoId: ot.equipoId || null,
    LINEA_EQUIPO: ot.equipoLocalidad || '',
    TIPO_MAQUINA: '',
    EQUIPO: ot.equipoNombre || '',
    TIPO_MANTENIMIENTO: proy ? 'Proyecto' : 'Predictivo',
    TECNICOS: ot.asignadoA || ot.trabajoRealizadoPor || '',
    DESCRIPCION_FALLA: ot.descripcionFalla || '',
    DESCRIPCION_SOLUCION: ot.notaRevision || (proy ? 'Proyecto cerrado por el Administrador' : 'Verificado mediante checklist (predictivo)'),
    ME: 'm',
    GENERA_OT: 'no',
    PARO_PLANTA: 'no',
    TOTAL_MIN_MAQUINA: 0,
    TOTAL_MIN_TECNICO: 0,
    // Un proyecto se planifica: no tiene "tiempo de respuesta" de falla.
    TIEMPO_RESPUESTA_MIN: proy ? null : tiempoRespuestaMin,
  };
}

async function cerrarOtFinal(otId) {
  const o = currentOts.find(x => x.id === otId);
  if (!o) return;
  const tiempoRespuestaMin = calcularTiempoRespuestaMin(o);
  try {
    await db.collection('ots').doc(otId).set({
      estado: 'completada',
      cerradoPor: (window.currentUserRole && window.currentUserRole.nombre) || '',
      cerradoEn: fbTimestamp(),
      fechaCompletada: todayStr(),
      tiempoRespuestaMin: otcEsProyecto(o) ? null : tiempoRespuestaMin,
      ...camposParaAnalisis(o, tiempoRespuestaMin),
      ...camposEdicionOt(),
      ...(o.reportadoEnBitacora ? {} : { cerradoSinBitacora: true }),
    }, { merge: true });
    showToast(otcEsProyecto(o) ? 'Proyecto cerrado ' : 'OT cerrada — cuenta como predictivo en Análisis');
  } catch (e) {
    showToast(mensajeErrorPermiso(e, 'cerrar'), 'error');
  }
}

// ══════ ANULAR OT (23 oct 2026 — solo Administrador) ══════
// Pedido del dueño: "solo el administrador puede borrar las solicitudes hechas
// por producción o algunas OT generadas". No se borra el documento: queda con
// estado 'anulada', anuladoPor, anuladoEn y motivoAnulacion (igual que los
// avisos duplicados de la Bitácora). firestore.rules también lo exige.
let _anularOtId = null;
function abrirAnularOt(otId) {
  const o = currentOts.find(x => x.id === otId);
  if (!o) return;
  if (!(typeof userHasRole === 'function' && userHasRole('ADMINISTRADOR'))) { showToast('Solo el Administrador puede anular una OT', 'error'); return; }
  _anularOtId = otId;
  document.getElementById('anularOtSub').textContent = `${o.folio || o.id} · ${o.equipoNombre || 'equipo'} — ${o.descripcionFalla || ''}`.slice(0, 220);
  document.getElementById('anularOtMotivo').value = '';
  document.getElementById('anularOtErr').textContent = '';
  openModalGeneric('modalAnularOt');
  setTimeout(() => document.getElementById('anularOtMotivo').focus(), 50);
}
function cerrarModalAnularOt() { _anularOtId = null; closeModalGeneric('modalAnularOt'); }
async function confirmarAnularOt() {
  const otId = _anularOtId;
  if (!otId) return cerrarModalAnularOt();
  const motivo = document.getElementById('anularOtMotivo').value.trim();
  if (!motivo) { document.getElementById('anularOtErr').textContent = 'Escribe el motivo para poder anular.'; document.getElementById('anularOtMotivo').focus(); return; }
  cerrarModalAnularOt();
  try {
    await db.collection('ots').doc(otId).update({
      estado: 'anulada',
      anuladoPor: nombreUsuarioActual(),
      anuladoEn: fbTimestamp(),
      motivoAnulacion: motivo.slice(0, 300),
      ...camposEdicionOt(),
    });
    showToast('OT anulada', 'warn');
  } catch (e) {
    showToast(mensajeErrorPermiso(e, 'anular'), 'error');
  }
}

function cancelarCierreDirecto(otId) { _avisoCierreSinBitacora.delete(otId); renderOts(); }
async function cerrarOtDirecto(otId, aunSinBitacora) {
  const o = currentOts.find(x => x.id === otId);
  if (!o) return;
  // (20 oct 2026) Sin reporte en Bitácora: primero el aviso en la tarjeta.
  if (!o.reportadoEnBitacora && !aunSinBitacora) { _avisoCierreSinBitacora.add(otId); renderOts(); return; }
  _avisoCierreSinBitacora.delete(otId);
  const nombreAdmin = (window.currentUserRole && window.currentUserRole.nombre) || '';
  const tiempoRespuestaMin = calcularTiempoRespuestaMin(o);
  const payload = {
    estado: 'completada',
    cerradoPor: nombreAdmin,
    cerradoEn: fbTimestamp(),
    fechaCompletada: todayStr(),
    tiempoRespuestaMin: otcEsProyecto(o) ? null : tiempoRespuestaMin,
    ...camposParaAnalisis(o, tiempoRespuestaMin),
    ...camposEdicionOt(),
  };
  if (!o.reportadoEnBitacora) payload.cerradoSinBitacora = true; // lo ve Incentivos
  // Si nadie la había revisado todavía, el cierre directo también cuenta como la revisión.
  if (!o.revisadoPor) {
    payload.revisadoPor = nombreAdmin;
    payload.revisadoEn = fbTimestamp();
    payload.revisionResultado = 'buena';
  }
  try {
    await db.collection('ots').doc(otId).set(payload, { merge: true });
    showToast('OT cerrada directamente ');
  } catch (e) {
    showToast(mensajeErrorPermiso(e, 'cerrar'), 'error');
  }
}


// ══════ COSTO DE REPUESTOS POR OT (comparación con Maximo/SAP, 28 sep 2026) ══════
// Lee /movimientos (misma colección que usa inventario.html para entradas/
// salidas de stock) filtrando por el folio de esta OT. Solo cuenta las
// salidas que tenían costo unitario cargado en Inventario — si un repuesto
// no tiene precio, se avisa cuántos quedaron fuera en vez de mostrar un
// total incompleto como si fuera el real.
// (5 oct 2026) El botón ya no lleva el folio escrito dentro del onclick
// (texto de Firestore dentro de JS en línea = riesgo de inyección): solo
// pasa el id de la OT y aquí se busca su folio.
async function verCostoRepuestosOt(otId) {
  const el = document.getElementById('costo-ot-' + otId);
  if (!el) return;
  const otLocal = currentOts.find(x => x.id === otId);
  const folio = otLocal && otLocal.folio;
  if (!folio) { el.textContent = 'Esta OT no tiene folio.'; return; }
  el.textContent = 'Buscando repuestos de esta OT...';
  try {
    const snap = await db.collection('movimientos').where('otFolio', '==', folio).get();
    const movs = snap.docs.map(d => d.data()).filter(m => m.tipo === 'salida');
    if (!movs.length) {
      el.textContent = 'Sin repuestos registrados con este folio todavía (se cargan desde Inventario → Movimiento → Folio de OT).';
      return;
    }
    let total = 0, sinPrecio = 0;
    movs.forEach(m => { if (m.costoTotal != null) total += m.costoTotal; else sinPrecio++; });
    el.innerHTML = `${movs.length} repuesto(s) · Total: $${total.toFixed(2)}` +
      (sinPrecio ? ` <span style="color:var(--color-accent-text)">(${sinPrecio} sin costo unitario cargado)</span>` : '');
  } catch (e) {
    el.textContent = 'Error al buscar: ' + e.message;
  }
}

