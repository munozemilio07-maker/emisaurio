/** Algoritmo de SPEC.md §4: k-means balanceado, vecino más cercano y 2-opt. Determinista (RNG con semilla). */
export type Pt = { lat: number; lng: number };

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const dist = (a: Pt, b: Pt) => Math.hypot(a.lat - b.lat, a.lng - b.lng);

/**
 * K-means con reinicios. La puntuación suma la inercia y una penalización por
 * desbalance de tamaños ((máx − mín) · balance), como los scripts originales.
 */
export function kmeans<T extends Pt>(pts: T[], k: number, rand: () => number, balance = 2e8, restarts = 40, iters = 60) {
  k = Math.max(1, Math.min(k, pts.length));
  let best: { score: number; labels: number[]; centers: Pt[] } | null = null;
  const nearest = (p: Pt, C: Pt[]) => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < C.length; i++) { const d = dist(p, C[i]); if (d < bd) { bd = d; bi = i; } }
    return bi;
  };
  for (let t = 0; t < restarts; t++) {
    const idx = pts.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    let C: Pt[] = idx.slice(0, k).map((i) => ({ lat: pts[i].lat, lng: pts[i].lng }));
    for (let it = 0; it < iters; it++) {
      const sum = C.map(() => ({ lat: 0, lng: 0, n: 0 }));
      for (const p of pts) { const s = sum[nearest(p, C)]; s.lat += p.lat; s.lng += p.lng; s.n++; }
      const next = sum.map((s, i) => (s.n ? { lat: s.lat / s.n, lng: s.lng / s.n } : C[i]));
      const moved = next.some((c, i) => dist(c, C[i]) > 1);
      C = next;
      if (!moved) break;
    }
    const labels = pts.map((p) => nearest(p, C));
    const sizes = C.map(() => 0);
    let sse = 0;
    labels.forEach((l, i) => { sizes[l]++; sse += dist(pts[i], C[l]) ** 2; });
    const score = sse + (Math.max(...sizes) - Math.min(...sizes)) * balance;
    if (!best || score < best.score) best = { score, labels, centers: C };
  }
  return best!;
}

/** Largo de la ruta abierta que sale de `start` y recorre `order`. */
export function tourLength(order: Pt[], start: Pt) {
  let L = order.length ? dist(start, order[0]) : 0;
  for (let i = 0; i + 1 < order.length; i++) L += dist(order[i], order[i + 1]);
  return L;
}

/** Vecino más cercano desde `start` y luego mejora 2-opt (ruta abierta, el inicio queda fijo). */
export function tour<T extends Pt>(pts: T[], start: Pt): T[] {
  const rem = pts.slice();
  const out: T[] = [];
  let cur: Pt = start;
  while (rem.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < rem.length; i++) { const d = dist(cur, rem[i]); if (d < bd) { bd = d; bi = i; } }
    cur = rem[bi]; out.push(rem[bi]); rem.splice(bi, 1);
  }
  return twoOpt(out, start);
}

export function twoOpt<T extends Pt>(route: T[], start: Pt): T[] {
  const out = route.slice();
  const n = out.length;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        // invertir out[i..j]: cambian las aristas (i-1,i) y (j,j+1)
        const a = i === 0 ? start : out[i - 1];
        const before = dist(a, out[i]) + (j + 1 < n ? dist(out[j], out[j + 1]) : 0);
        const after = dist(a, out[j]) + (j + 1 < n ? dist(out[i], out[j + 1]) : 0);
        if (after < before - 1) {
          for (let l = i, r = j; l < r; l++, r--) [out[l], out[r]] = [out[r], out[l]];
          improved = true;
        }
      }
    }
  }
  return out;
}

/** Inserta `p` en la posición de `route` que menos alarga la ruta. Devuelve el índice. */
export function cheapestInsertion<T extends Pt>(route: T[], p: T): number {
  if (!route.length) { route.push(p); return 0; }
  let bi = route.length, bd = dist(route[route.length - 1], p);
  for (let i = 0; i < route.length; i++) {
    const prev = i === 0 ? null : route[i - 1];
    const d = prev ? dist(prev, p) + dist(p, route[i]) - dist(prev, route[i]) : dist(p, route[0]);
    if (d < bd) { bd = d; bi = i; }
  }
  route.splice(bi, 0, p);
  return bi;
}
