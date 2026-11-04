// i18n/guia.js — (v3 etapa 3b) Guía de uso en Español, English y Türkçe.
// guia.html pinta las secciones del idioma elegido (sin leer nada de Firebase).
// Cada sección: { id, roles, ic, t (título), sub, items: [{ h, b (HTML corto), ir: [[enlace, texto]] }] }.
// La sección 'sec-nave-nueva' trae además 'pasos' (se marcan y se guardan en este celular).
(function () {
  const G = {};
  // ═════════════════════════ ESPAÑOL ═════════════════════════
  G.es = {
    ui: { titulo: 'Guía', intro: 'Lo que hace cada persona en la app. Tu parte sale primero. Toca un título para abrirlo.', buscarPh: 'Buscar: QR, repuesto, nave, horas…', buscarAria: 'Buscar en la guía', limpiar: 'Borrar búsqueda',
      sinRes: 'No hay nada con esa palabra. Prueba con otra: aviso, hora, almacén.', res1: '{n} resultado en {s} sección', resN: '{n} resultados en {s} secciones', tuRol: 'Tu rol', imprimir: 'Imprimir', volver: 'Volver', volverRep: 'Reportar',
      pie: 'Mantenimiento 2026 · VoidTech · La guía funciona sin señal una vez abierta.', nnNave: 'Nave:', nnPh: 'Nombre de la nave nueva (ej. NAVE 2)', nnPasos: '{n} de {t} pasos', nnLista: 'Nave lista', nnEscribe: 'Escribe el nombre de la nave para marcar los pasos.',
      nnReset: 'Empezar de nuevo esta nave', nnConfirm: '¿Desmarcar todos los pasos de "{n}"? Solo en este celular; no cambia nada en la app.', nnPaso: 'Paso {n} hecho', ir: 'Abrir' },
    secs: [
      { id: 'sec-todos', roles: '', ic: 'grid', t: 'Lo básico', sub: 'Para todos: menú, buscar, QR, idioma, sin señal', items: [
        { h: 'Hoy', b: '<p>Al entrar ves <b>Hoy</b>: solo lo que te toca, lo más urgente arriba (máquinas paradas, trabajos con fecha, checklists vencidos, solicitudes).</p>', ir: [['index.html', 'Abrir Hoy']] },
        { h: 'Moverse por la app', b: '<p>La barra de abajo tiene tus pantallas. El botón del centro <span class="k">+</span> sirve para escanear una máquina, reportar una falla, registrar un trabajo o hacer un checklist. <b>Más</b> tiene todas las pantallas de tu rol, el idioma, el tema y Salir.</p>' },
        { h: 'Buscar', b: '<p>La lupa de arriba busca máquinas, OTs (por folio, ej. OT-0123), repuestos y pantallas. No gasta datos al escribir.</p>' },
        { h: 'Escanear el QR de la máquina', b: '<p>Toca <span class="k">+</span> → <b>Escanear máquina</b> y apunta al QR. Se abre lo que te toca: el Equipo 360 si eres técnico, Reportar si eres operador. Si la cámara no funciona, escribe el nombre o el código.</p>' },
        { h: 'Idioma y tema', b: '<p>En <b>Más</b> eliges Español, English o Türkçe, y el tema: Claro, Oscuro, <b>Sol</b> (alto contraste, para la planta con mucha luz o al aire libre) o Auto. Lo que escribe la gente no cambia de idioma; toca <span class="k">Traducir</span> para leerlo en el tuyo.</p>' },
        { h: 'Sin señal', b: '<p>Arriba ves el estado: <b>Conectado</b>, <b>Guardando…</b> o <b>Sin conexión</b>, con los cambios que faltan por subir. Sin señal puedes seguir trabajando: lo que guardas se sube solo cuando vuelve. No lo repitas.</p>' },
        { h: 'Deshacer y ayuda', b: '<p>Algunas acciones se pueden deshacer: el aviso de abajo trae el botón <span class="k">Deshacer</span> por unos segundos. El botón <span class="k">?</span> junto a un título explica para qué sirve.</p>' },
      ] },
      { id: 'sec-operador', roles: 'OPERADOR', ic: 'siren', t: 'Operador (producción)', sub: 'Avisar una falla o pedir un proyecto', items: [
        { h: 'Reportar una falla', b: '<ol><li>Busca la máquina y tócala (o escanea su QR).</li><li>Elige <span class="k">Falla en la máquina</span>.</li><li>Di si está parada y desde qué hora.</li><li>Escribe qué se ve, se oye o se siente raro.</li><li>Elige qué tan urgente es y toca <span class="k">Enviar reporte</span>.</li></ol><p>Los técnicos reciben el aviso al momento.</p>', ir: [['reportar.html', 'Abrir Reportar']] },
        { h: '¿Falla o proyecto?', b: '<p><b>Falla</b>: la máquina tiene un problema ahora; se atiende ya. <b>Proyecto / mejora</b>: algo que se quiere hacer sin apuro; el Encargado le pone técnico y fecha.</p>' },
        { h: 'Ver cómo va tu reporte', b: '<p>Toca <b>Mis reportes</b> en la barra de abajo. Se actualiza solo: esperando técnico, en atención, resuelto o proyecto (cada uno con su icono y color).</p>', ir: [['reportar.html#estado', 'Ver mis reportes']] },
        { h: 'No mandes el mismo reporte dos veces', b: '<p>Si la máquina ya tiene un reporte abierto, la app te avisa. Revisa el estado antes de enviar otro.</p>' },
      ] },
      { id: 'sec-tecnico', roles: 'TECNICO', ic: 'wrench', t: 'Técnico', sub: 'Avisos, trabajos, checklists, repuestos y herramientas', items: [
        { h: 'Primero: activa los avisos', b: '<p>En <b>Trabajos → Avisos</b> toca <span class="k">Activar sonido y notificaciones</span>. Se hace una vez en cada celular.</p>', ir: [['bitacora.html#avisos', 'Abrir Avisos']] },
        { h: 'Atender un aviso', b: '<ol><li>Toca <span class="k">Voy a atenderlo</span>: queda a tu nombre y producción ve que vas.</li><li>Si no puedes seguir, toca <span class="k">Soltar</span>.</li><li>Al terminar toca <span class="k">Terminé — registrar OT</span>. Se abre el formulario con la máquina y las horas puestas.</li><li>Escribe la solución y toca <span class="k">Guardar</span>.</li></ol>' },
        { h: 'Registrar un trabajo', b: '<p><span class="k">+</span> → <b>Registrar trabajo</b>. Elige la máquina, el tipo (correctivo, preventivo, predictivo o proyecto), la falla y la solución, las horas (<b>Paró</b>, <b>Llegó</b>, <b>Terminó</b>; el botón <span class="k">Ahora</span> pone la hora de un toque), los técnicos, las herramientas y los repuestos.</p>', ir: [['bitacora.html#nuevo', 'Abrir Nuevo']] },
        { h: 'Seguridad antes de empezar (LOTO)', b: '<p>Si vas a meter las manos o quitar guardas, la app te pide el bloqueo: pasos, energías, candado y EPP. En los equipos A · Crítico es obligatorio. Los trabajos con riesgo especial (altura, espacio confinado, en caliente, eléctrico energizado) esperan la autorización del supervisor.</p>' },
        { h: 'Trabajos asignados', b: '<p>En <b>Trabajos → Asignados</b> están los trabajos que el Encargado te planificó con fecha. Toca <span class="k">Registrar</span>, termina y guarda: pasa a revisión. Si vuelve como <b>Devuelta</b>, lee la nota, corrige y guarda otra vez.</p>', ir: [['bitacora.html#asignados', 'Abrir Asignados']] },
        { h: 'Hacer un checklist', b: '<p>En <b>Checklist → Hoy</b> están los equipos que te tocan. Marca cada punto (Conforme, No conforme, No aplica, No inspeccionado) y guarda. Cada punto No conforme crea una OT para planificar.</p>', ir: [['checklist.html', 'Abrir Checklist']] },
        { h: 'Pedir repuestos', b: '<p>En el formulario del trabajo, en <b>Repuestos</b>, elige <span class="k">Con repuestos</span>, escribe el repuesto y la cantidad, y toca <span class="k">+ Solicitar a almacén</span>. Almacén lo entrega o lo rechaza.</p>' },
        { h: 'Equipo 360', b: '<p>Escanea el QR o busca la máquina: ves si está parada, su último trabajo, su checklist, lo pendiente, el LOTO, las RCA y las tendencias, y los botones para actuar.</p>', ir: [['hoja-vida.html', 'Abrir Equipos']] },
        { h: 'Herramientas a tu cargo', b: '<p>Cuando te entregan una herramienta, confírmalo en <b>Herramientas → Mis herramientas</b>. En el arqueo también das tu conformidad.</p>' },
        { h: 'Análisis de causa raíz (RCA)', b: '<p>Si una falla se repite, la app te pide llenar los 5 porqués, el tipo de causa, la acción, el responsable y la fecha. Sin él, el supervisor no puede validar.</p>' },
      ] },
      { id: 'sec-supervisor', roles: 'SUPERVISOR,ENCARGADO_MANTENIMIENTO', ic: 'clipboard-check', t: 'Supervisor y Encargado', sub: 'Autorizar, planificar, validar y medir', items: [
        { h: 'Autorizar permisos', b: '<p>En <b>Trabajos → Avisos</b> salen los permisos de trabajo con riesgo especial. Revisa y toca <span class="k">Autorizar</span> o <span class="k">Rechazar</span> (con nota). Tu propio permiso lo autoriza otra persona.</p>' },
        { h: 'Planificar (Encargado)', b: '<p>En <b>Trabajos → Por planificar</b> están las fallas de checklist y los proyectos. Elige técnico y fecha y toca <span class="k">Planificar</span>.</p>', ir: [['bitacora.html#planificar', 'Abrir Por planificar']] },
        { h: 'Validar', b: '<p>En <b>Trabajos → Por validar</b> revisa lo que registró el técnico: <span class="k">Buena y válida</span> o <span class="k">No concluido</span> con una nota de lo que falta.</p>', ir: [['bitacora.html#validar', 'Abrir Por validar']] },
        { h: 'Criticidad de los equipos', b: '<p>En <b>Equipos → Catálogo → Evaluar criticidad</b> contestas 5 preguntas por equipo: A · Crítico, B · Importante o C · Normal. Los críticos salen primero en Avisos y siempre llevan LOTO.</p>' },
        { h: 'Análisis', b: '<p><b>Resumen</b>: MTBF, MTTR, disponibilidad, backlog y cumplimiento. <b>Equipos</b>: riesgo y predicción por máquina. <b>Confiabilidad</b>: RCA, tendencias y seguridad. <b>Personas y naves</b>: técnicos y comparativo. Todo respeta los filtros y se exporta a Excel.</p>', ir: [['analisis.html', 'Abrir Análisis']] },
        { h: 'Checklist: puntos y frecuencias', b: '<p>En <b>Checklist → Ajustes</b> se cambian las frecuencias (días u horómetro) y los puntos propios de cada equipo, también por carga masiva desde Excel.</p>' },
        { h: 'CAPEX (Encargado)', b: '<p>Proyectos de inversión: borrador, envío, aprobación del Administrador, gastos y cierre. Se crea desde el Equipo 360 o desde CAPEX.</p>', ir: [['capex.html', 'Abrir CAPEX']] },
      ] },
      { id: 'sec-almacen', roles: 'ALMACEN', ic: 'package', t: 'Almacén', sub: 'Solicitudes, stock, movimientos y compras', items: [
        { h: 'Atender solicitudes', b: '<p>En <b>Almacén → Solicitudes</b> están los repuestos que piden los técnicos. Toca <span class="k">Entregar</span> o <span class="k">Rechazar</span> (con el motivo). El técnico ve el estado en su trabajo.</p>', ir: [['almacen.html#solicitudes', 'Abrir Solicitudes']] },
        { h: 'Entradas y salidas', b: '<p>En <b>Repuestos</b>, abre la máquina y usa los botones de entrada y salida de cada repuesto. Pon el folio de la OT si la salida es para un trabajo: así se cuenta su costo.</p>' },
        { h: 'Compras', b: '<p><b>Compras</b> lista lo que está sin stock o bajo el mínimo. Exporta la lista de compra a Excel.</p>' },
        { h: 'Herramientas', b: '<p>Entrega herramientas a los técnicos, registra devoluciones y haz arqueos. El técnico confirma con su usuario.</p>', ir: [['herramientas.html', 'Abrir Herramientas']] },
      ] },
      { id: 'sec-rrhh', roles: 'RRHH', ic: 'users', t: 'Recursos Humanos', sub: 'Cargos por herramientas', items: [
        { h: 'Cargos por enviar y por descontar', b: '<p>En <b>Herramientas → Recursos Humanos</b> llegan los cargos de los arqueos con faltantes o daños, con la constancia y la conformidad del técnico.</p>', ir: [['herramientas.html#rrhh', 'Abrir cargos']] },
        { h: 'Marcar descontado', b: '<p>Cuando se aplica en nómina, toca <span class="k">Marcar descontado</span> y escribe cómo (ej. nómina 15/10, 2 cuotas). Si no procede, <span class="k">Anular cargo</span>.</p>' },
        { h: 'Exportar', b: '<p>Descarga los cargos en CSV para nómina.</p>' },
      ] },
      { id: 'sec-admin', roles: 'ADMINISTRADOR', ic: 'settings', t: 'Administrador', sub: 'Usuarios, naves, respaldo, incentivos y costos', items: [
        { h: 'Usuarios', b: '<p>En <b>Administración → Usuarios</b> creas cuentas con correo y contraseña temporal, eliges el rol y las naves. Desactivar no borra nada. El nombre corto del técnico debe ser igual al de las OTs.</p>', ir: [['admin.html#usuarios', 'Abrir Usuarios']] },
        { h: 'Naves, áreas y líneas', b: '<p>Nave → áreas → líneas. Nada se borra: lo inactivo deja de salir para registros nuevos. Al renombrar, los registros viejos siguen contando.</p>', ir: [['admin.html#naves', 'Abrir Naves']] },
        { h: 'Respaldo completo', b: '<p>Descarga un archivo .json con toda la base de datos una vez por semana o por mes, y guárdalo fuera del celular. <b>¿Cuánto cuesta?</b> te dice cuántas lecturas usa.</p>', ir: [['admin.html#respaldo', 'Abrir Respaldo']] },
        { h: 'Incentivos', b: '<p>La semana se calcula sola con checklists a tiempo, OTs a tiempo, respuesta a avisos y calidad. Revisa, pon ajustes con motivo, aprueba, marca pagada y saca el <b>Reporte para pago</b>.</p>', ir: [['incentivos.html', 'Abrir Incentivos']] },
        { h: 'Rentabilidad', b: '<p>Costo de mantener cada máquina (técnico, operador detenido, arranques y repuestos) y el RAV comparado con una nueva. Carga los costos de repuestos y el precio de las máquinas.</p>', ir: [['rentabilidad.html', 'Abrir Rentabilidad']] },
        { h: 'Clave de eliminación', b: '<p>Borrar equipos o repuestos pide una clave, la misma en todos los celulares. Se crea en <b>Almacén</b> o en <b>Equipos</b>.</p>' },
        { h: 'Uso del plan gratis', b: '<p>En <b>Administración → Uso</b> ves el espacio y los límites diarios de Firebase. Sin pago: si un día se pasan, Firebase responde al día siguiente.</p>' },
      ] },
      { id: 'sec-nave-nueva', roles: 'ADMINISTRADOR', solo: 'ADMINISTRADOR', ic: 'hardhat', t: 'Abrir una nave nueva', sub: '8 pasos en orden. El progreso se guarda en este celular.', pasos: [
        { k: 'nave', h: '1. Crear la nave', b: '<p><b>Administración → Naves → Nueva nave</b>. Pon el nombre y, si quieres, su Encargado.</p>', ir: [['admin.html#naves', 'Ir a Naves']] },
        { k: 'areas', h: '2. Crear las áreas', b: '<p>En la tarjeta de la nave toca <b>+ Área</b> por cada área.</p>', ir: [['admin.html#naves', 'Ir a Naves']] },
        { k: 'lineas', h: '3. Crear las líneas', b: '<p>Dentro de cada área toca <b>+ Línea</b>.</p>', ir: [['admin.html#naves', 'Ir a Naves']] },
        { k: 'equipos', h: '4. Cargar los equipos', b: '<p>En <b>Equipos → Catálogo</b>: <b>Agregar equipo</b> o <b>Carga masiva</b> desde Excel, con su planta, área y línea.</p>', ir: [['hoja-vida.html#catalogo', 'Ir al Catálogo']] },
        { k: 'qr', h: '5. Imprimir y pegar los QR', b: '<p>En <b>Etiquetas QR</b> elige los equipos e imprime. Pega cada etiqueta en su máquina, a la vista del operador.</p>', ir: [['etiquetas-qr.html', 'Ir a Etiquetas QR']] },
        { k: 'usuarios', h: '6. Crear los usuarios con su nave', b: '<p>Técnicos, supervisor, encargado, operadores y almacén, con esta nave marcada.</p>', ir: [['admin.html#usuarios', 'Ir a Usuarios']] },
        { k: 'checklists', h: '7. Listas de checklist y frecuencias', b: '<p>En <b>Checklist → Ajustes</b>: carga las listas por equipo y configura las frecuencias.</p>', ir: [['checklist.html', 'Ir a Checklist']] },
        { k: 'respaldo', h: '8. Primer respaldo', b: '<p>Con todo cargado, descarga el primer respaldo y guárdalo fuera del celular.</p>', ir: [['admin.html#respaldo', 'Ir a Respaldo']] },
      ] },
      { id: 'sec-faq', roles: '', ic: 'help', t: 'Preguntas frecuentes', sub: 'Costos, instalar, contraseña', items: [
        { h: '¿Cuánto cuesta?', b: '<p>Nada. La app usa el plan gratis de Firebase: 50 000 lecturas, 20 000 escrituras y 20 000 borrados al día para toda la empresa, y 1 GiB de espacio.</p>' },
        { h: '¿Cómo actualizo la app?', b: '<p>Ciérrala del todo y ábrela otra vez con señal. A veces hay que hacerlo dos veces.</p>' },
        { h: '¿Cómo la pongo en el celular?', b: '<p><b>Android (Chrome)</b>: menú ⋮ → Agregar a pantalla de inicio. <b>iPhone (Safari)</b>: Compartir → En la pantalla de inicio.</p>' },
        { h: 'Olvidé mi contraseña', b: '<p>En la pantalla de entrada escribe tu correo y toca <b>Olvidé mi contraseña</b>. Te llega un correo. O pídeselo al Administrador.</p>' },
      ] },
    ],
  };
  // ═════════════════════════ ENGLISH ═════════════════════════
  G.en = {
    ui: { titulo: 'Guide', intro: 'What each person does in the app. Your part comes first. Tap a title to open it.', buscarPh: 'Search: QR, spare part, plant, hours…', buscarAria: 'Search the guide', limpiar: 'Clear search',
      sinRes: 'Nothing found for that word. Try another: alert, hours, storeroom.', res1: '{n} result in {s} section', resN: '{n} results in {s} sections', tuRol: 'Your role', imprimir: 'Print', volver: 'Back', volverRep: 'Report',
      pie: 'Maintenance 2026 · VoidTech · The guide works offline once opened.', nnNave: 'Plant:', nnPh: 'New plant name (e.g. PLANT 2)', nnPasos: '{n} of {t} steps', nnLista: 'Plant ready', nnEscribe: 'Type the plant name to tick the steps.',
      nnReset: 'Start this plant over', nnConfirm: 'Untick every step of "{n}"? Only on this device; nothing changes in the app.', nnPaso: 'Step {n} done', ir: 'Open' },
    secs: [
      { id: 'sec-todos', roles: '', ic: 'grid', t: 'The basics', sub: 'For everyone: menu, search, QR, language, offline', items: [
        { h: 'Today', b: '<p>When you sign in you see <b>Today</b>: only what is yours, most urgent first (stopped machines, dated jobs, overdue checklists, requests).</p>', ir: [['index.html', 'Open Today']] },
        { h: 'Getting around', b: '<p>The bottom bar has your screens. The centre button <span class="k">+</span> scans a machine, reports a fault, logs a job or starts a checklist. <b>More</b> has every screen for your role, language, theme and Sign out.</p>' },
        { h: 'Search', b: '<p>The magnifier at the top finds machines, work orders (by folio, e.g. OT-0123), spare parts and screens. Typing uses no data.</p>' },
        { h: 'Scan the machine QR', b: '<p>Tap <span class="k">+</span> → <b>Scan machine</b> and point at the QR. The right screen opens: Equipment 360 for technicians, Report for operators. If the camera does not work, type the name or code.</p>' },
        { h: 'Language and theme', b: '<p>In <b>More</b> choose Español, English or Türkçe, and the theme: Light, Dark, <b>Sun</b> (high contrast for bright plants or outdoors) or Auto. Text people type keeps its language; tap <span class="k">Translate</span> to read it in yours.</p>' },
        { h: 'No signal', b: '<p>The top bar shows <b>Online</b>, <b>Saving…</b> or <b>Offline</b>, plus the changes still to upload. Keep working offline: what you save uploads by itself when signal returns. Do not enter it twice.</p>' },
        { h: 'Undo and help', b: '<p>Some actions can be undone: the notice at the bottom shows <span class="k">Undo</span> for a few seconds. The <span class="k">?</span> button next to a title explains what it is for.</p>' },
      ] },
      { id: 'sec-operador', roles: 'OPERADOR', ic: 'siren', t: 'Operator (production)', sub: 'Report a fault or request a project', items: [
        { h: 'Report a fault', b: '<ol><li>Find the machine and tap it (or scan its QR).</li><li>Choose <span class="k">Machine fault</span>.</li><li>Say whether it is stopped and since when.</li><li>Write what looks, sounds or feels odd.</li><li>Choose how urgent it is and tap <span class="k">Send report</span>.</li></ol><p>Technicians get the alert right away.</p>', ir: [['reportar.html', 'Open Report']] },
        { h: 'Fault or project?', b: '<p><b>Fault</b>: the machine has a problem now; it is handled right away. <b>Project / improvement</b>: something to do without hurry; the Maintenance manager sets technician and date.</p>' },
        { h: 'Follow your report', b: '<p>Tap <b>My reports</b> in the bottom bar. It updates by itself: waiting for a technician, in progress, solved or project (each with its own icon and colour).</p>', ir: [['reportar.html#estado', 'See my reports']] },
        { h: 'Do not send the same report twice', b: '<p>If the machine already has an open report, the app tells you. Check its status before sending another.</p>' },
      ] },
      { id: 'sec-tecnico', roles: 'TECNICO', ic: 'wrench', t: 'Technician', sub: 'Alerts, jobs, checklists, spare parts and tools', items: [
        { h: 'First: turn on alerts', b: '<p>In <b>Work → Alerts</b> tap <span class="k">Turn on sound and notifications</span>. Do it once on each phone.</p>', ir: [['bitacora.html#avisos', 'Open Alerts']] },
        { h: 'Handle an alert', b: '<ol><li>Tap <span class="k">I’ll handle it</span>: it goes under your name and production sees you are coming.</li><li>If you cannot go on, tap <span class="k">Release</span>.</li><li>When finished tap <span class="k">Done — log WO</span>. The form opens with the machine and times filled in.</li><li>Write the solution and tap <span class="k">Save</span>.</li></ol>' },
        { h: 'Log a job', b: '<p><span class="k">+</span> → <b>Log work</b>. Choose the machine, the type (corrective, preventive, predictive or project), fault and solution, the times (<b>Stopped</b>, <b>Arrived</b>, <b>Finished</b>; the <span class="k">Now</span> button fills the time in one tap), technicians, tools and spare parts.</p>', ir: [['bitacora.html#nuevo', 'Open New']] },
        { h: 'Safety before you start (LOTO)', b: '<p>If you will put your hands in or remove guards, the app asks for lockout: steps, energy sources, padlock and PPE. On A · Critical machines it is required. Special-risk jobs (height, confined space, hot work, live electrical) wait for the supervisor’s authorization.</p>' },
        { h: 'Assigned jobs', b: '<p><b>Work → Assigned</b> has the jobs the Maintenance manager scheduled for you. Tap <span class="k">Log</span>, finish and save: it goes to review. If it comes back as <b>Returned</b>, read the note, fix it and save again.</p>', ir: [['bitacora.html#asignados', 'Open Assigned']] },
        { h: 'Do a checklist', b: '<p><b>Checklist → Today</b> lists your machines. Mark each point (OK, Not OK, N/A, Not inspected) and save. Each Not OK point creates a work order to schedule.</p>', ir: [['checklist.html', 'Open Checklist']] },
        { h: 'Request spare parts', b: '<p>In the job form, under <b>Spare parts</b>, choose <span class="k">With spare parts</span>, type the part and quantity, and tap <span class="k">+ Request from storeroom</span>. The storeroom delivers or rejects it.</p>' },
        { h: 'Equipment 360', b: '<p>Scan the QR or search the machine: you see whether it is stopped, its last job, checklist, pending work, LOTO, RCAs and trends, plus buttons to act.</p>', ir: [['hoja-vida.html', 'Open Assets']] },
        { h: 'Tools in your custody', b: '<p>When a tool is issued to you, confirm it in <b>Tools → My tools</b>. You also give your agreement on tool audits.</p>' },
        { h: 'Root cause analysis (RCA)', b: '<p>If a fault repeats, the app asks for the 5 whys, cause type, action, owner and due date. Without it the supervisor cannot validate.</p>' },
      ] },
      { id: 'sec-supervisor', roles: 'SUPERVISOR,ENCARGADO_MANTENIMIENTO', ic: 'clipboard-check', t: 'Supervisor and Maintenance manager', sub: 'Authorize, schedule, validate and measure', items: [
        { h: 'Authorize permits', b: '<p><b>Work → Alerts</b> shows special-risk work permits. Review and tap <span class="k">Authorize</span> or <span class="k">Reject</span> (with a note). Someone else authorizes your own permit.</p>' },
        { h: 'Schedule (Maintenance manager)', b: '<p><b>Work → To plan</b> has checklist faults and projects. Choose technician and date and tap <span class="k">Schedule</span>.</p>', ir: [['bitacora.html#planificar', 'Open To plan']] },
        { h: 'Validate', b: '<p>In <b>Work → To validate</b> review what the technician logged: <span class="k">Good and valid</span> or <span class="k">Not finished</span> with a note on what is missing.</p>', ir: [['bitacora.html#validar', 'Open To validate']] },
        { h: 'Machine criticality', b: '<p>In <b>Assets → Catalog → Assess criticality</b> answer 5 questions per machine: A · Critical, B · Important or C · Normal. Critical machines come first in Alerts and always need LOTO.</p>' },
        { h: 'Analysis', b: '<p><b>Summary</b>: MTBF, MTTR, availability, backlog and compliance. <b>Machines</b>: risk and prediction per machine. <b>Reliability</b>: RCA, trends and safety. <b>People and plants</b>: technicians and comparison. Everything follows the filters and exports to Excel.</p>', ir: [['analisis.html', 'Open Analysis']] },
        { h: 'Checklist points and frequencies', b: '<p>In <b>Checklist → Settings</b> change frequencies (days or hour meter) and each machine’s own points, also by bulk upload from Excel.</p>' },
        { h: 'CAPEX (Maintenance manager)', b: '<p>Investment projects: draft, submit, Administrator approval, spend and close. Create one from Equipment 360 or from CAPEX.</p>', ir: [['capex.html', 'Open CAPEX']] },
      ] },
      { id: 'sec-almacen', roles: 'ALMACEN', ic: 'package', t: 'Storeroom', sub: 'Requests, stock, movements and purchasing', items: [
        { h: 'Handle requests', b: '<p><b>Storeroom → Requests</b> has the spare parts technicians ask for. Tap <span class="k">Deliver</span> or <span class="k">Reject</span> (with the reason). The technician sees the status on the job.</p>', ir: [['almacen.html#solicitudes', 'Open Requests']] },
        { h: 'Stock in and out', b: '<p>In <b>Spare parts</b>, open the machine and use the in and out buttons of each part. Enter the WO folio when the part goes to a job, so its cost is counted.</p>' },
        { h: 'Purchasing', b: '<p><b>Purchasing</b> lists what is out of stock or below minimum. Export the shopping list to Excel.</p>' },
        { h: 'Tools', b: '<p>Issue tools to technicians, record returns and run audits. The technician confirms with their user.</p>', ir: [['herramientas.html', 'Open Tools']] },
      ] },
      { id: 'sec-rrhh', roles: 'RRHH', ic: 'users', t: 'Human Resources', sub: 'Tool charges', items: [
        { h: 'Charges to send and to deduct', b: '<p><b>Tools → Human Resources</b> receives charges from audits with missing or damaged tools, with the record and the technician’s agreement.</p>', ir: [['herramientas.html#rrhh', 'Open charges']] },
        { h: 'Mark as deducted', b: '<p>When it is applied in payroll, tap <span class="k">Mark as deducted</span> and write how (e.g. payroll 15/10, 2 instalments). If it does not apply, <span class="k">Cancel charge</span>.</p>' },
        { h: 'Export', b: '<p>Download the charges as CSV for payroll.</p>' },
      ] },
      { id: 'sec-admin', roles: 'ADMINISTRADOR', ic: 'settings', t: 'Administrator', sub: 'Users, plants, backup, incentives and costs', items: [
        { h: 'Users', b: '<p>In <b>Administration → Users</b> create accounts with email and a temporary password, and choose role and plants. Deactivating deletes nothing. The technician’s short name must match the one on work orders.</p>', ir: [['admin.html#usuarios', 'Open Users']] },
        { h: 'Plants, areas and lines', b: '<p>Plant → areas → lines. Nothing is deleted: inactive items stop showing for new records. After a rename, old records still count.</p>', ir: [['admin.html#naves', 'Open Plants']] },
        { h: 'Full backup', b: '<p>Download a .json file with the whole database once a week or month and keep it off the phone. <b>How much does it cost?</b> tells you how many reads it uses.</p>', ir: [['admin.html#respaldo', 'Open Backup']] },
        { h: 'Incentives', b: '<p>The week is calculated from on-time checklists, on-time work orders, alert response and quality. Review, add adjustments with a reason, approve, mark paid and print the <b>Payment report</b>.</p>', ir: [['incentivos.html', 'Open Incentives']] },
        { h: 'Profitability', b: '<p>The cost of keeping each machine (technician, idle operator, restarts and spare parts) and RAV against a new one. Load spare part costs and machine prices.</p>', ir: [['rentabilidad.html', 'Open Profitability']] },
        { h: 'Deletion PIN', b: '<p>Deleting machines or spare parts asks for a PIN, the same on every device. Create it in <b>Storeroom</b> or <b>Assets</b>.</p>' },
        { h: 'Free plan usage', b: '<p><b>Administration → Usage</b> shows storage and Firebase’s daily limits. Nothing is paid: if a limit is exceeded, Firebase answers again the next day.</p>' },
      ] },
      { id: 'sec-nave-nueva', roles: 'ADMINISTRADOR', solo: 'ADMINISTRADOR', ic: 'hardhat', t: 'Open a new plant', sub: '8 steps in order. Progress is saved on this device.', pasos: [
        { k: 'nave', h: '1. Create the plant', b: '<p><b>Administration → Plants → New plant</b>. Enter the name and, if you want, its Maintenance manager.</p>', ir: [['admin.html#naves', 'Go to Plants']] },
        { k: 'areas', h: '2. Create the areas', b: '<p>On the plant card tap <b>+ Area</b> for each area.</p>', ir: [['admin.html#naves', 'Go to Plants']] },
        { k: 'lineas', h: '3. Create the lines', b: '<p>Inside each area tap <b>+ Line</b>.</p>', ir: [['admin.html#naves', 'Go to Plants']] },
        { k: 'equipos', h: '4. Load the machines', b: '<p>In <b>Assets → Catalog</b>: <b>Add machine</b> or <b>Bulk upload</b> from Excel, with plant, area and line.</p>', ir: [['hoja-vida.html#catalogo', 'Go to Catalog']] },
        { k: 'qr', h: '5. Print and stick the QR labels', b: '<p>In <b>QR labels</b> choose the machines and print. Stick each label on its machine where the operator can see it.</p>', ir: [['etiquetas-qr.html', 'Go to QR labels']] },
        { k: 'usuarios', h: '6. Create users with their plant', b: '<p>Technicians, supervisor, maintenance manager, operators and storeroom, with this plant ticked.</p>', ir: [['admin.html#usuarios', 'Go to Users']] },
        { k: 'checklists', h: '7. Checklist lists and frequencies', b: '<p>In <b>Checklist → Settings</b>: upload the lists per machine and set the frequencies.</p>', ir: [['checklist.html', 'Go to Checklist']] },
        { k: 'respaldo', h: '8. First backup', b: '<p>With everything loaded, download the first backup and keep it off the phone.</p>', ir: [['admin.html#respaldo', 'Go to Backup']] },
      ] },
      { id: 'sec-faq', roles: '', ic: 'help', t: 'Frequent questions', sub: 'Cost, install, password', items: [
        { h: 'How much does it cost?', b: '<p>Nothing. The app uses Firebase’s free plan: 50,000 reads, 20,000 writes and 20,000 deletes per day for the whole company, and 1 GiB of storage.</p>' },
        { h: 'How do I update the app?', b: '<p>Close it completely and open it again with signal. Sometimes you need to do it twice.</p>' },
        { h: 'How do I put it on my phone?', b: '<p><b>Android (Chrome)</b>: menu ⋮ → Add to Home screen. <b>iPhone (Safari)</b>: Share → Add to Home Screen.</p>' },
        { h: 'I forgot my password', b: '<p>On the sign-in screen type your email and tap <b>I forgot my password</b>. You will get an email. Or ask the Administrator.</p>' },
      ] },
    ],
  };
  // ═════════════════════════ TÜRKÇE ═════════════════════════
  G.tr = {
    ui: { titulo: 'Kılavuz', intro: 'Uygulamada herkesin yaptığı işler. Sizin bölümünüz ilk sırada. Açmak için bir başlığa dokunun.', buscarPh: 'Ara: QR, yedek parça, tesis, saat…', buscarAria: 'Kılavuzda ara', limpiar: 'Aramayı temizle',
      sinRes: 'Bu kelimeyle bir şey bulunamadı. Başka birini deneyin: uyarı, saat, depo.', res1: '{s} bölümde {n} sonuç', resN: '{s} bölümde {n} sonuç', tuRol: 'Rolünüz', imprimir: 'Yazdır', volver: 'Geri', volverRep: 'Bildir',
      pie: 'Bakım 2026 · VoidTech · Kılavuz bir kez açıldıktan sonra çevrimdışı çalışır.', nnNave: 'Tesis:', nnPh: 'Yeni tesisin adı (örn. TESİS 2)', nnPasos: '{t} adımdan {n}', nnLista: 'Tesis hazır', nnEscribe: 'Adımları işaretlemek için tesisin adını yazın.',
      nnReset: 'Bu tesise baştan başla', nnConfirm: '"{n}" için tüm adımların işareti kaldırılsın mı? Yalnızca bu cihazda; uygulamada hiçbir şey değişmez.', nnPaso: '{n}. adım tamam', ir: 'Aç' },
    secs: [
      { id: 'sec-todos', roles: '', ic: 'grid', t: 'Temel bilgiler', sub: 'Herkes için: menü, arama, QR, dil, çevrimdışı', items: [
        { h: 'Bugün', b: '<p>Girişte <b>Bugün</b> ekranını görürsünüz: yalnızca size ait olanlar, en acili üstte (duran makineler, tarihli işler, gecikmiş kontrol listeleri, talepler).</p>', ir: [['index.html', 'Bugün’ü aç']] },
        { h: 'Uygulamada gezinme', b: '<p>Alttaki çubukta ekranlarınız var. Ortadaki <span class="k">+</span> düğmesiyle makine tarar, arıza bildirir, iş kaydeder veya kontrol listesi başlatırsınız. <b>Daha fazla</b> menüsünde rolünüzün tüm ekranları, dil, tema ve Çıkış bulunur.</p>' },
        { h: 'Arama', b: '<p>Üstteki büyüteç makineleri, iş emirlerini (fiş numarasıyla, örn. OT-0123), yedek parçaları ve ekranları bulur. Yazarken veri harcamaz.</p>' },
        { h: 'Makinenin QR kodunu tarama', b: '<p><span class="k">+</span> → <b>Makineyi tara</b>’ya dokunup QR koduna tutun. Size uygun ekran açılır: teknisyen için Ekipman 360, operatör için Bildir. Kamera çalışmazsa adı veya kodu yazın.</p>' },
        { h: 'Dil ve tema', b: '<p><b>Daha fazla</b> menüsünden Español, English veya Türkçe’yi ve temayı seçin: Açık, Koyu, <b>Güneş</b> (çok aydınlık tesis veya açık alan için yüksek kontrast) ya da Otomatik. Kişilerin yazdığı metinler kendi dilinde kalır; kendi dilinizde okumak için <span class="k">Çevir</span>’e dokunun.</p>' },
        { h: 'Sinyal yokken', b: '<p>Üstte durum görünür: <b>Bağlı</b>, <b>Kaydediliyor…</b> veya <b>Çevrimdışı</b>, ayrıca gönderilmeyi bekleyen değişiklik sayısı. Sinyal yokken çalışmaya devam edin: kaydettikleriniz sinyal gelince kendiliğinden gönderilir. İki kez girmeyin.</p>' },
        { h: 'Geri alma ve yardım', b: '<p>Bazı işlemler geri alınabilir: alttaki bildirimde birkaç saniye <span class="k">Geri al</span> düğmesi çıkar. Başlığın yanındaki <span class="k">?</span> düğmesi neye yaradığını açıklar.</p>' },
      ] },
      { id: 'sec-operador', roles: 'OPERADOR', ic: 'siren', t: 'Operatör (üretim)', sub: 'Arıza bildirme veya proje isteme', items: [
        { h: 'Arıza bildirme', b: '<ol><li>Makineyi bulup dokunun (veya QR kodunu tarayın).</li><li><span class="k">Makine arızası</span>’nı seçin.</li><li>Durup durmadığını ve saat kaçtan beri olduğunu belirtin.</li><li>Tuhaf görünen, duyulan veya hissedileni yazın.</li><li>Ne kadar acil olduğunu seçip <span class="k">Bildirimi gönder</span>’e dokunun.</li></ol><p>Teknisyenler uyarıyı anında alır.</p>', ir: [['reportar.html', 'Bildir’i aç']] },
        { h: 'Arıza mı, proje mi?', b: '<p><b>Arıza</b>: makinede şu an sorun var; hemen ilgilenilir. <b>Proje / iyileştirme</b>: acele etmeden yapılacak bir iş; Bakım sorumlusu teknisyen ve tarih belirler.</p>' },
        { h: 'Bildiriminizi izleme', b: '<p>Alttaki çubukta <b>Raporlarım</b>’a dokunun. Kendiliğinden güncellenir: teknisyen bekleniyor, müdahale ediliyor, çözüldü veya proje (her birinin kendi simgesi ve rengi var).</p>', ir: [['reportar.html#estado', 'Raporlarımı gör']] },
        { h: 'Aynı bildirimi iki kez göndermeyin', b: '<p>Makinenin açık bir bildirimi varsa uygulama size söyler. Yenisini göndermeden önce durumuna bakın.</p>' },
      ] },
      { id: 'sec-tecnico', roles: 'TECNICO', ic: 'wrench', t: 'Teknisyen', sub: 'Uyarılar, işler, kontrol listeleri, yedek parça ve aletler', items: [
        { h: 'Önce uyarıları açın', b: '<p><b>İşler → Uyarılar</b>’da <span class="k">Ses ve bildirimleri aç</span>’a dokunun. Her telefonda bir kez yapılır.</p>', ir: [['bitacora.html#avisos', 'Uyarıları aç']] },
        { h: 'Bir uyarıyla ilgilenme', b: '<ol><li><span class="k">Ben ilgileniyorum</span>’a dokunun: uyarı sizin adınıza geçer ve üretim yolda olduğunuzu görür.</li><li>Devam edemezseniz <span class="k">Bırak</span>’a dokunun.</li><li>Bitince <span class="k">Bitti — iş emrini kaydet</span>’e dokunun. Form makine ve saatler dolu olarak açılır.</li><li>Çözümü yazıp <span class="k">Kaydet</span>’e dokunun.</li></ol>' },
        { h: 'İş kaydetme', b: '<p><span class="k">+</span> → <b>İş kaydet</b>. Makineyi, türü (düzeltici, önleyici, kestirimci veya proje), arızayı ve çözümü, saatleri (<b>Durdu</b>, <b>Geldi</b>, <b>Bitti</b>; <span class="k">Şimdi</span> düğmesi saati tek dokunuşla girer), teknisyenleri, aletleri ve yedek parçaları seçin.</p>', ir: [['bitacora.html#nuevo', 'Yeni’yi aç']] },
        { h: 'Başlamadan önce güvenlik (LOTO)', b: '<p>Elinizi sokacak veya muhafaza çıkaracaksanız uygulama kilitleme ister: adımlar, enerji kaynakları, kilit ve KKD. A · Kritik ekipmanlarda zorunludur. Özel riskli işler (yüksekte, kapalı alanda, sıcak çalışma, enerjili elektrik) süpervizör onayını bekler.</p>' },
        { h: 'Atanan işler', b: '<p><b>İşler → Atananlar</b>’da Bakım sorumlusunun size tarihle planladığı işler var. <span class="k">Kaydet</span>’e dokunun, işi bitirip kaydedin: incelemeye gider. <b>Geri gönderildi</b> olarak dönerse notu okuyun, düzeltip yeniden kaydedin.</p>', ir: [['bitacora.html#asignados', 'Atananları aç']] },
        { h: 'Kontrol listesi yapma', b: '<p><b>Kontrol listesi → Bugün</b>’de sırası gelen ekipmanlar var. Her noktayı işaretleyin (Uygun, Uygun değil, Uygulanmaz, Denetlenmedi) ve kaydedin. Her Uygun değil noktası planlanacak bir iş emri açar.</p>', ir: [['checklist.html', 'Kontrol listesini aç']] },
        { h: 'Yedek parça isteme', b: '<p>İş formunda <b>Yedek parçalar</b> bölümünde <span class="k">Yedek parçalı</span>’yı seçin, parçayı ve miktarı yazıp <span class="k">+ Depodan iste</span>’ye dokunun. Depo teslim eder veya reddeder.</p>' },
        { h: 'Ekipman 360', b: '<p>QR kodunu tarayın veya makineyi arayın: durup durmadığını, son işini, kontrol listesini, bekleyen işleri, LOTO’yu, RCA’ları ve eğilimleri ve işlem düğmelerini görürsünüz.</p>', ir: [['hoja-vida.html', 'Ekipmanları aç']] },
        { h: 'Zimmetinizdeki aletler', b: '<p>Size bir alet teslim edildiğinde <b>Aletler → Aletlerim</b>’de onaylayın. Alet sayımlarında da onayınızı verirsiniz.</p>' },
        { h: 'Kök neden analizi (RCA)', b: '<p>Bir arıza tekrarlarsa uygulama 5 Neden’i, neden türünü, işlemi, sorumluyu ve tarihi ister. Bu olmadan süpervizör onaylayamaz.</p>' },
      ] },
      { id: 'sec-supervisor', roles: 'SUPERVISOR,ENCARGADO_MANTENIMIENTO', ic: 'clipboard-check', t: 'Süpervizör ve Bakım sorumlusu', sub: 'Onaylama, planlama, doğrulama ve ölçme', items: [
        { h: 'İzinleri onaylama', b: '<p><b>İşler → Uyarılar</b>’da özel riskli iş izinleri çıkar. İnceleyip <span class="k">Onayla</span> veya <span class="k">Reddet</span>’e (notla) dokunun. Kendi izninizi başka biri onaylar.</p>' },
        { h: 'Planlama (Bakım sorumlusu)', b: '<p><b>İşler → Planlanacak</b>’ta kontrol listesi arızaları ve projeler var. Teknisyen ve tarih seçip <span class="k">Planla</span>’ya dokunun.</p>', ir: [['bitacora.html#planificar', 'Planlanacakları aç']] },
        { h: 'Onaylama', b: '<p><b>İşler → Onaylanacak</b>’ta teknisyenin kaydettiğini inceleyin: <span class="k">İyi ve geçerli</span> veya eksikleri yazan bir notla <span class="k">Tamamlanmadı</span>.</p>', ir: [['bitacora.html#validar', 'Onaylanacakları aç']] },
        { h: 'Ekipman kritikliği', b: '<p><b>Ekipman → Katalog → Kritikliği değerlendir</b>’de her ekipman için 5 soruyu yanıtlayın: A · Kritik, B · Önemli veya C · Normal. Kritik ekipmanlar Uyarılarda ilk sıradadır ve her zaman LOTO gerektirir.</p>' },
        { h: 'Analiz', b: '<p><b>Özet</b>: MTBF, MTTR, kullanılabilirlik, bekleyen iş ve uyum. <b>Ekipmanlar</b>: makine bazında risk ve tahmin. <b>Güvenilirlik</b>: RCA, eğilimler ve güvenlik. <b>Kişiler ve tesisler</b>: teknisyenler ve karşılaştırma. Hepsi filtrelere uyar ve Excel’e aktarılır.</p>', ir: [['analisis.html', 'Analizi aç']] },
        { h: 'Kontrol noktaları ve sıklıklar', b: '<p><b>Kontrol listesi → Ayarlar</b>’da sıklıkları (gün veya saat sayacı) ve her ekipmanın kendi noktalarını, Excel’den toplu yüklemeyle de değiştirebilirsiniz.</p>' },
        { h: 'CAPEX (Bakım sorumlusu)', b: '<p>Yatırım projeleri: taslak, gönderme, Yönetici onayı, harcamalar ve kapanış. Ekipman 360’tan veya CAPEX’ten oluşturulur.</p>', ir: [['capex.html', 'CAPEX’i aç']] },
      ] },
      { id: 'sec-almacen', roles: 'ALMACEN', ic: 'package', t: 'Depo', sub: 'Talepler, stok, hareketler ve satın alma', items: [
        { h: 'Talepleri karşılama', b: '<p><b>Depo → Talepler</b>’de teknisyenlerin istediği yedek parçalar var. <span class="k">Teslim et</span> veya gerekçesiyle <span class="k">Reddet</span>’e dokunun. Teknisyen durumu işinde görür.</p>', ir: [['almacen.html#solicitudes', 'Talepleri aç']] },
        { h: 'Giriş ve çıkış', b: '<p><b>Yedek parçalar</b>’da makineyi açıp her parçanın giriş ve çıkış düğmelerini kullanın. Çıkış bir iş içinse iş emri fiş numarasını yazın; böylece maliyeti hesaplanır.</p>' },
        { h: 'Satın alma', b: '<p><b>Satın alma</b> stokta olmayanları veya minimumun altındakileri listeler. Satın alma listesini Excel’e aktarın.</p>' },
        { h: 'Aletler', b: '<p>Teknisyenlere alet teslim edin, iadeleri kaydedin ve sayım yapın. Teknisyen kendi kullanıcısıyla onaylar.</p>', ir: [['herramientas.html', 'Aletleri aç']] },
      ] },
      { id: 'sec-rrhh', roles: 'RRHH', ic: 'users', t: 'İnsan Kaynakları', sub: 'Alet kesintileri', items: [
        { h: 'Gönderilecek ve kesilecek kesintiler', b: '<p><b>Aletler → İnsan Kaynakları</b>’na eksik veya hasarlı alet çıkan sayımların kesintileri, tutanak ve teknisyen onayıyla birlikte gelir.</p>', ir: [['herramientas.html#rrhh', 'Kesintileri aç']] },
        { h: 'Kesildi olarak işaretleme', b: '<p>Bordroya yansıtıldığında <span class="k">Kesildi olarak işaretle</span>’ye dokunup nasıl uygulandığını yazın (örn. 15/10 bordrosu, 2 taksit). Uygun değilse <span class="k">Kesintiyi iptal et</span>.</p>' },
        { h: 'Dışa aktarma', b: '<p>Kesintileri bordro için CSV olarak indirin.</p>' },
      ] },
      { id: 'sec-admin', roles: 'ADMINISTRADOR', ic: 'settings', t: 'Yönetici', sub: 'Kullanıcılar, tesisler, yedek, teşvikler ve maliyetler', items: [
        { h: 'Kullanıcılar', b: '<p><b>Yönetim → Kullanıcılar</b>’da e-posta ve geçici şifreyle hesap oluşturup rolü ve tesisleri seçersiniz. Devre dışı bırakmak hiçbir şeyi silmez. Teknisyenin kısa adı iş emirlerindekiyle aynı olmalıdır.</p>', ir: [['admin.html#usuarios', 'Kullanıcıları aç']] },
        { h: 'Tesisler, alanlar ve hatlar', b: '<p>Tesis → alanlar → hatlar. Hiçbir şey silinmez: pasif olanlar yeni kayıtlarda görünmez. Yeniden adlandırmadan sonra eski kayıtlar sayılmaya devam eder.</p>', ir: [['admin.html#naves', 'Tesisleri aç']] },
        { h: 'Tam yedek', b: '<p>Haftada veya ayda bir tüm veritabanının .json dosyasını indirip telefon dışında saklayın. <b>Maliyeti ne kadar?</b> kaç okuma kullanacağını söyler.</p>', ir: [['admin.html#respaldo', 'Yedeği aç']] },
        { h: 'Teşvikler', b: '<p>Hafta; zamanında kontrol listeleri, zamanında iş emirleri, uyarı yanıtı ve kaliteye göre kendiliğinden hesaplanır. İnceleyin, gerekçeli düzeltme ekleyin, onaylayın, ödendi olarak işaretleyin ve <b>Ödeme raporu</b>’nu alın.</p>', ir: [['incentivos.html', 'Teşvikleri aç']] },
        { h: 'Kârlılık', b: '<p>Her makinenin bakım maliyeti (teknisyen, bekleyen operatör, yeniden başlatmalar ve yedek parçalar) ve yenisine göre RAV. Yedek parça maliyetlerini ve makine fiyatlarını yükleyin.</p>', ir: [['rentabilidad.html', 'Kârlılığı aç']] },
        { h: 'Silme şifresi', b: '<p>Ekipman veya yedek parça silmek tüm cihazlarda aynı olan bir şifre ister. <b>Depo</b> veya <b>Ekipman</b> ekranında oluşturulur.</p>' },
        { h: 'Ücretsiz plan kullanımı', b: '<p><b>Yönetim → Kullanım</b>’da alanı ve Firebase’in günlük sınırlarını görürsünüz. Ödeme yok: bir sınır aşılırsa Firebase ertesi gün yeniden yanıt verir.</p>' },
      ] },
      { id: 'sec-nave-nueva', roles: 'ADMINISTRADOR', solo: 'ADMINISTRADOR', ic: 'hardhat', t: 'Yeni tesis açma', sub: 'Sırayla 8 adım. İlerleme bu cihaza kaydedilir.', pasos: [
        { k: 'nave', h: '1. Tesisi oluşturun', b: '<p><b>Yönetim → Tesisler → Yeni tesis</b>. Adını ve isterseniz Bakım sorumlusunu girin.</p>', ir: [['admin.html#naves', 'Tesislere git']] },
        { k: 'areas', h: '2. Alanları oluşturun', b: '<p>Tesis kartında her alan için <b>+ Alan</b>’a dokunun.</p>', ir: [['admin.html#naves', 'Tesislere git']] },
        { k: 'lineas', h: '3. Hatları oluşturun', b: '<p>Her alanın içinde <b>+ Hat</b>’a dokunun.</p>', ir: [['admin.html#naves', 'Tesislere git']] },
        { k: 'equipos', h: '4. Ekipmanları yükleyin', b: '<p><b>Ekipman → Katalog</b>’da: <b>Ekipman ekle</b> veya Excel’den <b>Toplu yükleme</b>; tesis, alan ve hattıyla birlikte.</p>', ir: [['hoja-vida.html#catalogo', 'Kataloğa git']] },
        { k: 'qr', h: '5. QR etiketlerini yazdırıp yapıştırın', b: '<p><b>QR etiketleri</b>’nde ekipmanları seçip yazdırın. Her etiketi operatörün göreceği yere, kendi makinesine yapıştırın.</p>', ir: [['etiquetas-qr.html', 'QR etiketlerine git']] },
        { k: 'usuarios', h: '6. Kullanıcıları tesisleriyle oluşturun', b: '<p>Teknisyenler, süpervizör, bakım sorumlusu, operatörler ve depo; bu tesis işaretli olarak.</p>', ir: [['admin.html#usuarios', 'Kullanıcılara git']] },
        { k: 'checklists', h: '7. Kontrol listeleri ve sıklıklar', b: '<p><b>Kontrol listesi → Ayarlar</b>’da ekipman listelerini yükleyip sıklıkları ayarlayın.</p>', ir: [['checklist.html', 'Kontrol listesine git']] },
        { k: 'respaldo', h: '8. İlk yedek', b: '<p>Her şey yüklendiğinde ilk yedeği indirip telefon dışında saklayın.</p>', ir: [['admin.html#respaldo', 'Yedeğe git']] },
      ] },
      { id: 'sec-faq', roles: '', ic: 'help', t: 'Sık sorulan sorular', sub: 'Maliyet, kurulum, şifre', items: [
        { h: 'Maliyeti ne kadar?', b: '<p>Hiç. Uygulama Firebase’in ücretsiz planını kullanır: tüm şirket için günde 50.000 okuma, 20.000 yazma ve 20.000 silme, ayrıca 1 GiB alan.</p>' },
        { h: 'Uygulamayı nasıl güncellerim?', b: '<p>Tamamen kapatıp sinyal varken yeniden açın. Bazen iki kez yapmak gerekir.</p>' },
        { h: 'Telefona nasıl eklerim?', b: '<p><b>Android (Chrome)</b>: menü ⋮ → Ana ekrana ekle. <b>iPhone (Safari)</b>: Paylaş → Ana Ekrana Ekle.</p>' },
        { h: 'Şifremi unuttum', b: '<p>Giriş ekranında e-postanızı yazıp <b>Şifremi unuttum</b>’a dokunun. Size bir e-posta gelir. Ya da Yöneticiden isteyin.</p>' },
      ] },
    ],
  };
  window.GUIA_CONTENIDO = G;
  // Módulo de frases vacío: i18n.cargar('guia') queda resuelto (la guía trae su propio contenido por idioma).
  (window.__i18nPend = window.__i18nPend || []).push(['@frases', 'guia', [['Guía de inicio — Mantenimiento 2026', 'Guide — Maintenance 2026', 'Kılavuz — Bakım 2026']]]);
  if (window.i18n) window.i18n._drenar();
})();
