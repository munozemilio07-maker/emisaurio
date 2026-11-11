import { useMemo } from 'react';
import { search } from '../data';
import { useStore } from '../state/store';
import { FilterBar } from './FilterBar';
import { StopRow } from './StopRow';
import { IconSearch } from './icons';

const LIMIT = 120;

/** Buscador global: texto + filtros por tipo sobre las paradas de todo el mapa. */
export function SearchTab() {
  const query = useStore((s) => s.query);
  const kinds = useStore((s) => s.kinds);
  const pendingOnly = useStore((s) => s.pendingOnly);
  const done = useStore((s) => s.done);
  const set = useStore((s) => s.set);
  const active = query.trim() !== '' || kinds.length > 0 || pendingOnly;
  const results = useMemo(() => (active ? search({ text: query, kinds, pending: pendingOnly, done }) : []), [active, query, kinds, pendingOnly, done]);

  return (
    <div className="detail">
      <label className="searchbox">
        <IconSearch />
        <input
          type="search" value={query} autoComplete="off" spellCheck={false}
          placeholder="Busca: vault, Zanik, Kalphite, cofre uzzer…" aria-label="Buscar paradas en todo el mapa"
          onChange={(e) => set({ query: e.target.value })}
        />
      </label>
      <div className="detail-tools">
        <FilterBar />
        <label className="switch">
          <input type="checkbox" checked={pendingOnly} onChange={(e) => set({ pendingOnly: e.target.checked })} />
          <span>Solo pendientes</span>
        </label>
      </div>
      {active ? (
        <>
          <p className="hint mono">{results.length} {results.length === 1 ? 'parada' : 'paradas'}{results.length > LIMIT ? ` · se muestran ${LIMIT}` : ''} · resaltadas en el mapa</p>
          <ol className="rows">
            {results.slice(0, LIMIT).map(({ stop, exp }) => (
              <StopRow key={stop.markerId} stop={stop} n={exp.number} sub={`${exp.name} · parada ${stop.order}${stop.detail ? ` · ${stop.detail}` : ''}`} />
            ))}
          </ol>
          {!results.length && <p className="empty">Nada coincide. Prueba con menos palabras o quita un filtro.</p>}
        </>
      ) : (
        <p className="empty">Escribe un nombre, una zona o una misión, o toca un tipo para ver todas sus paradas en el mapa. El número de cada renglón es la expedición.</p>
      )}
    </div>
  );
}
