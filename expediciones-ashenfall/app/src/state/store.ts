import { create } from 'zustand';
import { BY_ID, EXPEDITIONS, QUEST_BY_KEY, expByNumber } from '../data';
import type { Kind, LayerId, Stop } from '../types';
import { emptyProgress, mergeProgress, parseImport, type Progress } from './progress';

const KEY = 'ashenfall-v5';
export type Tab = 'exp' | 'quests' | 'bosses' | 'search';
export type Theme = 'auto' | 'light' | 'dark';
export type Sheet = 'peek' | 'half' | 'full';
/** La ruta dibujada en el mapa: una expedición o los pasos de una misión */
export type Route = { type: 'exp'; number: number } | { type: 'quest'; key: string };

interface Persisted extends Progress {
  cur: number;
  hideDone: boolean;
  theme: Theme;
  syncCode: string;
  chat: ChatTurn[];
}
export interface ChatTurn { role: 'user' | 'assistant'; text: string }

interface State extends Persisted {
  tab: Tab;
  /** true = lista de paradas; false = índice de expediciones */
  expOpen: boolean;
  questOpen: string | null;
  selected: string | null;
  /** petición de volar a una parada (n cambia en cada petición) */
  focus: { id: string; n: number } | null;
  fit: number;
  layerMode: 'auto' | LayerId;
  kinds: Kind[];
  query: string;
  pendingOnly: boolean;
  chatOpen: boolean;
  settingsOpen: boolean;
  sheet: Sheet;
  flash: { id: string; n: number } | null;

  toggle(id: string, value?: boolean): void;
  setMany(ids: string[], value: boolean): void;
  openExp(n: number, fit?: boolean): void;
  showIndex(): void;
  openQuest(key: string | null): void;
  select(id: string, opts?: { fly?: boolean; fromMap?: boolean }): void;
  clearSelection(): void;
  setTab(t: Tab): void;
  set(p: Partial<State>): void;
  importProgress(raw: unknown, mode: 'merge' | 'replace'): number | null;
  applyRemote(p: Progress): void;
  resetProgress(): void;
}

function load(): Persisted {
  const base: Persisted = { ...emptyProgress(), cur: 1, hideDone: false, theme: 'auto', syncCode: '', chat: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...base, ...JSON.parse(raw) };
    // Primera vez: migra el progreso de la v4 si existe en este navegador
    const v4 = parseImport(JSON.parse(localStorage.getItem('aw-done') || 'null'));
    const cur = Number(localStorage.getItem('aw-cur') || 0) + 1;
    if (v4) return { ...base, ...v4, cur: cur >= 1 && cur <= EXPEDITIONS.length ? cur : 1, hideDone: localStorage.getItem('aw-hide') === '1' };
  } catch { /* almacenamiento bloqueado o corrupto: empieza limpio */ }
  return base;
}

let nonce = 0;
const initial = load();

export const useStore = create<State>((set, get) => ({
  ...initial,
  cur: expByNumber(initial.cur).number,
  tab: 'exp', expOpen: true, questOpen: null, selected: null, focus: null, fit: 0,
  layerMode: 'auto', kinds: [], query: '', pendingOnly: false,
  chatOpen: false, settingsOpen: false, sheet: 'half', flash: null,

  toggle(id, value) {
    const s = get();
    const v = value ?? !s.done[id];
    const done = { ...s.done }, undone = { ...s.undone };
    const now = Date.now();
    if (v) { done[id] = now; delete undone[id]; } else { delete done[id]; undone[id] = now; }
    set({ done, undone });
  },
  setMany(ids, value) {
    const s = get();
    const done = { ...s.done }, undone = { ...s.undone };
    const now = Date.now();
    for (const id of ids) {
      if (value) { if (!done[id]) done[id] = now; delete undone[id]; } else if (done[id]) { delete done[id]; undone[id] = now; }
    }
    set({ done, undone });
  },
  openExp(n, fit = true) {
    const e = expByNumber(n);
    set((s) => ({ cur: e.number, tab: 'exp', expOpen: true, questOpen: null, selected: null, layerMode: 'auto', fit: fit ? s.fit + 1 : s.fit }));
  },
  showIndex: () => set({ expOpen: false }),
  openQuest(key) {
    set((s) => ({ questOpen: key, tab: 'quests', selected: null, layerMode: 'auto', fit: key ? s.fit + 1 : s.fit }));
  },
  select(id, opts = {}) {
    const loc = BY_ID.get(id);
    if (!loc) return;
    const s = get();
    const patch: Partial<State> = { selected: id, flash: { id, n: ++nonce } };
    // Si la parada no está en la ruta visible, cambia a su expedición
    const inRoute = routeStops(currentRoute(s)).some((x) => x.markerId === id);
    if (!inRoute) Object.assign(patch, { cur: loc.exp.number, questOpen: null, ...(s.tab === 'quests' ? { tab: 'exp' as Tab } : {}) });
    if (!inRoute && s.tab === 'exp') patch.expOpen = true;
    if (loc.stop.layer !== activeLayer({ ...s, ...patch } as State)) patch.layerMode = loc.stop.layer;
    if (opts.fly !== false) patch.focus = { id, n: ++nonce };
    if (opts.fromMap && s.sheet === 'peek') patch.sheet = 'half';
    set(patch);
  },
  clearSelection: () => set({ selected: null }),
  setTab: (tab) => set((s) => ({ tab, sheet: s.sheet === 'peek' ? 'half' : s.sheet })),
  set: (p) => set(p),
  importProgress(raw, mode) {
    const p = parseImport(raw);
    if (!p) return null;
    const s = get();
    const next = mode === 'replace' ? replaceWith(s, p) : mergeProgress(s, p);
    set(next);
    return Object.keys(next.done).length;
  },
  applyRemote: (p) => set(mergeProgress(get(), p)),
  resetProgress() {
    const s = get();
    set(replaceWith(s, emptyProgress()));
  },
}));

/** Reemplazo que deja lápidas, para que el borrado también se sincronice. */
function replaceWith(cur: Progress, next: Progress): Progress {
  const now = Date.now();
  const undone = { ...next.undone };
  for (const id of Object.keys(cur.done)) if (!next.done[id]) undone[id] = now;
  const done: Record<string, number> = {};
  for (const id of Object.keys(next.done)) { done[id] = now; delete undone[id]; }
  return { done, undone };
}

useStore.subscribe((s) => {
  const p: Persisted = { done: s.done, undone: s.undone, cur: s.cur, hideDone: s.hideDone, theme: s.theme, syncCode: s.syncCode, chat: s.chat.slice(-30) };
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* sin espacio o modo privado */ }
});

// ── Selectores ──────────────────────────────────────────────────────────────
export const currentRoute = (s: Pick<State, 'tab' | 'questOpen' | 'cur'>): Route =>
  s.tab === 'quests' && s.questOpen ? { type: 'quest', key: s.questOpen } : { type: 'exp', number: s.cur };

export function routeStops(r: Route): Stop[] {
  if (r.type === 'exp') return expByNumber(r.number).stops;
  const q = QUEST_BY_KEY.get(r.key);
  if (!q) return [];
  return q.steps.map((st) => BY_ID.get(st.markerId)?.stop).filter((x): x is Stop => !!x);
}

export function activeLayer(s: Pick<State, 'layerMode' | 'tab' | 'questOpen' | 'cur' | 'selected'>): LayerId {
  if (s.layerMode !== 'auto') return s.layerMode;
  const r = currentRoute(s);
  if (r.type === 'exp') return expByNumber(r.number).layer;
  return 'surface';
}

export const countDone = (stops: { markerId: string }[], done: Record<string, number>) =>
  stops.reduce((n, s) => n + (done[s.markerId] ? 1 : 0), 0);

export const nextPending = (stops: Stop[], done: Record<string, number>, after?: string | null) => {
  const start = after ? stops.findIndex((s) => s.markerId === after) + 1 : 0;
  return [...stops.slice(start), ...stops.slice(0, start)].find((s) => !done[s.markerId]) ?? null;
};
