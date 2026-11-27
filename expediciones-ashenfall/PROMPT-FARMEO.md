# Nueva función: Planificador de farmeo ("¿dónde consigo X?")

Pega en Claude Code todo lo que está debajo de la línea.

---

Quiero agregar a la app de `expediciones-ashenfall/app` un **planificador de farmeo**. Le digo qué quiero conseguir (por ejemplo, "quiero un Ascension Core de nivel 6" o "necesito 40 Mithril Bars") y la app me arma la ruta en el mapa para conseguirlo.

## Los datos ya están en el snapshot
`app/data/snapshot/markers.json` trae `markerDetails` con todo lo necesario. Hoy la app no lo usa:

| Clave | Qué tiene | Cómo se une con los pines |
|---|---|---|
| `creatureKeyBySubcategory` | `subcategory` → clave de criatura (`BP_AI_..._Data`) | `marker.subcategory` |
| `creatureDetails[clave].drops` | `{itemKey, minQty, maxQty, dropChance (0–100), rolls}` | por la clave de arriba |
| `lootBySubcategory[subcategory]` | lo mismo, directo por subcategoría (cofres de jefes como `ulgo_the_zogre`) | `marker.subcategory` |
| `nodeProfiles[id]` | `{tool:{type}, respawn:{hours, inGameTime}, yields:[{item, min, max, chance 0–1}]}` (árboles, rocas, plantas) | `marker.nodeProfile` |
| `fishingBySubcategory` | peces, basura y herramientas por tipo de punto de pesca | `marker.subcategory` |
| `vaultLoot[nombreVault].contents` | `{item, min, max, chance}` | `marker.instanceName` de la vault |
| `agilityByCourse` | recompensas por circuito y medalla | `marker.instanceName` |
| `entryDetails[itemKey]` | `{name, icon, href}`: nombre legible del objeto y link a la base de datos de MetaForge | `itemKey` |

Ejemplo verificado: `ITEM_Resources_T6_Upgrade_Shard` es "Ascension Shard 6". Lo suelta **Blue Dragon** (15–20, 100%, 4 pines en Dowdun), **Black Knight Titan** (20–30, 100%) y el cofre de **Ulgo the Zogre** (0–19, 20%).

## Qué construir
1. **Índice inverso** en un script de build (`scripts/build-loot-index.ts`, que se corra dentro de `npm run update`). Para cada `itemKey`, guarda la lista de fuentes `{tipo: criatura|nodo|cofre|vault|pesca|agilidad, subcategoria, nombre, cantidadEsperada, probabilidad, herramienta?, respawnHoras?, markerIds[]}`. Guárdalo en `src/data/loot-index.json`, con nombres en español cuando existan y el `href` de MetaForge.
2. **Recetas**: `config/recipes.json`, curado a mano y con fuente, para lo que no viene en el snapshot. Empieza por los Ascension Cores (Mystic Forge):
   - Core 4/5/6/7: 99 Ascension Shards del mismo nivel + barras, cuero y tela del nivel.
   - **Core 6** = 99 Ascension Shard 6 + 10 Mithril Bar + 10 Cursed Leather + 10 Mystic Cloth.
   - Core 7: 99 Ascension Shard 7 + 10 Adamant Bar + 10 Scorch Leather + 10 Infinity Cloth (también sale de los Nightmare Crucibles).
   - Investiga y confirma en el wiki y en MetaForge las recetas de Mithril Bar, Cursed Leather y Mystic Cloth, y anota las fuentes.
   - El planificador debe **expandir la receta**: si pido un Core 6, calcula también dónde sacar los shards, las barras (el mineral), el cuero y la tela.
3. **Pestaña "Farmeo"** en el panel:
   - Un buscador de objetos con autocompletado, usando los nombres de `entryDetails`.
   - Cantidad objetivo.
   - Resultado: una tabla de fuentes ordenada por **rendimiento esperado** (cantidad esperada × probabilidad), con su región y PL. Además, cuántas vueltas o kills necesito, en promedio, para llegar a la cantidad.
   - Botón **"Armar ruta"**: crea una expedición temporal con los pines de las mejores fuentes, empezando en el Lodestone más cercano y ordenada con vecino más cercano y 2-opt (reutiliza `scripts/lib`). Se dibuja en el mapa igual que las expediciones y se puede guardar como "Expedición de farmeo".
   - Filtros: región, PL máximo y "solo lo que reaparece" (respawn conocido).
4. **Herramienta nueva para el chat**: `buscar_fuentes({objeto, cantidad?})` y `armar_ruta_farmeo({objeto, cantidad?, region?})`. Así, si le digo "quiero Ascension Cores de nivel 6", me explica la receta, me dice cuántos dragones azules necesito en promedio y me dibuja la ruta.
5. **Pruebas**: que `T6_Upgrade_Shard` devuelva Blue Dragon, Black Knight Titan y Ulgo; que la ruta empiece en un Lodestone; y que el cálculo de vueltas sea correcto (por ejemplo, 99 shards ÷ 17.5 promedio por dragón = 6 dragones).

## Ojo
- Algunos jefes son de misión y puede que **no reaparezcan** (Black Knight Titan, Blightscale y el dragón de Silverthorn). Márcalos como "puede ser de una sola vez", a menos que los datos digan otra cosa.
- `dropChance` viene de 0 a 100 en `creatureDetails` y `lootBySubcategory`, pero `chance` viene de 0 a 1 en `nodeProfiles` y `vaultLoot`. Normaliza todo.
- Muestra en la interfaz que las tablas de botín vienen de MetaForge y pueden cambiar con los parches.

Primero dame un plan corto y espera mi OK. Después constrúyelo, corre `npm test` y haz commit.
