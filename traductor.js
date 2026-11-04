// traductor.js — (v3, nov 2026) Traducción A PEDIDO de lo que escribe la gente
// (fallas, soluciones, notas, puntos de checklist, descripciones).
// ══════════════════════════════════════════════════════════════════════
// Decisión del dueño: nada se traduce solo. Junto a cada texto escrito en otro
// idioma aparece un botón pequeño "Traducir"; al tocarlo se traduce y se muestra
// "Traducido · ver original".
//
// MOTORES (gratis, en este orden):
//  1. 'chrome'   Traductor del propio celular/navegador (Translator API de Chrome:
//                Translator.availability / Translator.create / translate). Sin costo,
//                sin enviar nada por internet una vez descargado el idioma.
//  2. 'mymemory' api.mymemory.translated.net (gratis: ~5.000 caracteres al día por
//                celular, ~50.000 si se configura un correo de contacto con
//                traductor.config({ email })). Solo se envía el texto, NUNCA nombres de
//                personas o máquinas, códigos, folios, correos ni teléfonos (se cambian
//                por marcas XQ0Z antes de enviar y se reponen al volver).
//
// NO SE TRADUCEN: nombres de máquinas/equipos, de personas, de naves/áreas/líneas,
// códigos, folios (OT-0001, QR-…, CAPEX-…). Campos como EQUIPO, TECNICOS, creadoPor,
// folio, codigo… nunca muestran botón (traductor.NO_TRADUCIR).
//
// CACHÉ: memoria + localStorage (LRU limitado). Opcional: guardar la traducción
// en el mismo registro (campo nuevo y aditivo `tr`) para que el siguiente lector en
// ese idioma no gaste otra vez:
//   tr: { <campo>: { src:'es', h:'<huella del original>', en:'…', en_m:'chrome', en_at:<ms>,
//                    tr:'…', tr_m:'mymemory', tr_at:<ms> } }
//   <campo> con puntos se guarda con '__' ('rca.causa' → 'rca__causa', 'items.2.nota' → 'items__2__nota').
//   Si el original cambia (otra huella h) la traducción guardada deja de usarse.
//   Junto con `tr` se escribe `trK` = la clave que se acaba de escribir (para que las reglas
//   propuestas puedan validar esa entrada; ver propuesta-reglas-tr.md).
// persistir: 'auto' (por defecto) = solo donde las reglas actuales lo permiten sin
// riesgo (OTs para Técnico+ cuando el aviso es suyo o no está tomado, CAPEX para
// Encargado/Admin, equipos); en el resto solo caché local. Con config({ reglasTr: true })
// (cuando se publiquen las reglas propuestas en propuesta-reglas-tr.md) también
// checklists, permisos de trabajo y solicitudes de repuestos.
//
// USO
//   el.innerHTML = traductor.html(ot, 'descripcionFalla', { col: 'ots' });   // texto + botón
//   traductor.txt(ot, 'DESCRIPCION_SOLUCION')   // texto a mostrar (traducción si ya se pidió)
//   await traductor.traducir('Se cambió el rodamiento', { a: 'en' })   // { texto, motor, de, a }
// Lecturas extra: ninguna. Escrituras: 1 por traducción guardada en el registro (opcional).
// ══════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const LANGS = ['es', 'en', 'tr'];
  const CFG = {
    motores: ['chrome', 'mymemory'],
    email: '',                 // correo de contacto para MyMemory (sube la cuota gratis)
    persistir: 'auto',         // 'auto' | true | false
    reglasTr: false,           // true cuando estén publicadas las reglas propuestas para `tr`
    mostrarGuardadas: false,   // true = mostrar de una vez las traducciones ya guardadas
    esperarDescarga: false,    // true = esperar a que Chrome baje el idioma (si no, MyMemory mientras tanto)
    timeoutMs: 8000,
    cuotaAnonima: 5000,        // caracteres/día de MyMemory sin correo
    cuotaConCorreo: 50000,     // caracteres/día con correo
    margen: 0.9,               // se usa hasta el 90 % de la cuota
    maxCache: 400,             // entradas en localStorage
    maxBytesChunk: 450,        // MyMemory acepta ~500 bytes por consulta
    paralelo: 2,               // consultas a MyMemory a la vez
    url: 'https://api.mymemory.translated.net/get',
  };
  const LS_CFG = 'traductorCfg', LS_CACHE = 'traductorCache', LS_CUOTA = 'traductorCuota';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  try { const c = JSON.parse(lsGet(LS_CFG) || 'null'); if (c && typeof c === 'object') ['email', 'persistir', 'reglasTr', 'mostrarGuardadas'].forEach(k => { if (k in c) CFG[k] = c[k]; }); } catch (e) {}
  function config(o) {
    if (o && typeof o === 'object') {
      Object.assign(CFG, o);
      const guardar = {}; ['email', 'persistir', 'reglasTr', 'mostrarGuardadas'].forEach(k => { guardar[k] = CFG[k]; });
      lsSet(LS_CFG, JSON.stringify(guardar));
    }
    return Object.assign({}, CFG);
  }
  const T = (k, p, def) => (window.i18n && i18n.has(k) ? i18n.t(k, p) : (def || k));
  const langActual = () => (window.i18n ? i18n.getLang() : 'es');
  const esc = s => (typeof fbEsc === 'function' ? fbEsc(s) : String(s == null ? '' : s).replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c])));
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  function hash(s) { let h = 0x811c9dc5; s = norm(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
  function err(code, msg, extra) { const e = new Error(msg || code); e.code = code; return Object.assign(e, extra || {}); }

  // ── Campos ──
  // Nunca se traducen (nombres, códigos, folios, personas).
  const NO_TRADUCIR = new Set(['EQUIPO', 'TIPO_MAQUINA', 'LINEA_EQUIPO', 'LINEA', 'PLANTA', 'planta', 'TECNICOS', 'tecnico', 'tecnicos', 'creadoPor', 'asignadoA',
    'cerradoPor', 'editadoPor', 'folio', 'Title', 'codigo', 'nombre', 'equipoNombre', 'equipoLocalidad', 'solicitante', 'aprobadoPor', 'autorizadoPor',
    'atendidoPor', 'quien', 'por', 'responsable', 'proveedor', 'email', 'telefono', 'otFolio', 'marca', 'modelo', 'serie']);
  // Campos de texto libre conocidos por colección (guía para las pantallas y para las reglas).
  const CAMPOS = {
    ots: ['descripcionFalla', 'DESCRIPCION_FALLA', 'DESCRIPCION_SOLUCION', 'rca.causa', 'motivoAnulacion', 'notaRevision', 'motivoRechazo'],
    checklists: ['items.*.nota', 'items.*.motivo'],
    permisos_trabajo: ['nota', 'notaAutorizacion', 'retiro.nota'],
    solicitudes_repuestos: ['descripcion', 'nota'],
    capex: ['titulo', 'descripcion', 'justificacion.problema', 'justificacion.beneficio', 'trabajos.*.descripcion', 'repuestos.*.descripcion', 'otrosCostos.*.detalle'],
    equipos: ['caracteristicas', 'descripcion'],
    config_checklistPuntos: ['puntos.*'],
  };
  const claveCampo = c => String(c).replace(/\./g, '__');
  function leerCampo(doc, campo) { let v = doc; for (const p of String(campo).split('.')) { if (v == null) return undefined; v = v[p]; } return v; }
  const baseCampo = c => String(c).split('.').filter(p => !/^\d+$/.test(p)).pop();

  // ── Detección de idioma ──
  const PAL = {
    es: 'de la que el en y los se del las por un una para con no su al lo como más pero sus le ya o fue este ha porque esta son entre cuando muy sin sobre también hasta hay donde desde todo durante todos ni otro esto está están hace falla fallo máquina maquina cambio cambió cambiar revisar revisión ruido fuga aceite motor correa rodamiento bomba presión se quemó quemado roto rota limpieza ajuste ajustó nivel bajo alto agua aire tornillo guarda sensor eje'.split(' '),
    en: 'the and of to in is it that for on with as was be by this are or not from at have an but they which you were has been will would there their what when out up so no can all its into over after replaced broken leak leaking noise noisy belt bearing pump pressure check checked cleaning cleaned low high oil water air screw guard sensor shaft loose worn stopped machine'.split(' '),
    tr: 've bir bu için ile da de çok ne gibi daha olarak ama sonra var yok değil mi en kadar ise hem şu o ya her olan oldu yapıldı değiştirildi arıza makine motor yağ su hava kayış rulman pompa basınç kontrol temizlik gürültü sızıntı kaçak yüksek düşük vida sensör mil durdu bozuk'.split(' '),
  };
  const PAL_SET = { es: new Set(PAL.es), en: new Set(PAL.en), tr: new Set(PAL.tr) };
  // Rápida y sin red: letras propias del idioma + palabras frecuentes. '' = no se sabe.
  function detectarRapido(texto) {
    const s = String(texto || '');
    if (!s.trim()) return '';
    const p = { es: 0, en: 0, tr: 0 };
    if (/[ğışİ]/.test(s)) p.tr += 3;
    if (/[çöü]/.test(s)) p.tr += 1;
    if (/[ñ¿¡]/.test(s)) p.es += 3;
    if (/[áéíóú]/i.test(s)) p.es += 2;
    (s.normalize('NFC').match(/[\p{L}]+/gu) || []).forEach(w => {
      const a = w.toLowerCase(), b = w.toLocaleLowerCase('tr');
      LANGS.forEach(l => { if (PAL_SET[l].has(a) || PAL_SET[l].has(b)) p[l] += 1; });
    });
    const orden = LANGS.slice().sort((a, b) => p[b] - p[a]);
    if (p[orden[0]] === 0 || p[orden[0]] === p[orden[1]]) return '';
    return orden[0];
  }
  let _detector = null;
  async function detectar(texto) {
    const s = norm(texto);
    if (!s) return 'es';
    try {
      if (typeof self.LanguageDetector !== 'undefined' && s.length >= 12) {
        if (!_detector) {
          const av = await self.LanguageDetector.availability();
          if (av === 'available') _detector = await self.LanguageDetector.create();
        }
        if (_detector) {
          const r = await _detector.detect(s);
          const top = (r || []).find(x => LANGS.includes(String(x.detectedLanguage).slice(0, 2)) && x.confidence >= 0.5);
          if (top) return String(top.detectedLanguage).slice(0, 2);
        }
      }
    } catch (e) { /* detector no disponible: heurística */ }
    return detectarRapido(s) || 'es';
  }

  // ── Proteger nombres, códigos y datos personales ──
  let _terminos = null, _terminosT = 0;
  function terminosConocidos() {
    if (_terminos && Date.now() - _terminosT < 60000) return _terminos;
    const set = new Set();
    const add = v => { v = norm(v); if (v.length >= 2) set.add(v); };
    try { if (typeof fbEquiposIndice === 'function') fbEquiposIndice().forEach(e => { add(e.nombre); add(e.localidad); add(e.linea); add(e.planta); }); } catch (e) {}
    try { if (typeof fbListaNombres === 'function') ['plantas', 'areas', 'lineas'].forEach(t => fbListaNombres(t).forEach(d => { add(d.nombre); (d.nombresAnteriores || []).forEach(add); })); } catch (e) {}
    const PARTE_NO = new Set(['de', 'del', 'la', 'las', 'los', 'san', 'el', 'y']);
    const persona = n => { add(n); norm(n).split(/[\s.#]+/).forEach(p => { if (p.length >= 3 && !PARTE_NO.has(p.toLowerCase()) && !/^\d+$/.test(p)) add(p); }); };
    try { const c = JSON.parse(lsGet('fbTecnicosCopia') || 'null'); (c && c.lista || []).forEach(t => { persona(t.nombre); add(t.corto); if (t.nombreCompleto) persona(t.nombreCompleto); }); } catch (e) {}
    try { const u = window.currentUserRole; if (u) { persona(u.nombre); if (u.tecnico) persona(u.tecnico); } } catch (e) {}
    _terminos = [...set];
    _terminosT = Date.now();
    return _terminos;
  }
  // Nombres que trae el propio registro (máquina, personas, folio).
  function terminosDeDoc(doc) {
    if (!doc || typeof doc !== 'object') return [];
    const out = [];
    ['EQUIPO', 'equipoNombre', 'equipoLocalidad', 'LINEA_EQUIPO', 'LINEA', 'PLANTA', 'planta', 'creadoPor', 'asignadoA', 'cerradoPor', 'tecnico', 'solicitante', 'folio', 'codigo', 'otFolio', 'atendidoPor', 'autorizadoPor'].forEach(k => { if (typeof doc[k] === 'string') out.push(doc[k]); });
    if (typeof doc.TECNICOS === 'string') doc.TECNICOS.split(',').forEach(x => out.push(x));
    if (Array.isArray(doc.tecnicos)) doc.tecnicos.forEach(x => typeof x === 'string' && out.push(x));
    if (Array.isArray(doc.equipos)) doc.equipos.forEach(e => e && typeof e.nombre === 'string' && out.push(e.nombre));
    return out.map(norm).filter(x => x.length >= 2);
  }
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const B0 = '(?<![\\p{L}\\p{N}])', B1 = '(?![\\p{L}\\p{N}])';
  const PATRONES = [
    /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu,                                                  // correos
    /\bhttps?:\/\/\S+/gu,                                                              // enlaces
    /(?<![\p{L}\p{N}])\+?\d[\d ().-]{6,}\d(?![\p{L}\p{N}])/gu,                         // teléfonos
    /(?<![\p{L}\p{N}])(?:OT-P?[A-Z0-9]{3,}|QR-[A-Z0-9]{4,12}|CAPEX-\d{4}-[A-Z0-9]{1,12})(?![\p{L}\p{N}])/gu, // folios
    /#\d+/gu,                                                                          // número de empleado (#777)
    /(?<![\p{L}\p{N}])(?=[\p{L}\p{N}\-_/.]*\p{L})(?=[\p{L}\p{N}\-_/.]*\d)[\p{L}\p{N}][\p{L}\p{N}\-_/.]*[\p{L}\p{N}](?![\p{L}\p{N}])/gu, // códigos con letras y números (6205-2RS, GA37, M-102)
  ];
  function proteger(texto, extras) {
    const s = String(texto == null ? '' : texto);
    const spans = [];
    PATRONES.forEach(re => { re.lastIndex = 0; let m; while ((m = re.exec(s))) { if (m[0].length) spans.push([m.index, m.index + m[0].length]); } });
    const terms = [...new Set(terminosConocidos().concat(extras || []).map(norm).filter(x => x.length >= 2))].sort((a, b) => b.length - a.length);
    for (let i = 0; i < terms.length; i += 150) {
      const re = new RegExp(B0 + '(?:' + terms.slice(i, i + 150).map(reEsc).join('|') + ')' + B1, 'giu');
      let m; while ((m = re.exec(s))) { if (m[0].length) spans.push([m.index, m.index + m[0].length]); }
    }
    spans.sort((a, b) => a[0] - b[0] || (b[1] - b[0]) - (a[1] - a[0]));
    const elegidos = [];
    spans.forEach(sp => { const u = elegidos[elegidos.length - 1]; if (!u || sp[0] >= u[1]) elegidos.push(sp); else if (sp[1] > u[1] && sp[0] === u[0]) elegidos[elegidos.length - 1] = sp; });
    const mapa = []; let out = '', pos = 0;
    elegidos.forEach(([a, b]) => { out += s.slice(pos, a) + 'XQ' + mapa.length + 'Z'; mapa.push(s.slice(a, b)); pos = b; });
    out += s.slice(pos);
    return { t: out, mapa };
  }
  function restaurar(traducido, prot) {
    const vistos = new Set();
    const out = String(traducido).replace(/XQ\s?(\d+)\s?Z/gi, (m, i) => { i = +i; if (prot.mapa[i] == null) return m; vistos.add(i); return prot.mapa[i]; });
    if (vistos.size !== prot.mapa.length) throw err('protegidos', 'El motor alteró nombres o códigos protegidos');
    return out;
  }

  // ── Caché (memoria + localStorage LRU) ──
  const mem = new Map();
  let _ls = null;
  function lsCache() {
    if (_ls) return _ls;
    try { const c = JSON.parse(lsGet(LS_CACHE) || 'null'); _ls = (c && c.v === 1 && c.e && typeof c.e === 'object') ? c : { v: 1, e: {} }; } catch (e) { _ls = { v: 1, e: {} }; }
    return _ls;
  }
  const claveCache = (de, a, texto) => de + '>' + a + ':' + hash(texto);
  function cacheGet(de, a, texto) {
    const k = claveCache(de, a, texto);
    if (mem.has(k)) return mem.get(k);
    const e = lsCache().e[k];
    if (e && typeof e[0] === 'string') { const r = { t: e[0], m: e[1] || '' }; mem.set(k, r); e[2] = Date.now(); return r; }
    return null;
  }
  let _guardarT = null;
  function cacheSet(de, a, texto, t, m) {
    const k = claveCache(de, a, texto);
    mem.set(k, { t, m });
    if (mem.size > CFG.maxCache * 2) mem.delete(mem.keys().next().value);
    const c = lsCache();
    c.e[k] = [t, m, Date.now()];
    const keys = Object.keys(c.e);
    if (keys.length > CFG.maxCache) keys.sort((x, y) => (c.e[x][2] || 0) - (c.e[y][2] || 0)).slice(0, keys.length - CFG.maxCache).forEach(x => delete c.e[x]);
    clearTimeout(_guardarT);
    _guardarT = setTimeout(guardarCache, 50);
  }
  function guardarCache() {
    const c = lsCache();
    let s = JSON.stringify(c);
    while (s.length > 250000 && Object.keys(c.e).length) { // nunca más de ~250 KB
      const keys = Object.keys(c.e).sort((x, y) => (c.e[x][2] || 0) - (c.e[y][2] || 0));
      keys.slice(0, Math.ceil(keys.length / 4)).forEach(x => delete c.e[x]);
      s = JSON.stringify(c);
    }
    if (!lsSet(LS_CACHE, s)) { c.e = {}; lsSet(LS_CACHE, JSON.stringify(c)); }
  }
  function cacheLimpiar() { mem.clear(); _ls = { v: 1, e: {} }; try { localStorage.removeItem(LS_CACHE); } catch (e) {} }

  // ── Cuota diaria de MyMemory (contada en este celular) ──
  const hoy = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function cuota() {
    let c = null;
    try { c = JSON.parse(lsGet(LS_CUOTA) || 'null'); } catch (e) {}
    if (!c || c.fecha !== hoy()) c = { fecha: hoy(), chars: 0, agotado: false };
    c.limite = Math.floor((correoValido() ? CFG.cuotaConCorreo : CFG.cuotaAnonima) * CFG.margen);
    return c;
  }
  function cuotaGuardar(c) { lsSet(LS_CUOTA, JSON.stringify({ fecha: c.fecha, chars: c.chars, agotado: c.agotado })); }
  const correoValido = () => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(CFG.email || '');

  // ── Motores ──
  const traductoresChrome = new Map();
  const MOTORES = {
    chrome: {
      async disponible(de, a) {
        if (typeof self.Translator === 'undefined' || !self.Translator.availability) return 'no-api';
        try { return await self.Translator.availability({ sourceLanguage: de, targetLanguage: a }); } catch (e) { return 'unavailable'; }
      },
      async par(de, a, o) {
        const k = de + '>' + a;
        if (traductoresChrome.has(k)) return traductoresChrome.get(k);
        const av = await this.disponible(de, a);
        if (av === 'no-api' || av === 'unavailable') return null;
        const crear = () => self.Translator.create({ sourceLanguage: de, targetLanguage: a, monitor(m) { try { m.addEventListener('downloadprogress', e => { if (o && o.alProgreso) o.alProgreso(e.loaded); }); } catch (x) {} } });
        if (av !== 'available' && !(o && o.esperarDescarga) && !CFG.esperarDescarga) {
          // Se empieza a bajar el idioma (necesita el toque del usuario) y por ahora se usa el siguiente motor.
          try { const p = crear(); p.then(tr => traductoresChrome.set(k, Promise.resolve(tr)), () => {}); } catch (e) {}
          throw err('descargando', 'Chrome está bajando el idioma ' + k);
        }
        const p = crear();
        traductoresChrome.set(k, p);
        p.catch(() => traductoresChrome.delete(k));
        return p;
      },
      async traducir(texto, de, a, o) {
        let tr = await this.par(de, a, o);
        if (tr) return tr.translate(texto);
        if (de !== 'en' && a !== 'en') { // sin par directo: a través del inglés
          const t1 = await this.par(de, 'en', o), t2 = t1 && await this.par('en', a, o);
          if (t1 && t2) return t2.translate(await t1.translate(texto));
        }
        throw err('no-disponible', 'Chrome no traduce ' + de + '>' + a + ' en este equipo');
      },
    },
    mymemory: {
      async disponible() { return (typeof navigator === 'undefined' || navigator.onLine !== false) && !cuota().agotado ? 'available' : 'unavailable'; },
      async traducir(texto, de, a) {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) throw err('offline', 'Sin conexión');
        const c = cuota();
        if (c.agotado || c.chars + texto.length > c.limite) throw err('cuota', 'Cuota diaria de MyMemory');
        const partes = partir(texto, CFG.maxBytesChunk);
        const out = [];
        for (const p of partes) out.push(await enCola(() => consultaMyMemory(p, de, a)));
        return out.join(' ');
      },
    },
  };
  function bytes(s) { return new TextEncoder().encode(s).length; }
  // Corta en frases (y si una frase es muy larga, en palabras) sin pasar de max bytes.
  function partir(texto, max) {
    if (bytes(texto) <= max) return [texto];
    const frases = texto.match(/[^.!?;\n]+[.!?;\n]*\s*/g) || [texto];
    const out = []; let cur = '';
    const empujar = s => { if (bytes(cur + s) <= max) cur += s; else { if (cur.trim()) out.push(cur.trim()); cur = s; } };
    frases.forEach(f => {
      if (bytes(f) <= max) return empujar(f);
      f.split(/(\s+)/).forEach(w => { if (bytes(w) > max) { let x = ''; for (const ch of w) { if (bytes(x + ch) > max) { empujar(x); x = ''; } x += ch; } empujar(x); } else empujar(w); });
    });
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  let _activas = 0; const _espera = [];
  function enCola(fn) {
    return new Promise((res, rej) => {
      const correr = () => { _activas++; fn().then(res, rej).finally(() => { _activas--; const n = _espera.shift(); if (n) n(); }); };
      if (_activas < CFG.paralelo) correr(); else _espera.push(correr);
    });
  }
  function decodificar(s) {
    if (!/&(#\d+|#x[\da-f]+|\w+);/i.test(s)) return s;
    try { const d = new DOMParser().parseFromString('<!doctype html><body>' + s, 'text/html'); return d.body.textContent || s; } catch (e) { return s; }
  }
  async function consultaMyMemory(q, de, a) {
    const c = cuota();
    if (c.agotado || c.chars + q.length > c.limite) throw err('cuota', 'Cuota diaria de MyMemory');
    const url = CFG.url + '?q=' + encodeURIComponent(q) + '&langpair=' + de + '|' + a + (correoValido() ? '&de=' + encodeURIComponent(CFG.email) : '');
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const tm = setTimeout(() => ctl && ctl.abort(), CFG.timeoutMs);
    let r, j;
    try {
      r = await fetch(url, { signal: ctl ? ctl.signal : undefined, credentials: 'omit', referrerPolicy: 'no-referrer' });
      j = await r.json().catch(() => null);
    } catch (e) {
      throw err(e && e.name === 'AbortError' ? 'timeout' : 'red', 'MyMemory: ' + ((e && e.message) || e));
    } finally { clearTimeout(tm); }
    c.chars += q.length;
    const txt = j && j.responseData && j.responseData.translatedText;
    const estado = j ? Number(j.responseStatus) : r.status;
    if (r.status === 429 || estado === 429 || (j && j.quotaFinished === true) || /MYMEMORY WARNING|YOU USED ALL AVAILABLE FREE/i.test(String(txt || ''))) {
      c.agotado = true; cuotaGuardar(c);
      throw err('cuota', 'MyMemory: se acabó la cuota gratis de hoy');
    }
    cuotaGuardar(c);
    if (!r.ok || estado !== 200 || typeof txt !== 'string' || !txt) throw err('respuesta', 'MyMemory respondió ' + (estado || r.status) + ': ' + ((j && j.responseDetails) || ''));
    return decodificar(txt);
  }
  async function disponible(de, a) {
    const out = {};
    for (const m of CFG.motores) out[m] = MOTORES[m] ? await MOTORES[m].disponible(de, a) : 'desconocido';
    return out;
  }

  // ── Traducir un texto ──
  const enCurso = new Map();
  async function traducir(texto, o) {
    o = o || {};
    const original = String(texto == null ? '' : texto);
    if (!original.trim()) return { texto: original, motor: 'ninguno', de: o.de || '', a: o.a || langActual() };
    const a = LANGS.includes(o.a) ? o.a : langActual();
    const de = LANGS.includes(o.de) ? o.de : await detectar(original);
    if (de === a) return { texto: original, motor: 'ninguno', de, a, igual: true };
    const c = cacheGet(de, a, original);
    if (c) return { texto: c.t, motor: c.m, de, a, cache: true };
    const k = claveCache(de, a, original);
    if (enCurso.has(k)) return enCurso.get(k);
    const p = (async () => {
      const prot = proteger(original, o.protegidos);
      const errores = [];
      for (const nombre of (o.motores || CFG.motores)) {
        const m = MOTORES[nombre];
        if (!m) continue;
        try {
          const crudo = await m.traducir(prot.t, de, a, o);
          const final = restaurar(crudo, prot);
          cacheSet(de, a, original, final, nombre);
          return { texto: final, motor: nombre, de, a };
        } catch (e) { errores.push({ motor: nombre, code: (e && e.code) || 'error', msg: (e && e.message) || String(e) }); }
      }
      const codes = errores.map(x => x.code);
      const code = codes.includes('cuota') && !codes.some(x => x === 'respuesta') ? 'cuota'
        : codes.includes('offline') ? 'offline' : codes.includes('protegidos') ? 'protegidos' : 'error';
      throw err(code, 'No se pudo traducir (' + errores.map(x => x.motor + ': ' + x.code).join(', ') + ')', { errores });
    })();
    enCurso.set(k, p);
    p.finally(() => enCurso.delete(k)).catch(() => {});
    return p;
  }

  // ── Traducciones guardadas en el registro ──
  function srcDe(doc, campo, texto) {
    const e = doc && doc.tr && doc.tr[claveCampo(campo)];
    if (e && LANGS.includes(e.src)) return e.src;
    return detectarRapido(texto != null ? texto : leerCampo(doc, campo)) || 'es';
  }
  function guardada(doc, campo, lang, texto) {
    const e = doc && doc.tr && doc.tr[claveCampo(campo)];
    const orig = texto != null ? texto : leerCampo(doc, campo);
    if (!e || typeof e !== 'object' || e.h !== hash(orig) || typeof e[lang] !== 'string' || !e[lang]) return null;
    return { t: e[lang], m: e[lang + '_m'] || '', guardada: true };
  }
  const rolDe = () => (window.currentUserRole && window.currentUserRole.activo === true ? window.currentUserRole.rol : '');
  const _bloqueadas = new Set(); // colecciones donde una escritura fue rechazada en esta sesión
  function puedePersistir(col, doc) {
    if (CFG.persistir === false || !col || !doc || !doc.id || typeof db === 'undefined' || !db) return false;
    if (_bloqueadas.has(col)) return false;
    if (CFG.persistir === true) return true;
    const rol = rolDe(), uid = window.currentUser && window.currentUser.uid;
    const TEC = ['ADMINISTRADOR', 'ENCARGADO_MANTENIMIENTO', 'SUPERVISOR', 'TECNICO'].includes(rol);
    const SUP = ['ADMINISTRADOR', 'ENCARGADO_MANTENIMIENTO', 'SUPERVISOR'].includes(rol);
    const ENC = ['ADMINISTRADOR', 'ENCARGADO_MANTENIMIENTO'].includes(rol);
    const ALM = ['ADMINISTRADOR', 'ENCARGADO_MANTENIMIENTO', 'ALMACEN'].includes(rol);
    switch (col) {
      case 'ots': // regla /ots update: Técnico+; un aviso 'en_atencion' de otro solo Supervisor+; 'anulada' solo Supervisor+
        if (!TEC) return false;
        if (doc.estado === 'en_atencion' && doc.asignadoUid && doc.asignadoUid !== uid && !SUP) return false;
        if (doc.estado === 'anulada' && !SUP) return false;
        return true;
      case 'capex': return ENC;             // capexCambioValido deja agregar campos que no están congelados
      case 'equipos': return TEC || ALM;    // `tr` no es campo de criticidad
      case 'checklists': case 'permisos_trabajo': return !!CFG.reglasTr && TEC;
      case 'solicitudes_repuestos': return !!CFG.reglasTr && (TEC || ALM);
      default: return false;
    }
  }
  function persistir(col, doc, campo, lang, res, texto) {
    if (!puedePersistir(col, doc) || !res || !res.texto || res.texto.length > 4000) return Promise.resolve(false);
    const k = claveCampo(campo);
    const orig = texto != null ? texto : leerCampo(doc, campo);
    const h = hash(orig);
    const prev = doc.tr && doc.tr[k];
    const ahora = Date.now();
    let cambios, entrada;
    if (prev && typeof prev === 'object' && prev.h === h) {
      cambios = { ['tr.' + k + '.' + lang]: res.texto, ['tr.' + k + '.' + lang + '_m']: res.motor, ['tr.' + k + '.' + lang + '_at']: ahora };
      entrada = Object.assign({}, prev, { [lang]: res.texto, [lang + '_m']: res.motor, [lang + '_at']: ahora });
    } else {
      entrada = { src: res.de, h, [lang]: res.texto, [lang + '_m']: res.motor, [lang + '_at']: ahora };
      cambios = { ['tr.' + k]: entrada };
    }
    cambios.trK = k; // clave escrita: las reglas propuestas validan solo esa entrada (no hay bucles en las reglas)
    doc.tr = Object.assign({}, doc.tr || {}, { [k]: entrada }); // este celular la ve ya
    doc.trK = k;
    return db.collection(col).doc(doc.id).update(cambios).then(() => true).catch(e => {
      if (e && e.code === 'permission-denied') _bloqueadas.add(col);
      console.warn('traductor: no se guardó la traducción en ' + col + '/' + doc.id + ':', (e && e.code) || (e && e.message) || e);
      return false;
    });
  }

  // ── Mostrar en pantalla ──
  const reg = new Map();       // id del texto → { doc, campo, col, original, src }
  const revelados = new Set(); // textos que la persona pidió ver traducidos (sobreviven a repintar la lista)
  function info(doc, campo, o) {
    o = o || {};
    const original = o.texto != null ? String(o.texto) : leerCampo(doc, campo);
    const lang = o.lang || langActual();
    const txt = typeof original === 'string' ? original : (original == null ? '' : String(original));
    if (!txt.trim() || NO_TRADUCIR.has(baseCampo(campo))) return { original: txt, src: lang, lang, necesita: false, traduccion: null };
    const src = o.de || srcDe(doc, campo, txt);
    if (src === lang) return { original: txt, src, lang, necesita: false, traduccion: null };
    const g = guardada(doc, campo, lang, txt) || (cacheGet(src, lang, txt) ? Object.assign({ guardada: false }, cacheGet(src, lang, txt)) : null);
    const id = 'tx' + hash((o.col || '') + '/' + ((doc && doc.id) || '') + '/' + campo + '/' + hash(txt));
    return { id, original: txt, src, lang, necesita: true, traduccion: g ? g.t : null, motor: g ? g.m : '', guardada: !!(g && g.guardada) };
  }
  const visible = inf => !!(inf.traduccion && (CFG.mostrarGuardadas || revelados.has(inf.id + inf.lang)));
  // Texto a mostrar: la traducción si la persona ya la pidió (o mostrarGuardadas); si no, el original.
  function txt(doc, campo, o) { const inf = info(doc, campo, o); return visible(inf) ? inf.traduccion : inf.original; }
  const nombreLang = l => T('lang_' + l, null, l);
  function htmlBoton(inf, mostrando) {
    return mostrando
      ? '<button type="button" class="tx-b" data-tx-acc="original" title="' + esc(T('tx_aviso', null, 'Traducción automática')) + '">' + esc(T('tx_traducido', null, 'Traducido')) + ' · ' + esc(T('tx_verOriginal', null, 'ver original')) + '</button>'
      : '<button type="button" class="tx-b" data-tx-acc="traducir" aria-label="' + esc(T('tx_traducirA', { lang: nombreLang(inf.lang) }, 'Traducir')) + '">' + esc(T('tx_traducir', null, 'Traducir')) + '</button>';
  }
  // HTML seguro: el texto (escapado) y, si está en otro idioma, el botón Traducir.
  // o: { col: 'ots' (para guardar la traducción en el registro), texto (otro texto que mostrar),
  //      protegidos: [nombres extra], tag: 'span'|'div' }
  function html(doc, campo, o) {
    o = o || {};
    css(); escuchar();
    const inf = info(doc, campo, o);
    if (!inf.necesita) return esc(inf.original);
    reg.set(inf.id, { doc, campo, col: o.col || '', original: inf.original, src: inf.src, protegidos: o.protegidos || [] });
    if (reg.size > 3000) reg.delete(reg.keys().next().value);
    const mostrando = visible(inf);
    const tag = o.tag === 'div' ? 'div' : 'span';
    return '<' + tag + ' class="tx" data-tx="' + inf.id + '" lang="' + (mostrando ? inf.lang : inf.src) + '"><span class="tx-t">' + esc(mostrando ? inf.traduccion : inf.original) + '</span> ' + htmlBoton(inf, mostrando) + '</' + tag + '>';
  }
  function pintarId(id, mostrando, texto, lang, src) {
    document.querySelectorAll('[data-tx="' + id + '"]').forEach(el => {
      const t = el.querySelector('.tx-t'); if (t) t.textContent = texto;
      el.setAttribute('lang', mostrando ? lang : src);
      const b = el.querySelector('.tx-b'); if (b) b.outerHTML = htmlBoton({ lang }, mostrando);
      const m = el.querySelector('.tx-msg'); if (m) m.remove();
    });
  }
  async function alTocar(e) {
    const b = e.target.closest && e.target.closest('.tx-b');
    if (!b) return;
    const el = b.closest('[data-tx]'); if (!el) return;
    e.preventDefault(); e.stopPropagation();
    const id = el.getAttribute('data-tx');
    const ctx = reg.get(id); if (!ctx) return;
    const lang = langActual();
    if (b.getAttribute('data-tx-acc') === 'original') { revelados.delete(id + lang); pintarId(id, false, ctx.original, lang, ctx.src); return; }
    const inf = info(ctx.doc, ctx.campo, { texto: ctx.original, col: ctx.col });
    if (inf.traduccion) { revelados.add(id + lang); pintarId(id, true, inf.traduccion, lang, ctx.src); return; }
    b.disabled = true;
    const antes = b.textContent;
    b.textContent = T('tx_traduciendo', null, 'Traduciendo…');
    try {
      const res = await traducir(ctx.original, { de: ctx.src, a: lang, protegidos: terminosDeDoc(ctx.doc).concat(ctx.protegidos), alProgreso: () => { b.textContent = T('tx_descargando', null, '…'); } });
      revelados.add(id + lang);
      pintarId(id, true, res.texto, lang, ctx.src);
      if (ctx.col && res.motor !== 'ninguno') persistir(ctx.col, ctx.doc, ctx.campo, lang, res, ctx.original);
      try { window.dispatchEvent(new CustomEvent('traduccion-lista', { detail: { id, col: ctx.col, docId: ctx.doc && ctx.doc.id, campo: ctx.campo, lang, motor: res.motor } })); } catch (x) {}
    } catch (er) {
      b.disabled = false; b.textContent = antes;
      const msg = er.code === 'cuota' ? T('tx_cuota') : er.code === 'offline' ? T('tx_offline') : T('tx_error', null, 'No se pudo traducir.');
      let m = el.querySelector('.tx-msg');
      if (!m) { m = document.createElement('span'); m.className = 'tx-msg'; m.setAttribute('role', 'status'); el.appendChild(m); }
      m.textContent = ' ' + msg;
    }
  }
  let _escuchando = false;
  function escuchar() { if (_escuchando || typeof document === 'undefined') return; _escuchando = true; document.addEventListener('click', alTocar, true); }
  function css() {
    if (typeof document === 'undefined' || document.getElementById('txCss')) return;
    const s = document.createElement('style');
    s.id = 'txCss';
    s.textContent = '.tx-b{display:inline-flex;align-items:center;min-height:28px;padding:2px 6px;margin-left:2px;border:0;background:none;color:var(--color-primary-text,#2563EB);font:inherit;font-size:11.5px;font-weight:700;text-decoration:underline;text-underline-offset:2px;cursor:pointer;vertical-align:baseline}'
      + '.tx-b:disabled{opacity:.6;cursor:wait}.tx-b:focus-visible{outline:2px solid var(--color-primary,#3B82F6);outline-offset:1px;border-radius:4px}'
      + '.tx-msg{font-size:11.5px;color:var(--color-danger-text,#B91C1C)}';
    (document.head || document.documentElement).appendChild(s);
  }
  // Al cambiar de idioma la traducción visible es de otro idioma: las pantallas repintan
  // (evento 'idioma-cambiado') y html() vuelve a decidir; aquí solo se limpia la caché de términos.
  window.addEventListener('idioma-cambiado', () => { _terminos = null; });

  window.traductor = {
    config, traducir, detectar, detectarRapido, disponible, txt, html, info, persistir, puedePersistir,
    proteger, restaurar, partir, claveCampo, leerCampo, hash, cuota,
    cache: { get: cacheGet, set: cacheSet, limpiar: cacheLimpiar, tam: () => Object.keys(lsCache().e).length },
    CAMPOS, NO_TRADUCIR, _motores: MOTORES, _terminos: () => { _terminos = null; return terminosConocidos(); },
  };
})();
