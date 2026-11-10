// weibull.js — (10 nov 2026) Patrón de falla por equipo con Weibull (cálculo puro, sin Firebase).
// Lo usa analisis.html (Equipos → "Patrón de falla") y las pruebas.
//
// Con los días entre fallas correctivas de un equipo se estiman β (forma) y η (escala) por regresión
// de rangos medianos (aproximación de Bernard: F = (i − 0.3) / (n + 0.4)), el método estándar de papel
// Weibull. β dice CÓMO falla el equipo y por lo tanto qué estrategia sirve:
//   β < 0.9   fallas tempranas (después de reparar o instalar): el preventivo por tiempo NO ayuda;
//             revisar calidad de la reparación, montaje, repuestos y arranque.
//   0.9–1.2   fallas al azar: el preventivo por tiempo NO ayuda; inspección por condición y repuesto a mano.
//   β > 1.2   desgaste: el preventivo por tiempo SÍ ayuda; intervalo sugerido = vida B10 (el tiempo en
//             que fallaría el 10 %), es decir, con 90 % de probabilidad de llegar sin falla.
// Confianza según cuántos intervalos hay (n) y qué tan bien se ajusta la recta (R²).
// No usa el tiempo desde la última falla (sin censura): es una estimación para decidir, no un estudio.
(function (raiz) {
  'use strict';
  // Γ(z) por Lanczos (g = 7)
  const G = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function gamma(z) {
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    z -= 1; let x = G[0]; for (let i = 1; i < 9; i++) x += G[i] / (z + i);
    const t = z + 7.5; return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }
  // tiempos (> 0) → { n, beta, eta, r2, media, b10 } o null si hay menos de 3
  function ajustar(tiempos) {
    const t = (tiempos || []).map(Number).filter(v => isFinite(v) && v > 0).sort((a, b) => a - b);
    const n = t.length;
    if (n < 3) return null;
    const xs = [], ys = [];
    t.forEach((v, i) => { const F = (i + 1 - 0.3) / (n + 0.4); xs.push(Math.log(v)); ys.push(Math.log(-Math.log(1 - F))); });
    const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
    if (sxx === 0) return null; // todos los intervalos iguales
    const beta = sxy / sxx, b0 = my - beta * mx;
    if (!(beta > 0)) return null;
    const eta = Math.exp(-b0 / beta);
    const r2 = syy > 0 ? (sxy * sxy) / (sxx * syy) : 0;
    return { n, beta, eta, r2, media: eta * gamma(1 + 1 / beta), b10: eta * Math.pow(-Math.log(0.9), 1 / beta) };
  }
  function patron(beta) { return beta == null ? '' : beta < 0.9 ? 'temprana' : beta <= 1.2 ? 'azar' : 'desgaste'; }
  function confianza(n, r2) {
    if (!n || n < 5) return 'insuficiente';
    let c = n >= 20 ? 'alta' : n >= 10 ? 'media' : 'baja';
    if (r2 < 0.8) c = c === 'alta' ? 'media' : 'baja';
    return c;
  }
  // Fechas de falla (YYYY-MM-DD, puede haber repetidas) → intervalos en días entre días distintos
  function intervalos(fechas) {
    const dias = [...new Set((fechas || []).filter(f => /^\d{4}-\d{2}-\d{2}/.test(f)).map(f => f.slice(0, 10)))].sort();
    const ms = dias.map(f => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(f); return Date.UTC(+m[1], +m[2] - 1, +m[3]); });
    const out = [];
    for (let i = 1; i < ms.length; i++) out.push(Math.round((ms[i] - ms[i - 1]) / 86400000));
    return out.filter(d => d > 0);
  }
  // grupos: [{ clave, nombre, fechas: [...] , frecuenciaPM? }] → filas con análisis y recomendación
  function analizar(grupos) {
    return (grupos || []).map(g => {
      const iv = intervalos(g.fechas);
      const a = ajustar(iv);
      const p = a ? patron(a.beta) : '';
      const conf = confianza(a ? a.n : iv.length, a ? a.r2 : 0);
      let rec = 'datos';
      if (a && conf !== 'insuficiente') rec = p === 'desgaste' ? 'preventivo' : p === 'azar' ? 'condicion' : 'calidad';
      return Object.assign({}, g, { fallas: iv.length + (g.fechas && g.fechas.length ? 1 : 0), intervalos: iv.length, ajuste: a, patron: p, confianza: conf, recomendacion: rec,
        intervaloSugerido: a && p === 'desgaste' ? Math.max(1, Math.round(a.b10)) : null });
    }).sort((x, y) => (x.confianza === 'insuficiente') - (y.confianza === 'insuficiente') || (y.fallas - x.fallas));
  }
  const api = { gamma, ajustar, patron, confianza, intervalos, analizar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.VTWeibull = api;
})(typeof window !== 'undefined' ? window : globalThis);
