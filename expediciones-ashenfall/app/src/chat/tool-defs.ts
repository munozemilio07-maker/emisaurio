/** Definiciones de las 5 herramientas del chat (SPEC.md §6). Sin dependencias: las importa el Worker. */
export interface ToolDef { name: string; description: string; input_schema: Record<string, unknown> }

const KINDS = ['cofre', 'lore', 'mision', 'vault', 'jefe', 'secreto', 'npc', 'viaje'];

export const toolDefs = (N: number): ToolDef[] => [
  {
    name: 'buscar_paradas',
    description: `Busca paradas en todo el mapa por texto (nombre, tipo, zona, landmark o misión; en español o inglés) y opcionalmente por tipo y/o expedición. Úsala cuando el jugador mencione un lugar, objeto, NPC, jefe o misión, para saber en qué expedición y parada está. Devuelve hasta 25 resultados con expedicion, zona, parada, nombre, tipo, detalle y si ya está hecha, más el total de coincidencias.`,
    input_schema: {
      type: 'object',
      properties: {
        texto: { type: 'string', description: 'Palabras a buscar; deben aparecer todas.' },
        tipo: { type: 'string', enum: KINDS },
        expedicion: { type: 'integer', description: `Número de expedición (1–${N}).` },
        solo_pendientes: { type: 'boolean' },
      },
    },
  },
  {
    name: 'ver_expedicion',
    description: `Lista todas las paradas de una expedición (1–${N}) en orden de ruta, con tipo, detalle y ✓ si ya están hechas.`,
    input_schema: { type: 'object', properties: { numero: { type: 'integer' } }, required: ['numero'] },
  },
  {
    name: 'progreso',
    description: `Resumen de avance del jugador: hechas/total por cada una de las ${N} expediciones y el total del mapa.`,
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'mostrar_en_mapa',
    description: 'Cambia la app a una expedición y, si se da una parada, centra el mapa en ella y abre su ficha. Úsala para llevar al jugador a donde debe ir.',
    input_schema: {
      type: 'object',
      properties: { expedicion: { type: 'integer' }, parada: { type: 'integer', description: 'Número de parada dentro de la expedición.' } },
      required: ['expedicion'],
    },
  },
  {
    name: 'marcar_hecho',
    description: 'Marca (o desmarca con hecho=false) paradas de una expedición. Úsala solo cuando el jugador diga explícitamente que ya las completó.',
    input_schema: {
      type: 'object',
      properties: { expedicion: { type: 'integer' }, paradas: { type: 'array', items: { type: 'integer' } }, hecho: { type: 'boolean' } },
      required: ['expedicion', 'paradas'],
    },
  },
];

