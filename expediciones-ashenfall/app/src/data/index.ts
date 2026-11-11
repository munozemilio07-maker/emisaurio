import expData from './expeditions.json';
import questData from './quests.json';
import bossData from './bosses.json';
import tileData from './tiles.json';
import type { Boss, Expedition, Kind, Located, Quest } from '../types';

export const EXPEDITIONS = expData.expeditions as unknown as Expedition[];
export const GROUPS = expData.groups as string[];
export const SNAPSHOT_AT = expData.snapshotAt as string | null;
export const QUESTS = questData as unknown as Quest[];
export const BOSSES = bossData as unknown as Boss[];
export const TILES = tileData as unknown as {
  minZoom: number; maxZoom: number;
  layers: Record<string, { name: string; zlayer: number; tiles: Record<string, Record<string, number[]>> }>;
};

export const ALL: Located[] = EXPEDITIONS.flatMap((exp) => exp.stops.map((stop) => ({ stop, exp })));
export const BY_ID = new Map<string, Located>(ALL.map((l) => [l.stop.markerId, l]));
export const TOTAL = ALL.length;
export const expByNumber = (n: number) => EXPEDITIONS[Math.max(1, Math.min(EXPEDITIONS.length, Math.round(n))) - 1];
export const QUEST_BY_KEY = new Map(QUESTS.map((q) => [q.key, q]));

export const KINDS: Kind[] = ['cofre', 'lore', 'mision', 'vault', 'jefe', 'secreto', 'npc', 'viaje'];
export const KIND_LABEL: Record<Kind, string> = {
  cofre: 'Cofre', lore: 'Lore', mision: 'Misión', vault: 'Vault', jefe: 'Jefe', secreto: 'Secreto', npc: 'NPC', viaje: 'Viaje',
};
export const KIND_PLURAL: Record<Kind, string> = {
  cofre: 'Cofres', lore: 'Lore', mision: 'Misiones', vault: 'Vaults', jefe: 'Jefes', secreto: 'Secretos', npc: 'NPC', viaje: 'Viaje',
};
/** Colores fijos por tipo: se leen sobre el mapa oscuro y sobre el pergamino. */
export const KIND_COLOR: Record<Kind, string> = {
  cofre: '#f0b429', lore: '#4cc9e6', mision: '#ff8f3f', vault: '#b794f6',
  jefe: '#ff5468', secreto: '#6fdc8c', npc: '#f3ead3', viaje: '#5b9dff',
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const HAY = new Map<string, string>(
  ALL.map(({ stop, exp }) => [
    stop.markerId,
    norm([stop.title, stop.detail, KIND_LABEL[stop.kind], stop.kind, exp.name, exp.region, ...(stop.recipes ?? []),
      ...(stop.quests ?? []).map((k) => QUEST_BY_KEY.get(k)?.name ?? '')].join(' ')),
  ]),
);

/** Búsqueda global: todas las palabras deben aparecer (título, detalle, tipo, zona, misión). */
export function search(opts: { text?: string; kinds?: Kind[]; exp?: number; pending?: boolean; done: Record<string, number> }): Located[] {
  const words = norm(opts.text ?? '').split(/\s+/).filter(Boolean);
  return ALL.filter(({ stop, exp }) => {
    if (opts.exp && exp.number !== opts.exp) return false;
    if (opts.kinds?.length && !opts.kinds.includes(stop.kind)) return false;
    if (opts.pending && opts.done[stop.markerId]) return false;
    const hay = HAY.get(stop.markerId)!;
    return words.every((w) => hay.includes(w));
  });
}
