import L from 'leaflet';
import { CRS_TRANSFORM, WORLD } from '../lib/geo';

/**
 * CRS de Ashenfall: CRS.Simple con la transformación de SPEC.md §3, de modo que
 * L.latLng(lat, lng) usa directamente las unidades del juego de MetaForge:
 *   px = (lng + 12000) / 420000 · 256 · 2^z      py = (lat + 118500) / 419900 · 256 · 2^z
 */
export const ASHENFALL_CRS: L.CRS = L.extend({}, L.CRS.Simple, {
  transformation: new L.Transformation(...CRS_TRANSFORM),
});

export const WORLD_BOUNDS = L.latLngBounds([WORLD.latMin, WORLD.lngMin], [WORLD.latMax, WORLD.lngMax]);
