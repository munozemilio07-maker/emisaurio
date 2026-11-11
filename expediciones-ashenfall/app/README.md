# Expediciones de Ashenfall

Cuaderno de cartógrafo para completar al 100% el mapa de **RuneScape: Dragonwilds**: 37 expediciones y 883 paradas sobre el mapa real, con rutas numeradas, progreso por parada, vista por misiones, fichas de jefes, buscador y un chat con Claude que conoce la guía y mueve el mapa por ti.

Mapa y marcadores: [MetaForge](https://metaforge.app/runescape-dragonwilds/map/ashenfall) · RuneScape: Dragonwilds © Jagex. Uso personal.

## Correrla en tu compu

Necesitas Node 20 o más reciente.

```bash
cd expediciones-ashenfall/app
npm install
npm run dev
```

Abre <http://localhost:5173>. El mapa, las expediciones y el progreso funcionan así, sin nada más.

Para el **chat** y la **sincronización** hace falta además el Worker, en otra terminal:

```bash
cp worker/.dev.vars.example worker/.dev.vars   # y pon tu API key de Claude adentro
npm run worker:dev
```

Vite manda `/api/*` al Worker (puerto 8787). La API key solo vive en `worker/.dev.vars` (ignorado por git) y nunca llega al navegador.

Otros comandos:

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas: coordenadas (Temple Lodestone), datos, algoritmo, progreso y herramientas del chat |
| `npm run build` | Compila a `dist/` (incluye el service worker de la PWA) |
| `npm run preview` | Sirve `dist/` para probar la versión compilada |

## Actualizar después de un parche

```bash
npm run update
```

Eso corre los dos scripts, en orden:

1. **`npm run fetch`** (`scripts/fetch-metaforge.ts`, Playwright). Abre metaforge.app, baja el snapshot de marcadores a `data/snapshot/` y los tiles z1–z6 de cada capa a `public/tiles/`. Detecta sola la ruta de tiles nueva (la fecha cambia con cada parche) y actualiza `config/layers.json`. Solo baja los tiles que faltan; con `-- --force` los baja todos y con `-- --no-tiles` solo los marcadores. La primera vez en tu máquina: `npx playwright install chromium`.
2. **`npm run expeditions`** (`scripts/build-expeditions.ts`). Regenera `src/data/expeditions.json` y `src/data/quests.json` con el algoritmo de `SPEC.md` §4 (k-means balanceado, vecino más cercano y 2-opt) e imprime un reporte.

**Tu progreso no se pierde:** los checks se guardan por `markerId` de MetaForge, no por número de parada.

Qué revisar en el reporte:

- **Marcadores sin región** → apareció una región nueva. Agrégala a `config/regions.json` (una caja de coordenadas, su orden de progresión y algunos landmarks) y vuelve a correr `npm run expeditions`.
- **Misiones nuevas sin nombre** → agrégalas a `config/quests.json` con su nombre real y, si quieres, el orden de sus pasos.
- **Capas de tiles nuevas** → agrégalas a `config/layers.json`.

Las expediciones 1–25 originales se conservan tal cual (mismo número y mismo orden) y los pines nuevos de esas zonas se insertan donde menos alargan la ruta. Para rehacer todo desde cero: `npm run expeditions -- --fresh`.

### Archivos de configuración

| Archivo | Para qué |
|---|---|
| `config/regions.json` | Reglas de regiones, orden de progresión, número de expediciones y landmarks para nombrarlas |
| `config/markers.json` | Qué subcategorías de MetaForge son paradas y de qué tipo |
| `config/quests.json` | Nombre real de cada misión y orden de sus pasos |
| `config/overrides.json` | Correcciones a los datos de MetaForge (`SPEC.md` §5) |
| `config/layers.json` | URLs de tiles por capa |
| `data/knowledge-base.md` | Guía del juego que lee el chat |
| `src/data/bosses.json` | Fichas de jefes |

## Desplegarla (Cloudflare, un solo Worker)

La app compilada y la API salen juntas en un Worker con assets estáticos. Con la cuenta gratuita alcanza.

```bash
npx wrangler login
npx wrangler kv namespace create SYNC --config worker/wrangler.toml
```

Pega el `id` que te devuelve en `worker/wrangler.toml` (donde dice `REEMPLAZA_CON_EL_ID_DE_TU_KV`). Luego:

```bash
npx wrangler secret put ANTHROPIC_API_KEY --config worker/wrangler.toml
```

```bash
npm run build
```

```bash
npm run worker:deploy
```

Wrangler imprime la URL (`https://expediciones-ashenfall.<tu-cuenta>.workers.dev`). Ábrela en el celular y usa "Agregar a pantalla de inicio" para instalarla.

**Protege tu API key.** Cualquiera con la URL podría usar el chat a tu costa. Ponle una contraseña; la app te la pide la primera vez que abras el chat:

```bash
npx wrangler secret put APP_PASSWORD --config worker/wrangler.toml
```

Opciones en `worker/wrangler.toml` → `[vars]`: `CLAUDE_MODEL` (por defecto `claude-opus-5-5`) y `CLAUDE_EFFORT` (`low`, `medium` o `high`).

Si no quieres chat ni sincronización, `dist/` es un sitio estático: súbelo a cualquier hosting y lo demás funciona igual.

## Cómo está hecha

```
app/
├─ scripts/            fetch-metaforge.ts, build-expeditions.ts, lib/algo.ts
├─ config/             reglas editables (regiones, marcadores, misiones, correcciones, capas)
├─ data/               snapshot de MetaForge, expediciones base (v4) y la guía del chat
├─ public/tiles/       tiles z1–z6: surface/ y dowdun/
├─ src/
│  ├─ lib/geo.ts       fórmula de coordenadas de SPEC §3
│  ├─ map/             CRS de Leaflet, capas, ruta animada, clustering
│  ├─ features/        panel, expediciones, misiones, jefes, buscador, chat, ajustes
│  ├─ state/           progreso (por markerId), exportar/importar, sincronización
│  ├─ chat/            las 5 herramientas de SPEC §6 y el ciclo de tool use
│  └─ data/            JSON generados
├─ worker/             Cloudflare Worker: /api/chat y /api/sync
└─ tests/
```

- **Coordenadas.** `L.latLng(lat, lng)` usa directamente las unidades de MetaForge, con un `CRS.Simple` cuya transformación es la fórmula de `SPEC.md` §3. La prueba `tests/geo.test.ts` fija el Temple Lodestone `(189026, 5065)` en el tile z5 `(1, 23)`, el templo del suroeste.
- **Sin conexión.** La PWA precachea la app, los datos, las fuentes y los tiles z1–z5 (unos 13 MB). El zoom 6 se guarda al verlo, o completo desde Ajustes → "Descargar el mapa completo". El chat y la sincronización sí necesitan internet.
- **Sincronización.** Opcional, desde Ajustes: el mismo código en dos dispositivos. Cada check lleva su hora y al fusionar gana el cambio más reciente de cada parada.
- **Chat.** El Worker manda a Claude la guía y las definiciones de herramientas; la página ejecuta las herramientas contra tu progreso y el mapa.
