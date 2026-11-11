import { describe, expect, it } from 'vitest';
import data from '../src/data/expeditions.json';
import quests from '../src/data/quests.json';
import base from '../data/base-expeditions.json';
import { mergeProgress, parseImport } from '../src/state/progress';
import { kmeans, rng, tour, tourLength } from '../scripts/lib/algo';

const stops = data.expeditions.flatMap((e) => e.stops.map((s) => ({ ...s, exp: e.number })));
const byId = new Map(stops.map((s) => [s.markerId, s]));

describe('expediciones generadas', () => {
  it('no repite marcadores y numera en orden', () => {
    expect(byId.size).toBe(stops.length);
    data.expeditions.forEach((e, i) => {
      expect(e.number).toBe(i + 1);
      e.stops.forEach((s, j) => expect(s.order).toBe(j + 1));
    });
  });

  it('conserva todas las paradas base (el progreso de la v4 no se pierde)', () => {
    for (const e of base.expeditions) for (const s of e.stops) expect(byId.get(s.markerId)?.exp, s.title).toBe(e.number);
  });

  it('cubre Umbral Sands y Scorned Wilderness', () => {
    const groups = new Set(data.expeditions.map((e) => e.group));
    expect(groups.has('Umbral Sands')).toBe(true);
    expect(groups.has('Scorned Wilderness')).toBe(true);
    const lodestone = stops.find((s) => s.title === 'Umbral Sands Lodestone');
    expect(data.expeditions[lodestone!.exp - 1].group).toBe('Umbral Sands');
    expect(data.expeditions[stops.find((s) => s.title === 'Kalphite Queen')!.exp - 1].group).toBe('Umbral Sands');
  });

  it('corrige los problemas de SPEC §5', () => {
    expect(byId.get('fa19d1164853f8588de69fa9b7a35b59')?.title).toBe('The Pride of the Avernic');
    expect(byId.get('e65b8cd56d81bf783e6039ad61aa36d0')?.title).toBe('The Binding of Ib');
    const abraxus = stops.find((s) => s.title.startsWith('Abraxus'))!;
    expect(abraxus.quests).toEqual(['quest_what_remains']);
    expect(stops.find((s) => s.title === 'Offalfoot')?.note).toBeTruthy();
    expect(stops.find((s) => s.title === 'Putrilius')?.note).toBeTruthy();
    expect(quests.find((q) => q.key === 'quest_sq1')?.name).toBe("What's Theirs is Mine!");
  });

  it('los pasos de las misiones apuntan a paradas reales y Abraxus va primero', () => {
    for (const q of quests) for (const st of q.steps) expect(byId.has(st.markerId), `${q.name}: ${st.title}`).toBe(true);
    expect(quests.find((q) => q.key === 'quest_what_remains')!.steps[0].title).toMatch(/Abraxus/);
  });
});

describe('algoritmo (SPEC §4)', () => {
  const pts = Array.from({ length: 60 }, (_, i) => ({ lat: (i % 3) * 50000 + ((i * 7919) % 4000), lng: ((i * 104729) % 5000) + (i % 3) * 1000 }));
  it('k-means separa grupos evidentes y es determinista', () => {
    const a = kmeans(pts, 3, rng(1));
    const b = kmeans(pts, 3, rng(1));
    expect(a.labels).toEqual(b.labels);
    for (let g = 0; g < 3; g++) expect(new Set(pts.map((_, i) => i).filter((i) => i % 3 === g).map((i) => a.labels[i])).size).toBe(1);
  });
  it('2-opt nunca empeora al vecino más cercano y visita todo', () => {
    const start = { lat: 0, lng: 0 };
    const t = tour(pts, start);
    expect(new Set(t).size).toBe(pts.length);
    const shuffled = pts.slice().reverse();
    expect(tourLength(t, start)).toBeLessThanOrEqual(tourLength(shuffled, start));
  });
});

describe('progreso', () => {
  const A = 'a'.repeat(32), B = 'b'.repeat(32);
  it('importa el formato de la v4 y el propio', () => {
    expect(Object.keys(parseImport({ [A]: 1, [B]: 1 })!.done)).toEqual([A, B]);
    expect(parseImport({ done: { [A]: 1731200000000 }, undone: {} })!.done[A]).toBe(1731200000000);
    expect(parseImport({ hola: 1 })).toBeNull();
    expect(parseImport('x')).toBeNull();
  });
  it('al fusionar gana el cambio más reciente de cada parada', () => {
    const m = mergeProgress({ done: { [A]: 10, [B]: 10 }, undone: {} }, { done: {}, undone: { [A]: 20, [B]: 5 } });
    expect(m.done).toEqual({ [B]: 10 });
    expect(m.undone).toEqual({ [A]: 20 });
  });
});
