import { BY_ID, GROUPS, QUESTS, QUEST_BY_KEY } from '../data';
import type { Quest } from '../types';
import { nextPending, routeStops, useStore } from '../state/store';
import { Meter } from './Expeditions';
import { StopRow } from './StopRow';
import { IconBack, IconLink, IconNext } from './icons';

const TYPE: Record<Quest['type'], string> = { primaria: 'Principal', secundaria: 'Secundaria', tarea: 'Tarea' };
const stepIds = (q: Quest) => [...new Set(q.steps.map((s) => s.markerId))];
const withTasks = (q: Quest) => [q, ...QUESTS.filter((t) => t.parent === q.key)];

function QuestIndex() {
  const done = useStore((s) => s.done);
  const openQuest = useStore((s) => s.openQuest);
  const tops = QUESTS.filter((q) => !q.parent);
  const regions = [...new Set([...GROUPS, ...tops.map((q) => q.region)])];
  return (
    <div className="index">
      <p className="hint">Las paradas agrupadas por misión, con sus pasos en orden. Solo aparecen las misiones que tienen pines en MetaForge.</p>
      {regions.map((r) => {
        const list = tops.filter((q) => q.region === r);
        if (!list.length) return null;
        return (
          <section key={r} className="index-group">
            <header><h2>{r}</h2></header>
            <ul>
              {list.map((q) => {
                const ids = withTasks(q).flatMap(stepIds);
                const n = ids.filter((id) => done[id]).length;
                const full = n === ids.length;
                return (
                  <li key={q.key}>
                    <button type="button" className={`index-item${full ? ' is-full' : ''}`} onClick={() => openQuest(q.key)}>
                      <span className={`index-n index-n--${q.type}`}>{q.type === 'primaria' ? '★' : '◆'}</span>
                      <span className="index-name">{q.name}<small>{TYPE[q.type]}{withTasks(q).length > 1 ? ` · ${withTasks(q).length - 1} tareas` : ''}</small></span>
                      <span className="index-count">{full ? 'Completa' : `${n}/${ids.length}`}</span>
                      <i className="index-bar" style={{ width: `${(n / ids.length) * 100}%` }} />
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

function Steps({ q, offset = 0 }: { q: Quest; offset?: number }) {
  return (
    <ol className="rows">
      {q.steps.map((st, i) => {
        const loc = BY_ID.get(st.markerId);
        if (!loc) return null;
        return <StopRow key={`${st.markerId}-${i}`} stop={loc.stop} n={offset + i + 1} title={st.title} sub={`Exp. ${loc.exp.number} · parada ${loc.stop.order}${loc.stop.underground ? ' · Subterráneo' : ''}`} />;
      })}
    </ol>
  );
}

function QuestDetail({ q }: { q: Quest }) {
  const done = useStore((s) => s.done);
  const select = useStore((s) => s.select);
  const openQuest = useStore((s) => s.openQuest);
  const tasks = QUESTS.filter((t) => t.parent === q.key);
  const ids = withTasks(q).flatMap(stepIds);
  const n = ids.filter((id) => done[id]).length;
  const next = nextPending(routeStops({ type: 'quest', key: q.key }), done);
  const clans = [...new Set(tasks.map((t) => t.clan ?? ''))];

  return (
    <div className="detail">
      <header className="detail-head">
        <div className="detail-nav">
          <button type="button" className="link" onClick={() => openQuest(null)}><IconBack size={14} /> Todas las misiones</button>
          <span className="spacer" />
          <a className="link" href={q.wiki} target="_blank" rel="noreferrer"><IconLink size={13} /> Wiki</a>
        </div>
        <p className="kicker">Misión {TYPE[q.type].toLowerCase()} · {q.region}</p>
        <h2 className="detail-title">{q.name}</h2>
        <Meter value={n} total={ids.length} label={`Progreso de ${q.name}`} />
        {n === ids.length && <span className="stamp" aria-hidden="true">Completa</span>}
      </header>

      {next && (
        <button type="button" className="next" onClick={() => select(next.markerId)}>
          <span className="next-label">Siguiente paso</span>
          <span className="next-title">{q.steps.find((s) => s.markerId === next.markerId)?.title ?? next.title}</span>
          <IconNext size={22} />
        </button>
      )}

      <p className="hint">El orden sigue la guía de la misión cuando se conoce; los pasos repetidos (por ejemplo, varios fragmentos) van por cercanía.</p>
      <Steps q={q} />

      {clans.map((clan) => (
        <section key={clan} className="tasks">
          {clan && <h3 className="tasks-clan">Clan {clan}</h3>}
          {tasks.filter((t) => (t.clan ?? '') === clan).map((t) => (
            <div key={t.key} className="task">
              <h4>
                <span>{t.name}</span>
                <button type="button" className="link" onClick={() => openQuest(t.key)}>Ver ruta</button>
              </h4>
              <Steps q={t} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

export function Quests() {
  const open = useStore((s) => s.questOpen);
  const q = open ? QUEST_BY_KEY.get(open) : null;
  return q ? <QuestDetail q={q} /> : <QuestIndex />;
}
