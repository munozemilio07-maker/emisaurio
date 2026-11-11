/**
 * Ejecución de las 5 herramientas del chat (SPEC.md §6) contra el estado local.
 * Sus definiciones para Claude están en tool-defs.ts (las usa el Worker).
 */
import { EXPEDITIONS, KIND_LABEL, KINDS, search } from '../data';
import type { Kind } from '../types';

const N = EXPEDITIONS.length;

/** Lo que las herramientas necesitan de la app. Así se pueden probar sin navegador. */
export interface ToolHost {
  done: () => Record<string, number>;
  openExp: (n: number) => void;
  select: (markerId: string) => void;
  setMany: (ids: string[], value: boolean) => void;
}

const findExp = (n: unknown) => {
  const i = Math.round(Number(n));
  if (!(i >= 1 && i <= N)) throw new Error(`Número de expedición inválido (1–${N})`);
  return EXPEDITIONS[i - 1];
};

export function runTool(name: string, input: Record<string, unknown>, host: ToolHost): unknown {
  const done = host.done();
  switch (name) {
    case 'buscar_paradas': {
      const tipo = KINDS.includes(input.tipo as Kind) ? [input.tipo as Kind] : undefined;
      const hits = search({ text: String(input.texto ?? ''), kinds: tipo, exp: input.expedicion ? findExp(input.expedicion).number : undefined, pending: !!input.solo_pendientes, done });
      return {
        total: hits.length,
        resultados: hits.slice(0, 25).map(({ stop, exp }) => ({
          expedicion: exp.number, zona: `${exp.name} (${exp.region})`, parada: stop.order, nombre: stop.title,
          tipo: KIND_LABEL[stop.kind], detalle: stop.detail || undefined, nota: stop.note, recetas: stop.recipes,
          subterraneo: stop.underground || undefined, hecha: !!done[stop.markerId],
        })),
      };
    }
    case 'ver_expedicion': {
      const e = findExp(input.numero);
      return {
        expedicion: e.number, zona: e.name, region: e.region,
        hechas: e.stops.filter((s) => done[s.markerId]).length, total: e.stops.length,
        paradas: e.stops.map((s) => `${s.order}. [${KIND_LABEL[s.kind]}] ${s.title}${s.detail ? ` (${s.detail})` : ''}${done[s.markerId] ? ' ✓' : ''}`),
      };
    }
    case 'progreso': {
      const total = EXPEDITIONS.reduce((n, e) => n + e.stops.length, 0);
      const hechas = EXPEDITIONS.reduce((n, e) => n + e.stops.filter((s) => done[s.markerId]).length, 0);
      return {
        total: `${hechas}/${total}`,
        expediciones: EXPEDITIONS.map((e) => `${e.number}. ${e.name} — ${e.region}: ${e.stops.filter((s) => done[s.markerId]).length}/${e.stops.length}`),
      };
    }
    case 'mostrar_en_mapa': {
      const e = findExp(input.expedicion);
      if (input.parada == null) { host.openExp(e.number); return `Mostrando la expedición ${e.number}: ${e.name}`; }
      const s = e.stops[Math.round(Number(input.parada)) - 1];
      if (!s) throw new Error(`Esa parada no existe: la expedición ${e.number} tiene ${e.stops.length}`);
      host.openExp(e.number);
      host.select(s.markerId);
      return `Mostrando la expedición ${e.number}, parada ${s.order}: ${s.title}`;
    }
    case 'marcar_hecho': {
      const e = findExp(input.expedicion);
      const value = input.hecho !== false;
      const list = Array.isArray(input.paradas) ? input.paradas : [];
      const stops = list.map((p) => e.stops[Math.round(Number(p)) - 1]).filter(Boolean);
      if (!stops.length) throw new Error('Ninguna de esas paradas existe en la expedición');
      host.setMany(stops.map((s) => s.markerId), value);
      return { expedicion: e.number, hecho: value, paradas: stops.map((s) => `${s.order}. ${s.title}`) };
    }
    default:
      throw new Error(`Herramienta desconocida: ${name}`);
  }
}
