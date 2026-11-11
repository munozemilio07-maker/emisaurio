import { TOTAL } from '../data';
import { useStore, type Sheet, type Tab } from '../state/store';
import { Bosses } from './Bosses';
import { ExpDetail, ExpIndex, Meter } from './Expeditions';
import { Quests } from './Quests';
import { SearchTab } from './SearchTab';
import { Compass, IconChat, IconGear } from './icons';

const TABS: { id: Tab; label: string }[] = [
  { id: 'exp', label: 'Expediciones' },
  { id: 'quests', label: 'Misiones' },
  { id: 'bosses', label: 'Jefes' },
  { id: 'search', label: 'Buscar' },
];
const NEXT_SHEET: Record<Sheet, Sheet> = { peek: 'half', half: 'full', full: 'peek' };
const SHEET_LABEL: Record<Sheet, string> = { peek: 'Abrir el cuaderno', half: 'Agrandar el cuaderno', full: 'Encoger el cuaderno' };

export function Panel() {
  const tab = useStore((s) => s.tab);
  const expOpen = useStore((s) => s.expOpen);
  const sheet = useStore((s) => s.sheet);
  const total = useStore((s) => Object.keys(s.done).filter((id) => s.done[id]).length);
  const setTab = useStore((s) => s.setTab);
  const set = useStore((s) => s.set);
  // cada vista empieza arriba: la clave reinicia el scroll
  const view = useStore((s) => (s.tab === 'exp' ? (s.expOpen ? `e${s.cur}` : 'ei') : s.tab === 'quests' ? `q${s.questOpen ?? ''}` : s.tab));

  return (
    <aside className={`panel panel--${sheet}`} data-panel aria-label="Cuaderno de expediciones">
      <button type="button" className="sheet-handle" aria-label={SHEET_LABEL[sheet]} onClick={() => set({ sheet: NEXT_SHEET[sheet] })}><i /></button>
      <header className="masthead">
        <Compass />
        <div className="masthead-text">
          <p className="kicker">Cuaderno de cartógrafo</p>
          <h1>Expediciones de Ashenfall</h1>
        </div>
        {!import.meta.env.VITE_ARTIFACT && <button type="button" className="icon-btn" aria-label="Chat con Claude" title="Chat con Claude" onClick={() => set({ chatOpen: true })}><IconChat /></button>}
        <button type="button" className="icon-btn" aria-label="Ajustes y progreso" title="Ajustes y progreso" onClick={() => set({ settingsOpen: true })}><IconGear /></button>
      </header>
      <div className="total">
        <span className="total-label">Mapa completado</span>
        <Meter value={Math.min(total, TOTAL)} total={TOTAL} label="Progreso total" />
      </div>
      <nav className="tabs" aria-label="Secciones">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={tab === t.id ? 'is-on' : ''} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="panel-body" key={view}>
        {tab === 'exp' && (expOpen ? <ExpDetail /> : <ExpIndex />)}
        {tab === 'quests' && <Quests />}
        {tab === 'bosses' && <Bosses />}
        {tab === 'search' && <SearchTab />}
      </div>
      <footer className="credits">
        Mapa y marcadores: <a href="https://metaforge.app/runescape-dragonwilds/map/ashenfall" target="_blank" rel="noreferrer">MetaForge</a> · RuneScape: Dragonwilds © Jagex
      </footer>
    </aside>
  );
}
