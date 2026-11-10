// spc.js — (10 nov 2026) Control estadístico de las lecturas de checklist (cálculo puro, sin Firebase).
// Lo usa analisis.html (Tendencias → "Cambios anormales") y las pruebas.
//
// Gráfica de valores individuales (I-MR): la media y la variación normal (σ = rango móvil promedio / 1.128)
// salen de la HISTORIA de cada equipo y punto, no de la especificación. Así se ve un cambio raro aunque la
// lectura siga dentro del mínimo y el máximo — el aviso más temprano posible de que algo empezó a fallar.
// Reglas (Western Electric), sobre las lecturas más recientes:
//   R1  una lectura fuera de media ± 3σ
//   R2  2 de las últimas 3 más allá de 2σ, del mismo lado
//   R3  las últimas 8 del mismo lado de la media (corrimiento)
// La base es la historia sin las últimas 5 lecturas (si hay 12 o más) para que el cambio no esconda el cambio.
(function (raiz) {
  'use strict';
  const MIN_N = 8;
  function base(vals) {
    const b = vals.length >= 12 ? vals.slice(0, vals.length - 5) : vals.slice();
    const media = b.reduce((a, x) => a + x, 0) / b.length;
    let mr = 0; for (let i = 1; i < b.length; i++) mr += Math.abs(b[i] - b[i - 1]);
    const sigma = b.length > 1 ? (mr / (b.length - 1)) / 1.128 : 0;
    return { media, sigma, n: b.length };
  }
  // valores en orden de fecha → { regla, media, sigma, lcs, lci, ultimo, n } o null (sin señal / pocos datos)
  function evaluar(vals) {
    const v = (vals || []).map(Number).filter(isFinite);
    if (v.length < MIN_N) return null;
    const B = base(v);
    if (!(B.sigma > 0)) return null;
    const { media, sigma } = B, z = x => (x - media) / sigma;
    const u = v[v.length - 1], ult3 = v.slice(-3), ult8 = v.slice(-8);
    let regla = '';
    if (Math.abs(z(u)) > 3) regla = 'R1';
    else if (ult3.filter(x => z(x) > 2).length >= 2 || ult3.filter(x => z(x) < -2).length >= 2) regla = 'R2';
    else if (v.length >= 12 && (ult8.every(x => x > media) || ult8.every(x => x < media))) regla = 'R3';
    if (!regla) return null;
    const lado = (regla === 'R3' ? ult8[0] : u) > media ? 'sube' : 'baja';
    return { regla, lado, media, sigma, lcs: media + 3 * sigma, lci: media - 3 * sigma, ultimo: u, n: v.length };
  }
  // grupos de tendencias.js (Map o lista con .lecturas [{valor, min, max, fecha}]) → señales, sin las que ya
  // están fuera de especificación (esas ya salen como "Fuera de rango").
  function senales(grupos) {
    const out = [];
    (grupos instanceof Map ? [...grupos.values()] : grupos || []).forEach(g => {
      const L = (g.lecturas || []).filter(l => isFinite(Number(l.valor)));
      const s = evaluar(L.map(l => Number(l.valor)));
      if (!s) return;
      const u = L[L.length - 1];
      if ((u.max != null && u.valor > u.max) || (u.min != null && u.valor < u.min)) return;
      out.push(Object.assign({ key: g.key, equipoId: g.equipoId, equipoNombre: g.equipoNombre, punto: g.punto, unidad: u.unidad || g.unidad || '', fecha: u.fecha, min: u.min, max: u.max }, s));
    });
    const ord = { R1: 0, R2: 1, R3: 2 };
    return out.sort((a, b) => ord[a.regla] - ord[b.regla]);
  }
  const api = { evaluar, senales, base };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  raiz.VTSpc = api;
})(typeof window !== 'undefined' ? window : globalThis);
