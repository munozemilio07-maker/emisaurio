import { useSyncExternalStore } from 'react';
import { useStore } from './store';
import { sameProgress, type Progress } from './progress';

const password = () => { try { return localStorage.getItem('ashenfall-app-password') ?? ''; } catch { return ''; } };

/**
 * Sincronización opcional contra el Worker (/api/sync/:code).
 * El cliente manda su progreso, el servidor lo fusiona con lo guardado y
 * devuelve el resultado. Sin código o sin red no hace nada.
 */
interface Status { state: 'idle' | 'syncing' | 'ok' | 'error'; at?: number; error?: string }
let status: Status = { state: 'idle' };
const subs = new Set<() => void>();
const setStatus = (s: Status) => { status = s; subs.forEach((f) => f()); };
export const useSyncStatus = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => status);

const WORDS = ['brasa', 'duna', 'cuervo', 'runa', 'niebla', 'garou', 'vault', 'ceniza', 'lodestone', 'kebbit', 'espectro', 'ambar', 'colmillo', 'pantano', 'titan', 'oasis'];
export function newSyncCode() {
  const r = crypto.getRandomValues(new Uint32Array(5));
  const hex = Array.from(r.slice(2), (n) => n.toString(36).padStart(6, '0').slice(-6)).join('');
  return `${WORDS[r[0] % WORDS.length]}-${WORDS[r[1] % WORDS.length]}-${hex}`;
}

let running = false;
let again = false;
let lastSynced: Progress | null = null;

export async function syncNow(): Promise<void> {
  const { syncCode } = useStore.getState();
  if (!syncCode) return;
  if (running) { again = true; return; }
  running = true;
  setStatus({ state: 'syncing', at: status.at });
  try {
    const s = useStore.getState();
    const sent: Progress = { done: s.done, undone: s.undone };
    const r = await fetch(`/api/sync/${encodeURIComponent(syncCode)}`, {
      method: 'PUT', headers: { 'content-type': 'application/json', ...(password() ? { 'x-app-password': password() } : {}) }, body: JSON.stringify(sent),
    });
    if (!r.ok) throw new Error(r.status === 401 ? 'contraseña de la app incorrecta (escríbela en el chat)' : r.status === 404 ? 'el servidor de sincronización no está desplegado' : r.status === 400 ? 'código inválido (mínimo 12 caracteres)' : `error ${r.status}`);
    const merged = (await r.json()) as Progress;
    if (!merged || typeof merged.done !== 'object') throw new Error('respuesta inesperada');
    lastSynced = merged;
    useStore.getState().applyRemote(merged);
    setStatus({ state: 'ok', at: Date.now() });
  } catch (e) {
    setStatus({ state: 'error', at: status.at, error: e instanceof TypeError ? 'sin conexión con el servidor' : (e as Error).message });
  } finally {
    running = false;
    if (again) { again = false; void syncNow(); }
  }
}

/** Arranca la sincronización automática: al abrir, al cambiar algo y al volver a la pestaña. */
export function startSync() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  void syncNow();
  useStore.subscribe((s, prev) => {
    if (s.done === prev.done && s.undone === prev.undone && s.syncCode === prev.syncCode) return;
    if (!s.syncCode) return;
    if (lastSynced && sameProgress(lastSynced, s)) return; // el cambio vino del propio servidor
    clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 1500);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void syncNow(); });
  window.addEventListener('online', () => void syncNow());
  setInterval(() => { if (document.visibilityState === 'visible') void syncNow(); }, 120_000);
}
