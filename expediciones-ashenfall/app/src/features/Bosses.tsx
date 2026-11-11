import { useMemo, useState } from 'react';
import { ALL, BOSSES, QUEST_BY_KEY } from '../data';
import type { Boss } from '../types';
import { useStore } from '../state/store';
import { IconLink, IconTarget } from './icons';

const stopsFor = (b: Boss) =>
  (b.match ?? [b.name]).flatMap((m) => ALL.filter((l) => l.stop.title.toLowerCase().includes(m.toLowerCase())));

function BossCard({ b }: { b: Boss }) {
  const [open, setOpen] = useState(false);
  const done = useStore((s) => s.done);
  const select = useStore((s) => s.select);
  const locs = useMemo(() => stopsFor(b), [b]);
  const beaten = locs.length > 0 && locs.every((l) => done[l.stop.markerId]);
  const quest = b.quest ? QUEST_BY_KEY.get(b.quest) : null;
  return (
    <article className={`boss${open ? ' is-open' : ''}${beaten ? ' is-beaten' : ''}`}>
      <button type="button" className="boss-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="boss-name">{b.name}</span>
        <span className="boss-where">{b.where}</span>
        <span className="boss-stats">
          {b.pl && <span><small>PL</small>{b.pl}</span>}
          {b.hp && <span><small>Vida</small>{b.hp}</span>}
        </span>
      </button>
      {open && (
        <div className="boss-body">
          {(b.weak?.length || b.resist?.length) ? (
            <dl className="boss-dl">
              {b.weak?.length ? (<><dt>Débil a</dt><dd>{b.weak.join(' · ')}</dd></>) : null}
              {b.resist?.length ? (<><dt>Resiste</dt><dd>{b.resist.join(' · ')}</dd></>) : null}
            </dl>
          ) : null}
          <ul className="boss-tips">{b.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
          {b.drops?.length ? <p className="boss-drops"><b>Botín:</b> {b.drops.join(', ')}</p> : null}
          <div className="boss-actions">
            {locs.slice(0, 4).map((l) => (
              <button key={l.stop.markerId} type="button" className="btn btn--sm" onClick={() => select(l.stop.markerId)}>
                <IconTarget size={14} /> Exp. {l.exp.number} · parada {l.stop.order}
              </button>
            ))}
            {quest && <button type="button" className="btn btn--sm" onClick={() => useStore.getState().openQuest(quest.parent ?? quest.key)}>Misión: {quest.name}</button>}
            {b.wiki && <a className="link" href={b.wiki} target="_blank" rel="noreferrer"><IconLink size={13} /> Wiki</a>}
          </div>
          {!locs.length && <p className="hint">Sin pin en MetaForge: se entra por una puerta, un vault o una actividad.</p>}
        </div>
      )}
    </article>
  );
}

export function Bosses() {
  const regions = [...new Set(BOSSES.map((b) => b.region))];
  return (
    <div className="index">
      <p className="hint">Fichas para melee. Los datos vienen de la base de conocimiento y del wiki; lo que el wiki no publica aparece vacío en vez de inventado.</p>
      {regions.map((r) => (
        <section key={r} className="index-group">
          <header><h2>{r}</h2></header>
          {BOSSES.filter((b) => b.region === r).map((b) => <BossCard key={b.id} b={b} />)}
        </section>
      ))}
    </div>
  );
}
