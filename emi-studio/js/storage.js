// Guardado local: proyectos y archivos en IndexedDB (se quedan en tu equipo, dentro del navegador).
const DB_NAME = 'emi-studio', DB_VER = 1;
let dbp = null;

function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    const r = fn(s);
    if (r) r.onsuccess = () => (out = r.result);
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('Transacción cancelada'));
  });
}

export const MAX_STORED = 2 * 1024 ** 3; // archivos de más de 2 GB no se copian: se vuelven a vincular

export async function putFile(id, file) {
  if (file.size > MAX_STORED) return false;
  await tx('files', 'readwrite', (s) => s.put({ id, name: file.name, type: file.type, size: file.size, blob: file }));
  return true;
}
export const getFile = (id) => tx('files', 'readonly', (s) => s.get(id));
export const saveProject = (rec) => tx('projects', 'readwrite', (s) => s.put(rec));
export const getProject = (id) => tx('projects', 'readonly', (s) => s.get(id));
export async function listProjects() {
  const all = (await tx('projects', 'readonly', (s) => s.getAll())) || [];
  return all.map(({ data, ...meta }) => meta).sort((a, b) => b.updated - a.updated);
}

// Borra el proyecto y los archivos que ningún otro proyecto usa
export async function deleteProject(id) {
  const rec = await getProject(id);
  await tx('projects', 'readwrite', (s) => s.delete(id));
  if (!rec) return;
  const mine = new Set((JSON.parse(rec.data).media || []).map((m) => m.id));
  const all = (await tx('projects', 'readonly', (s) => s.getAll())) || [];
  for (const p of all) for (const m of JSON.parse(p.data).media || []) mine.delete(m.id);
  for (const fid of mine) await tx('files', 'readwrite', (s) => s.delete(fid));
}

export async function storageInfo() {
  try {
    const persisted = await navigator.storage?.persist?.();
    const est = await navigator.storage?.estimate?.();
    return { persisted, usage: est?.usage || 0, quota: est?.quota || 0 };
  } catch { return { persisted: false, usage: 0, quota: 0 }; }
}

export function lastProjectId() { try { return localStorage.getItem('emi.last'); } catch { return null; } }
export function setLastProjectId(id) { try { localStorage.setItem('emi.last', id); } catch {} }
