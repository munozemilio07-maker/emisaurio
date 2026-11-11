import { describe, expect, it, vi } from 'vitest';
import { runTool, type ToolHost } from '../src/chat/tools';
import { toolDefs } from '../src/chat/tool-defs';
import { EXPEDITIONS } from '../src/data';

function makeHost(done: Record<string, number> = {}) {
  const host: ToolHost = {
    done: () => done,
    openExp: vi.fn(),
    select: vi.fn(),
    setMany: vi.fn((ids: string[], v: boolean) => { for (const id of ids) { if (v) done[id] = 1; else delete done[id]; } }),
  };
  return host;
}

describe('herramientas del chat (SPEC §6)', () => {
  it('define las 5 herramientas', () => {
    expect(toolDefs(EXPEDITIONS.length).map((t) => t.name)).toEqual(['buscar_paradas', 'ver_expedicion', 'progreso', 'mostrar_en_mapa', 'marcar_hecho']);
  });

  it('buscar_paradas encuentra el Lodestone de Umbral Sands y respeta solo_pendientes', () => {
    const host = makeHost();
    const r = runTool('buscar_paradas', { texto: 'umbral sands lodestone' }, host) as any;
    expect(r.total).toBeGreaterThan(0);
    expect(r.resultados[0].nombre).toBe('Umbral Sands Lodestone');
    const all = runTool('buscar_paradas', { tipo: 'vault' }, host) as any;
    const id = EXPEDITIONS.flatMap((e) => e.stops).find((s) => s.kind === 'vault')!.markerId;
    const pending = runTool('buscar_paradas', { tipo: 'vault', solo_pendientes: true }, makeHost({ [id]: 1 })) as any;
    expect(pending.total).toBe(all.total - 1);
  });

  it('ver_expedicion y progreso reflejan los checks', () => {
    const e = EXPEDITIONS[25];
    const host = makeHost({ [e.stops[0].markerId]: 1 });
    const v = runTool('ver_expedicion', { numero: 26 }, host) as any;
    expect(v.hechas).toBe(1);
    expect(v.paradas[0]).toMatch(/✓$/);
    expect((runTool('progreso', {}, host) as any).total).toMatch(/^1\//);
  });

  it('mostrar_en_mapa abre la expedición y selecciona la parada', () => {
    const host = makeHost();
    runTool('mostrar_en_mapa', { expedicion: 26, parada: 3 }, host);
    expect(host.openExp).toHaveBeenCalledWith(26);
    expect(host.select).toHaveBeenCalledWith(EXPEDITIONS[25].stops[2].markerId);
    expect(() => runTool('mostrar_en_mapa', { expedicion: 26, parada: 999 }, host)).toThrow();
    expect(() => runTool('mostrar_en_mapa', { expedicion: 99 }, host)).toThrow();
  });

  it('marcar_hecho marca y desmarca', () => {
    const done: Record<string, number> = {};
    const host = makeHost(done);
    runTool('marcar_hecho', { expedicion: 1, paradas: [1, 2] }, host);
    expect(Object.keys(done)).toHaveLength(2);
    runTool('marcar_hecho', { expedicion: 1, paradas: [1], hecho: false }, host);
    expect(Object.keys(done)).toEqual([EXPEDITIONS[0].stops[1].markerId]);
  });
});
