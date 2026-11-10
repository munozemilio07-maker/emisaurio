/**
 * fetch-metaforge.ts — baja el snapshot de marcadores y los tiles de MetaForge.
 *
 *   npm run fetch                 marcadores + tiles que falten
 *   npm run fetch -- --no-tiles   solo marcadores
 *   npm run fetch -- --force      vuelve a bajar todos los tiles
 *
 * MetaForge bloquea los fetch automáticos, así que todo se pide desde el
 * contexto de una página real de metaforge.app abierta con Playwright (SPEC §2).
 * Salidas:
 *   data/snapshot/markers.json      respuesta cruda de la API
 *   data/snapshot/meta.json         fecha, conteos y rutas de tiles usadas
 *   public/tiles/<capa>/z/x/y.webp  tiles z1–z6
 *   src/data/tiles.json             manifiesto (qué tiles existen, por capa)
 */
import { chromium, type Page } from 'playwright';
import { mkdir, readFile, writeFile, access, rm, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const NO_TILES = args.has('--no-tiles');
const BATCH = 24;

interface LayerCfg { id: string; name: string; zlayer: number; match: string; path: string }
interface Cfg { page: string; api: string; tileBase: string; minZoom: number; maxZoom: number; layers: LayerCfg[] }

// Se evalúa en la página como texto (así el transpilador no le inyecta helpers).
const PAGE_FETCH = `async ({ base, z, batch }) => {
  const one = async (t, tries) => {
    try {
      const r = await fetch(base + '/' + z + '/' + t[0] + '/' + t[1] + '.webp');
      if (r.status === 404 || r.status === 403) return null;
      if (!r.ok) throw new Error(String(r.status));
      const buf = new Uint8Array(await r.arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return btoa(s);
    } catch (e) {
      if (tries > 1) { await new Promise((r) => setTimeout(r, 800)); return one(t, tries - 1); }
      throw e;
    }
  };
  return Promise.all(batch.map((t) => one(t, 3)));
}`;

const exists = (p: string) => access(p).then(() => true, () => false);

async function main() {
  const cfgPath = join(ROOT, 'config/layers.json');
  const cfg: Cfg & Record<string, unknown> = JSON.parse(await readFile(cfgPath, 'utf8'));

  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch(proxy ? { proxy: { server: proxy } } : {});
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  // Detecta las rutas de tiles vigentes: en las peticiones de la página y en su bundle JS.
  const found = new Set<string>();
  const scan = (s: string) => {
    for (const m of s.matchAll(/dragonwilds\/maptiles\/(\d{8}\/[A-Za-z0-9_-]+)/g)) found.add(m[1]);
  };
  page.on('request', (r) => scan(r.url()));
  page.on('response', async (r) => {
    const ct = r.headers()['content-type'] ?? '';
    if (!/javascript|json|html/.test(ct)) return;
    try { scan(await r.text()); } catch { /* respuesta ya liberada */ }
  });

  console.log('→ Abriendo', cfg.page);
  await page.goto(cfg.page, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForTimeout(6000);

  // 1) Marcadores
  console.log('→ Bajando marcadores…');
  const raw = await page.evaluate(async (url) => {
    const r = await fetch(url);
    if (!r.ok) throw new Error('API ' + r.status);
    return await r.text();
  }, cfg.api);
  const snap = JSON.parse(raw);
  if (!Array.isArray(snap.data) || snap.data.length < 1000) throw new Error('Snapshot sospechoso: ' + snap.data?.length + ' marcadores');
  await mkdir(join(ROOT, 'data/snapshot'), { recursive: true });
  await writeFile(join(ROOT, 'data/snapshot/markers.json'), JSON.stringify(snap));
  console.log(`  ${snap.data.length} marcadores`);

  // 2) Rutas de tiles: usa la más reciente que coincida con cada capa
  let changed = false;
  for (const layer of cfg.layers) {
    const cands = [...found].filter((p) => p.includes(layer.match)).sort();
    const newest = cands.at(-1);
    if (newest && newest !== layer.path) {
      console.log(`  ⚠ La capa "${layer.id}" cambió de ruta: ${layer.path} → ${newest}`);
      layer.path = newest; changed = true;
    }
  }
  const known = cfg.layers.map((l) => l.match);
  const unknown = [...found].filter((p) => !known.some((k) => p.includes(k)));
  if (unknown.length) console.log('  ⚠ Capas de tiles nuevas sin configurar (agrégalas a config/layers.json):', unknown.join(', '));
  if (changed) await writeFile(cfgPath, JSON.stringify(cfg, null, 2) + '\n');

  // 3) Tiles
  const manifest: Record<string, unknown> = {};
  if (!NO_TILES) {
    for (const layer of cfg.layers) manifest[layer.id] = await fetchLayer(page, cfg, layer, changed);
    await writeFile(join(ROOT, 'src/data/tiles.json'), JSON.stringify({ minZoom: cfg.minZoom, maxZoom: cfg.maxZoom, layers: manifest }));
  }

  await writeFile(join(ROOT, 'data/snapshot/meta.json'), JSON.stringify({
    fetchedAt: new Date().toISOString(),
    markers: snap.data.length,
    tilePaths: Object.fromEntries(cfg.layers.map((l) => [l.id, l.path])),
  }, null, 2) + '\n');
  await browser.close();
  console.log('✓ Listo. Ahora corre: npm run expeditions');
}

/** Baja la pirámide de una capa. Solo pide los hijos de los tiles que existen. */
async function fetchLayer(page: Page, cfg: Cfg, layer: LayerCfg, pathChanged: boolean) {
  const base = cfg.tileBase + layer.path;
  const dir = join(ROOT, 'public/tiles', layer.id);
  const zooms: Record<number, [number, number][]> = {};
  let parents: [number, number][] | null = null;
  let got = 0, kept = 0, blanks = 0;
  // El servidor responde un tile vacío (idéntico) fuera del mapa en vez de 404:
  // cualquier contenido repetido se considera vacío, se borra y no se baja su descendencia.
  const firstSeen = new Map<string, string>();
  const blank = new Set<string>();
  const dropped = new Set<string>();

  for (let z = cfg.minZoom; z <= cfg.maxZoom; z++) {
    let want: [number, number][] = [];
    if (!parents) {
      for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) want.push([x, y]);
    } else {
      for (const [px, py] of parents) for (const dx of [0, 1]) for (const dy of [0, 1]) want.push([px * 2 + dx, py * 2 + dy]);
    }
    const present: [number, number][] = [];
    const todo: [number, number][] = [];
    for (const t of want) {
      if (!FORCE && !pathChanged && (await exists(join(dir, `${z}/${t[0]}/${t[1]}.webp`)))) { present.push(t); kept++; }
      else todo.push(t);
    }
    for (let i = 0; i < todo.length; i += BATCH) {
      const batch = todo.slice(i, i + BATCH);
      const res = (await page.evaluate(`(${PAGE_FETCH})(${JSON.stringify({ base, z, batch })})`)) as (string | null)[];
      for (let j = 0; j < batch.length; j++) {
        const b64 = res[j];
        if (!b64) continue;
        const [x, y] = batch[j];
        const f = join(dir, `${z}/${x}/${y}.webp`);
        await mkdir(dirname(f), { recursive: true });
        await writeFile(f, Buffer.from(b64, 'base64'));
        present.push([x, y]); got++;
      }
      process.stdout.write(`\r  ${layer.id} z${z}: ${Math.min(i + BATCH, todo.length)}/${todo.length}   `);
    }
    const real: [number, number][] = [];
    for (const t of present) {
      const f = join(dir, `${z}/${t[0]}/${t[1]}.webp`);
      const h = createHash('sha1').update(await readFile(f)).digest('hex');
      const prev = firstSeen.get(h);
      if (blank.has(h) || prev) {
        blank.add(h);
        if (prev && !dropped.has(prev)) { await rm(prev, { force: true }); dropped.add(prev); blanks++; }
        await rm(f, { force: true }); dropped.add(f); blanks++;
      } else { firstSeen.set(h, f); real.push(t); }
    }
    real.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    zooms[z] = real;
    parents = real;
  }
  process.stdout.write('\n');
  console.log(`  ${layer.id}: ${got} bajados, ${kept} ya estaban, ${blanks} vacíos descartados`);
  for (const z of Object.keys(zooms)) zooms[+z] = zooms[+z].filter(([x, y]) => !dropped.has(join(dir, `${z}/${x}/${y}.webp`)));
  // Limpia tiles huérfanos (de una corrida anterior o de otra versión del mapa)
  const keep = new Set<string>();
  for (const [z, list] of Object.entries(zooms)) for (const [x, y] of list) keep.add(`${z}/${x}/${y}.webp`);
  for (const f of await readdir(dir, { recursive: true }).catch(() => [] as string[])) {
    if (f.endsWith('.webp') && !keep.has(f.split('\\').join('/'))) await rm(join(dir, f), { force: true });
  }
  // Manifiesto compacto: por zoom, "x:y1,y2,…"
  const tiles: Record<string, Record<string, number[]>> = {};
  for (const [z, list] of Object.entries(zooms)) {
    tiles[z] = {};
    for (const [x, y] of list) (tiles[z][x] ??= []).push(y);
  }
  return { name: layer.name, zlayer: layer.zlayer, tiles };
}

main().catch((e) => { console.error('\n✗', e); process.exit(1); });
