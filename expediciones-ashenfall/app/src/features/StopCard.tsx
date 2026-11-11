import { BY_ID, KIND_LABEL, QUEST_BY_KEY } from '../data';
import { currentRoute, nextPending, routeStops, useStore } from '../state/store';
import { KindIcon, IconLink } from './icons';

/** Ficha de una parada dentro del popup del mapa. */
export function StopCard({ id }: { id: string }) {
  const isDone = useStore((s) => !!s.done[id]);
  const toggle = useStore((s) => s.toggle);
  const select = useStore((s) => s.select);
  const loc = BY_ID.get(id);
  if (!loc) return null;
  const { stop, exp } = loc;

  const doneAndNext = () => {
    const s = useStore.getState();
    s.toggle(id, true);
    const next = nextPending(routeStops(currentRoute(s)), { ...s.done, [id]: 1 }, id);
    if (next) select(next.markerId); else s.clearSelection();
  };

  return (
    <div className="card">
      <div className="card-kicker">
        <KindIcon kind={stop.kind} size={15} />
        <span>{KIND_LABEL[stop.kind]}</span>
        <span className="card-where">Exp. {exp.number} · parada {stop.order}</span>
      </div>
      <h3 className="card-title">{stop.title}</h3>
      {stop.detail && <p className="card-detail">{stop.detail}</p>}
      {stop.quests?.map((k) => {
        const q = QUEST_BY_KEY.get(k);
        return q ? (
          <button key={k} type="button" className="chip chip--link" onClick={() => useStore.getState().openQuest(k)}>
            Misión: {q.name}
          </button>
        ) : null;
      })}
      {stop.recipes && <p className="card-recipes"><b>Recetas dentro:</b> {stop.recipes.join(', ')}</p>}
      {stop.note && <p className="card-note">{stop.note}</p>}
      <div className="card-actions">
        <button type="button" className={`btn btn--sm${isDone ? '' : ' btn--primary'}`} onClick={() => toggle(id)}>
          {isDone ? 'Desmarcar' : 'Marcar hecha'}
        </button>
        {!isDone && <button type="button" className="btn btn--sm" onClick={doneAndNext}>Hecha y siguiente →</button>}
      </div>
      <a className="card-link" href={stop.metaforgeUrl} target="_blank" rel="noreferrer">
        <IconLink size={13} /> Ver en MetaForge
      </a>
    </div>
  );
}
