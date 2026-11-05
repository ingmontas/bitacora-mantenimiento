# bitacora-mantenimiento
App de mantenimiento VoidTech (español · English · Türkçe). HTML/JS sin compilar, Firebase (Firestore + Auth, plan gratis), GitHub Pages.

## Módulos (v3, nov 2026)
- **Hoy** (`index.html`): lo que toca hoy según el rol. `index.html#todo` = todas las pantallas (los grupos del menú Más).
- **Trabajos** (`bitacora.html`): una sola cola de órdenes de trabajo — Avisos · Asignados · Por planificar · Por validar · Historial · Nuevo (+ Mi semana, Ajustes).
  `checklist.html#ots` lleva a `bitacora.html#planificar`.
- **Checklist** (`checklist.html`): Hoy · Historial · Ajustes.
- **Equipos** (`hoja-vida.html`): lista → Equipo 360 → historial, y el catálogo de equipos (`hoja-vida.html#catalogo`).
- **Almacén** (`almacen.html`): Repuestos · Solicitudes · Movimientos · Compras · Herramientas. `inventario.html` lleva a `almacen.html#repuestos`.
- **Análisis** (`analisis.html`): Resumen · Equipos · Confiabilidad · Personas y naves + Exportar/Datos (los enlaces viejos `#mundial`, `#rca`, `#tend`… siguen sirviendo).
- Incentivos, Rentabilidad, CAPEX, Administración (respaldo completo), Herramientas, Reportar, Guía.

## Archivos compartidos
`app-shell.js` (estructura, lista única de pantallas, candado por rol) · `firebase-init.js` · `filtros.js` (filtros y exportar a Excel/CSV) ·
`kpis.js` (MTBF, MTTR, disponibilidad, backlog, cumplimiento, vencidas, reincidencia) · `catalogo.js` (catálogo de equipos) ·
`ots-cola.js` (OTs por planificar / validar) · `criticidad.js` · `seguridad.js` · `rca.js` · `tendencias.js` · `i18n.js` + `i18n-*` · `icons.js` · `tema.css`.

### Idiomas (v3 etapa 3b)
Las pantallas se escriben en español. `i18n-<pantalla>.js` trae filas `[español, English, Türkçe]` (con `{x}` para valores y `{n}` para números);
`i18n.js` cambia los textos en la pantalla al elegir EN o TR (sin recargar ni leer de Firebase) y los devuelve al volver a ES.
`i18n-compartido.js` = textos de los scripts compartidos; `i18n-guia.js` = la Guía completa en los tres idiomas.
Lo que escribe la gente no se traduce (botón «Traducir»). Prueba: `t_i18n_full.js`.

Al subir cambios, sube también el número de `CACHE` en `sw.js`.

Actualizado 3 nov 2026
