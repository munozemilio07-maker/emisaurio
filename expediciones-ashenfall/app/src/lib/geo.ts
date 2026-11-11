/** Sistema de coordenadas de MetaForge (SPEC.md §3). Compartido por la app y los scripts. */
export const WORLD = { latMin: -118500, lngMin: -12000, latMax: 301400, lngMax: 408000 } as const;
export const WORLD_W = WORLD.lngMax - WORLD.lngMin; // 420000
export const WORLD_H = WORLD.latMax - WORLD.latMin; // 419900
export const TILE = 256;

/** Píxel a zoom z (eje y hacia abajo). lat mayor = más al sur; lng mayor = más al este. */
export function toPixel(lat: number, lng: number, z: number): { x: number; y: number } {
  const s = TILE * 2 ** z;
  return { x: ((lng - WORLD.lngMin) / WORLD_W) * s, y: ((lat - WORLD.latMin) / WORLD_H) * s };
}

/** Tile que contiene el punto a zoom z. */
export function toTile(lat: number, lng: number, z: number): { x: number; y: number } {
  const p = toPixel(lat, lng, z);
  return { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
}

export const METAFORGE_MAP = 'https://metaforge.app/runescape-dragonwilds/map/ashenfall';
export const metaforgeUrl = (markerId: string) => `${METAFORGE_MAP}?markerID=${markerId}`;

/**
 * Coeficientes [a, b, c, d] de L.Transformation para el CRS de la app:
 * x = a·lng + b, y = c·lat + d (píxeles a zoom 0). Equivale a toPixel(…, 0).
 */
export const CRS_TRANSFORM: [number, number, number, number] = [
  TILE / WORLD_W, (-WORLD.lngMin * TILE) / WORLD_W, TILE / WORLD_H, (-WORLD.latMin * TILE) / WORLD_H,
];
