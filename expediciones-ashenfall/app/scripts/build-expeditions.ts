/**
 * build-expeditions.ts — genera las expediciones de TODO el mapa (SPEC.md §4).
 *
 *   npm run expeditions            conserva las expediciones base (1–25) y genera las regiones nuevas
 *   npm run expeditions -- --fresh regenera todo desde cero con el mismo algoritmo
 *
 * Entradas:  data/snapshot/markers.json, data/base-expeditions.json, config/*.json
 * Salidas:   src/data/expeditions.json, src/data/quests.json
 *
 * Pasos: 1) filtrar y etiquetar marcadores  2) deduplicar por celda (prefiere pines de misión)
 * 3) asignar región con config/regions.json  4) k-means balanceado por región
 * 5) encadenar expediciones; dentro de cada una, vecino más cercano + 2-opt
 * 6) nombrar con el landmark libre más cercano al centroide.
 * El progreso del jugador se guarda por markerId, así que regenerar no borra checks.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cheapestInsertion, dist, kmeans, rng, tour, tourLength, twoOpt, type Pt } from './lib/algo.ts';
import { metaforgeUrl } from '../src/lib/geo.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRESH = process.argv.includes('--fresh');
const readJson = async (p: string) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

type Kind = 'cofre' | 'lore' | 'mision' | 'vault' | 'jefe' | 'secreto' | 'npc' | 'viaje';
interface Raw { id: string; lat: number; lng: number; category: string; subcategory: string; zlayers?: number; instanceName?: string }
interface Rule { zlayer?: number; latMin?: number; latMax?: number; lngMin?: number; lngMax?: number }
interface Region {
  id: string; name: string; group: string; order: number; layer?: string; any: Rule[];
  k: number | 'auto'; balance?: number; seed?: number; start: [number, number]; landmarks: [string, number, number][];
}
interface Cand extends Pt {
  id: string; sub: string; cat: string; layer: 'surface' | 'dowdun'; kind: Kind; title: string; detail: string;
  quests: { key: string; title: string }[]; note?: string; recipes?: string[]; isQuestPin: boolean;
}
interface Exp { region: Region; name: string; stops: Cand[]; locked?: number }

const titleCase = (s: string) =>
  s.replace(/_/g, ' ').replace(/(^|[\s-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

async function main() {
  const snap = await readJson('data/snapshot/markers.json');
  const meta = await readJson('data/snapshot/meta.json').catch(() => ({}));
  const regCfg = await readJson('config/regions.json');
  const mk = await readJson('config/markers.json');
  const qCfg = (await readJson('config/quests.json')).quests as Record<string, { name: string; type: string; region: string; order?: string[]; parent?: string; clan?: string }>;
  const ov = await readJson('config/overrides.json');
  const base = await readJson('data/base-expeditions.json');
  const regions: Region[] = regCfg.regions;
  const CELL: number = regCfg.dedupeCell;
  const raws: Raw[] = snap.data;

  const questName = (key: string) => qCfg[key]?.name ?? titleCase(key.replace(/^quest_/, ''));
  const unknownQuests = new Set<string>();

  // ── 1) Filtrar y etiquetar ────────────────────────────────────────────────
  const kindRule = (sub: string) => {
    if (mk.kinds[sub]) return mk.kinds[sub];
    const pre = Object.keys(mk.kinds).find((k) => k.endsWith('_') && sub.startsWith(k));
    return pre ? mk.kinds[pre] : null;
  };
  const label = (r: Raw): Cand | null => {
    const forced = ov.forceInclude.includes(r.id);
    if (!forced) {
      if (!mk.includeCategories.includes(r.category)) return null;
      if (mk.exclude.some((p: string) => r.subcategory.startsWith(p))) return null;
    }
    const sub = r.subcategory;
    const name = (r.instanceName ?? '').trim();
    const rule = kindRule(sub);
    let kind: Kind, title: string, detail = '';
    const quests: { key: string; title: string }[] = [];
    if (sub.startsWith('quest_')) {
      kind = 'mision'; title = name || questName(sub); detail = questName(sub);
      quests.push({ key: sub, title });
      if (!qCfg[sub]) unknownQuests.add(sub);
    } else if (rule) {
      kind = rule.kind;
      title = rule.title ?? mk.names[sub] ?? (rule.prefix ? `${rule.prefix} ${rule.lastWord ? name.split(' ').at(-1) ?? '' : name || 'circuito'}`.trim() : name || rule.fallback || mk.names[sub] || titleCase(sub));
      detail = rule.detail ?? '';
      if (rule.quest) { quests.push({ key: rule.quest, title }); if (!detail || kind === 'secreto') detail = detail || questName(rule.quest); }
    } else {
      kind = mk.categories[r.category] ?? 'npc';
      title = mk.names[sub] ?? (name || titleCase(sub) || 'Sin nombre');
      detail = kind === 'jefe' ? 'Enemigo importante' : kind === 'npc' ? 'NPC' : '';
    }
    return {
      id: r.id, sub, cat: r.category, lat: Math.round(r.lat), lng: Math.round(r.lng),
      layer: r.zlayers === 2 ? 'dowdun' : 'surface', kind, title, detail, quests, isQuestPin: r.category === 'quest',
    };
  };

  const applyOverride = (c: Cand) => {
    const sets: any[] = [];
    for (const r of ov.rules) {
      if (r.subcategory && r.subcategory !== c.sub) continue;
      if (r.titleIncludes && !c.title.toLowerCase().includes(r.titleIncludes.toLowerCase())) continue;
      sets.push(r.set);
    }
    if (ov.stops[c.id]) sets.push(ov.stops[c.id]);
    for (const s of sets) {
      if (s.title) c.title = s.title;
      if (s.kind) c.kind = s.kind;
      if (s.note) c.note = s.note;
      if (s.layer) c.layer = s.layer;
      if (s.quest) { c.quests = [{ key: s.quest, title: c.title }]; c.detail = questName(s.quest); }
      if (s.detail) c.detail = s.detail;
    }
  };

  const baseStops = new Map<string, { exp: number; title: string }>();
  if (!FRESH) for (const e of base.expeditions) for (const s of e.stops) baseStops.set(s.markerId, { exp: e.number, title: s.title });

  const all: Cand[] = [];
  for (const r of raws) {
    const c = label(r);
    if (!c) continue;
    const b = baseStops.get(c.id);
    if (b) { c.title = b.title; if (c.quests[0] && c.isQuestPin) c.quests[0].title = b.title; }
    applyOverride(c);
    if (c.layer === 'dowdun') c.detail = c.detail ? `${c.detail} · Subterráneo` : 'Subterráneo';
    all.push(c);
  }

  // Recetas únicas: se anotan en el vault más cercano en vez de ser parada
  const vaults = all.filter((c) => c.sub === 'vault');
  for (const r of raws) {
    if (r.subcategory !== 'unique_recipe' || !r.instanceName) continue;
    const v = vaults.slice().sort((a, b) => dist(a, r) - dist(b, r))[0];
    if (v && dist(v, r) < 2000) (v.recipes ??= []).push(r.instanceName.replace(/\s*-\s*inside Vault/i, ''));
  }

  // ── 2) Deduplicar por celda ───────────────────────────────────────────────
  // Prioridad: paradas base (para no moverlas) > pines de misión > resto.
  const prio = (c: Cand) => (baseStops.has(c.id) ? 2 : 0) + (c.isQuestPin ? 1 : 0);
  const cells = new Map<string, Cand>();
  const kept: Cand[] = [];
  for (const c of all.slice().sort((a, b) => prio(b) - prio(a))) {
    const key = `${Math.round(c.lat / CELL)}|${Math.round(c.lng / CELL)}|${c.layer}`;
    const prev = cells.get(key);
    if (!prev) { cells.set(key, c); kept.push(c); continue; }
    if (baseStops.has(c.id)) { kept.push(c); continue; } // dos paradas base en la misma celda: se conservan ambas
    for (const q of c.quests) if (!prev.quests.some((p) => p.key === q.key)) prev.quests.push(q);
    if (c.note && !prev.note) prev.note = c.note;
  }

  // ── 3) Región ─────────────────────────────────────────────────────────────
  const matches = (c: Cand, r: Rule) =>
    (r.zlayer === undefined || (r.zlayer === 2) === (c.layer === 'dowdun')) &&
    (r.latMin === undefined || c.lat >= r.latMin) && (r.latMax === undefined || c.lat < r.latMax) &&
    (r.lngMin === undefined || c.lng >= r.lngMin) && (r.lngMax === undefined || c.lng < r.lngMax);
  const regionOf = (c: Cand) => regions.find((r) => r.any.some((rule) => matches(c, rule)));

  // ── 4–6) Expediciones ─────────────────────────────────────────────────────
  const exps: Exp[] = [];
  const byRegion = new Map<string, Cand[]>();
  const unassigned: Cand[] = [];
  const baseRegionByName = new Map<string, Region>(regions.map((r) => [r.name.toLowerCase(), r]));

  if (!FRESH) {
    const byId = new Map(kept.map((c) => [c.id, c]));
    for (const e of base.expeditions) {
      const region = baseRegionByName.get(String(e.region).toLowerCase());
      if (!region) throw new Error(`La expedición base ${e.number} usa una región que no está en regions.json: ${e.region}`);
      const stops = e.stops.map((s: any) => byId.get(s.markerId)).filter(Boolean) as Cand[];
      const gone = e.stops.length - stops.length;
      if (gone) console.log(`  ⚠ Exp. ${e.number}: ${gone} parada(s) ya no existen en MetaForge y se quitaron`);
      exps.push({ region, name: e.name[0].toUpperCase() + e.name.slice(1), stops, locked: e.number });
    }
  }
  const lockedIds = new Set(exps.flatMap((e) => e.stops.map((s) => s.id)));
  for (const c of kept) {
    if (lockedIds.has(c.id)) continue;
    const r = regionOf(c);
    if (!r) { unassigned.push(c); continue; }
    if (!byRegion.has(r.id)) byRegion.set(r.id, []);
    byRegion.get(r.id)!.push(c);
  }

  const inserted: Record<number, number> = {};
  const ordered = regions.slice().sort((a, b) => a.order - b.order);
  for (const region of ordered) {
    const P = byRegion.get(region.id) ?? [];
    const lockedHere = exps.filter((e) => e.locked && e.region.id === region.id);
    if (lockedHere.length) {
      // Región con expediciones base: lo nuevo se inserta donde menos alarga la ruta.
      for (const c of P) {
        let best = lockedHere[0], bd = Infinity;
        for (const e of lockedHere) for (const s of e.stops) { const d = dist(s, c); if (d < bd) { bd = d; best = e; } }
        cheapestInsertion(best.stops, c);
        inserted[best.locked!] = (inserted[best.locked!] ?? 0) + 1;
      }
      continue;
    }
    if (!P.length) continue;
    const rand = rng(region.seed ?? 1);
    const k = region.k === 'auto' ? Math.max(1, Math.round(P.length / regCfg.targetSize)) : region.k;
    const { labels, centers } = kmeans(P, k, rand, region.balance ?? 2e8);
    const groups = centers.map((_, i) => P.filter((_, j) => labels[j] === i));
    let cur: Pt = { lat: region.start[0], lng: region.start[1] };
    const rem = centers.map((_, i) => i).filter((i) => groups[i].length);
    const used = new Set<string>();
    while (rem.length) {
      rem.sort((a, b) => dist(cur, centers[a]) - dist(cur, centers[b]));
      const i = rem.shift()!;
      const stops = tour(groups[i], cur);
      exps.push({ region, name: nameFor(region, centers[i], stops, used), stops });
      cur = stops[stops.length - 1];
    }
  }

  function nameFor(region: Region, c: Pt, stops: Cand[], used: Set<string>) {
    const spread = Math.max(...stops.map((s) => dist(s, c)), 1);
    const free = region.landmarks.filter((l) => !used.has(l[0]));
    const lm = free.sort((a, b) => dist(c, { lat: a[1], lng: a[2] }) - dist(c, { lat: b[1], lng: b[2] }))[0];
    if (lm && dist(c, { lat: lm[1], lng: lm[2] }) <= spread * 1.2) { used.add(lm[0]); return lm[0]; }
    // Sin landmark cercano: la parada más notable de la expedición
    const rank: Kind[] = ['vault', 'jefe', 'viaje', 'npc', 'mision', 'lore', 'secreto', 'cofre'];
    const notable = stops.filter((s) => !used.has(s.title)).sort((a, b) => rank.indexOf(a.kind) - rank.indexOf(b.kind) || dist(a, c) - dist(b, c))[0];
    const n = notable ? notable.title.split(' - ')[0] : `${region.group} ${used.size + 1}`;
    used.add(notable?.title ?? n);
    return n;
  }

  // Orden final: progresión del juego; las base conservan su número.
  exps.sort((a, b) => (a.locked ?? 1e6) - (b.locked ?? 1e6) || a.region.order - b.region.order);
  if (FRESH) exps.sort((a, b) => a.region.order - b.region.order);

  // ── Salida ────────────────────────────────────────────────────────────────
  const stopIndex = new Map<string, { exp: number; stop: number }>();
  const outExps = exps.map((e, i) => {
    const number = i + 1;
    return {
      id: `exp-${String(number).padStart(2, '0')}`, number,
      regionId: e.region.id, region: e.region.name, group: e.region.group, name: e.name,
      layer: e.region.layer ?? 'surface', underground: (e.region.layer ?? 'surface') !== 'surface',
      length: Math.round(tourLength(e.stops, e.stops[0] ?? { lat: 0, lng: 0 })),
      stops: e.stops.map((s, j) => {
        stopIndex.set(s.id, { exp: number, stop: j + 1 });
        return {
          order: j + 1, markerId: s.id, kind: s.kind, title: s.title, detail: s.detail,
          lat: s.lat, lng: s.lng, layer: s.layer, underground: s.layer !== 'surface',
          ...(s.quests.length ? { quests: s.quests.map((q) => q.key) } : {}),
          ...(s.recipes?.length ? { recipes: s.recipes } : {}),
          ...(s.note ? { note: s.note } : {}),
          metaforgeUrl: metaforgeUrl(s.id),
        };
      }),
    };
  });

  // Misiones: pasos en orden (config/quests.json → 'order'; el resto por cercanía)
  const qSteps = new Map<string, { c: Cand; title: string }[]>();
  for (const c of kept) for (const q of c.quests) {
    if (!stopIndex.has(c.id)) continue;
    if (!qSteps.has(q.key)) qSteps.set(q.key, []);
    qSteps.get(q.key)!.push({ c, title: q.title });
  }
  const outQuests = [...qSteps.entries()].map(([key, steps]) => {
    const order = (qCfg[key]?.order ?? []).map((s) => s.toLowerCase());
    const star = order.indexOf('*');
    const rank = (t: string) => {
      const l = t.toLowerCase();
      const i = order.findIndex((o) => o !== '*' && (o.startsWith('=') ? l === o.slice(1) : l.includes(o)));
      return i >= 0 ? i : star >= 0 ? star : order.length;
    };
    const groups = new Map<number, { c: Cand; title: string }[]>();
    for (const s of steps) { const r = rank(s.title); if (!groups.has(r)) groups.set(r, []); groups.get(r)!.push(s); }
    const sorted: { c: Cand; title: string }[] = [];
    let cur: Pt | null = null;
    for (const r of [...groups.keys()].sort((a, b) => a - b)) {
      const g = groups.get(r)!.map((s) => ({ ...s, lat: s.c.lat, lng: s.c.lng }));
      const t = cur ? tour(g, cur) : twoOpt(tour(g, g[0]), g[0]);
      sorted.push(...t); cur = t[t.length - 1];
    }
    const minExp = Math.min(...sorted.map((s) => stopIndex.get(s.c.id)!.exp));
    return {
      key, name: questName(key), type: qCfg[key]?.type ?? 'secundaria', region: qCfg[key]?.region ?? '',
      ...(qCfg[key]?.parent ? { parent: qCfg[key].parent } : {}), ...(qCfg[key]?.clan ? { clan: qCfg[key].clan } : {}),
      wiki: `https://dragonwilds.runescape.wiki/w/${encodeURIComponent(questName(key).replace(/ /g, '_'))}`,
      firstExp: minExp,
      steps: sorted.map((s) => ({ markerId: s.c.id, title: s.title })),
    };
  });
  const qOrder = Object.keys(qCfg);
  const qi = (k: string) => { const i = qOrder.indexOf(k); return i < 0 ? 1e6 : i; };
  outQuests.sort((a, b) => qi(a.key) - qi(b.key) || a.firstExp - b.firstExp);

  const total = outExps.reduce((n, e) => n + e.stops.length, 0);
  await writeFile(join(ROOT, 'src/data/expeditions.json'), JSON.stringify({
    schema: 2, snapshotAt: meta.fetchedAt ?? null, totalStops: total,
    groups: [...new Set(ordered.map((r) => r.group))],
    expeditions: outExps,
  }));
  await writeFile(join(ROOT, 'src/data/quests.json'), JSON.stringify(outQuests));

  // ── Reporte ───────────────────────────────────────────────────────────────
  console.log(`\n${outExps.length} expediciones, ${total} paradas (${raws.length} marcadores en el snapshot)\n`);
  for (const e of outExps) {
    const add = inserted[e.number] ? `  (+${inserted[e.number]} nuevas)` : '';
    console.log(`  ${String(e.number).padStart(2)}  ${e.region.padEnd(36)} ${e.name.padEnd(34)} ${String(e.stops.length).padStart(3)} paradas${add}`);
  }
  console.log(`\n${outQuests.length} misiones con pines`);
  if (unknownQuests.size) console.log('⚠ Misiones nuevas sin nombre en config/quests.json:', [...unknownQuests].join(', '));
  if (unassigned.length) {
    console.log(`⚠ ${unassigned.length} marcadores sin región (¿región nueva? agrégala a config/regions.json):`);
    for (const c of unassigned.slice(0, 20)) console.log(`    ${c.title} (${c.lat}, ${c.lng})`);
  }
  for (const id of ov.forceInclude) if (!stopIndex.has(id)) console.log(`⚠ forceInclude ${id} no quedó como parada (¿ya no existe en MetaForge?)`);
}

main().catch((e) => { console.error('✗', e); process.exit(1); });
