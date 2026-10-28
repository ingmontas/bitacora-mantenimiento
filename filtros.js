// filtros.js — Etapa 3 "Reportes filtrables por áreas" (25 oct 2026)
// ══════════════════════════════════════════════════════════════════════
// 1) Barra de filtros compartida Nave → Área → Línea → Equipo
//    fbFiltroUbicacion({ el, pagina, niveles, extras, onChange }) → control
//     - Nave = la nave elegida arriba (barra de la app): cambiarla aquí es lo
//       mismo que cambiarla arriba (una sola nave elegida en toda la app).
//     - Área, Línea y Equipo salen de las copias que ya están en el celular
//       (/areas, /lineas del Administrador / Bitácora y el catálogo de equipos
//       de 12 h): CERO lecturas de Firestore. Los inactivos salen aparte, en el
//       grupo "(inactivas)", para poder filtrar datos viejos.
//     - Nombres comparados como en la Etapa 2: sin mayúsculas, acentos ni
//       espacios y respetando los nombres anteriores (renombrados).
//     - La última elección se recuerda por pantalla en este celular.
//    control.coincide(registro[, acceso]) → ¿el registro entra en el filtro?
//    Con todo en "Todas/Todos" devuelve SIEMPRE true (nada cambia).
// 2) Exportar a Excel (.xlsx con ExcelJS, que se descarga solo al pedirlo) y,
//    si no se puede cargar (sin señal), ofrece un CSV con lo mismo.
//    fbExportar({ nombre, hojas:[{ nombre, titulo, columnas:[{t, w}], filas }] })
// ══════════════════════════════════════════════════════════════════════
(function () {
  const K = s => fbEquipoKey(s);
  const LS = 'fbFiltro_';
  const porNombre = (a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es', { numeric: true });
  const ka = s => fbClaveNombre('areas', s), kl = s => fbClaveNombre('lineas', s), kp = s => fbClaveNombre('plantas', s);

  function css() {
    if (document.getElementById('fbFiltrosCss')) return;
    const st = document.createElement('style');
    st.id = 'fbFiltrosCss';
    st.textContent = '.fbFiltros{display:flex;flex-wrap:wrap;gap:6px;min-width:0;width:100%;}'
      + '.fbFiltros select{flex:1 1 140px;min-width:0;max-width:100%;width:auto;background:var(--color-input-bg,var(--surface,var(--panel-2,#1A2535)));color:var(--color-text,var(--text,#F1F5F9));border:1px solid var(--color-border,var(--border,var(--line,#2D3F55)));border-radius:8px;padding:8px 10px;font-size:13px;font-family:inherit;}'
      + '.fbFiltros select.on{border-color:var(--color-accent,var(--accent,var(--amber,#F59E0B)));color:var(--color-accent-text,var(--accent,var(--amber,#F59E0B)));background:var(--color-accent-soft,transparent);font-weight:700;}'
      + '.fbFiltros .fbFiltroTxt{flex:1 1 100%;font-size:11px;color:var(--color-muted,var(--muted,#94A3B8));}'
      + '#fbExpDlg{position:fixed;inset:0;z-index:1200;background:var(--color-overlay,rgba(0,0,0,.6));display:flex;align-items:center;justify-content:center;padding:16px;font-family:-apple-system,system-ui,sans-serif;}'
      + '#fbExpDlg>div{background:var(--color-surface,#202F42);border:1px solid var(--color-border,#2D3F55);border-radius:14px;padding:18px;max-width:360px;width:100%;color:var(--color-text,#F1F5F9);font-size:14px;line-height:1.5;}'
      + '#fbExpDlg button{width:100%;margin-top:10px;padding:11px;border-radius:10px;border:0;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit;}';
    document.head.appendChild(st);
  }

  // ── Datos de un registro (OT, checklist, fila de Análisis…) ──
  function accesoDefecto(d) {
    d = d || {};
    return {
      area: d.LINEA_EQUIPO || d.equipoLocalidad || d.localidad || '',
      linea: d.LINEA || d.linea || d.equipoLinea || '',
      equipoId: d.equipoId || '',
      equipo: d.EQUIPO || d.equipoNombre || d.TIPO_MAQUINA || '',
    };
  }
  function equipoIdx(id) { return id ? fbEquiposIndice().find(e => e.id === id) || null : null; }

  // ── Opciones de cada nivel (sin lecturas) ──
  function naveVisible(n) { const f = fbNavesFiltro(); return !f || !n || f.includes(kp(n)); }
  function opcionesAreas(extras) {
    const m = new Map();
    const add = (nombre, nave, activo) => {
      if (!nombre) return; nombre = fbNombreActual('areas', nombre); const k = ka(nombre); if (!k) return;
      const x = m.get(k);
      if (!x) m.set(k, { nombre, nave: nave || '', activo: activo !== false });
      else if (!x.nave && nave) x.nave = nave;
    };
    fbListaNombres('areas').forEach(a => add(a.nombre, a.plantaNombre ? fbNombreActual('plantas', a.plantaNombre) : '', a.activo));
    fbEquiposIndice().forEach(e => add(e.localidad, fbPlantaDeEquipo(e.id), true));
    (extras || []).forEach(a => add(a, fbPlantaDeArea(a), !m.has(ka(a)) ? true : undefined));
    return [...m.values()].filter(a => naveVisible(a.nave)).sort(porNombre);
  }
  function opcionesLineas(area, extras) {
    const m = new Map();
    const add = (nombre, ar, nave, activo) => {
      if (!nombre) return; nombre = fbNombreActual('lineas', nombre); const k = kl(nombre); if (!k) return;
      const x = m.get(k);
      if (!x) m.set(k, { nombre, area: ar ? fbNombreActual('areas', ar) : '', nave: nave || '', activo: activo !== false });
      else { if (!x.area && ar) x.area = fbNombreActual('areas', ar); if (!x.nave && nave) x.nave = nave; }
    };
    fbListaNombres('lineas').forEach(l => add(l.nombre, l.areaNombre, l.plantaNombre ? fbNombreActual('plantas', l.plantaNombre) : '', l.activo));
    fbEquiposIndice().forEach(e => add(e.linea, e.localidad, fbPlantaDeEquipo(e.id), true));
    (extras || []).forEach(l => add(l, '', '', true));
    return [...m.values()].filter(l => {
      if (area) return !!l.area && ka(l.area) === ka(area);
      return naveVisible(l.nave || fbPlantaDeArea(l.area));
    }).sort(porNombre);
  }
  function opcionesEquipos(area, linea) {
    return fbEquiposIndice().filter(e => e.nombre && naveVisible(fbPlantaDeEquipo(e.id))
      && (!area || (e.localidad && ka(e.localidad) === ka(area)))
      && (!linea || (e.linea && kl(e.linea) === kl(linea)))).sort(porNombre);
  }

  function opcionesHtml(lista, valor, todas, etiqueta, valorDe, suelta) {
    const act = lista.filter(x => x.activo !== false), ina = lista.filter(x => x.activo === false);
    const op = x => { const v = valorDe(x); return `<option value="${fbEsc(v)}"${v === valor ? ' selected' : ''}>${fbEsc(etiqueta(x))}</option>`; };
    let h = `<option value=""${valor ? '' : ' selected'}>${fbEsc(todas)}</option>` + act.map(op).join('');
    if (ina.length) h += `<optgroup label="(inactivas)">${ina.map(op).join('')}</optgroup>`;
    // una elección guardada que ya no sale en la lista se conserva (no se pierde el filtro)
    if (valor && !lista.some(x => valorDe(x) === valor)) h += `<option value="${fbEsc(valor)}" selected>${fbEsc(suelta ? suelta(valor) : valor)}</option>`;
    return h;
  }

  function fbFiltroUbicacion(o) {
    o = o || {};
    const niveles = o.niveles || ['nave', 'area', 'linea', 'equipo'];
    const clave = LS + (o.pagina || 'pagina');
    const naveK = () => { const a = fbNaveActiva(); return a ? kp(a) : 'todas'; };
    let sel = { nave: naveK(), area: '', linea: '', equipo: '' };
    try {
      const g = JSON.parse(localStorage.getItem(clave) || 'null');
      if (g && g.nave === sel.nave) sel = { nave: g.nave, area: String(g.area || ''), linea: String(g.linea || ''), equipo: String(g.equipo || '') };
    } catch (e) {}
    const guardar = () => { try { localStorage.setItem(clave, JSON.stringify(sel)); } catch (e) {} };
    // Si cambió la nave (aquí o arriba), lo de abajo vuelve a "Todas".
    const vigente = () => { const n = naveK(); if (sel.nave !== n) { sel = { nave: n, area: '', linea: '', equipo: '' }; guardar(); } return sel; };
    const extras = () => { try { return (o.extras && o.extras()) || {}; } catch (e) { return {}; } };

    function pintar() {
      if (!o.el) return;
      css();
      const s = vigente(), ex = extras();
      const todasNaves = !fbNaveActiva();
      let h = '';
      if (niveles.includes('nave')) {
        const disp = fbNavesDisponibles();
        if (disp.length > 1) {
          const act = fbNaveActiva();
          const lst = disp.map(n => ({ nombre: n, activo: fbNombreActivo('plantas', n) }));
          h += `<select data-fbf="nave" aria-label="Nave" class="${act ? 'on' : ''}">` + opcionesHtml(lst, act || '', fbMisNaves() ? 'Todas mis naves' : 'Todas las naves', x => '🏭 ' + x.nombre, x => x.nombre) + '</select>';
        }
      }
      if (niveles.includes('area')) {
        const lst = opcionesAreas(ex.areas);
        h += `<select data-fbf="area" aria-label="Área" class="${s.area ? 'on' : ''}">` + opcionesHtml(lst, s.area, 'Todas las áreas', x => x.nombre + (todasNaves && x.nave && fbNavesDisponibles().length > 1 ? ' · ' + x.nave : ''), x => x.nombre) + '</select>';
      }
      if (niveles.includes('linea')) {
        const lst = opcionesLineas(s.area, ex.lineas);
        h += `<select data-fbf="linea" aria-label="Línea" class="${s.linea ? 'on' : ''}">` + opcionesHtml(lst, s.linea, 'Todas las líneas', x => x.nombre + (!s.area && x.area ? ' · ' + x.area : ''), x => x.nombre) + '</select>';
      }
      if (niveles.includes('equipo')) {
        const lst = opcionesEquipos(s.area, s.linea);
        h += `<select data-fbf="equipo" aria-label="Equipo" class="${s.equipo ? 'on' : ''}">` + opcionesHtml(lst, s.equipo, 'Todos los equipos', x => x.nombre + (!s.area && x.localidad ? ' · ' + x.localidad : ''), x => x.id, v => { const e = equipoIdx(v); return e ? e.nombre : v; }) + '</select>';
      }
      o.el.classList.add('fbFiltros');
      o.el.innerHTML = h;
      o.el.querySelectorAll('select[data-fbf]').forEach(el => { el.onchange = () => cambiar(el.dataset.fbf, el.value); });
    }
    function cambiar(nivel, v) {
      if (nivel === 'nave') { fbSetNaveActiva(v || 'todas'); return; } // la pantalla se repinta con fbOnNaveCambio
      const s = vigente();
      if (nivel === 'area') { s.area = v; s.linea = ''; s.equipo = ''; }
      if (nivel === 'linea') { s.linea = v; s.equipo = ''; }
      if (nivel === 'equipo') s.equipo = v;
      guardar(); pintar();
      if (o.onChange) o.onChange(ctl.get());
    }
    // ¿Entra el registro? acceso(r) → {area, linea, equipoId, equipo} (por defecto: campos de una OT).
    function coincide(r, acceso) {
      const s = vigente();
      if (!s.area && !s.linea && !s.equipo) return true;
      const d = (acceso || accesoDefecto)(r) || {};
      let eq = null;
      const eqDe = () => { if (eq === null) eq = equipoIdx(d.equipoId || fbEquipoIdPorNombre(d.equipo)) || false; return eq; };
      if (s.equipo) {
        const id = d.equipoId || fbEquipoIdPorNombre(d.equipo);
        if (id) { if (id !== s.equipo) return false; }
        else { const e = equipoIdx(s.equipo); if (!e || !d.equipo || K(d.equipo) !== K(e.nombre)) return false; }
      }
      if (s.area) { const a = d.area || (eqDe() ? eqDe().localidad : ''); if (!a || ka(a) !== ka(s.area)) return false; }
      if (s.linea) { const l = d.linea || (eqDe() ? eqDe().linea : ''); if (!l || kl(l) !== kl(s.linea)) return false; }
      return true;
    }
    // Para equipos del catálogo ({id, nombre, localidad, linea}).
    const coincideEquipo = e => coincide(e, x => ({ area: x.localidad || '', linea: x.linea || '', equipoId: x.id || '', equipo: x.nombre || '' }));
    const ctl = {
      get() { const s = vigente(); const e = equipoIdx(s.equipo); return { nave: fbNaveActiva() || '', area: s.area, linea: s.linea, equipo: s.equipo, equipoNombre: e ? e.nombre : '' }; },
      set(p) { const s = vigente(); Object.keys(p || {}).forEach(k => { if (['area', 'linea', 'equipo'].includes(k)) s[k] = String(p[k] || ''); }); guardar(); pintar(); },
      limpiar() { const s = vigente(); s.area = ''; s.linea = ''; s.equipo = ''; guardar(); pintar(); },
      activo() { const s = vigente(); return !!(s.area || s.linea || s.equipo); },
      coincide, coincideEquipo, pintar,
      // "PLANTA 2 · WEAVING · LINEA A" (vacío si todo está en Todas).
      texto() { const g = ctl.get(); return [g.nave, g.area, g.linea, g.equipoNombre].filter(Boolean).join(' · '); },
      partes() { const g = ctl.get(); return [g.nave, g.area, g.linea, g.equipoNombre].filter(Boolean); },
    };
    if (typeof fbOnNaveCambio === 'function') fbOnNaveCambio(() => pintar());
    if (typeof fbOnCatalogo === 'function') fbOnCatalogo(() => pintar());
    pintar();
    return ctl;
  }

  // ══════ EXPORTAR ══════
  // Nombre de archivo seguro: "PLANTA 2" → "PLANTA-2"; sin acentos.
  function fbSlug(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
  function fbNombreArchivo(pagina, partes, periodo) { return [pagina].concat((partes || []).map(fbSlug).filter(Boolean), periodo ? [fbSlug(periodo)] : []).join('_'); }

  // Misma librería y versión que la Hoja de vida (se descarga solo al exportar).
  let _xl = null;
  function fbCargarExcelJS() {
    if (typeof ExcelJS !== 'undefined') return Promise.resolve();
    if (!_xl) {
      const tag = document.createElement('script');
      tag.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
      _xl = new Promise((resolve, reject) => {
        tag.onload = () => (typeof ExcelJS !== 'undefined' ? resolve() : reject(new Error('ExcelJS no disponible')));
        tag.onerror = () => reject(new Error('no se pudo descargar ExcelJS (¿sin conexión?)'));
        document.head.appendChild(tag);
      }).catch(err => { _xl = null; tag.remove(); throw err; });
    }
    return _xl;
  }
  function descargar(blob, nombre) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  // CSV con ; y coma decimal (Excel en español). El apóstrofo evita que un
  // texto que empieza con = + - @ se lea como fórmula.
  function fbCsv(hojas) {
    const cel = x => {
      if (typeof x === 'number') return isFinite(x) ? String(Math.round(x * 100) / 100).replace('.', ',') : '';
      let s = String(x == null ? '' : x).replace(/\r?\n/g, ' ');
      const formula = /^[=+\-@]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s);
      if (formula) s = "'" + s;
      return /[;"]/.test(s) || formula ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const out = [];
    hojas.forEach((h, i) => {
      if (i) out.push('');
      if (hojas.length > 1) out.push(cel(h.nombre));
      if (h.titulo) out.push(cel(h.titulo));
      out.push(h.columnas.map(c => cel(c.t)).join(';'));
      h.filas.forEach(f => out.push(f.map(cel).join(';')));
    });
    return '﻿' + out.join('\r\n');
  }
  async function xlsx(hojas) {
    await fbCargarExcelJS();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Mantenimiento 2026';
    hojas.forEach(h => {
      const ws = wb.addWorksheet(String(h.nombre || 'Datos').replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31));
      let r = 1;
      if (h.titulo) { ws.addRow([h.titulo]); ws.getRow(1).font = { bold: true, size: 12 }; ws.addRow([]); r = 3; }
      ws.addRow(h.columnas.map(c => c.t));
      const cab = ws.getRow(r);
      cab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2535' } };
      h.filas.forEach(f => ws.addRow(f.map(v => (v == null ? '' : v))));
      h.columnas.forEach((c, i) => { ws.getColumn(i + 1).width = c.w || Math.min(40, Math.max(10, String(c.t).length + 2)); });
      ws.views = [{ state: 'frozen', ySplit: r }];
    });
    return wb.xlsx.writeBuffer();
  }
  function dialogoCsv(msg, alCsv) {
    css();
    const viejo = document.getElementById('fbExpDlg'); if (viejo) viejo.remove();
    const d = document.createElement('div');
    d.id = 'fbExpDlg';
    d.innerHTML = `<div role="dialog" aria-modal="true"><div style="font-size:28px;text-align:center">📵</div><div>${fbEsc(msg)}</div>
      <button id="fbExpCsv" style="background:var(--color-primary,#F59E0B);color:var(--color-on-primary,#0F1923)">⬇️ Descargar CSV (se abre con Excel)</button>
      <button id="fbExpNo" style="background:var(--color-surface-2,#2D3F55);color:var(--color-text,#F1F5F9);border:1px solid var(--color-border,#2D3F55)">Cerrar</button></div>`;
    document.body.appendChild(d);
    d.querySelector('#fbExpCsv').onclick = () => { d.remove(); alCsv(); };
    d.querySelector('#fbExpNo').onclick = () => d.remove();
    d.onclick = e => { if (e.target === d) d.remove(); };
  }
  // Devuelve una promesa con 'xlsx', 'csv-ofrecido' o 'csv'. opts.csv = true → CSV directo.
  async function fbExportar(opts) {
    const hojas = (opts.hojas || []).filter(h => h && h.columnas);
    const base = opts.nombre || 'reporte';
    window.__fbExport = { nombre: base, hojas, formato: null };
    const csv = () => { descargar(new Blob([fbCsv(hojas)], { type: 'text/csv;charset=utf-8' }), base + '.csv'); window.__fbExport.formato = 'csv'; window.__fbExport.archivo = base + '.csv'; if (opts.aviso) opts.aviso('⬇️ CSV descargado — ábrelo con Excel'); };
    if (opts.csv) { csv(); return 'csv'; }
    try {
      const buf = await xlsx(hojas);
      descargar(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), base + '.xlsx');
      window.__fbExport.formato = 'xlsx'; window.__fbExport.archivo = base + '.xlsx';
      if (opts.aviso) opts.aviso('⬇️ Excel descargado');
      return 'xlsx';
    } catch (e) {
      console.warn('Excel:', e && e.message);
      window.__fbExport.formato = 'csv-ofrecido';
      dialogoCsv('No se pudo preparar el archivo de Excel (' + ((e && e.message) || 'error') + '). Puedes descargar los mismos datos en CSV, que también abre en Excel.', csv);
      return 'csv-ofrecido';
    }
  }

  window.fbFiltroUbicacion = fbFiltroUbicacion;
  window.fbExportar = fbExportar;
  window.fbCargarExcelJS = fbCargarExcelJS;
  window.fbSlug = fbSlug;
  window.fbNombreArchivo = fbNombreArchivo;
  window.fbCsv = fbCsv;
  window.fbDescargar = descargar; // (26 oct 2026) Reporte de incentivos
})();
