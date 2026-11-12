// repuestos-calc.js — (11 nov 2026, v73) REPUESTOS POR MÁQUINA: cálculo puro (sin Firebase ni DOM).
// Lo usa repuestos.html y las pruebas (t_repuestos.js).
// Fuente: la lista de repuestos que ya tiene cada equipo (/equipos/{id}.repuestos), la misma de Almacén.
// No escribe nada y nunca toca el costo (pu): esta pantalla no muestra precios.
//
//  aplanar(equipos, naveDe)   → una fila por repuesto de cada máquina, con los datos de la máquina.
//  filtrar(filas, F, sin)     → aplica los filtros; `sin` = un filtro que se ignora (cada gráfico ignora el suyo).
//  contar(filas, dim)         → [[valor, n]] de mayor a menor.
//  pivot(filas, dimF, dimC, v)→ tabla dinámica con totales.
//  tambien(filas, fila)       → otras máquinas que usan el mismo repuesto (mismo código, o mismo nombre y marca).
(function (raiz) {
  'use strict';
  const sinAc = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const num = v => { if (v === null || v === undefined || v === '') return null; const n = parseFloat(v); return isNaN(n) ? null : n; };

  // Mismo criterio que Almacén (almacen.html → stockStatus)
  function estado(p) {
    const q = num(p.q); if (q === null) return 'nodata';
    if (q <= 0) return 'sin';
    const min = num(p.min);
    if (min !== null && min > 0) return q < min ? 'bajo' : 'ok';
    const cm = num(p.cm);
    if (cm !== null && cm > 0 && q < cm * 0.2) return 'bajo';
    return 'ok';
  }
  const ESTADOS = ['sin', 'bajo', 'ok', 'nodata'];

  function familia(e) {
    const t = String(e.tipoMaquina || '').trim(); if (t) return t;
    const mm = [e.marca, e.modelo].map(x => String(x || '').trim()).filter(Boolean).join(' · ');
    return mm || String(e.nombre || '').trim() || '—';
  }

  function aplanar(equipos, naveDe) {
    const out = [];
    (equipos || []).forEach(e => {
      const nave = (naveDe && naveDe(e)) || String(e.planta || '').trim();
      const fam = familia(e);
      (Array.isArray(e.repuestos) ? e.repuestos : []).forEach((p, i) => {
        if (!p || !String(p.r || '').trim()) return;
        out.push({
          k: e.id + ':' + (p.id || i), id: typeof p.id === 'string' ? p.id : '', clave: partKey(p), eqId: e.id, eq: String(e.nombre || '').trim() || '—', fam,
          nave: nave || '', area: String(e.localidad || '').trim(), linea: String(e.linea || '').trim(),
          r: String(p.r).trim(), t: String(p.t || '').trim(), m: String(p.m || '').trim(), d: String(p.d || '').trim(), u: String(p.u || '').trim(),
          cm: num(p.cm), q: num(p.q), min: num(p.min), max: num(p.max), img: typeof p.img === 'string' ? p.img : '', est: estado(p),
          _s: sinAc([p.r, p.m, p.t, p.d, p.u, e.nombre].join(' ')),
        });
      });
    });
    return out;
  }

  // Dimensiones (para gráficos, tabla dinámica y filtros)
  const DIM = {
    eq: { f: x => x.eq }, fam: { f: x => x.fam }, u: { f: x => x.u || '(sin parte)' }, est: { f: x => x.est },
    t: { f: x => x.t || '(sin marca)' }, nave: { f: x => x.nave || '(sin nave)' }, area: { f: x => x.area || '(sin área)' },
  };

  // F = { eq, fam, u, est, t, nave, q, sel: [{dim, v}] }
  function filtrar(filas, F, sin) {
    F = F || {}; const q = sinAc(F.q);
    const palabras = q ? q.split(' ') : [];
    return (filas || []).filter(x => {
      for (const d of ['eq', 'fam', 'u', 'est', 't', 'nave']) if (d !== sin && F[d] && DIM[d].f(x) !== F[d]) return false;
      if (sin !== 'sel' && Array.isArray(F.sel) && F.sel.some(s => DIM[s.dim] && DIM[s.dim].f(x) !== s.v)) return false;
      if (palabras.length && !palabras.every(w => x._s.includes(w))) return false;
      return true;
    });
  }

  function contar(filas, dim) {
    const m = new Map(); const f = DIM[dim].f;
    filas.forEach(x => { const k = f(x); m.set(k, (m.get(k) || 0) + 1); });
    const arr = [...m.entries()];
    if (dim === 'est') return ESTADOS.map(s => [s, m.get(s) || 0]);
    return arr.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'es', { numeric: true }));
  }

  const claveRep = x => x.m && x.m.replace(/[\s\-–—._/]/g, '').length >= 3 ? 'c:' + sinAc(x.m).replace(/[\s\-–—._/]/g, '') : 'n:' + sinAc(x.r) + '|' + sinAc(x.t);

  // valor: 'n' filas · 'c' códigos distintos · 'q' suma en almacén · 'cm' suma instalada
  function valorDe(lista, v) {
    if (v === 'c') return new Set(lista.map(claveRep)).size;
    if (v === 'q') return lista.reduce((s, x) => s + (x.q > 0 ? x.q : 0), 0);
    if (v === 'cm') return lista.reduce((s, x) => s + (x.cm > 0 ? x.cm : 0), 0);
    return lista.length;
  }
  function pivot(filas, dimF, dimC, v, maxCol) {
    maxCol = maxCol || 14;
    const fF = DIM[dimF].f, fC = dimC && DIM[dimC] ? DIM[dimC].f : null;
    let cols = fC ? contar(filas, dimC).filter(c => c[1] > 0).map(c => c[0]) : [];
    let otros = false;
    if (cols.length > maxCol) { cols = cols.slice(0, maxCol - 1); otros = true; }
    const colDe = x => { if (!fC) return '∑'; const c = fC(x); return cols.includes(c) ? c : '(otros)'; };
    if (!fC) cols = ['∑']; else if (otros) cols.push('(otros)');
    const g = new Map();
    filas.forEach(x => { const r = fF(x), c = colDe(x); if (!g.has(r)) g.set(r, new Map()); const m = g.get(r); if (!m.has(c)) m.set(c, []); m.get(c).push(x); });
    let filasP = [...g.keys()].map(r => {
      const m = g.get(r); const celdas = cols.map(c => valorDe(m.get(c) || [], v));
      return { r, celdas, total: valorDe([].concat(...[...m.values()]), v) };
    });
    filasP.sort((a, b) => b.total - a.total || String(a.r).localeCompare(String(b.r), 'es', { numeric: true }));
    if (dimF === 'est') filasP.sort((a, b) => ESTADOS.indexOf(a.r) - ESTADOS.indexOf(b.r));
    const totCol = cols.map(c => valorDe(filas.filter(x => colDe(x) === c), v));
    const max = Math.max(0, ...filasP.map(f => Math.max(0, ...f.celdas)));
    return { cols, filas: filasP, totCol, total: valorDe(filas, v), max, otros };
  }
  // filas que caen en una celda de la tabla dinámica
  function enCelda(filas, dimF, r, dimC, c, colsVisibles) {
    return filas.filter(x => DIM[dimF].f(x) === r && (!dimC || c === '∑' || (c === '(otros)' ? !colsVisibles.includes(DIM[dimC].f(x)) : DIM[dimC].f(x) === c)));
  }

  function tambien(filas, fila) {
    const k = claveRep(fila);
    return filas.filter(x => x.k !== fila.k && claveRep(x) === k);
  }

  function compraSugerida(x) {
    if (x.est !== 'sin' && x.est !== 'bajo') return null;
    const obj = x.max > 0 ? x.max : x.min > 0 ? x.min : null;
    if (obj === null) return null;
    const n = obj - (x.q > 0 ? x.q : 0);
    return n > 0 ? n : null;
  }

  function ordenar(filas, col, asc) {
    const f = { eq: x => x.eq, r: x => x.r, m: x => x.m, t: x => x.t, u: x => x.u, q: x => x.q, cm: x => x.cm, min: x => x.min, est: x => ESTADOS.indexOf(x.est) }[col] || (x => x.eq);
    const s = asc ? 1 : -1;
    return filas.slice().sort((a, b) => {
      const va = f(a), vb = f(b);
      if (va === null || va === '') return 1; if (vb === null || vb === '') return -1;
      return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es', { numeric: true })) * s || a.eq.localeCompare(b.eq, 'es', { numeric: true }) || a.r.localeCompare(b.r, 'es');
    });
  }

  // ══ EDITAR / AGREGAR (v73, solo Administrador) ══
  // Mismas reglas que Almacén (catalogo.js / almacen.html): cada repuesto tiene un id estable;
  // "el mismo repuesto" = nombre + marca + (código o, sin código, descripción). Nunca se tocan
  // pu (costo), img (foto) ni otros campos que no estén en el formulario.
  const normK = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const partKey = p => normK(p.r) + '|' + normK(p.t) + '|' + normK(p.m || p.d || '');
  const REP_ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
  const repIdValido = id => typeof id === 'string' && REP_ID_RE.test(id);
  function nuevoRepId(rnd) {
    const az = 'abcdefghijklmnopqrstuvwxyz0123456789'; let s = '';
    const b = rnd || ((typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(10)) : Array.from({ length: 10 }, () => Math.floor(Math.random() * 256)));
    for (let i = 0; i < 10; i++) s += az[b[i] % az.length];
    return 'r' + s;
  }
  function asegurarIds(lista) {
    let n = 0; const vistos = new Set();
    (lista || []).forEach(p => { if (!p || typeof p !== 'object') return; if (!repIdValido(p.id) || vistos.has(p.id)) { p.id = nuevoRepId(); n++; } vistos.add(p.id); });
    return n;
  }
  const CAMPOS_TXT = { r: 200, t: 80, m: 80, d: 300, u: 120 };
  // form: textos tal cual del formulario (números como texto; acepta coma decimal)
  function leerForm(form) {
    const n = v => { const s = String(v == null ? '' : v).trim().replace(',', '.'); if (!s) return null; const x = Number(s); return isFinite(x) ? x : NaN; };
    const o = {}; Object.keys(CAMPOS_TXT).forEach(k => { o[k] = String(form[k] == null ? '' : form[k]).trim().replace(/\s+/g, ' ').slice(0, CAMPOS_TXT[k]); });
    ['q', 'cm', 'min', 'max'].forEach(k => { o[k] = n(form[k]); });
    const err = [];
    if (!o.r) err.push('Ponle nombre al repuesto.');
    ['q', 'cm', 'min', 'max'].forEach(k => { if (Number.isNaN(o[k])) err.push('«{c}» tiene que ser un número.|' + k); else if (o[k] !== null && o[k] < 0) err.push('«{c}» no puede ser negativo.|' + k); });
    if (o.min !== null && o.max !== null && !Number.isNaN(o.min) && !Number.isNaN(o.max) && o.max < o.min) err.push('El máximo no puede ser menor que el mínimo.');
    return { obj: o, err };
  }
  // Aplica el cambio a la lista FRESCA (dentro de la transacción). Devuelve
  // { ok, p, antesQ, cambioQ, msg } o { ok:false, msg }. No fusiona en silencio: si ya existe
  // un repuesto igual, avisa para que se edite ese.
  // ref = { id, clave }: por id; un repuesto viejo sin id se busca por su clave (nombre|marca|código).
  function aplicarCambio(lista, modo, ref, obj) {
    ref = ref || {};
    const sinId = !repIdValido(ref.id);
    asegurarIds(lista);
    const clave = partKey(obj);
    if (modo === 'editar') {
      const i = sinId ? lista.findIndex(p => p && partKey(p) === ref.clave) : lista.findIndex(p => p && p.id === ref.id);
      if (i < 0) return { ok: false, msg: 'Este repuesto ya no está en la máquina (lo cambiaron desde otro celular). Cierra y vuelve a abrirlo.' };
      const dup = lista.findIndex((p, j) => j !== i && p && partKey(p) === clave);
      if (dup >= 0) return { ok: false, msg: 'Ya hay otro repuesto igual en esta máquina: «{r}». Edita ese o cambia el nombre, la marca o el código.', r: lista[dup].r };
      const antes = lista[i];
      const p = Object.assign({}, antes, { r: obj.r, t: obj.t, m: obj.m, d: obj.d, u: obj.u, cm: obj.cm, min: obj.min, max: obj.max, q: obj.qTocada === false ? (antes.q === undefined ? null : antes.q) : obj.q, id: antes.id }); // cantidad sin tocar → vale la FRESCA
      lista[i] = p;
      const aq = num(antes.q), bq = num(p.q);
      return { ok: true, p, antesQ: aq, cambioQ: aq !== bq && bq !== null, msg: 'Repuesto actualizado' };
    }
    const dup = lista.find(p => p && partKey(p) === clave);
    if (dup) return { ok: false, msg: 'Ese repuesto ya está en esta máquina: «{r}». Ábrelo y edítalo.', r: dup.r };
    const p = { r: obj.r, t: obj.t, m: obj.m, d: obj.d, u: obj.u, q: obj.q, cm: obj.cm, min: obj.min, max: obj.max, img: null, id: nuevoRepId() };
    lista.push(p);
    return { ok: true, p, antesQ: null, cambioQ: num(p.q) !== null, msg: 'Repuesto agregado' };
  }

  const api = { aplanar, filtrar, contar, pivot, enCelda, tambien, compraSugerida, ordenar, estado, familia, valorDe, claveRep, sinAc, DIM, ESTADOS,
    partKey, repIdValido, nuevoRepId, asegurarIds, leerForm, aplicarCambio };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.VTRepuestos = api;
})(typeof window !== 'undefined' ? window : globalThis);
