import { describe, expect, it } from 'vitest';
import { CRS_TRANSFORM, toPixel, toTile } from '../src/lib/geo';

describe('sistema de coordenadas (SPEC §3)', () => {
  it('esquinas del mundo', () => {
    expect(toPixel(-118500, -12000, 0)).toEqual({ x: 0, y: 0 });
    expect(toPixel(301400, 408000, 0)).toEqual({ x: 256, y: 256 });
  });

  it('Temple Lodestone (189026, 5065) cae en el templo del suroeste', () => {
    const p = toPixel(189026, 5065, 5);
    expect(p.x).toBeCloseTo(332.8, 0);
    expect(p.y).toBeCloseTo(5999.5, 0);
    // cuadrante suroeste del mapa, y dentro del tile z5 (1, 23)
    expect(p.x / 8192).toBeLessThan(0.1);
    expect(p.y / 8192).toBeGreaterThan(0.7);
    expect(toTile(189026, 5065, 5)).toEqual({ x: 1, y: 23 });
  });

  it('la transformación del CRS de Leaflet da los mismos píxeles que la fórmula', () => {
    const [a, b, c, d] = CRS_TRANSFORM;
    for (const [lat, lng] of [[189026, 5065], [96415, 244689], [28644, 314435], [-57714, 144594]]) {
      for (const z of [1, 4, 6]) {
        const p = toPixel(lat, lng, z);
        expect((a * lng + b) * 2 ** z).toBeCloseTo(p.x, 6);
        expect((c * lat + d) * 2 ** z).toBeCloseTo(p.y, 6);
      }
    }
  });
});
