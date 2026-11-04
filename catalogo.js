// catalogo.js — (v3 etapa 3a, nov 2026) CATÁLOGO DE EQUIPOS
// ══════════════════════════════════════════════════════════════════════
// Código MOVIDO tal cual desde inventario.html (no se reescribió nada de la
// lógica ni de lo que se guarda): agregar / editar equipo, planta-área-línea-
// tipo, manual (enlace), reubicaciones, auditoría, carga masiva de equipos,
// ordenar fichas técnicas, eliminar equipo (con clave y deshacer) y la clave
// de eliminación compartida. Lo usan:
//   · hoja-vida.html (módulo Equipos: lista → Equipo 360 → historial) — su casa
//   · almacen.html (Almacén → Repuestos), para el rol Almacén, que no abre Equipos
//     y siempre pudo editar el catálogo (firestore.rules: esAlmacenOMas()).
// Cada pantalla que lo carga define: let DB (equipos con repuestos), let
// currentEquipoId, getCurrentEquipo(), renderHome(), renderDetail(),
// backHome(), openEquipo(id), showToast(), showUndoToast(), showLoading(),
// hideLoading(). Las ventanas (modales) se agregan solas al final de <body>.
// Lecturas: ninguna al cargar (las listas de áreas / plantas / líneas se leen
// al abrir el formulario, igual que antes).
// ══════════════════════════════════════════════════════════════════════
(function () {
  if (document.getElementById('vtCatCss')) return;
  const st = document.createElement('style'); st.id = 'vtCatCss';
  st.textContent = `
.modal-bg.vtcat{display:none;position:fixed;inset:0;background:var(--color-overlay);z-index:650;align-items:center;justify-content:center;padding:20px;font-family:var(--font-sans);}
.modal-bg.vtcat.open{display:flex;}
.modal-bg.vtcat .modal{background:var(--color-surface);color:var(--color-text);border:1px solid var(--color-border);border-radius:14px;padding:24px;max-width:560px;width:100%;max-height:85vh;overflow-y:auto;text-align:left;}
.modal-bg.vtcat .modal h3{margin:0 0 4px;font-size:16px;}
.modal-bg.vtcat .modal-sub{font-size:12px;color:var(--color-muted);margin-bottom:18px;}
.modal-bg.vtcat .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.modal-bg.vtcat .form-field{display:flex;flex-direction:column;gap:5px;}
.modal-bg.vtcat .form-field.full{grid-column:1/-1;}
.modal-bg.vtcat .form-field label{font-size:10.5px;color:var(--color-muted);text-transform:uppercase;letter-spacing:.4px;font-family:var(--font-mono);}
.modal-bg.vtcat .form-field input,.modal-bg.vtcat .form-field textarea,.modal-bg.vtcat .form-field select{background:var(--color-surface-2);border:1px solid var(--color-border);color:var(--color-text);padding:9px 11px;border-radius:7px;font-size:13px;font-family:var(--font-sans);width:100%;}
.modal-bg.vtcat .form-field textarea{resize:vertical;min-height:50px;}
.modal-bg.vtcat .modal-actions{display:flex;gap:10px;margin-top:20px;justify-content:flex-end;flex-wrap:wrap;}
.modal-bg.vtcat .btn{width:auto;flex:0 0 auto;background:var(--color-accent);color:var(--color-on-accent);border:none;padding:9px 16px;border-radius:7px;font-weight:600;font-size:12.5px;cursor:pointer;font-family:var(--font-sans);}
.modal-bg.vtcat .btn.secondary{background:transparent;border:1px solid var(--color-border);color:var(--color-text);}
.modal-bg.vtcat .btn.danger{background:var(--color-danger-soft);color:var(--color-danger-text);border:1px solid #EF444466;}
.modal-bg.vtcat .btn.sm{padding:6px 11px;font-size:11.5px;}
.modal-bg.vtcat .btn[disabled]{opacity:.5;cursor:default;}
.modal-bg.vtcat table{width:100%;border-collapse:collapse;font-size:12.5px;}
.modal-bg.vtcat thead th{text-align:left;font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--color-muted);border-bottom:1px solid var(--color-border);padding:8px 10px;white-space:nowrap;background:none;position:static;}
.modal-bg.vtcat tbody td{padding:10px;border-bottom:1px solid var(--color-surface-2);vertical-align:middle;}
.modal-bg.vtcat .table-card{background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;padding:12px;}
.modal-bg.vtcat .ficha-item{border:1px solid var(--color-border);border-radius:10px;padding:12px 14px;margin-bottom:10px;background:var(--color-surface-2);}
.modal-bg.vtcat .ficha-head{display:flex;gap:8px;align-items:center;}
.modal-bg.vtcat .ficha-head input{width:auto;}
.modal-bg.vtcat .ficha-antes{font-size:11.5px;color:var(--color-muted);margin:6px 0 8px;line-height:1.5;}
.modal-bg.vtcat .mono{font-family:var(--font-mono);}
@media(max-width:720px){.modal-bg.vtcat .form-grid{grid-template-columns:1fr;}.modal-bg.vtcat .modal{padding:18px;}}
`;
  document.head.appendChild(st);
  const montar = () => { if (!document.getElementById('modalEquipo')) document.body.insertAdjacentHTML('beforeend', `<!-- Modal: nuevo equipo -->
<div class="modal-bg vtcat" id="modalEquipo">
  <div class="modal">
    <h3 id="equipoModalTitle"><span data-icon="plus"></span> Nuevo equipo / máquina</h3>
    <div class="modal-sub">Datos generales — puedes dejar campos vacíos y completarlos después</div>
    <div class="form-grid">
      <div class="form-field full"><label>Nombre *</label><input id="eq-nombre" placeholder="Ej: VALVE ASSEMBLY"></div>
      <div class="form-field"><label>Marca</label><input id="eq-marca"></div>
      <div class="form-field"><label>Modelo</label><input id="eq-modelo"></div>
      <div class="form-field"><label>Serie</label><input id="eq-serie"></div>
      <!-- FASE 2 (Módulo 2): antes era texto libre; ahora se elige de la
           misma lista de Áreas que usa Bitácora (/areas en Firestore), para
           que un equipo quede ligado a un área real y no a texto suelto
           ("PLANTA 1" vs "Planta 1" vs "planta1"). Ver loadAreasParaEquipos(). -->
      <!-- (7 oct 2026) Planta / Línea / Tipo de máquina: los mismos campos que
           lee la cascada Planta → Área → Línea → Tipo → Equipo de Bitácora.
           Planta sale de /plantas y Línea de /lineas (filtrada por el Área
           elegida, areaNombre). Se leen UNA vez por sesión al abrir el
           formulario (plan gratis: pocas lecturas). Todos son opcionales. -->
      <div class="form-field"><label>Planta</label><select id="eq-planta"><option value="">Sin planta</option></select></div>
      <div class="form-field"><label>Localidad (Área)</label><select id="eq-localidad" onchange="onEqAreaChange()"><option value="">Seleccionar área...</option></select></div>
      <div class="form-field"><label>Línea</label><select id="eq-linea" onchange="avisarLineaArea()"><option value="">Sin línea</option></select></div>
      <div class="form-field"><label>Tipo de máquina</label><input id="eq-tipo" list="eq-tipo-list" placeholder="Ej: Telar circular" autocomplete="off"><datalist id="eq-tipo-list"></datalist></div>
      <div class="form-field full" id="eq-linea-aviso" style="display:none;font-size:12px;color:var(--color-accent-text);margin-top:-4px;"></div>
      <div class="form-field"><label>Fecha fabricación</label><input id="eq-fabricacion" type="date"></div>
      <div class="form-field"><label>Fecha instalación</label><input id="eq-instalacion" type="date"></div>
      <!-- Comparación con Maximo/SAP (28 sep 2026): rastrear compra/garantía por
           equipo evita mandar a comprar un repuesto pagado cuando la pieza
           todavía está cubierta. -->
      <div class="form-field"><label>Fecha de compra</label><input id="eq-compra" type="date"></div>
      <div class="form-field"><label>Garantía hasta</label><input id="eq-garantia" type="date"></div>
      <div class="form-field"><label>Tensión</label><input id="eq-tension" placeholder="220 V"></div>
      <div class="form-field"><label>Potencia</label><input id="eq-potencia" placeholder="3 KW"></div>
      <div class="form-field"><label>Frecuencia</label><input id="eq-frecuencia" placeholder="50/60 HZ"></div>
      <div class="form-field"><label>Tamaño</label><input id="eq-tamano" placeholder="1340x1340x1670mm"></div>
      <div class="form-field"><label>Peso</label><input id="eq-peso" placeholder="1 ton."></div>
      <div class="form-field"><label>Fase</label><input id="eq-fase" placeholder="MONO FASICO"></div>
      <div class="form-field"><label>Made in</label><input id="eq-madein"></div>
      <div class="form-field full"><label>Características</label><textarea id="eq-caracteristicas" placeholder="Capacidad, presión, refrigerante, centro de carga…"></textarea></div>
    </div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal('modalEquipo')">Cancelar</button>
      <button class="btn" onclick="saveEquipo()">Guardar equipo</button>
    </div>
  </div>
</div>
<!-- Modal: historial de reubicaciones (29 sep 2026) -->
<div class="modal-bg vtcat" id="modalReubicaciones">
  <div class="modal" style="max-width:700px;">
    <h3><span data-icon="compass"></span> Historial de reubicaciones</h3>
    <div class="modal-sub" id="reubHistSub"></div>
    <div style="overflow-x:auto;max-height:60vh;overflow-y:auto;">
      <table>
        <thead><tr><th>Fecha</th><th>Ubicación anterior</th><th>Ubicación nueva</th><th>Quién</th></tr></thead>
        <tbody id="reubHistBody"></tbody>
      </table>
    </div>
    <div class="modal-actions"><button class="btn secondary" onclick="closeModal('modalReubicaciones')">Cerrar</button></div>
  </div>
</div>
<!-- Modal: auditoría de cambios en datos maestros (29 sep 2026, solo Encargado/Admin) -->
<div class="modal-bg vtcat" id="modalAuditoria">
  <div class="modal" style="max-width:920px;">
    <h3><span data-icon="eye"></span> Auditoría de cambios</h3>
    <div class="modal-sub">Cambios en los datos maestros, del más reciente al más antiguo. <button type="button" class="vt-help" data-ayuda="Datos del equipo, frecuencia y puntos de checklist. Se muestran los últimos 200 registros." aria-label="Ayuda">?</button></div>
    <div style="overflow-x:auto;max-height:60vh;overflow-y:auto;">
      <table>
        <thead><tr><th>Fecha</th><th>Quién</th><th>Categoría</th><th>Equipo</th><th>Qué cambió</th></tr></thead>
        <tbody id="audHistBody"></tbody>
      </table>
    </div>
    <div class="modal-actions"><button class="btn secondary" onclick="closeModal('modalAuditoria')">Cerrar</button></div>
  </div>
</div>
<!-- Modal: carga masiva de equipos (pegar tabla) -->
<div class="modal-bg vtcat" id="modalBulkEquipos">
  <div class="modal" style="max-width:860px;">
    <h3><span data-icon="clipboard"></span> Carga masiva de equipos</h3>
    <div class="modal-sub">Sube el Excel o pega las filas. Verás una vista previa antes de guardar. <button type="button" class="vt-help" data-ayuda="Con encabezados en la primera fila, las columnas pueden ir en cualquier orden y también se cargan Planta, Línea, Tipo de máquina y la ficha técnica (tensión, potencia, frecuencia, fase, tamaño, peso, país y fechas)." aria-label="Ayuda">?</button></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
      <button type="button" class="btn sm" onclick="document.getElementById('bulkEquiposFile').click()"><span data-icon="folder"></span> Subir archivo Excel / CSV</button>
      <button type="button" class="btn secondary sm" onclick="descargarPlantillaEquipos()"><span data-icon="download"></span> Descargar plantilla</button>
      <input type="file" id="bulkEquiposFile" accept=".xlsx,.xls,.csv,.txt" style="display:none" onchange="leerArchivoEquipos(event)">
    </div>
    <div class="form-field full">
      <label>O pega aquí las filas (con o sin encabezados). Sin encabezados el orden es: Nombre* · Marca · Modelo · Serie · Área · Frecuencia de checklist (días)</label>
      <textarea id="bulkEquiposPasteArea" style="min-height:150px;font-family:var(--font-mono);font-size:11.5px;" placeholder="Nombre	Marca	Modelo	Serie	Área	Frecuencia&#10;COMPRESOR 2	INGERSOLL RAND	R11i	SN-4521	Compresor de Aire	7&#10;TELAR 10	STARLINGER	SL-6	A-8812	Weaving	"></textarea>
    </div>
    <label style="display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--muted);margin:8px 0;cursor:pointer;">
      <input type="checkbox" id="bulkEquiposSobrescribir" style="width:auto;" onchange="previsualizarEquipos()"> Si el equipo ya existe, reemplazar sus datos con los del archivo (si no se marca, solo se completan los datos vacíos)
    </label>
    <div id="bulkEquiposPreview"></div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal('modalBulkEquipos')">Cancelar</button>
      <button class="btn secondary" onclick="previsualizarEquipos()"><span data-icon="eye"></span> Ver vista previa</button>
      <button class="btn" id="bulkEquiposOk" onclick="bulkImportEquipos()" disabled>Cargar equipos</button>
    </div>
    <div id="bulkEquiposStatus" style="font-size:12px;margin-top:10px;color:var(--muted);"></div>
  </div>
</div>
<div class="modal-bg vtcat" id="modalFichas">
  <div class="modal" style="max-width:860px;">
    <h3><span data-icon="eraser"></span> Ordenar fichas técnicas</h3>
    <div class="modal-sub">Equipos con la ficha técnica escrita toda en "Modelo". Desmarca los que no quieras cambiar. <button type="button" class="vt-help" data-ayuda="Cada dato pasa a su campo (potencia, peso, tensión, fechas, país…) y lo demás queda en Características. Nunca se reemplaza un campo que ya tenía dato." aria-label="Ayuda">?</button></div>
    <div id="fichasBody" style="max-height:60vh;overflow:auto;"></div>
    <div class="modal-actions">
      <button class="btn secondary" onclick="closeModal('modalFichas')">Cancelar</button>
      <button class="btn" id="fichasOk" onclick="aplicarFichas()">Ordenar</button>
    </div>
  </div>
</div>`); };
  if (document.body) montar(); else document.addEventListener('DOMContentLoaded', montar);
})();

// Ayudas que antes estaban sueltas en inventario.html (mismas definiciones).
function normalizeKey(str){
  return (str||'').toString().trim().toLowerCase().replace(/\s+/g,' ');
}
const conTimeout = (prom, ms) => Promise.race([prom, new Promise(ok => setTimeout(() => ok('timeout'), ms))]);
const quienSoy = () => (window.currentUserRole && window.currentUserRole.nombre) || (window.currentUser && window.currentUser.email) || '—';
const miUid = () => (window.currentUser && window.currentUser.uid) || null;
const cmpNat = (a, b) => (a || '').toString().localeCompare((b || '').toString(), 'es', { numeric: true, sensitivity: 'base' });

// Después de guardar/borrar desde el catálogo: la copia del catálogo en el
// celular ya trae el cambio (Firestore la actualiza al instante) → se vuelve a
// entregar a la pantalla SIN leer del servidor (0 lecturas).
function catRefrescarLocal() { if (typeof fbRefrescarEquipos === 'function') setTimeout(() => fbRefrescarEquipos(true).catch(() => {}), 60); }

// quita valores `undefined` (Firestore los rechaza) reemplazándolos por null
function fbSanitize(obj){
  return JSON.parse(JSON.stringify(obj === undefined ? null : obj));
}

// Firestore no permite documentos de más de ~1MB. Como cada equipo guarda
// TODOS sus repuestos en un solo documento, un catálogo muy grande cargado de
// una vez a un mismo equipo se puede acercar a ese límite. Avisamos antes de
// que falle en seco.
function checkEquipoSize(e){
  const bytes = new Blob([JSON.stringify(e)]).size;
  const pct = bytes / (1024*1024);
  if(pct > 0.85){
    showToast(`"${e.nombre}" pesa ${(bytes/1024).toFixed(0)}KB — cerca del límite de 1MB de Firestore. Si vas a cargar más repuestos, considera dividirlos en otro equipo (ej: por módulo del catálogo) para no perder la carga.`, 'warn');
  }
  return bytes;
}
// (5 oct 2026) Guardado del equipo COMPLETO (datos + todos sus repuestos).
// Ya solo se usa para restaurar: "Importar respaldo" y "Deshacer" al borrar
// un equipo. Todo lo demás (movimientos, editar/agregar/borrar repuestos,
// fusionar, carga masiva, datos del equipo, manual) escribe SOLO el campo
// que cambia, y los repuestos van dentro de una transacción (txRepuestos).
function fbSaveEquipo(e){
  const { id, ...rest } = e;
  if(Array.isArray(rest.repuestos)) asegurarIdsRepuestos(rest.repuestos);
  checkEquipoSize(e);
  const localUpdatedAt = e.updatedAt; // snapshot ANTES de que este guardado cambie updatedAt
  db.collection('equipos').doc(id).set(fbSanitizeTs({ ...rest, updatedAt: fbTimestamp() }), { merge: true })
    .catch(err => { console.error('Error guardando equipo:', err); showToast('No se pudo sincronizar: '+err.message, 'warn'); });
  warnIfEquipoChangedSinceLoad(id, e.nombre, localUpdatedAt);
}

// (29 sep 2026) Cada guardado de un equipo sube el arreglo COMPLETO de
// repuestos (y todos sus demás campos), no solo lo que cambió -- así que
// si dos personas editan el MISMO equipo casi al mismo tiempo (una
// registrando una entrada de un repuesto, otra agregando uno distinto),
// el segundo guardado puede sobrescribir sin avisar el cambio del primero.
// (5 oct 2026) Ese problema ya se resolvió con txRepuestos() (abajo); este
// aviso queda solo para fbSaveEquipo (restaurar respaldo / deshacer).
// Nunca bloquea ni retrasa el guardado: es una lectura aparte, en
// paralelo, que se salta sola si no hay conexión o si algo falla.
async function warnIfEquipoChangedSinceLoad(equipoId, equipoNombre, localUpdatedAt){
  if (!navigator.onLine || !localUpdatedAt || typeof localUpdatedAt.toMillis !== 'function') return;
  try {
    const remoteSnap = await db.collection('equipos').doc(equipoId).get({ source: 'server' });
    if (!remoteSnap.exists) return;
    const remoteUpdatedAt = remoteSnap.data().updatedAt;
    if (remoteUpdatedAt && typeof remoteUpdatedAt.toMillis === 'function' && remoteUpdatedAt.toMillis() > localUpdatedAt.toMillis()) {
      showToast(`"${equipoNombre}" fue editado por otra persona justo antes de tu guardado — revisa el "Historial" o "Auditoría" de este equipo para confirmar que no se perdió nada.`, 'warn');
    }
  } catch (err) { console.error('No se pudo verificar si el equipo cambió mientras tanto:', err); }
}
function fbDeleteEquipoDoc(id){
  return db.collection('equipos').doc(id).delete();
}


const REP_ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
const repIdValido = id => typeof id === 'string' && REP_ID_RE.test(id);
function nuevoRepId(){
  const az = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  const rnd = (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(10)) : Array.from({length:10}, () => Math.floor(Math.random()*256));
  for (let i = 0; i < 10; i++) s += az[rnd[i] % az.length];
  return 'r' + s;
}
// Pone id a los repuestos que no tienen (o que traen uno inválido de un
// respaldo importado). Devuelve cuántos asignó.
function asegurarIdsRepuestos(lista){
  let n = 0;
  const vistos = new Set();
  (lista || []).forEach(p => {
    if (!p || typeof p !== 'object') return;
    if (!repIdValido(p.id) || vistos.has(p.id)) { p.id = nuevoRepId(); n++; }
    vistos.add(p.id);
  });
  return n;
}

/* ═══════════════ ÁREAS (Módulo 2 — Localidad ahora es un desplegable) ═══
   Misma colección /areas que usa Bitácora (firestore.rules: lectura
   esTecnicoOMas()). Aquí solo se lee — agregar un área nueva se hace desde
   Bitácora, no desde Inventario, para no duplicar ese flujo. */
const AREAS_INVENTARIO_FALLBACK = [
  'Almacén','Oficinas','Comedor','Baños','Área Común','Bombas','Estructura',
  'Compresor de Aire','Chiller','Ensamble de Válvulas','Coating','Weaving',
  'Tape-Line','Reciclaje','PE-Film','Agua Tratada','Transformadores',
  'Compactadoras','Techo','Extractores','Montacarga','Jardín','Extintores',
  'Taller','Área de Baterías','Iluminación','Paneles Eléctricos'
];
let currentAreasInventario = AREAS_INVENTARIO_FALLBACK.slice();

function renderEquipoLocalidadOptions(valorActual){
  const sel = document.getElementById('eq-localidad');
  if(!sel) return;
  // Si el equipo ya tenía un valor de Localidad de texto libre (ej. "PLANTA
  // 1", de antes de este cambio) que no está en la lista de Áreas, se agrega
  // igual como opción para no perder ni esconder ese dato ya guardado.
  // (25 oct 2026, Etapa 2) Sin las áreas inactivas ni las de naves que el usuario no tiene (la del equipo se conserva).
  const lista = currentAreasInventario.filter(a => fbNombreActivo('areas', a) && fbNavePermitida(fbPlantaDeArea(a)));
  if (valorActual && !lista.some(a => a.toLowerCase() === valorActual.toLowerCase())) lista.unshift(valorActual);
  sel.innerHTML = '<option value="">Seleccionar área...</option>'
    + lista.map(a => `<option value="${fbEsc(a)}"${a === valorActual ? ' selected' : ''}>${fbEsc(a)}</option>`).join(''); // (5 oct 2026) escapado
}

function loadAreasParaEquipos(){
  renderEquipoLocalidadOptions(document.getElementById('eq-localidad')?.value || '');
  window.fbReady.then(() => {
    db.collection('areas').orderBy('nombre').onSnapshot((snap) => {
      fbRegistrarNombres('areas', snap.docs); // (25 oct 2026) nombres anteriores / activas
      if (!snap.empty) {
        currentAreasInventario = snap.docs.map(d => d.data().nombre).filter(Boolean);
        // (7 oct 2026) planta de cada área (plantaNombre, como en Bitácora) para
        // proponer la Planta al elegir el Área en el formulario de equipo.
        plantaDeAreaInv = {};
        snap.docs.forEach(d => { const a = d.data(); if (a.nombre && a.plantaNombre) [a.nombre, ...(Array.isArray(a.nombresAnteriores) ? a.nombresAnteriores : [])].forEach(n => { const k = fbEquipoKey(n); if (!plantaDeAreaInv[k]) plantaDeAreaInv[k] = fbNombreActual('plantas', a.plantaNombre); }); });
        renderEquipoLocalidadOptions(document.getElementById('eq-localidad')?.value || '');
      }
    }, (err) => {
      console.warn('No se pudo leer /areas, usando lista local de respaldo:', err.message);
    });
  }).catch(() => {});
}

/* ═══════════════ PLANTA / LÍNEA / TIPO DE MÁQUINA (7 oct 2026) ═══════════════
   Campos que usa la cascada de Bitácora (Planta → Área → Línea → Tipo →
   Equipo): equipos.planta (= nombre en /plantas), equipos.linea (= nombre en
   /lineas, cuya areaNombre es la Localidad/Área del equipo) y
   equipos.tipoMaquina (texto libre). /plantas y /lineas se leen con get()
   UNA sola vez por sesión, al abrir el formulario o la carga masiva (plan
   gratis: lecturas acotadas). Sin señal, get() usa la copia del celular; si
   falla, se vuelve a intentar la próxima vez que se abra el formulario. */
let plantaDeAreaInv = {};          // fbEquipoKey(área) → plantaNombre (de /areas)
let plantasInv = null;             // ['PLANTA 1', …] o null si aún no se leyó
let lineasInv = null;              // [{nombre, areaNombre}] o null si aún no se leyó
let _catUbicPromesa = null;
function cargarCatalogoUbicacion(){
  if (_catUbicPromesa) return _catUbicPromesa;
  const leer = (col, map) => db.collection(col).orderBy('nombre').get()
    .then(snap => snap.docs.map(d => map(d.data())).filter(Boolean))
    .catch(err => { console.warn('No se pudo leer /' + col + ':', err.message); return null; });
  // solo se lee lo que aún no está en memoria (si una falló, se reintenta solo esa)
  _catUbicPromesa = window.fbReady.then(() => Promise.all([
    // (25 oct 2026, Etapa 2) se guardan también activo / nombres anteriores (fbRegistrarNombres)
    plantasInv ? plantasInv : leer('plantas', d => d.nombre ? d : null).then(l => { if (l) { fbRegistrarNombres('plantas', l); return l.map(d => d.nombre); } return l; }),
    lineasInv ? lineasInv : leer('lineas', d => d.nombre ? d : null).then(l => { if (l) { fbRegistrarNombres('lineas', l); return l.map(d => ({ nombre: d.nombre, areaNombre: d.areaNombre || '', activo: d.activo !== false })); } return l; }),
  ])).then(([pl, li]) => {
    if (pl) plantasInv = pl;
    if (li) lineasInv = li;
    if (!pl || !li) _catUbicPromesa = null;
  }).catch(() => { _catUbicPromesa = null; });
  return _catUbicPromesa;
}
// Opciones de un <select>: la lista + el valor actual aunque no esté en ella
// (para no perder ni esconder un dato ya guardado).
function opcionesSelect(sel, lista, valorActual, vacio){
  if(!sel) return;
  const items = lista.slice();
  // Mismo nombre con otra escritura ("Linea A" vs "LINEA A"): se muestra el
  // valor guardado tal cual, en lugar del de la lista (así no cuenta como cambio).
  const i = valorActual ? items.findIndex(x => fbEquipoKey(x.v ?? x) === fbEquipoKey(valorActual)) : -1;
  if (i >= 0) items[i] = valorActual;
  else if (valorActual) items.unshift(valorActual);
  sel.innerHTML = `<option value="">${fbEsc(vacio)}</option>` + items.map(x => {
    const v = x.v ?? x, t = x.t ?? x;
    return `<option value="${fbEsc(v)}"${v === valorActual ? ' selected' : ''}>${fbEsc(t)}</option>`;
  }).join('');
  sel.value = valorActual || '';
}
function renderEquipoPlantaOptions(valorActual){
  // /plantas + las que ya tienen los equipos; el mismo nombre con otra escritura se muestra una sola vez
  // (25 oct 2026, Etapa 2) Un nombre viejo de una nave renombrada cuenta como la misma
  // nave; sin naves inactivas ni las que el usuario no tiene (la del equipo se conserva).
  const lista = [];
  [...(plantasInv || []), ...DB.map(e => e.planta).filter(Boolean).map(p => fbNombreActual('plantas', p))].forEach(p => { if (!lista.some(q => fbMismoNombre('plantas', q, p))) lista.push(p); });
  const usable = lista.filter(p => fbNombreActivo('plantas', p) && fbNavePermitida(p));
  opcionesSelect(document.getElementById('eq-planta'), usable.sort(cmpNat), valorActual, 'Sin planta');
}
// Líneas del Área elegida (sin importar mayúsculas/acentos, como Bitácora).
// Sin Área elegida se muestran todas, con su área al lado.
function lineasParaAreaInv(area){
  const todas = lineasInv || [];
  if (!area) return todas.filter(l => l.activo !== false).map(l => ({ v: l.nombre, t: l.areaNombre ? `${l.nombre} — ${l.areaNombre}` : l.nombre }));
  // (25 oct 2026, Etapa 2) sin líneas inactivas; área renombrada = misma área
  return [...new Set(todas.filter(l => l.activo !== false && fbMismoNombre('areas', l.areaNombre, area)).map(l => l.nombre))];
}
function renderEquipoLineaOptions(valorActual){
  const area = document.getElementById('eq-localidad')?.value || '';
  opcionesSelect(document.getElementById('eq-linea'), lineasParaAreaInv(area), valorActual, 'Sin línea');
  avisarLineaArea();
}
function renderTiposMaquinaDatalist(){
  const dl = document.getElementById('eq-tipo-list'); if (!dl) return;
  const vistos = new Map();
  DB.forEach(e => { const t = (e.tipoMaquina || '').trim(); if (t && !vistos.has(fbEquipoKey(t))) vistos.set(fbEquipoKey(t), t); });
  dl.innerHTML = [...vistos.values()].sort(cmpNat).map(t => `<option value="${fbEsc(t)}"></option>`).join('');
}
// Aviso (no bloquea): la Línea elegida pertenece a otra Área.
function avisarLineaArea(){
  const box = document.getElementById('eq-linea-aviso'); if (!box) return;
  const linea = document.getElementById('eq-linea')?.value || '';
  const area = document.getElementById('eq-localidad')?.value || '';
  let msg = '';
  if (linea && lineasInv) {
    const regs = lineasInv.filter(l => fbEquipoKey(l.nombre) === fbEquipoKey(linea));
    if (!regs.length) msg = `La línea "${linea}" no está registrada en Líneas.`;
    else if (area && !regs.some(l => fbEquipoKey(l.areaNombre) === fbEquipoKey(area))) {
      const otras = [...new Set(regs.map(l => l.areaNombre).filter(Boolean))].join(', ');
      msg = `La línea "${linea}" pertenece ${otras ? 'al área "' + otras + '"' : 'a otra área'}, no a "${area}". Puedes guardar igual.`;
    }
  }
  box.textContent = msg;
  box.style.display = msg ? '' : 'none';
}
function onEqAreaChange(){
  const area = document.getElementById('eq-localidad').value;
  // Si el área tiene planta asignada y aún no se eligió planta, se propone.
  const selP = document.getElementById('eq-planta');
  const pl = plantaDeAreaInv[fbEquipoKey(area)];
  if (selP && !selP.value && pl) renderEquipoPlantaOptions(pl);
  renderEquipoLineaOptions(document.getElementById('eq-linea').value);
}
// Llena Planta/Línea/Tipo del formulario y, cuando llega el catálogo, los repinta
// conservando lo que el usuario ya haya elegido.
function prepararUbicacionForm(planta, linea, tipo){
  renderEquipoPlantaOptions(planta || '');
  renderEquipoLineaOptions(linea || '');
  document.getElementById('eq-tipo').value = tipo || '';
  renderTiposMaquinaDatalist();
  cargarCatalogoUbicacion().then(() => {
    renderEquipoPlantaOptions(document.getElementById('eq-planta').value);
    renderEquipoLineaOptions(document.getElementById('eq-linea').value);
  });
}

/* ═══════════════ MODALES ═══════════════ */
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

let editingEquipoId = null;
const EQ_FIELD_IDS = ['eq-nombre','eq-marca','eq-modelo','eq-serie','eq-localidad','eq-fabricacion','eq-instalacion','eq-compra','eq-garantia','eq-tension','eq-potencia','eq-frecuencia','eq-tamano','eq-peso','eq-fase','eq-madein','eq-caracteristicas'];

function openNewEquipoModal(){
  editingEquipoId = null;
  document.getElementById('equipoModalTitle').textContent = 'Nuevo equipo / máquina';
  EQ_FIELD_IDS.forEach(id=>document.getElementById(id).value='');
  renderEquipoLocalidadOptions('');
  prepararUbicacionForm('', '', '');
  openModal('modalEquipo');
}
function openEditEquipoModal(){
  const e = getCurrentEquipo();
  editingEquipoId = e.id;
  document.getElementById('equipoModalTitle').textContent = 'Editar datos del equipo';
  document.getElementById('eq-nombre').value = e.nombre||'';
  document.getElementById('eq-marca').value = e.marca||'';
  document.getElementById('eq-modelo').value = e.modelo||'';
  document.getElementById('eq-serie').value = e.serie||'';
  renderEquipoLocalidadOptions(e.localidad||'');
  document.getElementById('eq-fabricacion').value = e.fabricacion||'';
  document.getElementById('eq-instalacion').value = e.instalacion||'';
  document.getElementById('eq-compra').value = e.fechaCompra||'';
  document.getElementById('eq-garantia').value = e.garantiaHasta||'';
  document.getElementById('eq-tension').value = e.tension||'';
  document.getElementById('eq-potencia').value = e.potencia||'';
  document.getElementById('eq-frecuencia').value = e.frecuencia||'';
  document.getElementById('eq-tamano').value = e.tamano||'';
  document.getElementById('eq-peso').value = e.peso||'';
  document.getElementById('eq-fase').value = e.fase||'';
  document.getElementById('eq-madein').value = e.madein||'';
  document.getElementById('eq-caracteristicas').value = e.caracteristicas||'';
  prepararUbicacionForm(e.planta||'', e.linea||'', e.tipoMaquina||'');
  openModal('modalEquipo');
}

async function saveEquipo(){
  const nombre = document.getElementById('eq-nombre').value.trim();
  if(!nombre){ showToast('El nombre es obligatorio', 'warn'); return; }
  const dupe = DB.find(e2=>normalizeKey(e2.nombre)===normalizeKey(nombre) && e2.id!==editingEquipoId);
  if(dupe){ showToast('Ya existe otro equipo con ese nombre', 'warn'); return; }

  const datos = {
    nombre,
    marca: document.getElementById('eq-marca').value.trim(),
    modelo: document.getElementById('eq-modelo').value.trim(),
    serie: document.getElementById('eq-serie').value.trim(),
    localidad: document.getElementById('eq-localidad').value.trim(),
    planta: document.getElementById('eq-planta').value.trim(),       // (7 oct 2026)
    linea: document.getElementById('eq-linea').value.trim(),         // (7 oct 2026)
    tipoMaquina: document.getElementById('eq-tipo').value.trim(),    // (7 oct 2026)
    fabricacion: document.getElementById('eq-fabricacion').value,
    instalacion: document.getElementById('eq-instalacion').value,
    fechaCompra: document.getElementById('eq-compra').value,
    garantiaHasta: document.getElementById('eq-garantia').value,
    tension: document.getElementById('eq-tension').value.trim(),
    potencia: document.getElementById('eq-potencia').value.trim(),
    frecuencia: document.getElementById('eq-frecuencia').value.trim(),
    tamano: document.getElementById('eq-tamano').value.trim(),
    peso: document.getElementById('eq-peso').value.trim(),
    fase: document.getElementById('eq-fase').value.trim(),
    madein: document.getElementById('eq-madein').value.trim(),
    caracteristicas: document.getElementById('eq-caracteristicas').value.trim(),
  };

  // Etiquetas legibles para la auditoría — mismas claves que `datos` arriba.
  const EQ_FIELD_LABELS = { nombre:'Nombre', marca:'Marca', modelo:'Modelo', serie:'Serie', localidad:'Localidad', planta:'Planta', linea:'Línea', tipoMaquina:'Tipo de máquina', fabricacion:'Fecha fabricación', instalacion:'Fecha instalación', fechaCompra:'Fecha de compra', garantiaHasta:'Garantía hasta', tension:'Tensión', potencia:'Potencia', frecuencia:'Frecuencia', tamano:'Tamaño', peso:'Peso', fase:'Fase', madein:'Made in', caracteristicas:'Características' };

  if(editingEquipoId){
    const e = DB.find(x=>x.id===editingEquipoId);
    // Reubicación (29 sep 2026): si cambió la Localidad, se guarda como un
    // renglón aparte ANTES de sobrescribir — ver logReubicacion() arriba.
    if((e.localidad||'') !== (datos.localidad||'')){
      logReubicacion(e, e.localidad, datos.localidad);
    }
    // Auditoría (29 sep 2026): se compara cada campo del formulario contra
    // su valor anterior y solo se registran los que de verdad cambiaron.
    const cambios = [];
    Object.keys(datos).forEach(k=>{
      const antes = e[k] || '';
      const despues = datos[k] || '';
      if(antes !== despues) cambios.push({ campo: EQ_FIELD_LABELS[k]||k, anterior: antes, nuevo: despues });
    });
    if(!cambios.length){ closeModal('modalEquipo'); showToast('Sin cambios'); return; }
    logAuditoria('especificaciones_equipo', e.id, e.nombre, cambios);
    // (5 oct 2026) Antes se subía el equipo COMPLETO (set merge con sus
    // repuestos, checklist y horómetro tal como estaban en este celular):
    // podía pisar un movimiento de stock o un checklist hecho en otro celular
    // mientras el formulario estaba abierto. Ahora solo se actualizan los
    // campos de este formulario. Sin await: sin señal queda en cola y sube solo.
    db.collection('equipos').doc(e.id).update({ ...fbSanitize(datos), updatedAt: fbTimestamp() })
      .catch(err => { console.error('Error guardando equipo:', err); showToast(err.code === 'permission-denied' ? 'Tu usuario no tiene permiso para editar equipos.' : 'No se pudo guardar el equipo: ' + err.message); });
    Object.assign(e, datos);
    // Mantiene al día la copia pública del QR (solo la ficha; el historial no se toca).
    publicarHojaVida({ ...e, id: e.id });
    closeModal('modalEquipo');
    renderDetail();
    showToast('Datos del equipo guardados', 'success');
    catRefrescarLocal();
    return;
  }

  await window.fbReady;
  const ref = db.collection('equipos').doc(); // id generado localmente, sin esperar al servidor
  const nuevo = { id: ref.id, ...datos, repuestos: [] };
  // (5 oct 2026) documento nuevo: se crea directo (sin await, funciona sin señal)
  ref.set(fbSanitizeTs({ ...datos, repuestos: [], updatedAt: fbTimestamp() }))
    .catch(err => { console.error('Error creando equipo:', err); showToast(err.code === 'permission-denied' ? 'Tu usuario no tiene permiso para crear equipos.' : 'No se pudo crear el equipo: ' + err.message); });
  publicarHojaVida({ ...datos, id: ref.id });
  // Reubicación: un equipo nuevo con Localidad ya asignada cuenta como su
  // "instalación inicial" en el historial (arranca desde "sin ubicación").
  if(datos.localidad){
    logReubicacion(nuevo, '', datos.localidad);
  }
  DB.push(nuevo);
  closeModal('modalEquipo');
  EQ_FIELD_IDS.forEach(id=>document.getElementById(id).value='');
  ['eq-planta','eq-linea','eq-tipo'].forEach(id=>document.getElementById(id).value='');
  renderHome();
  showToast('Equipo agregado', 'success');
  catRefrescarLocal();
}

/* ═══════════════ MANUAL DE PARTES (PDF por equipo) ═══════════════ */
function handleManualUpload(ev){
  const file = ev.target.files[0];
  if(!file) return;
  if(file.type !== 'application/pdf'){ showToast('Solo se aceptan archivos PDF', 'warn'); ev.target.value=''; return; }
  const sizeMB = file.size / 1024 / 1024;
  // (5 oct 2026) tope de 20 MB: un PDF más grande se leía entero en memoria
  // (como texto base64) y colgaba los celulares baratos.
  if(sizeMB > 20){ showToast(`Este PDF pesa ${sizeMB.toFixed(1)} MB — el máximo es 20 MB. Comprímelo o súbelo por partes.`, 'warn'); ev.target.value=''; return; }
  if(!navigator.onLine){ showToast('Para subir el manual se necesita conexión.', 'warn'); ev.target.value=''; return; }
  const reader = new FileReader();
  reader.onload = async (e)=>{
    const eq = getCurrentEquipo();
    if(!eq){ return; }
    const prevUrl = eq.manualUrl;
    showLoading('Subiendo manual…');
    try{
      // nombre de archivo sin caracteres raros para la ruta de Storage
      const nombreSeguro = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'_').slice(-80);
      const url = await fbUploadDataUrl(e.target.result, `manuales/${eq.id}/${Date.now()}-${nombreSeguro}`);
      // (5 oct 2026) solo los dos campos del manual, no el equipo completo
      await conTimeout(db.collection('equipos').doc(eq.id).update({ manualUrl: url, manualNombre: file.name, updatedAt: fbTimestamp() }), 8000);
      eq.manualUrl = url;
      eq.manualNombre = file.name;
      if(prevUrl && prevUrl !== url) fbDeleteFile(prevUrl);
      showToast('Manual subido', 'success');
    }catch(err){
      console.error('Error subiendo manual:', err);
      showToast('No se pudo subir el manual: '+(err.code === 'storage/unauthorized' || err.code === 'permission-denied' ? 'sin permiso.' : err.message), 'error');
    }
    hideLoading();
    renderDetail(); catRefrescarLocal();
  };
  reader.readAsDataURL(file);
  ev.target.value = '';
}
// (5 oct 2026) Manual por ENLACE en vez de subir el PDF: subir archivos
// (Storage) exige el plan de pago de Firebase. El PDF se sube gratis a
// Google Drive (o cualquier sitio) y aquí se pega su enlace para compartir.
async function enlazarManual(){
  const eq = getCurrentEquipo();
  if(!eq) return;
  const url = (prompt('Pega el enlace del manual (PDF en Google Drive con acceso "Cualquier persona con el enlace"):', eq.manualUrl || '') || '').trim();
  if(!url) return;
  if(!/^https:\/\/[^\s"'<>]+$/i.test(url)){ showToast('El enlace debe empezar con https://', 'warn'); return; }
  const nombre = (prompt('Nombre del manual (ej. "Manual de partes"):', eq.manualNombre || 'Manual de partes') || 'Manual').trim().slice(0, 80);
  try{
    const r = await conTimeout(db.collection('equipos').doc(eq.id).update({ manualUrl: url, manualNombre: nombre, updatedAt: fbTimestamp() }), 8000);
    if(r === 'timeout') showToast('Guardado en el celular; se subirá cuando haya señal', 'success');
    else showToast('Manual enlazado', 'success');
  }catch(err){ showToast('No se pudo guardar el enlace: ' + err.message, 'error'); return; }
  eq.manualUrl = url; eq.manualNombre = nombre;
  renderDetail(); catRefrescarLocal();
}
function viewManual(){
  const eq = getCurrentEquipo();
  if(!eq.manualUrl) return;
  if(!/^https:\/\//i.test(eq.manualUrl)) return;
  window.open(eq.manualUrl, '_blank', 'noopener');
}
// (v3 etapa 3b) Reversible: se quita ya y el aviso ofrece "Deshacer". El archivo (si estaba en
// Storage) se borra solo cuando el aviso se cierra sin deshacer. Sin vtDeshacer, se pregunta como antes.
function removeManual(){
  if(!window.vtDeshacer && !confirm('¿Quitar el manual de este equipo?')) return;
  const eq = getCurrentEquipo();
  const url = eq.manualUrl, nombre = eq.manualNombre || null, id = eq.id;
  let deshecho = false;
  // (5 oct 2026) solo los campos del manual; el archivo se borra después de guardar
  const p = db.collection('equipos').doc(id).update({ manualUrl: null, manualNombre: null, updatedAt: fbTimestamp() })
    .catch(err => { showToast('No se pudo quitar el manual: ' + err.message, 'warn'); throw err; });
  eq.manualUrl = null; eq.manualNombre = null;
  renderDetail(); catRefrescarLocal();
  const borrarArchivo = () => { if (!deshecho) p.then(() => fbDeleteFile(url)).catch(() => {}); };
  if (window.vtDeshacer) {
    vtDeshacer('Manual quitado', () => {
      deshecho = true;
      const e1 = (typeof getCurrentEquipo === 'function' && getCurrentEquipo()) || {};
      if (e1.id === id) { e1.manualUrl = url; e1.manualNombre = nombre; }
      db.collection('equipos').doc(id).update({ manualUrl: url, manualNombre: nombre, updatedAt: fbTimestamp() })
        .catch(err => showToast('No se pudo guardar el enlace: ' + err.message, 'warn'));
      renderDetail(); catRefrescarLocal();
    }, { alCerrar: borrarArchivo });
  } else { borrarArchivo(); showToast('Manual eliminado', 'success'); }
}


// ═══════════════ REUBICACIÓN DE EQUIPO ENTRE ÁREAS (29 sep 2026) ═══════════════
// Antes, cambiar la "Localidad" de un equipo en "✏️ Editar datos" simplemente
// sobrescribía el valor — no quedaba ningún rastro de que el equipo estuvo
// antes en otra área, cuándo se movió, ni quién lo hizo (comparación con
// Maximo/SAP, sección 12.3 #7: esos sistemas guardan cada instalación/
// reubicación/desmontaje, no solo la ubicación actual). Se guarda cada
// cambio en su propia colección compartida ("reubicaciones"), mismo patrón
// que "movimientos" arriba — nunca se borra ni se sobrescribe, solo se
// agrega un renglón nuevo por cambio. Ver saveEquipo() para dónde se llama.
function logReubicacion(equipo, ubicacionAnterior, ubicacionNueva){
  const plantaR = fbPlantaDeEquipo(equipo); // (25 oct 2026, Etapa 2)
  db.collection('reubicaciones').add({
    equipoId: equipo.id,
    equipo: equipo.nombre,
    ...(plantaR ? { planta: plantaR } : {}),
    ubicacionAnterior: ubicacionAnterior || '(sin ubicación)',
    ubicacionNueva: ubicacionNueva || '(sin ubicación)',
    quien: quienSoy(),
    quienUid: miUid(), // (5 oct 2026) uid de quien lo hizo, para las reglas
    fecha: fbTimestamp(),
  }).catch(err => {
    console.error('Error guardando reubicación:', err);
    showToast('La ubicación se actualizó, pero no se pudo guardar el historial de reubicación: ' + err.message, 'warn'); // (29 sep 2026)
  });
}

async function showReubicaciones(){
  const e = getCurrentEquipo();
  document.getElementById('reubHistSub').textContent = `Cargando historial de "${e.nombre}"…`;
  document.getElementById('reubHistBody').innerHTML = '';
  openModal('modalReubicaciones');
  await window.fbReady;
  let log = [];
  try{
    const snap = await db.collection('reubicaciones').where('equipoId','==', e.id).limit(200).get();
    log = snap.docs.map(d=>d.data());
    log.sort((a,b)=> (b.fecha?.toMillis?.()||0) - (a.fecha?.toMillis?.()||0));
  }catch(err){ showToast('No se pudo cargar el historial: '+err.message, 'warn'); }
  document.getElementById('reubHistSub').textContent = log.length
    ? `${log.length} cambio(s) de ubicación registrados para "${e.nombre}".`
    : `"${e.nombre}" no ha cambiado de ubicación desde que se activó este registro (29 sep 2026) — los cambios de antes de esa fecha no quedaron guardados.`;
  document.getElementById('reubHistBody').innerHTML = log.length ? log.map(m=>`
    <tr>
      <td class="mono" style="white-space:nowrap;">${m.fecha?.toDate ? m.fecha.toDate().toLocaleString('es-DO') : '—'}</td>
      <td>${fbEsc(m.ubicacionAnterior)}</td>
      <td>${fbEsc(m.ubicacionNueva)}</td>
      <td>${fbEsc(m.quien)}</td>
    </tr>`).join('') : `<tr><td colspan="4"><div class="empty-state"><div class="big"><span data-icon="inbox"></span></div>Sin reubicaciones registradas todavía.</div></td></tr>`;
}

// ═══════════════ AUDITORÍA DE CAMBIOS EN DATOS MAESTROS (29 sep 2026) ═══════════════
// Comparación con Maximo/SAP, sección 12.3 #9: hoy editar los datos de un
// equipo (o su frecuencia/puntos de checklist, en checklist.html) sobrescribe
// el documento sin dejar ningún rastro de quién lo cambió ni qué tenía antes.
// Se guarda un renglón por cada edición REAL (solo los campos que de verdad
// cambiaron, nunca la lista completa, para no generar ruido) en la colección
// compartida "auditoria" — de solo-creación por firestore.rules (nunca se
// puede editar ni borrar un renglón ya escrito, para que el rastro sea
// confiable). checklist.html escribe aquí también, para las otras dos
// categorías (frecuencia y puntos de checklist) — por eso el visor de abajo
// vive en Inventario pero muestra las tres.
function logAuditoria(categoria, equipoId, equipoNombre, cambios){
  if(!cambios || !cambios.length) return; // nada cambió de verdad -- no generar ruido
  db.collection('auditoria').add({
    categoria, equipoId: equipoId||null, equipoNombre: equipoNombre||null, cambios: fbSanitize(cambios),
    quien: quienSoy(),
    // (5 oct 2026) firestore.rules exige quienUid == uid de la sesión y
    // fecha == hora del servidor (fbTimestamp()).
    quienUid: miUid(),
    fecha: fbTimestamp(),
  }).catch(err => {
    console.error('Error guardando auditoría:', err);
    showToast('El cambio se guardó, pero no se pudo registrar en la auditoría: ' + err.message, 'warn'); // (29 sep 2026)
  });
}

const AUDITORIA_CATEGORIA_LABEL = {
  especificaciones_equipo: 'Datos del equipo',
  frecuencia_checklist: 'Frecuencia de checklist',
  puntos_checklist_general: 'Puntos de checklist (lista general)',
  puntos_checklist_equipo: 'Puntos de checklist (propios del equipo)',
};

// valor de auditoría legible (los puntos de checklist pueden venir como lista/objeto)
const fmtAud = v => (v==null || v==='') ? '—' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
async function openAuditoria(){
  document.getElementById('audHistBody').innerHTML = '';
  openModal('modalAuditoria');
  await window.fbReady;
  let log = [];
  try{
    const snap = await db.collection('auditoria').orderBy('fecha','desc').limit(200).get();
    log = snap.docs.map(d=>d.data());
  }catch(err){
    document.getElementById('audHistBody').innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="big"><span data-icon="lock"></span></div>No se pudo cargar — esto es solo para Encargado/Administrador. (${fbEsc(err.message)})</div></td></tr>`;
    return;
  }
  document.getElementById('audHistBody').innerHTML = log.length ? log.map(m=>`
    <tr>
      <td class="mono" style="white-space:nowrap;">${m.fecha?.toDate ? m.fecha.toDate().toLocaleString('es-DO') : '—'}</td>
      <td>${fbEsc(m.quien)}</td>
      <td>${AUDITORIA_CATEGORIA_LABEL[m.categoria]||fbEsc(m.categoria)}</td>
      <td>${fbEsc(m.equipoNombre||'—')}</td>
      <td>${(Array.isArray(m.cambios)?m.cambios:[]).map(c=>`<div style="margin-bottom:2px;"><b>${fbEsc(c.campo)}</b>: <span style="color:var(--muted);">${fbEsc(fmtAud(c.anterior))}</span> → ${fbEsc(fmtAud(c.nuevo))}</div>`).join('')}</td>
    </tr>`).join('') : `<tr><td colspan="5"><div class="empty-state"><div class="big"><span data-icon="inbox"></span></div>Sin cambios registrados todavía.</div></td></tr>`;
}


/* ═══════════════ CARGA MASIVA DE EQUIPOS ═══════════════
   Mismo patrón de "pegar tabla" que la carga masiva de repuestos, pero para
   dar de alta o completar varios equipos de una sola vez (pedido del
   usuario: "cómo puedo seguir entrando equipos"). Si el nombre ya existe,
   SOLO se completan los campos que el equipo tenía vacíos — nunca se
   sobrescribe un dato que ya estaba cargado a mano. La frecuencia de
   checklist es opcional y, si viene, también deja el equipo listo para
   aparecer en "Hoy te toca" dentro de checklist.html. */
function addDaysStrInv(baseStr, dias){
  const base = baseStr ? new Date(baseStr + 'T00:00:00') : new Date();
  base.setDate(base.getDate() + Number(dias || 0));
  return base.getFullYear() + '-' + String(base.getMonth() + 1).padStart(2, '0') + '-' + String(base.getDate()).padStart(2, '0');
}

/* ═══════════════ CARGA MASIVA DE EQUIPOS (rehecha 4 oct 2026) ═══════════════
   - Acepta pegar desde Excel (tabulaciones), CSV con ; o , y archivos .xlsx/.csv.
   - Reconoce encabezados en cualquier orden; sin encabezados usa el orden fijo.
   - Con encabezados también llena la ficha técnica: tensión, potencia,
     frecuencia eléctrica, fase, tamaño, peso, made in y las fechas.
   - Respeta celdas entre comillas (Excel las usa cuando hay saltos de línea).
   - Vista previa fila por fila antes de guardar; une filas repetidas.
   - Guarda en lotes de 400 (Firestore admite hasta 500 escrituras por lote). */
let bulkEquiposFilas = [];   // filas ya interpretadas, listas para guardar
const COLS_EQUIPO = [
  { k: 'nombre',        l: 'Nombre',            alias: ['nombre','equipo','maquina','nombre del equipo','nombre equipo','descripcion'] },
  { k: 'marca',         l: 'Marca',             alias: ['marca','fabricante'] },
  { k: 'modelo',        l: 'Modelo',            alias: ['modelo'] },
  { k: 'serie',         l: 'Serie',             alias: ['serie','serial','numero de serie','n° serie','no. serie','no serie','s/n','sn'] },
  { k: 'localidad',     l: 'Área',              alias: ['area','localidad','ubicacion','zona','departamento'] }, // (7 oct 2026) 'linea' pasó a su propia columna
  // (7 oct 2026) mismos campos que la cascada de Bitácora
  { k: 'planta',        l: 'Planta',            alias: ['planta','plant'] },
  { k: 'linea',         l: 'Línea',             alias: ['linea','line','linea de produccion'] },
  { k: 'tipoMaquina',   l: 'Tipo de máquina',   alias: ['tipo de maquina','tipo maquina','tipo de equipo','tipo equipo','tipo'] },
  { k: 'dias',          l: 'Frec. checklist',   alias: ['frecuencia checklist','frecuencia de checklist','frecuencia checklist (dias)','frecuencia (dias)','dias','checklist','cada cuantos dias'] },
  { k: 'frecuencia',    l: 'Frec. eléctrica',   alias: ['frecuencia electrica','hz','frecuencia (hz)','frecuencia hz'] },
  { k: 'tension',       l: 'Tensión',           alias: ['tension','voltaje','voltage','tension (v)','voltaje (v)','v'] },
  { k: 'potencia',      l: 'Potencia',          alias: ['potencia','kw','hp','potencia (kw)','potencia (hp)'] },
  { k: 'fase',          l: 'Fase',              alias: ['fase','fases'] },
  { k: 'tamano',        l: 'Tamaño',            alias: ['tamano','dimensiones','medidas','dimension'] },
  { k: 'peso',          l: 'Peso',              alias: ['peso','peso (kg)'] },
  { k: 'madein',        l: 'Made in',           alias: ['made in','origen','pais','pais de origen','procedencia','fabricado en'] },
  { k: 'fabricacion',   l: 'Fabricación',       alias: ['fecha fabricacion','fecha de fabricacion','fabricacion','ano fabricacion','año fabricacion','ano de fabricacion','año de fabricacion'], fecha: true },
  { k: 'instalacion',   l: 'Instalación',       alias: ['fecha instalacion','fecha de instalacion','instalacion'], fecha: true },
  { k: 'fechaCompra',   l: 'Compra',            alias: ['fecha compra','fecha de compra','compra'], fecha: true },
  { k: 'caracteristicas', l: 'Características',  alias: ['caracteristicas','especificaciones','ficha tecnica','descripcion tecnica','detalles','descripcion'] },
  { k: 'garantiaHasta', l: 'Garantía hasta',    alias: ['garantia','garantia hasta','vence garantia','fin de garantia','vencimiento garantia'], fecha: true },
];
const CAMPOS_FICHA = COLS_EQUIPO.map(c => c.k).filter(k => k !== 'nombre' && k !== 'dias');
const LBL_EQ = Object.fromEntries(COLS_EQUIPO.map(c => [c.k, c.l]));
const sinAcentos = s => (s||'').toString().normalize('NFD').replace(/[̀-ͯ]/g,'').trim().toLowerCase().replace(/\s+/g,' ');

function openBulkEquiposModal(){
  document.getElementById('bulkEquiposPasteArea').value = '';
  document.getElementById('bulkEquiposStatus').textContent = '';
  document.getElementById('bulkEquiposPreview').innerHTML = '';
  document.getElementById('bulkEquiposOk').disabled = true;
  bulkEquiposFilas = [];
  openModal('modalBulkEquipos');
  // (7 oct 2026) /plantas y /lineas (una vez por sesión) para reconocer Planta y Línea;
  // si ya hay una vista previa en pantalla cuando llegan, se recalcula.
  cargarCatalogoUbicacion().then(() => { if (document.getElementById('bulkEquiposPreview').innerHTML) previsualizarEquipos(); });
}

// Separa texto en filas/celdas respetando comillas. Detecta el separador.
function parseTabla(texto){
  texto = (texto||'').replace(/\r\n?/g,'\n');
  const primera = texto.split('\n').find(l => l.trim()) || '';
  const sep = primera.includes('\t') ? '\t' : (primera.includes(';') ? ';' : (primera.includes(',') ? ',' : '\t'));
  const filas = []; let fila = [], celda = '', comillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (comillas) {
      if (ch === '"' && texto[i+1] === '"') { celda += '"'; i++; }
      else if (ch === '"') comillas = false;
      else celda += ch;
    } else if (ch === '"' && celda === '') comillas = true;
    else if (ch === sep) { fila.push(celda); celda = ''; }
    else if (ch === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; }
    else celda += ch;
  }
  fila.push(celda); filas.push(fila);
  return filas.map(f => f.map(c => c.replace(/\s+/g,' ').trim())).filter(f => f.some(c => c));
}

// Fecha escrita de cualquier forma → AAAA-MM-DD (lo que usan los campos de fecha).
// Acepta 2022-06-15, 15/06/2022, 15-06-22, 2022-06 (→ día 1), 2022 (→ 1 de enero)
// y el número de serie de fecha de Excel (ej. 44713). Día primero, como en
// Latinoamérica. Devuelve { v, aviso } o { error }.
function normalizarFecha(txt){
  const s = (txt || '').trim();
  if (!s) return { v: '' };
  const p2 = n => String(n).padStart(2, '0');
  const ok = (y, m, d) => { const f = new Date(y, m - 1, d); return f.getFullYear() === y && f.getMonth() === m - 1 && f.getDate() === d; };
  let m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s)) && ok(+m[1], +m[2], +m[3])) return { v: `${m[1]}-${p2(m[2])}-${p2(m[3])}` };
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s))) {
    let y = +m[3]; if (y < 100) y += 2000;
    if (ok(y, +m[2], +m[1])) return { v: `${y}-${p2(m[2])}-${p2(m[1])}` };
  }
  if ((m = /^(\d{4})[-/.](\d{1,2})$/.exec(s)) && +m[2] >= 1 && +m[2] <= 12) return { v: `${m[1]}-${p2(m[2])}-01`, aviso: 'sin día: se usó el día 1' };
  if ((m = /^(\d{1,2})[-/.](\d{4})$/.exec(s)) && +m[1] >= 1 && +m[1] <= 12) return { v: `${m[2]}-${p2(m[1])}-01`, aviso: 'sin día: se usó el día 1' };
  if (/^(19|20)\d{2}$/.test(s)) return { v: `${s}-01-01`, aviso: 'solo año: se usó el 1 de enero' };
  if (/^\d{5}$/.test(s) && +s > 20000 && +s < 60000) { const f = new Date(Date.UTC(1899, 11, 30) + (+s) * 86400000); return { v: `${f.getUTCFullYear()}-${p2(f.getUTCMonth() + 1)}-${p2(f.getUTCDate())}` }; }
  return { error: true };
}

// Convierte la tabla en filas {nombre, marca, ...} según encabezados o el orden fijo.
function interpretarEquipos(tabla){
  if (!tabla.length) return { filas: [], conEncabezado: false, columnas: [] };
  const head = tabla[0].map(sinAcentos);
  const mapa = {};
  COLS_EQUIPO.forEach(col => {
    // se prueba cada alias en orden de prioridad (ej. "Nombre" antes que "Descripción")
    for (const a of col.alias.map(sinAcentos)) {
      const i = head.findIndex((h, j) => h === a && !Object.values(mapa).includes(j));
      if (i >= 0) { mapa[col.k] = i; break; }
    }
  });
  // "Frecuencia" a secas puede ser la del checklist (días) o la eléctrica (50/60 Hz):
  // se decide por lo que traen las celdas.
  const iFrec = head.findIndex(h => h === 'frecuencia');
  if (iFrec >= 0 && !Object.values(mapa).includes(iFrec)) {
    const vals = tabla.slice(1).map(f => (f[iFrec] || '').toLowerCase()).filter(Boolean);
    const electrica = vals.some(v => /hz|\d\s*\/\s*\d/.test(v));
    if (electrica && mapa.frecuencia === undefined) mapa.frecuencia = iFrec;
    else if (!electrica && mapa.dias === undefined) mapa.dias = iFrec;
  }
  const conEncabezado = mapa.nombre !== undefined;
  const orden = conEncabezado ? mapa : { nombre: 0, marca: 1, modelo: 2, serie: 3, localidad: 4, dias: 5 };
  const cuerpo = conEncabezado ? tabla.slice(1) : tabla;
  const ignoradas = conEncabezado ? tabla[0].filter((h, i) => h && !Object.values(mapa).includes(i)) : [];
  return { conEncabezado, ignoradas, columnas: COLS_EQUIPO.map(c => c.k).filter(k => orden[k] !== undefined), filas: cuerpo.map((c, n) => {
    const r = { fila: n + (conEncabezado ? 2 : 1) }; // (7 oct 2026) antes 'linea': ese nombre ahora es la columna Línea
    COLS_EQUIPO.forEach(col => { r[col.k] = orden[col.k] !== undefined ? (c[orden[col.k]] || '').trim() : ''; });
    return r;
  }) };
}

async function leerArchivoEquipos(ev){
  const f = ev.target.files && ev.target.files[0];
  ev.target.value = '';
  if (!f) return;
  const status = document.getElementById('bulkEquiposStatus');
  try {
    let texto;
    if (/\.(xlsx|xls)$/i.test(f.name)) {
      status.textContent = 'Leyendo Excel…';
      if (!window.XLSX) await new Promise((ok, mal) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar el lector de Excel. Revisa la conexión o guarda el archivo como CSV.')); document.head.appendChild(s); });
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      texto = XLSX.utils.sheet_to_csv(hoja, { FS: '\t', blankrows: false, dateNF: 'yyyy-mm-dd' });
    } else {
      texto = await f.text();
    }
    document.getElementById('bulkEquiposPasteArea').value = texto;
    status.textContent = `Archivo "${f.name}" leído.`;
    previsualizarEquipos();
  } catch (err) { status.textContent = '' + err.message; }
}

function descargarPlantillaEquipos(){
  const cab = ['Nombre','Marca','Modelo','Serie','Planta','Área','Línea','Tipo de máquina','Frecuencia checklist (días)','Tensión','Potencia','Frecuencia eléctrica','Fase','Tamaño','Peso','Made in','Fecha fabricación','Fecha instalación','Fecha compra','Garantía hasta'];
  const ej = ['COMPRESOR 2','INGERSOLL RAND','R11i','SN-4521','Planta 1','Compresor de Aire','','Compresor de tornillo','7','220 V','11 kW','60 Hz','Trifásico','1200x800x1500 mm','350 kg','USA','15/06/2022','01/09/2022','10/05/2022','10/05/2024'];
  const csv = '﻿' + cab.join(';') + '\n' + ej.join(';') + '\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'plantilla_equipos.csv'; a.click(); URL.revokeObjectURL(url);
}

// Área escrita en el archivo → nombre exacto de un área ya registrada (sin
// importar mayúsculas ni acentos). Devuelve null si no existe.
function areaCanonica(txt){
  const k = sinAcentos(txt);
  if (!k) return '';
  const lista = [...currentAreasInventario, ...DB.map(e => e.localidad).filter(Boolean)];
  return lista.find(a => sinAcentos(a) === k) || null;
}
// (7 oct 2026) Igual para Planta (/plantas) y Línea (/lineas); null si no existe.
function plantaCanonica(txt){
  const k = fbEquipoKey(txt);
  if (!k) return '';
  return [...(plantasInv || []), ...DB.map(e => e.planta).filter(Boolean)].find(p => fbEquipoKey(p) === k) || null;
}
function lineaCanonica(txt){
  const k = fbEquipoKey(txt);
  if (!k) return '';
  return [...(lineasInv || []).map(l => l.nombre), ...DB.map(e => e.linea).filter(Boolean)].find(l => fbEquipoKey(l) === k) || null;
}

function previsualizarEquipos(){
  const prev = document.getElementById('bulkEquiposPreview');
  const okBtn = document.getElementById('bulkEquiposOk');
  const sobrescribir = document.getElementById('bulkEquiposSobrescribir').checked;
  const { filas, conEncabezado, columnas, ignoradas } = interpretarEquipos(parseTabla(document.getElementById('bulkEquiposPasteArea').value));
  bulkEquiposFilas = [];
  if (!filas.length) { prev.innerHTML = '<div class="info-box" style="padding:10px;color:var(--muted);font-size:12.5px;">Pega filas o sube un archivo para ver la vista previa.</div>'; okBtn.disabled = true; return; }

  const vistos = new Map(); // nombre normalizado → fila (une repetidas dentro del archivo)
  const salida = [];
  filas.forEach(f => {
    const r = { ...f, problemas: [], avisos: [] };
    if (!r.nombre) { r.estado = 'error'; r.problemas.push('Falta el nombre'); salida.push(r); return; }
    if (r.dias && !(parseInt(r.dias, 10) > 0)) { r.avisos.push(`Frecuencia de checklist "${r.dias}" no es un número de días: se ignora`); r.dias = ''; }
    if (r.localidad) { const c = areaCanonica(r.localidad); if (c) r.localidad = c; else r.avisos.push(`Área "${r.localidad}" no está en la lista de Áreas`); }
    // (7 oct 2026) Planta y Línea: se usa la escritura registrada; si no existe o la
    // línea es de otra área, solo se avisa (se carga igual, como el Área).
    if (r.planta) { const c = plantaCanonica(r.planta); if (c) r.planta = c; else if (plantasInv) r.avisos.push(`Planta "${r.planta}" no está en la lista de Plantas`); }
    if (r.linea) {
      const c = lineaCanonica(r.linea);
      if (c) r.linea = c; else if (lineasInv) r.avisos.push(`Línea "${r.linea}" no está en la lista de Líneas`);
      const regs = (lineasInv || []).filter(l => fbEquipoKey(l.nombre) === fbEquipoKey(r.linea));
      if (r.localidad && regs.length && !regs.some(l => fbEquipoKey(l.areaNombre) === fbEquipoKey(r.localidad))) r.avisos.push(`Línea "${r.linea}" pertenece al área "${[...new Set(regs.map(l => l.areaNombre))].join(', ')}", no a "${r.localidad}"`);
    }
    COLS_EQUIPO.filter(c => c.fecha && r[c.k]).forEach(c => {
      const n = normalizarFecha(r[c.k]);
      if (n.error) { r.avisos.push(`${c.l} "${r[c.k]}" no se entiende como fecha: se ignora`); r[c.k] = ''; }
      else { r[c.k] = n.v; if (n.aviso) r.avisos.push(`${c.l}: ${n.aviso}`); }
    });
    const k = normalizeKey(r.nombre);
    if (vistos.has(k)) { const p = vistos.get(k); [...CAMPOS_FICHA, 'dias'].forEach(c => { if (!p[c] && r[c]) p[c] = r[c]; }); p.avisos.push(`Repetido en la fila ${r.fila}: se unió`); return; }
    vistos.set(k, r);
    const ex = DB.find(e => normalizeKey(e.nombre) === k);
    if (!ex) r.estado = 'nuevo';
    else {
      r.existenteId = ex.id;
      const cambios = {};
      CAMPOS_FICHA.forEach(c => { if (r[c] && (sobrescribir ? r[c] !== (ex[c]||'') : !ex[c])) cambios[c] = r[c]; });
      const d = parseInt(r.dias, 10);
      if (d > 0 && (sobrescribir ? d !== ex.checklistFrecuenciaDias : !ex.checklistFrecuenciaDias)) cambios.dias = d;
      r.cambios = cambios;
      r.estado = Object.keys(cambios).length ? 'actualiza' : 'igual';
    }
    salida.push(r);
  });
  bulkEquiposFilas = salida.filter(r => r.estado === 'nuevo' || r.estado === 'actualiza');
  const n = e => salida.filter(r => r.estado === e).length;
  const etiqueta = { nuevo: ['Nuevo', 'var(--teal)'], actualiza: ['Se actualiza', 'var(--amber)'], igual: ['Ya existe, sin cambios', 'var(--muted)'], error: ['Error', 'var(--red)'] };
  const extras = CAMPOS_FICHA.filter(k => !['marca','modelo','serie','localidad','planta','linea'].includes(k) && columnas.includes(k));
  // (7 oct 2026) Planta y Línea se muestran junto al Área (Planta › Área › Línea)
  const celdaArea = r => [r.planta && `<span style="color:var(--muted)">Planta:</span> ${escInv(r.planta)}`, escInv(r.localidad), r.linea && `<span style="color:var(--muted)">Línea:</span> ${escInv(r.linea)}`].filter(Boolean).join('<br>');
  prev.innerHTML = `
    <div style="font-size:12.5px;margin:6px 0 8px;line-height:1.6;">
      ${conEncabezado ? `<span data-icon="check-circle" class="ic-ok"></span> Columnas reconocidas: <b>${columnas.map(c => LBL_EQ[c]).join(', ')}</b>${ignoradas.length ? `<br><span data-icon="info"></span> Columnas que no se usan: ${ignoradas.map(escInv).join(', ')}` : ''}` : '<span data-icon="info"></span> Sin encabezados: se usó el orden Nombre · Marca · Modelo · Serie · Área · Frecuencia. Para cargar también planta, línea, tipo de máquina, tensión, potencia, fechas, etc., agrega una fila de encabezados (descarga la plantilla).'}<br>
      <b style="color:var(--color-success-text)">${n('nuevo')} nuevos</b> · <b style="color:var(--color-accent-text)">${n('actualiza')} se actualizan</b> · ${n('igual')} sin cambios${n('error') ? ` · <b style="color:var(--color-danger-text)">${n('error')} con error (no se cargan)</b>` : ''}
    </div>
    <div class="table-card" style="max-height:300px;overflow:auto;margin:0;">
      <table><thead><tr><th>Fila</th><th>Estado</th><th>Nombre</th><th>Marca</th><th>Modelo</th><th>Serie</th><th>Área</th><th>Frec.</th>${extras.length ? '<th>Ficha técnica</th>' : ''}<th>Notas</th></tr></thead>
      <tbody>${salida.map(r => `<tr>
        <td>${r.fila}</td><td><span style="color:${etiqueta[r.estado][1]};font-weight:700;white-space:nowrap;">${etiqueta[r.estado][0]}</span></td>
        <td><b>${escInv(r.nombre) || '—'}</b></td><td>${escInv(r.marca)}</td><td>${escInv(r.modelo)}</td><td>${escInv(r.serie)}</td><td style="font-size:11.5px;">${celdaArea(r)}</td><td>${escInv(r.dias)}</td>
        ${extras.length ? `<td style="font-size:11px;">${extras.filter(k => r[k]).map(k => `<span style="color:var(--muted)">${LBL_EQ[k]}:</span> ${escInv(r[k])}`).join('<br>')}</td>` : ''}
        <td style="font-size:11px;color:var(--muted);">${[...r.problemas, ...r.avisos, r.estado === 'actualiza' ? 'Cambia: ' + Object.keys(r.cambios).map(c => c === 'dias' ? 'Frec. checklist' : LBL_EQ[c]).join(', ') : ''].filter(Boolean).map(escInv).join('<br>')}</td></tr>`).join('')}</tbody></table>
    </div>`;
  okBtn.disabled = !bulkEquiposFilas.length;
  okBtn.textContent = bulkEquiposFilas.length ? `Cargar ${bulkEquiposFilas.length} equipo(s)` : 'Nada que cargar';
}
const escInv = s => fbEsc(s); // (5 oct 2026) misma función compartida de firebase-init.js

async function bulkImportEquipos(){
  previsualizarEquipos(); // recalcula con los datos más recientes
  const filas = bulkEquiposFilas;
  const status = document.getElementById('bulkEquiposStatus');
  if (!filas.length) { showToast('No hay equipos nuevos ni cambios para cargar', 'warn'); return; }
  await window.fbReady;
  const hoyStr = fbHoy();
  const btn = document.getElementById('bulkEquiposOk');
  btn.disabled = true;
  let hechos = 0;
  let enCola = false; // (5 oct 2026) true si algún lote quedó guardado solo en el celular
  try {
    for (let i = 0; i < filas.length; i += 400) {
      const batch = db.batch();
      filas.slice(i, i + 400).forEach(r => {
        if (r.estado === 'nuevo') {
          const datos = { nombre: r.nombre, repuestos: [], updatedAt: fbTimestamp() };
          CAMPOS_FICHA.forEach(c => { datos[c] = r[c] || ''; });
          const d = parseInt(r.dias, 10);
          if (d > 0) { datos.checklistFrecuenciaDias = d; datos.checklistProximaFecha = addDaysStrInv(hoyStr, d); }
          batch.set(db.collection('equipos').doc(), fbSanitizeTs(datos));
        } else {
          const c = { ...r.cambios };
          if (c.dias) { c.checklistFrecuenciaDias = c.dias; c.checklistProximaFecha = addDaysStrInv(hoyStr, c.dias); delete c.dias; }
          batch.set(db.collection('equipos').doc(r.existenteId), fbSanitizeTs({ ...c, updatedAt: fbTimestamp() }), { merge: true });
        }
      });
      status.textContent = `Guardando… ${Math.min(i + 400, filas.length)} de ${filas.length}`;
      // (5 oct 2026) Con la persistencia sin conexión, commit() no termina
      // hasta que el servidor responde: sin señal la pantalla quedaba en
      // "Guardando…" para siempre. El lote ya quedó guardado en el celular al
      // llamar commit(), así que se espera como máximo 8 s y se sigue.
      const p = batch.commit();
      if (enCola) { p.catch(err => showToast('Un lote de equipos no se pudo subir: ' + err.message, 'warn')); }
      else if ((await conTimeout(p, 8000)) === 'timeout') {
        enCola = true;
        p.catch(err => showToast('Un lote de equipos no se pudo subir: ' + err.message, 'warn'));
      }
      hechos = Math.min(i + 400, filas.length);
    }
    const nuevos = filas.filter(r => r.estado === 'nuevo').length;
    if (enCola) showToast(`Guardado en el celular; se subirá cuando haya señal (${nuevos} nuevo(s)${filas.length - nuevos ? `, ${filas.length - nuevos} actualizado(s)` : ''})`, 'success');
    else showToast(`${nuevos} equipo(s) nuevo(s)${filas.length - nuevos ? `, ${filas.length - nuevos} actualizado(s)` : ''}`, 'success');
    closeModal('modalBulkEquipos');
    catRefrescarLocal(); // (v3 etapa 3a) antes lo traía el listener en vivo de toda la colección
  } catch (err) {
    console.error(err);
    status.innerHTML = `<span data-icon="alert" class="ic-warn"></span> Se guardaron ${hechos} de ${filas.length}. Error: ${escInv(err.code === 'permission-denied' ? 'tu usuario no tiene permiso para crear equipos (rol Técnico, Almacén, Encargado o Administrador).' : err.message)}`;
    btn.disabled = false;
  }
}
/* ═══════════════ ORDENAR FICHAS TÉCNICAS (4 oct 2026) ═══════════════
   Muchos equipos se cargaron con toda la ficha técnica dentro de "Modelo"
   ("CPQYD · Config. 30-RCH · Motor 31.2 kW · Peso 4820 kg · Fab. 2026-01 ·
   China · ..."). Esto lee ese texto, reparte cada dato en su campo y deja lo
   demás en "Características". Nunca reemplaza un campo que ya tenía dato:
   si choca, el texto se queda en Características y se avisa. Siempre con
   vista previa; se guarda solo lo que se aprueba. */
const PAISES = ['china','usa','eeuu','ee.uu.','estados unidos','alemania','italia','japon','japón','taiwan','taiwán','corea','corea del sur','india','brasil','mexico','méxico','españa','francia','turquia','turquía','reino unido','inglaterra','suiza','suecia','canada','canadá','republica dominicana','república dominicana','argentina','colombia','austria','holanda','paises bajos','belgica','bélgica','dinamarca','finlandia','vietnam','tailandia','malasia','polonia','portugal','checa','republica checa'];
const capitalizar = s => s.charAt(0).toUpperCase() + s.slice(1);

// Devuelve { cambios: {campo: valor}, caracteristicas: [..], notas: [..], modelo }
function separarFicha(e){
  const texto = (e.modelo || '').trim();
  const partes = texto.split(/\s*[·•|;]\s*|\n+/).map(s => s.trim()).filter(Boolean);
  const res = { cambios: {}, caract: [], notas: [], modeloPartes: [] };
  const libre = k => !e[k] && !res.cambios[k];
  const poner = (k, v, original) => {
    if (!v) return;
    if (libre(k)) res.cambios[k] = v;
    else if (sinAcentos(e[k] || res.cambios[k]) !== sinAcentos(v)) { res.caract.push(original); res.notas.push(`${LBL_EQ[k] || k} ya tenía "${e[k] || res.cambios[k]}": "${original}" queda en Características`); }
  };
  partes.forEach((seg, i) => {
    let s = seg, usado = false;
    const sn = sinAcentos(s);
    let m;
    // fecha de fabricación / instalación
    if ((m = /^(fab\.?|fabricad[oa]|fabricacion|ano de fabricacion|ano fab\.?|año|ano)\s*:?\s*(.+)$/i.exec(s))) {
      const f = normalizarFecha(m[2].replace(/^en\s+/i, ''));
      if (!f.error) { poner('fabricacion', f.v, seg); if (f.aviso) res.notas.push('Fabricación: ' + f.aviso); return; }
    }
    if ((m = /^(instalad[oa]|instalacion|instalación|fecha de instalacion)\s*:?\s*(.+)$/i.exec(s))) {
      const f = normalizarFecha(m[2]); if (!f.error) { poner('instalacion', f.v, seg); return; }
    }
    // país de origen
    if ((m = /^(made in|hecho en|origen|fabricado en|pais)\s*:?\s*(.+)$/i.exec(s))) { poner('madein', capitalizar(m[2].trim()), seg); return; }
    if (PAISES.includes(sn)) { poner('madein', capitalizar(s), seg); return; }
    // serie
    if ((m = /^(s\/n|sn|serie|n[°º]? ?serie|serial)\s*:?\s*(.+)$/i.exec(s))) { poner('serie', m[2].trim(), seg); return; }
    // peso (solo con la palabra "Peso": "Capacidad 3000 kg" NO es el peso)
    if ((m = /^peso\s*:?\s*(.+)$/i.exec(s))) { poner('peso', m[1].trim(), seg); return; }
    // dimensiones
    if ((m = /^(?:(?:dimensiones|medidas|tama[nñ]o)\s*:?\s*)?(\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)?\s*(?:mm|cm|m)?)$/i.exec(s))) { poner('tamano', m[1].trim(), seg); return; }
    // mantenimiento / horómetro → configuración del checklist
    if ((m = /(cada|c\/)\s*(\d+)\s*(h|hr|hrs|horas)\b/i.exec(s)) && /(serv|mant|horom)/i.test(sn)) { if (!e.checklistFrecuenciaHoras) res.cambios.checklistFrecuenciaHoras = +m[2]; res.caract.push(seg); return; }
    if ((m = /^horometro\s*:?\s*(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|horas)?/i.exec(sn))) { if (e.horometroActual == null) { res.cambios.horometroActual = parseFloat(m[1].replace(',', '.')); res.cambios.horometroUltimoService = res.cambios.horometroActual; res.notas.push(`Horómetro ${res.cambios.horometroActual} h tomado como último servicio: ajústalo en Checklist si no es así`); } res.caract.push(seg); return; }
    if (/^mant(\.|enimiento)?\s/i.test(s) && !e.checklistFrecuenciaDias) {
      const d = /semanal/i.test(s) ? 7 : /quincenal/i.test(s) ? 15 : /mensual/i.test(s) ? 30 : /trimestral/i.test(s) ? 90 : /diari/i.test(s) ? 1 : ((m = /cada\s*(\d+)\s*d/i.exec(s)) ? +m[1] : 0);
      if (d) { const hoy = fbHoy();
        res.cambios.checklistFrecuenciaDias = d; res.cambios.checklistProximaFecha = addDaysStrInv(hoy, d); res.caract.push(seg); return; }
    }
    // datos eléctricos dentro del texto (pueden venir varios: "1F 220V 50Hz 1.38 kW")
    const quitar = re => { const mm = re.exec(s); if (mm) { s = s.replace(mm[0], ' '); usado = true; } return mm; };
    let t;
    if ((t = quitar(/\b(\d{2,3}(?:\s*\/\s*\d{2,3})?)\s*(v|vac|vdc|volts?|voltios)\b/i))) poner('tension', t[1].replace(/\s/g, '') + ' ' + t[2].toUpperCase().replace('VOLTIOS','V').replace(/VOLTS?/,'V'), seg);
    if ((t = quitar(/\b(\d{2}(?:\s*\/\s*\d{2})?)\s*hz\b/i))) poner('frecuencia', t[1].replace(/\s/g, '') + ' Hz', seg);
    if ((t = quitar(/\b(\d+(?:[.,]\d+)?)\s*(kw|hp|cv)\b/i))) poner('potencia', t[1] + ' ' + (t[2].toLowerCase() === 'kw' ? 'kW' : t[2].toUpperCase()), seg);
    if ((t = quitar(/\b([13])\s*f\b|\b(monof[aá]sic[oa]|trif[aá]sic[oa]|bif[aá]sic[oa])\b/i))) poner('fase', t[1] ? (t[1] === '1' ? 'Monofásico' : 'Trifásico') : capitalizar(t[2].toLowerCase()), seg);
    if (usado) {
      const resto = s.replace(/\b(motor|potencia|tension|tensión|voltaje|alimentacion|alimentación|electrico|eléctrico|frecuencia|fase)\b/gi, '').replace(/[\s,:\-]+/g, ' ').trim();
      if (resto) res.caract.push(resto);
      return;
    }
    // el modelo: el primer tramo, más los que parecen parte del código (Config., Versión…)
    if (i === 0 || /^(config\.?|configuraci[oó]n|mod\.?|modelo|versi[oó]n|tipo)\b/i.test(s)) { res.modeloPartes.push(seg); return; }
    res.caract.push(seg);
  });
  res.modelo = res.modeloPartes.join(' · ');
  if (res.modelo && res.modelo !== texto) res.cambios.modelo = res.modelo;
  if (res.caract.length) res.cambios.caracteristicas = [e.caracteristicas, res.caract.join(' · ')].filter(Boolean).join(' · ');
  return res;
}
// Un equipo necesita orden si su Modelo trae varios datos juntos.
const necesitaOrden = e => (/[·•|;\n]/.test(e.modelo || '') || (e.modelo || '').length > 45) && Object.keys(separarFicha(e).cambios).length > 0;

let fichasPropuestas = [];
function abrirOrdenarFichas(soloId){
  const lista = DB.filter(e => (!soloId || e.id === soloId) && necesitaOrden(e)).sort((a, b) => cmpNat(a.nombre, b.nombre));
  fichasPropuestas = lista.map(e => ({ e, r: separarFicha(e) }));
  const etiquetas = { ...LBL_EQ, modelo: 'Modelo', caracteristicas: 'Características', checklistFrecuenciaHoras: 'Checklist cada (h)', checklistFrecuenciaDias: 'Checklist cada (días)', horometroActual: 'Horómetro actual', horometroUltimoService: 'Horómetro último servicio' };
  document.getElementById('fichasBody').innerHTML = fichasPropuestas.length ? `
    <label style="display:flex;gap:8px;align-items:center;font-size:12.5px;margin-bottom:10px;cursor:pointer;"><input type="checkbox" id="fichasTodas" checked style="width:auto;" onchange="document.querySelectorAll('[data-ficha]').forEach(c=>c.checked=this.checked);contarFichas()"> Seleccionar todos (${fichasPropuestas.length})</label>
    ${fichasPropuestas.map((x, i) => `
    <div class="ficha-item">
      <label class="ficha-head"><input type="checkbox" data-ficha="${i}" checked onchange="contarFichas()"> <b>${escInv(x.e.nombre)}</b> <span style="color:var(--muted);font-size:11.5px;">${escInv(x.e.localidad || '')}</span></label>
      <div class="ficha-antes"><span>Modelo hoy:</span> ${escInv(x.e.modelo)}</div>
      <div class="ficha-despues">${Object.entries(x.r.cambios).filter(([k]) => !['horometroUltimoService','checklistProximaFecha'].includes(k)).map(([k, v]) => `<div${k === 'caracteristicas' ? ' style="grid-column:1/-1"' : ''}><span>${etiquetas[k] || k}</span>${escInv(v)}</div>`).join('')}</div>
      ${x.r.notas.length ? `<div class="ficha-notas">${x.r.notas.map(escInv).join('<br>')}</div>` : ''}
    </div>`).join('')}`
    : `<div class="empty-state" style="padding:30px 10px;"><span data-icon="check-circle" class="ic-ok"></span> ${soloId ? 'La ficha de este equipo ya está ordenada.' : 'No hay equipos con la ficha técnica amontonada en Modelo.'}</div>`;
  contarFichas();
  openModal('modalFichas');
}
function contarFichas(){
  const n = document.querySelectorAll('[data-ficha]:checked').length;
  const b = document.getElementById('fichasOk');
  b.disabled = !n; b.textContent = n ? `Ordenar ${n} equipo(s)` : 'Nada seleccionado';
}
async function aplicarFichas(){
  const elegidos = [...document.querySelectorAll('[data-ficha]:checked')].map(c => fichasPropuestas[+c.dataset.ficha]);
  if (!elegidos.length) return;
  const b = document.getElementById('fichasOk'); b.disabled = true;
  await window.fbReady;
  try {
    for (let i = 0; i < elegidos.length; i += 400) {
      const batch = db.batch();
      elegidos.slice(i, i + 400).forEach(({ e, r }) => batch.set(db.collection('equipos').doc(e.id), fbSanitizeTs({ ...r.cambios, updatedAt: fbTimestamp() }), { merge: true }));
      // (5 oct 2026) mismo tope de 8 s que la carga masiva: sin señal queda en cola
      const p = batch.commit();
      if ((await conTimeout(p, 8000)) === 'timeout') p.catch(err => showToast('No se pudo subir la ficha ordenada: ' + err.message, 'warn'));
    }
    // copia pública del QR al día con la ficha nueva (sin esperar)
    elegidos.forEach(({ e, r }) => publicarHojaVida({ ...e, ...r.cambios, id: e.id }));
    elegidos.forEach(({ e, r }) => logAuditoria('especificaciones_equipo', e.id, e.nombre,
      Object.entries(r.cambios).map(([k, v]) => ({ campo: k === 'caracteristicas' ? 'Características' : (LBL_EQ[k] || k), anterior: e[k] ?? '', nuevo: v }))));
    showToast(`Ficha técnica ordenada en ${elegidos.length} equipo(s)`, 'success');
    closeModal('modalFichas');
    catRefrescarLocal();
  } catch (err) {
    showToast('No se pudo guardar: ' + (err.code === 'permission-denied' ? 'tu usuario no tiene permiso para editar equipos.' : err.message), 'warn');
    b.disabled = false;
  }
}

// fbSanitize convierte a JSON y perdería el serverTimestamp: este lo conserva.
function fbSanitizeTs(obj){
  const { updatedAt, ...rest } = obj;
  const limpio = fbSanitize(rest);
  return updatedAt ? { ...limpio, updatedAt } : limpio;
}


// OTs abiertas de un equipo (para avisar antes de borrarlo). Si no se puede
// consultar (sin señal / sin permiso), devuelve null y no se avisa.
async function contarOtsAbiertas(e){
  const ABIERTAS = ['pendiente','en_atencion','planificada','en_revision'];
  try{
    const qs = [
      db.collection('ots').where('equipoId','==', e.id).limit(300).get(),
      db.collection('ots').where('EQUIPO','==', e.nombre).limit(300).get(),
      db.collection('ots').where('equipoNombre','==', e.nombre).limit(300).get(),
    ];
    const r = await conTimeout(Promise.allSettled(qs), 6000);
    if(r === 'timeout') return null;
    const ids = new Set();
    r.forEach(x => { if(x.status === 'fulfilled') x.value.docs.forEach(d => { if(ABIERTAS.includes(d.data().estado)) ids.add(d.id); }); });
    return r.some(x => x.status === 'fulfilled') ? ids.size : null;
  }catch(err){ return null; }
}

async function deleteEquipo(){
  const e = getCurrentEquipo();
  // Borrar un equipo completo es solo para Administrador (firestore.rules):
  // se avisa antes, en vez de borrarlo de la pantalla y fallar en la nube.
  if (typeof userHasRole === 'function' && !userHasRole('ADMINISTRADOR')) { showToast('Solo un Administrador puede eliminar equipos completos.', 'error'); return; }
  if(!(await verifyPin())) return;
  // (5 oct 2026) avisa si el equipo tiene OTs abiertas (no se borran: quedan en el historial)
  const abiertas = await contarOtsAbiertas(e);
  const avisoOts = abiertas ? `\n\nTiene ${abiertas} OT(s) abiertas (pendientes / en atención / planificadas). Esas OTs NO se borran, pero quedarán apuntando a un equipo que ya no existe.` : '';
  if(!confirm(`¿Eliminar "${e.nombre}" y sus ${e.repuestos.length} repuestos?${avisoOts}\n\nSu historial de OTs se conserva. Tendrás unos segundos para deshacerlo con el botón del aviso.`)) return;
  const backup = JSON.parse(JSON.stringify(e));
  // (5 oct 2026) se borra también la copia pública del QR (/equipos_publico),
  // en el mismo lote; antes el QR seguía mostrando la ficha de un equipo borrado.
  const batch = db.batch();
  batch.delete(db.collection('equipos').doc(e.id));
  batch.delete(db.collection('equipos_publico').doc(e.id));
  batch.commit().catch(err=>showToast('No se pudo borrar en la nube: '+err.message, 'warn'));
  DB = DB.filter(x=>x.id!==backup.id);
  backHome();
  catRefrescarLocal();
  let undone = false;
  showUndoToast(`Equipo "${backup.nombre}" eliminado`, ()=>{
    undone = true;
    fbSaveEquipo(backup);
    publicarHojaVida(backup); // vuelve la ficha pública (el historial se rehace al guardar en Bitácora)
    DB.push(backup);
    openEquipo(backup.id);
    catRefrescarLocal();
  });
  // El PDF del manual se borra de Storage solo si no se deshizo a tiempo.
  setTimeout(()=>{ if(!undone && backup.manualUrl) fbDeleteFile(backup.manualUrl); }, 5300);
}


/* ═══════════════ CLAVE DE ELIMINACIÓN (compartida entre todos los celulares) ═══════════════ */
// La clave se guarda como hash SHA-256 (no en texto plano) para que alguien
// que llegue a mirar la base de datos de Firestore directamente no pueda
// leerla tal cual — solo sirve para comparar, no para recuperarla.
async function sha256Hex(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

// (4 oct 2026) Estas dos funciones se llamaban desde verifyPin/configurePin
// pero NUNCA existieron: por eso eliminar siempre fallaba con "No se pudo
// comprobar la clave". La clave se guarda como hash SHA-256 (nunca en texto)
// en /config/app, compartida por todos los celulares. Solo Administrador puede
// crearla o cambiarla (firestore.rules: /config escritura esAdmin()).
async function fbGetSharedPin(){
  const snap = await db.collection('config').doc('app').get();
  if(!snap.exists) return null;
  const d = snap.data() || {};
  return d.pinEliminar || d.pinHash || d.pin || null;
}
async function fbSetSharedPin(hash){
  try {
    await db.collection('config').doc('app').set({
      pinEliminar: hash || null,
      pinActualizadoPor: (window.currentUserRole && window.currentUserRole.nombre) || (window.currentUser && window.currentUser.email) || '',
      pinActualizadoEn: fbTimestamp()
    }, { merge: true });
  } catch (err) {
    showToast(err.code === 'permission-denied' ? 'Solo un Administrador puede crear o cambiar la clave de eliminación.' : 'No se pudo guardar la clave: ' + err.message);
    throw err;
  }
}

async function verifyPin(){
  await window.fbReady;
  let pinHash;
  try{ pinHash = await fbGetSharedPin(); }catch(err){ showToast('No se pudo comprobar la clave: '+err.message, 'warn'); return false; }
  if(!pinHash){
    const crear = confirm('Todavía no hay una clave configurada para eliminar (es la misma en todos los celulares).\n\n¿Quieres crearla ahora?');
    if(!crear){ showToast('Eliminación cancelada — no hay clave configurada'); return false; }
    const nueva = prompt('Crea una clave para proteger la eliminación:');
    if(!nueva) return false;
    const confirmacion = prompt('Confirma la clave:');
    if(confirmacion !== nueva){ showToast('Las claves no coinciden — inténtalo de nuevo', 'error'); return false; }
    try { await fbSetSharedPin(await sha256Hex(nueva)); } catch (e) { return false; }
    showToast('Clave configurada — vuelve a tocar eliminar para continuar', 'error');
    return false; // por seguridad, la primera vez solo configura la clave; hay que volver a intentar eliminar
  }
  const entered = prompt('Ingresa la clave para eliminar:');
  if(entered===null) return false; // canceló
  if(!(await pinCoincide(entered, pinHash))){ showToast('Clave incorrecta', 'error'); return false; }
  return true;
}
// (5 oct 2026) Antes también se aceptaba escribir el HASH guardado tal cual
// (entered === pinHash): cualquiera que leyera /config/app podía borrar.
// Ahora: si lo guardado es un hash SHA-256 (64 hex) solo vale la clave cuyo
// hash coincide; solo una clave vieja guardada en texto plano se compara
// directo. La clave sigue siendo un freno en pantalla; quién puede borrar de
// verdad lo deciden las reglas de Firestore.
async function pinCoincide(entered, guardado){
  if(/^[0-9a-f]{64}$/i.test(guardado || '')) return (await sha256Hex(entered)) === guardado.toLowerCase();
  return entered === guardado;
}

async function configurePin(){
  await window.fbReady;
  const current = await fbGetSharedPin().catch(()=>null);
  if(current){
    const cambiar = confirm('Ya hay una clave configurada (compartida entre todos los celulares).\n\nAceptar = cambiarla\nCancelar = quitar la protección');
    if(cambiar){
      const old = prompt('Ingresa la clave actual:');
      if(old===null) return;
      if(!(await pinCoincide(old, current))){ showToast('Clave incorrecta', 'error'); return; }
      const nueva = prompt('Nueva clave:');
      if(!nueva) return;
      try { await fbSetSharedPin(await sha256Hex(nueva)); } catch (e) { return; }
      showToast('Clave actualizada para todos los celulares', 'success');
    } else {
      const old = prompt('Ingresa la clave actual para quitar la protección:');
      if(old===null) return;
      if(!(await pinCoincide(old, current))){ showToast('Clave incorrecta', 'error'); return; }
      try { await fbSetSharedPin(null); } catch (e) { return; }
      showToast('Protección de eliminación desactivada', 'success');
    }
  } else {
    const nueva = prompt('Crea una clave para proteger la eliminación de repuestos y equipos (será la misma en todos los celulares):');
    if(!nueva) return;
    const confirmacion = prompt('Confirma la clave:');
    if(confirmacion !== nueva){ showToast('Las claves no coinciden, inténtalo de nuevo', 'error'); return; }
    try { await fbSetSharedPin(await sha256Hex(nueva)); } catch (e) { return; }
    showToast('Clave configurada — se pedirá para eliminar repuestos o equipos', 'error');
  }
}

