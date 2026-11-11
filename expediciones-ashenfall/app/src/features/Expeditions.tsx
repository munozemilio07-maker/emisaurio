import { useMemo } from 'react';
import { EXPEDITIONS, GROUPS, KINDS } from '../data';
import type { Expedition } from '../types';
import { countDone, nextPending, useStore } from '../state/store';
import { FilterBar } from './FilterBar';
import { StopRow } from './StopRow';
import { IconBack, IconNext } from './icons';

export function Meter({ value, total, label }: { value: number; total: number; label?: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={value} aria-label={label ?? 'Progreso'}>
      <div className="meter-bar"><i style={{ width: `${pct}%` }} /></div>
      <span className="meter-num">{value}<small>/{total}</small></span>
    </div>
  );
}

/** Índice: todas las expediciones agrupadas por región. */
export function ExpIndex() {
  const done = useStore((s) => s.done);
  const cur = useStore((s) => s.cur);
  const openExp = useStore((s) => s.openExp);
  return (
    <div className="index">
      {GROUPS.map((g) => {
        const list = EXPEDITIONS.filter((e) => e.group === g);
        if (!list.length) return null;
        const stops = list.flatMap((e) => e.stops);
        const d = countDone(stops, done);
        return (
          <section key={g} className="index-group">
            <header>
              <h2>{g}</h2>
              <span className="mono">{d}/{stops.length}</span>
            </header>
            <ul>
              {list.map((e) => {
                const n = countDone(e.stops, done);
                const full = n === e.stops.length;
                return (
                  <li key={e.id}>
                    <button type="button" className={`index-item${e.number === cur ? ' is-cur' : ''}${full ? ' is-full' : ''}`} onClick={() => openExp(e.number)}>
                      <span className="index-n">{e.number}</span>
                      <span className="index-name">
                        {e.name}
                        {e.region !== g && <small>{e.region.replace(`${g} · `, '')}</small>}
                      </span>
                      <span className="index-count">{full ? 'Completa' : `${n}/${e.stops.length}`}</span>
                      <i className="index-bar" style={{ width: `${(n / e.stops.length) * 100}%` }} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Botón grande del modo "Siguiente parada". */
export function NextStop({ exp }: { exp: Expedition }) {
  const done = useStore((s) => s.done);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const openExp = useStore((s) => s.openExp);
  const anchor = selected && exp.stops.some((s) => s.markerId === selected && done[s.markerId]) ? selected : null;
  const next = nextPending(exp.stops, done, anchor);
  if (!next) {
    const following = EXPEDITIONS.find((e) => e.number > exp.number && countDone(e.stops, done) < e.stops.length);
    return (
      <button type="button" className="next next--done" onClick={() => following && openExp(following.number)} disabled={!following}>
        <span className="next-label">Expedición completa</span>
        <span className="next-title">{following ? `Seguir con la ${following.number}: ${following.name}` : 'Mapa al 100%. Nada pendiente.'}</span>
      </button>
    );
  }
  return (
    <button type="button" className="next" onClick={() => select(next.markerId)}>
      <span className="next-label">Siguiente parada</span>
      <span className="next-title"><b className="mono">{next.order}</b> {next.title}</span>
      <IconNext size={22} />
    </button>
  );
}

/** Detalle de una expedición: ruta numerada con checks. */
export function ExpDetail() {
  const cur = useStore((s) => s.cur);
  const done = useStore((s) => s.done);
  const hideDone = useStore((s) => s.hideDone);
  const kinds = useStore((s) => s.kinds);
  const set = useStore((s) => s.set);
  const openExp = useStore((s) => s.openExp);
  const showIndex = useStore((s) => s.showIndex);
  const exp = EXPEDITIONS[cur - 1];
  const n = countDone(exp.stops, done);
  const counts = useMemo(() => Object.fromEntries(KINDS.map((k) => [k, exp.stops.filter((s) => s.kind === k).length])), [exp]);
  const shown = exp.stops.filter((s) => (!hideDone || !done[s.markerId]) && (!kinds.length || kinds.includes(s.kind)));

  return (
    <div className="detail">
      <header className="detail-head">
        <div className="detail-nav">
          <button type="button" className="link" onClick={showIndex}><IconBack size={14} /> Todas las expediciones</button>
          <span className="spacer" />
          <button type="button" className="icon-btn" aria-label="Expedición anterior" disabled={cur <= 1} onClick={() => openExp(cur - 1)}><IconBack /></button>
          <button type="button" className="icon-btn" aria-label="Expedición siguiente" disabled={cur >= EXPEDITIONS.length} onClick={() => openExp(cur + 1)}><IconNext /></button>
        </div>
        <p className="kicker">Expedición {exp.number} · {exp.region}</p>
        <h2 className="detail-title">{exp.name}</h2>
        <Meter value={n} total={exp.stops.length} label={`Progreso de la expedición ${exp.number}`} />
        {n === exp.stops.length && <span className="stamp" aria-hidden="true">Completa</span>}
      </header>

      <NextStop exp={exp} />

      <div className="detail-tools">
        <FilterBar counts={counts} />
        <label className="switch">
          <input type="checkbox" checked={hideDone} onChange={(e) => set({ hideDone: e.target.checked })} />
          <span>Ocultar las hechas</span>
        </label>
      </div>

      <ol className="rows">
        {shown.map((s) => <StopRow key={s.markerId} stop={s} n={s.order} />)}
      </ol>
      {!shown.length && <p className="empty">{n === exp.stops.length ? 'Todo hecho en esta expedición.' : 'Ninguna parada coincide con los filtros.'}</p>}
    </div>
  );
}
