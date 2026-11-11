export type Kind = 'cofre' | 'lore' | 'mision' | 'vault' | 'jefe' | 'secreto' | 'npc' | 'viaje';
export type LayerId = 'surface' | 'dowdun';

export interface Stop {
  order: number;
  markerId: string;
  kind: Kind;
  title: string;
  detail: string;
  lat: number;
  lng: number;
  layer: LayerId;
  underground: boolean;
  quests?: string[];
  recipes?: string[];
  note?: string;
  metaforgeUrl: string;
}

export interface Expedition {
  id: string;
  number: number;
  regionId: string;
  region: string;
  group: string;
  name: string;
  layer: LayerId;
  underground: boolean;
  length: number;
  stops: Stop[];
}

export interface Quest {
  key: string;
  name: string;
  type: 'primaria' | 'secundaria' | 'tarea';
  region: string;
  parent?: string;
  clan?: string;
  wiki: string;
  firstExp: number;
  steps: { markerId: string; title: string }[];
}

export interface Boss {
  id: string;
  name: string;
  region: string;
  where: string;
  pl?: string;
  hp?: string;
  weak?: string[];
  resist?: string[];
  tips: string[];
  drops?: string[];
  quest?: string;
  wiki?: string;
  /** Subcadenas para enlazar con paradas del mapa (por título) */
  match?: string[];
}

/** Una parada ya ubicada en su expedición */
export interface Located { stop: Stop; exp: Expedition }
