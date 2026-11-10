# Prompt para Claude Code

Copia todo lo que está debajo de la línea y pégalo en Claude Code, con esta carpeta abierta como proyecto.

---

Quiero que construyas **"Expediciones de Ashenfall"**, una web app para completar al 100% el mapa de **RuneScape: Dragonwilds**. Antes de escribir código, lee `SPEC.md`: ahí están el sistema de coordenadas, las URLs de los tiles, el formato de los datos y los problemas conocidos.

## Contexto
- Juego en modo **melee**. Ya terminé PL1–5 y Dowdun Reach (ya vencí al Black Knight) y ahora voy en **Umbral Sands** (las dunas).
- Ya existe una versión funcional de un solo archivo: `reference/expediciones-v4.html`. Úsala como referencia de funciones, no de arquitectura.
- Los datos ya están listos en `data/expeditions.json` (25 expediciones, 560 paradas), `data/knowledge-base.md` (guía del juego para el chat) y los mapas en `assets/`.

## Stack
- **Vite + React + TypeScript**, **Leaflet** (con `react-leaflet`) y Tailwind o CSS Modules, lo que prefieras.
- **PWA instalable** que funcione offline (el mapa y los datos se guardan en caché).
- Un backend mínimo (**Cloudflare Worker** o función serverless) solo para el chat con la **Claude API**. La API key va en una variable de entorno, nunca en el cliente.

## Cobertura: TODO el mapa de Dragonwilds
Los datos incluidos solo cubren PL1–5 y Dowdun. Quiero que la app cubra **todo el juego**, empezando por **Umbral Sands**:
- Escribe `scripts/fetch-metaforge.ts` (Playwright) que baje **todos** los marcadores de la API (`mapId=ashenfall`) y **todos** los tiles z1–z6 de cada capa (superficie y subterráneos), siguiendo `SPEC.md` §2–3.
- Detecta las regiones de forma automática o con reglas en un archivo de config (`regions.json`): Brynmoor, Ghornfell, Fellhollow, Dowdun Reach (más su subterráneo), **Umbral Sands** y cualquier región nueva que aparezca con parches. Referencias para Umbral Sands: su Lodestone está en `lat 96415, lng 244689`, y en esa zona están "Kalphite Queen" (`28644, 314435`) y un "Vault Door" (`73108, 342637`). La región se extiende al este de `lng ≈ 230000`.
- Genera las expediciones de **todas** las regiones con el mismo algoritmo y numéralas en orden de progresión del juego.
- Agrega a `knowledge-base.md` una sección de Umbral Sands (misiones, vaults, jefes y recetas) investigada en el wiki oficial (dragonwilds.runescape.wiki), con fuentes.
- Debe quedar fácil de actualizar: correr los 2 scripts después de un parche regenera todo.
- Conserva mi progreso: los checks se guardan por `markerId`, así que no se pierden al regenerar.

## Funciones obligatorias (las que ya tiene la v4)
1. Mapa real con `CRS.Simple`, la fórmula exacta de `SPEC.md` §3 y la capa subterránea de Dowdun con un toggle.
2. Lista de expediciones agrupadas por región. En cada una, una ruta numerada en el mapa y la lista de paradas con check, tipo y link "Ver en MetaForge" (`?markerID=`).
3. Al tocar una parada, `flyTo` y popup. Al tocar un pin, se resalta en la lista.
4. Progreso guardado (por parada, por expedición y total).
5. Chat con Claude con las 5 herramientas de `SPEC.md` §6 y la base de conocimiento como contexto.
6. Tema claro y oscuro, y que funcione bien en el celular.

## Mejoras que quiero ("fabulosa")
- **Tiles reales** (`L.tileLayer` con z1–z6 descargados) en vez de las imágenes cosidas, para que el zoom se vea nítido.
- **Vista "Misiones"**: además de por expedición, ver las paradas agrupadas por misión (Black Knight's Fortress, Biohazard, Wanted!, What Remains is Written, etc.) con sus pasos en orden.
- **Buscador global** y **filtros por tipo** (cofres, lore, vaults, jefes, secretos).
- **Modo "Siguiente parada"**: un botón grande que te lleva a la siguiente parada pendiente de la expedición.
- **Exportar e importar progreso** (JSON) y, opcional, sincronizarlo entre PC y celular.
- **Clustering** de pines amontonados (por ejemplo, los nodestones de The Nexus).
- **Fichas de jefes** con PL, vida, debilidades y tips, sacados de `knowledge-base.md`.
- Que se puedan **agregar nuevas regiones**: un script `scripts/fetch-metaforge.ts` con Playwright que baje el snapshot de la API y los tiles, y un `scripts/build-expeditions.ts` que replique el algoritmo de `SPEC.md` §4 (k-means, vecino más cercano y 2-opt).
- Corregir los problemas de datos de `SPEC.md` §5: agregar los 2 pines faltantes y corregir las etiquetas.

## Diseño
- Estética de **cuaderno de cartógrafo de fantasía oscura**, no la típica plantilla de dashboard. La v4 usa *IM Fell English SC* para títulos, *Alegreya Sans* para el texto y *JetBrains Mono* para los números. Puedes mejorarla.
- Colores fijos por tipo de parada, que se lean bien sobre el mapa oscuro.
- Animaciones discretas (ruta que se dibuja al cambiar de expedición). Respeta `prefers-reduced-motion`.
- Toda la interfaz en **español**. Los nombres de objetos y misiones del juego en inglés, como salen en MetaForge.

## Cómo trabajar
1. Lee `SPEC.md`, `data/expeditions.json` (solo la estructura) y `reference/expediciones-v4.html`.
2. Propón un plan corto con la estructura de carpetas y espera mi OK.
3. Construye por etapas: mapa y datos, luego progreso, luego chat, luego mejoras. Haz commit en cada etapa.
4. Verifica las coordenadas con el **Temple Lodestone** `(lat 189026, lng 5065)`: debe caer en el templo del suroeste.
5. Al final, dame instrucciones para correrla localmente y para desplegarla.

Créditos visibles: "Mapa y marcadores: MetaForge · RuneScape: Dragonwilds © Jagex". Es para uso personal.
