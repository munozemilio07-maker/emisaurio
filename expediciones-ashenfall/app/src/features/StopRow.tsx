import { memo, useEffect, useRef } from 'react';
import { KIND_COLOR, KIND_LABEL } from '../data';
import type { Stop } from '../types';
import { useStore } from '../state/store';
import { KindIcon, IconLink } from './icons';

interface Props { stop: Stop; n: number | string; title?: string; sub?: string }

/** Renglón de la bitácora: número (vuela al pin), datos, enlace y check. */
export const StopRow = memo(function StopRow({ stop, n, title, sub }: Props) {
  const id = stop.markerId;
  const isDone = useStore((s) => !!s.done[id]);
  const selected = useStore((s) => s.selected === id);
  const flash = useStore((s) => (s.flash?.id === id ? s.flash.n : 0));
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!flash || !ref.current) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [flash]);

  return (
    <li ref={ref} className={`row${isDone ? ' is-done' : ''}${selected ? ' is-sel' : ''}`} style={{ '--k': KIND_COLOR[stop.kind] } as React.CSSProperties}>
      <button type="button" className="row-num" title="Ver en el mapa" aria-label={`Ver ${title ?? stop.title} en el mapa`} onClick={() => useStore.getState().select(id)}>
        {n}
      </button>
      <div className="row-body" onClick={() => useStore.getState().select(id)}>
        <div className="row-title">{title ?? stop.title}</div>
        <div className="row-meta">
          <KindIcon kind={stop.kind} size={13} />
          <span>{KIND_LABEL[stop.kind]}</span>
          {(sub ?? stop.detail) && <span className="row-detail">· {sub ?? stop.detail}</span>}
          {stop.note && <span className="row-flag" title={stop.note}>ojo</span>}
        </div>
        <a className="row-link" href={stop.metaforgeUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
          <IconLink size={11} /> Ver en MetaForge
        </a>
      </div>
      <label className="check" title={isDone ? 'Desmarcar' : 'Marcar como hecha'}>
        <input type="checkbox" checked={isDone} onChange={() => useStore.getState().toggle(id)} aria-label={`${title ?? stop.title}: hecha`} />
        <span aria-hidden="true" />
      </label>
    </li>
  );
});
