/**
 * Progreso por markerId. Cada cambio guarda su marca de tiempo para poder
 * fusionar entre dispositivos: gana el cambio más reciente de cada parada.
 */
export interface Progress {
  /** markerId → cuándo se marcó como hecha (ms) */
  done: Record<string, number>;
  /** markerId → cuándo se desmarcó (ms). Solo sirve para sincronizar. */
  undone: Record<string, number>;
}

export const emptyProgress = (): Progress => ({ done: {}, undone: {} });

export function mergeProgress(a: Progress, b: Progress): Progress {
  const out = emptyProgress();
  const ids = new Set([...Object.keys(a.done), ...Object.keys(a.undone), ...Object.keys(b.done), ...Object.keys(b.undone)]);
  for (const id of ids) {
    const d = Math.max(a.done[id] ?? 0, b.done[id] ?? 0);
    const u = Math.max(a.undone[id] ?? 0, b.undone[id] ?? 0);
    if (d >= u && d > 0) out.done[id] = d;
    else if (u > 0) out.undone[id] = u;
  }
  return out;
}

export const sameProgress = (a: Progress, b: Progress) => {
  const ka = Object.keys(a.done), kb = Object.keys(b.done);
  const ua = Object.keys(a.undone), ub = Object.keys(b.undone);
  return ka.length === kb.length && ua.length === ub.length && ka.every((k) => a.done[k] === b.done[k]) && ua.every((k) => a.undone[k] === b.undone[k]);
};

export interface ExportFile {
  app: 'expediciones-ashenfall';
  version: 2;
  exportedAt: string;
  done: Record<string, number>;
  undone: Record<string, number>;
}

export function exportProgress(p: Progress): ExportFile {
  return { app: 'expediciones-ashenfall', version: 2, exportedAt: new Date().toISOString(), done: p.done, undone: p.undone };
}

/**
 * Acepta el formato propio, el `aw-done` de la v4 ({ markerId: 1 }) o una lista de ids.
 * Devuelve null si el JSON no es un progreso reconocible.
 */
export function parseImport(raw: unknown, now = Date.now()): Progress | null {
  const isId = (s: unknown): s is string => typeof s === 'string' && /^[0-9a-f]{32}$/i.test(s);
  const fromMap = (m: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (!m || typeof m !== 'object') return out;
    for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
      if (!isId(k) || !v) continue;
      out[k] = typeof v === 'number' && v > 1e11 ? v : now; // v4 guardaba 1: se usa la hora de importación
    }
    return out;
  };
  if (Array.isArray(raw)) {
    const ids = raw.filter(isId);
    return ids.length ? { done: Object.fromEntries(ids.map((i) => [i, now])), undone: {} } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.done && typeof o.done === 'object') return { done: fromMap(o.done), undone: fromMap(o.undone) };
  const legacy = fromMap(o);
  return Object.keys(legacy).length ? { done: legacy, undone: {} } : null;
}
