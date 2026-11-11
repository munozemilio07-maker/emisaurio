import { KINDS, KIND_COLOR, KIND_PLURAL } from '../data';
import { useStore } from '../state/store';

/** Filtros por tipo. Afectan a la lista y a los pines del mapa. */
export function FilterBar({ counts }: { counts?: Partial<Record<string, number>> }) {
  const kinds = useStore((s) => s.kinds);
  const set = useStore((s) => s.set);
  const flip = (k: (typeof KINDS)[number]) => set({ kinds: kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k] });
  return (
    <div className="filters" role="group" aria-label="Filtrar por tipo">
      {KINDS.map((k) => {
        if (counts && !counts[k]) return null;
        const on = kinds.includes(k);
        return (
          <button key={k} type="button" className={`chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => flip(k)} style={{ '--k': KIND_COLOR[k] } as React.CSSProperties}>
            <i className="dot" />{KIND_PLURAL[k]}{counts ? <b>{counts[k]}</b> : null}
          </button>
        );
      })}
      {kinds.length > 0 && <button type="button" className="chip chip--clear" onClick={() => set({ kinds: [] })}>Quitar filtros</button>}
    </div>
  );
}
