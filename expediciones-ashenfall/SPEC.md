# Expediciones de Ashenfall: especificación técnica

Guía interactiva para completar al 100% RuneScape: Dragonwilds. Organiza los puntos de interés del mapa en **expediciones**: rutas ordenadas sobre el mapa real, con checklist de progreso y un chat con Claude que conoce el juego.

Este documento tiene todo lo que se descubrió al construir la versión 4 (la referencia está en `reference/expediciones-v4.html`).

---

## 1. Qué hace la app (versión actual)

| Función | Detalle |
|---|---|
| **25 expediciones, 560 paradas** | Brynmoor (1–5), Ghornfell (6–9), Fellhollow (10–16), Dowdun Reach en superficie (17–23) y Dowdun subterráneo (24–25) |
| **Mapa real** | Leaflet con `CRS.Simple`. Una imagen del mapa del mundo (z5) y otra de la capa subterránea de Dowdun (z6) |
| **Ruta** | Polilínea punteada con pines numerados y coloreados por tipo. Las otras expediciones salen tenues |
| **Checklist** | Un check por parada, guardado en `localStorage` (`aw-done`, `aw-cur`, `aw-hide`, `aw-chat`) |
| **Navegación** | Rail lateral agrupado por región, en móvil un `<select>`. Botones Anterior y Siguiente. "Centrar ruta". Toggle Superficie/Subterráneo |
| **Ir a parada** | Al tocar el número de una parada, el mapa hace `flyTo` y abre un popup con el link a MetaForge |
| **Deep link** | `https://metaforge.app/runescape-dragonwilds/map/ashenfall?markerID=<id>` abre el pin exacto en MetaForge |
| **Chat con Claude** | Panel flotante. Usa la base de conocimiento y 5 herramientas de la página (ver §6) |
| **Temas** | Claro y oscuro con tokens CSS |

Tipos de parada: `cofre`, `lore`, `mision`, `vault`, `jefe`, `secreto`, `npc`, `viaje` (Lodestone).

---

## 2. Fuente de datos: MetaForge

### API de marcadores
```
GET https://api.metaforge.app/runescape-dragonwilds/map?mapId=ashenfall
```
Respuesta (unos 24,700 marcadores):
```jsonc
{
  "data": [
    { "id": "8ac90c0a5fe1b4c0c5f7600bd9ecf5dc", "lat": -57714, "lng": 144594,
      "category": "poi", "subcategory": "vault", "mapID": "ashenfall",
      "zlayers": 1,            // 1 = superficie, 2 = Dowdun Underground
      "instanceName": "Vekchenven Kara", "nodeProfile": "..." }
  ],
  "markerDetails": { "questKeyBySubcategory": {...}, "lootBySubcategory": {...},
                     "creatureDetails": {...}, "vaultLoot": {...}, ... }
}
```
- `metaforge.app` bloquea los fetch automáticos con protección anti-bots. La API respondió desde el contexto de una página abierta en `metaforge.app`.
- **Recomendación:** baja un *snapshot* una vez con un script (Playwright abriendo metaforge.app y haciendo `fetch` desde la página), guárdalo en `data/` y no consultes la API en vivo desde la app. Respeta sus términos de uso.
- Subcategorías útiles: `treasure_chest`, `lore_item`, `vault`, `lodestone`, `quest_*`, `statue`, `reliquary`, `spectral_room`, `spectral_bird`, `sanguine_urn`, `nature_spirit`, `kebbit_burrow`, `agility_course`, `standing_stone`, `curse_seal`, `dragon_tooth`, `recipe_book`, `misc_strange_raven`, `misc_dreamstone_shard`, y `category` `npc` o `important_mob`.
- Claves de misión en Dowdun: `quest_bkf` (Black Knight's Fortress), `quest_sq1` (internamente `Quest_SQ1_ThinkingWithPortals`: nodestones, Valerius, Hastily Scrawled Notes), `quest_sq2` (`AnimalLover`, que es **Wanted!**), `quest_sq3` (`Nevermore`, que es **Biohazard**).
- Hay un endpoint de descripciones, pero casi no tiene texto: `https://metaforge.app/api/game-map-data/inspector?game=runescape-dragonwilds&map=ashenfall`.

### Tiles del mapa
```
Superficie:   https://static.metaforge.app/dragonwilds/maptiles/20260915/20260915WorldMap/{z}/{x}/{y}.webp
Subterráneo:  https://static.metaforge.app/dragonwilds/maptiles/20260623/20260623Downdun/{z}/{x}/{y}.webp
```
- `tileSize` 256, `minZoom` 1, `maxZoom` 6, centro inicial `[50000, 145000]`, zoom inicial 2.
- Las fechas de la ruta cambian con los parches. Revisa el bundle de MetaForge (`tileLayers` en su config de mapa) si dejan de cargar.
- Los tiles tienen CORS habilitado desde metaforge.app. Para usarlos en otra app, descárgalos y sírvelos tú (los de `assets/` ya están cosidos).

---

## 3. Sistema de coordenadas (lo más importante)

Viene de la config de MetaForge:
```js
worldExtent = [-118500, -12000, 301400, 408000]   // [latMin, lngMin, latMax, lngMax]
tileExtent  = [0, 0, 256, 256]                     // a zoom 0
```
Fórmula de píxel a zoom `z` (eje y hacia abajo):
```js
const px = (lng + 12000)  / 420000 * 256 * 2**z;
const py = (lat + 118500) / 419900 * 256 * 2**z;
```
- **lat mayor = más al sur.** Brynmoor está en lat 140k–200k y Fellhollow en lat negativa (norte).
- **lng mayor = más al este.** Dowdun está en lng 180k–260k, lat 0–80k.
- Se verificó con el Temple Lodestone `(189026, 5065)`: cae exactamente en el templo.

### Imágenes cosidas en `assets/`
| Archivo | Zoom | Tiles | Tamaño | Offset |
|---|---|---|---|---|
| `ashenfall-mapa.webp` | z5 | x 0–20, y 1–25 | 5376×6400 | la imagen empieza en el píxel z5 `(0, 256)` |
| `dowdun-subterraneo.webp` | z6 | x 31–37, y 21–26 | 1792×1536 (fondo transparente) | píxel z6 `(7936, 5376)` |

Con Leaflet `CRS.Simple`, usando el espacio de píxeles z5 de la imagen grande:
```js
const LL = (lat, lng) => {
  const x = (lng + 12000) / 420000 * 8192;
  const y = (lat + 118500) / 419900 * 8192 - 256;
  return L.latLng(-y, x);
};
const IMG_BOUNDS = [[-6400, 0], [0, 5376]];
const UG_BOUNDS  = [[-(2432 + 768), 3968], [-2432, 3968 + 896]]; // subterráneo, en el mismo espacio
```
**Alternativa mejor:** en vez de imágenes cosidas, usa `L.tileLayer` con los tiles descargados (z1–z6) y un CRS propio con `transformation: new L.Transformation(256/420000, 12000*256/420000, 256/419900, 118500*256/419900)`. Así tienes zoom nítido hasta z6.

---

## 4. Construcción de expediciones (`scripts/`)

1. **Filtrar** los marcadores por región y por subcategoría (§2). Deduplicar por celda `(round(lat/300), round(lng/300))`, prefiriendo los pines de misión.
2. **Macro-región**, PL1–5:
   - `lat < 45000` → Fellhollow
   - `lng > 112000 && lat > 133000` → Bloodblight
   - `lat > 140000 || (lat > 133000 && lng > 85000)` → Brynmoor
   - `lng < 50000 && lat < 110000` → Stormtouched Highlands
   - si no → Fractured Plains
   - Dowdun: `5000 < lat < 82000`, `160000 < lng < 265000`, separando `zlayers == 2` como subterráneo.
3. **K-means** por región (k = 4/1/1/3/7 en PL1–5; 7 en superficie y 2 en subterráneo de Dowdun) con penalización por desbalance de tamaños.
4. **Orden:** las expediciones se encadenan, cada una empieza cerca del final de la anterior. Dentro de cada una, vecino más cercano y luego mejora con **2-opt**.
5. **Nombre:** el landmark más cercano al centroide que no se haya usado antes (lista en `scripts/build.py` y `scripts/dowdun.py`).

`data/expeditions.json` ya trae el resultado final, limpio y documentado. Los `.txt` de `data/` son los pines crudos (`id|cat|sub|nombre|lat|lng|...`).

---

## 4b. Regiones fuera de los datos incluidos
- **Umbral Sands** (las dunas, después de Dowdun): Lodestone en `(96415, 244689)`. Puntos de referencia: "Kalphite Queen" en `(28644, 314435)` y "Vault Door" en `(73108, 342637)`. Ocupa lng de unos 230k a 410k. **La imagen cosida `ashenfall-mapa.webp` solo llega a lng ≈ 263k**, así que para Umbral hay que bajar tiles más al este (x > 20 en z5).
- Otro "Vault Door" está en `(233060, 222274)` y "Cataclysm Keep" en `(5898, -2194)`. Hay que revisar a qué región pertenecen.
- El progreso se guarda por `markerId`, así que regenerar las expediciones no borra los checks.

## 5. Problemas conocidos en los datos
- **The Pride of the Avernic** (`fa19d1164853f8588de69fa9b7a35b59`, lat -32604, lng 241159) y **The Binding of Ib** (`e65b8cd56d81bf783e6039ad61aa36d0`) quedaron fuera del filtro. Hay que agregarlos.
- En MetaForge el pin de **Abraxus** sale como `quest_even_more_ghosts`, pero es el inicio de *What Remains is Written*.
- Según MetaForge, **Offalfoot** está en la superficie (Exp. 17), pero el wiki lo pone en The Lake subterráneo. **Putrilius** sale en The Pastures, pero el wiki lo pone en el techo del Grand Hall.
- El nombre real de la misión `quest_sq1` (nodestones/Valerius) no está confirmado. En la app sale como "Nodestones (Valerius)".
- En The Nexus hay muchos nodestones apilados (cada nodestone tiene su par ahí). Conviene agruparlos con clustering.
- No hay pines para las Notas de Alric ni para los 4 libros de la Biblioteca.

---

## 6. Chat con Claude

### Prompt de sistema (resumen)
- Responde en español mexicano, breve, con viñetas.
- Cuando el jugador diga "voy en…" o "quiero…", busca las paradas, dile "Expedición X, parada N" y llévalo en el mapa.
- Marca paradas como hechas solo si el jugador dice que ya las hizo.
- Usa solo la base de conocimiento (`data/knowledge-base.md`) y las herramientas. Si algo no está ahí, dilo y manda al pin de MetaForge o al wiki.

### Herramientas (las ejecuta la página)
| Nombre | Entrada | Devuelve |
|---|---|---|
| `buscar_paradas` | `texto?, tipo?, expedicion?, solo_pendientes?` | hasta 25 `{expedicion, zona, parada, nombre, tipo, detalle, hecha}` |
| `ver_expedicion` | `numero` | lista de paradas con ✓ |
| `progreso` | – | resumen `X/Y` por expedición |
| `mostrar_en_mapa` | `expedicion, parada?` | cambia de expedición y hace `flyTo` con popup |
| `marcar_hecho` | `expedicion, paradas[], hecho?` | marca o desmarca |

### Dónde corre
- **Como artifact de claude.ai** (lo actual): `claude.use("sample")` con `tools`, sin API key.
- **Como app propia**: usa la **Claude API** (Messages API con tool use) desde un **backend** (Cloudflare Worker, Vercel function o Express). La API key nunca va en el frontend. Las herramientas se definen igual y se ejecutan en el cliente (el backend reenvía los `tool_use`), o se resuelven en el backend con los mismos datos.

---

## 7. Licencias y créditos
- Los tiles y los datos de marcadores son de **MetaForge** y el contenido del juego es de **Jagex**. Úsalos para uso personal, con crédito visible ("Mapa: MetaForge"), y revisa sus términos antes de publicar la app.
- Los textos de la base de conocimiento son resúmenes propios de RuneScape Dragonwilds Wiki, MetaBot, Gamever, GamesHorizon, Nerd's Chalk, AllThings.How, HostedGG y Steam Community.
