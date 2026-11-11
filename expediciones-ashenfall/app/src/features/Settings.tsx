import { useEffect, useRef, useState } from 'react';
import { SNAPSHOT_AT, TILES, TOTAL } from '../data';
import { exportProgress } from '../state/progress';
import { useStore, type Theme } from '../state/store';
import { newSyncCode, syncNow, useSyncStatus } from '../state/sync';
import { IconClose } from './icons';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'auto', label: 'Automático' },
  { id: 'dark', label: 'Oscuro' },
  { id: 'light', label: 'Claro' },
];

function allTileUrls() {
  const out: string[] = [];
  for (const [id, layer] of Object.entries(TILES.layers))
    for (const [z, xs] of Object.entries(layer.tiles))
      for (const [x, ys] of Object.entries(xs)) for (const y of ys) out.push(`${import.meta.env.BASE_URL}tiles/${id}/${z}/${x}/${y}.webp`);
  return out;
}

const PREVIEW = !!import.meta.env.VITE_ARTIFACT;

export function Settings() {
  const open = useStore((s) => s.settingsOpen);
  const theme = useStore((s) => s.theme);
  const syncCode = useStore((s) => s.syncCode);
  const doneCount = useStore((s) => Object.keys(s.done).length);
  const set = useStore((s) => s.set);
  const sync = useSyncStatus();
  const ref = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const [code, setCode] = useState(syncCode);
  const [dl, setDl] = useState<{ n: number; total: number } | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setCode(useStore.getState().syncCode); setMsg(''); d.showModal(); }
    if (!open && d.open) d.close();
  }, [open]);

  const doExport = () => {
    const s = useStore.getState();
    if (PREVIEW) {
      // aquí no se pueden descargar archivos: se copia el JSON al portapapeles
      navigator.clipboard.writeText(JSON.stringify(exportProgress(s)))
        .then(() => setMsg('Progreso copiado al portapapeles. Pégalo en una nota para guardarlo.'), () => setMsg('No se pudo copiar el progreso en este visor.'));
      return;
    }
    const blob = new Blob([JSON.stringify(exportProgress(s), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ashenfall-progreso-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setMsg(`Exportadas ${Object.keys(s.done).length} paradas hechas.`);
  };

  const doImport = async (f: File, mode: 'merge' | 'replace') => {
    try {
      const n = useStore.getState().importProgress(JSON.parse(await f.text()), mode);
      setMsg(n === null ? 'Ese archivo no es un progreso de Expediciones de Ashenfall.' : `Importado. Ahora hay ${n} paradas hechas.`);
    } catch { setMsg('No se pudo leer el archivo: no es un JSON válido.'); }
  };

  const downloadMap = async () => {
    if (!('caches' in window)) { setMsg('Este navegador no permite guardar el mapa sin conexión.'); return; }
    const urls = allTileUrls();
    const cache = await caches.open('ashenfall-tiles');
    let n = 0, failed = 0;
    setDl({ n, total: urls.length });
    for (let i = 0; i < urls.length; i += 12) {
      await Promise.all(urls.slice(i, i + 12).map(async (u) => {
        try {
          if (!(await cache.match(u)) && !(await caches.match(u))) {
            const r = await fetch(u);
            if (r.ok) await cache.put(u, r); else failed++;
          }
        } catch { failed++; }
        n++;
      }));
      setDl({ n, total: urls.length });
    }
    setDl(null);
    setMsg(failed ? `Mapa guardado, pero ${failed} tiles fallaron. Vuelve a intentarlo con conexión.` : `Mapa completo guardado (${urls.length} tiles). Ya funciona sin conexión.`);
  };

  const saveCode = (c: string) => {
    const clean = c.trim().toLowerCase();
    set({ syncCode: clean });
    setCode(clean);
    if (clean) void syncNow();
  };

  return (
    <dialog ref={ref} className="dialog" onClose={() => set({ settingsOpen: false })} onClick={(e) => { if (e.target === ref.current) set({ settingsOpen: false }); }}>
      <div className="dialog-inner">
        <header className="dialog-head">
          <h2>{PREVIEW ? 'Progreso' : 'Ajustes y progreso'}</h2>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={() => set({ settingsOpen: false })}><IconClose /></button>
        </header>

        {!PREVIEW && (
        <section>
          <h3>Tema</h3>
          <div className="seg" role="group" aria-label="Tema">
            {THEMES.map((t) => (
              <button key={t.id} type="button" className={theme === t.id ? 'is-on' : ''} aria-pressed={theme === t.id} onClick={() => set({ theme: t.id })}>{t.label}</button>
            ))}
          </div>
        </section>
        )}

        {PREVIEW && <p className="dialog-msg">Vista previa: tu progreso se guarda solo en este navegador. El chat, la sincronización y el modo sin conexión están en la app desplegada.</p>}
        <section>
          <h3>Progreso</h3>
          <p className="hint">Llevas <b className="mono">{doneCount}/{TOTAL}</b> paradas. Los checks se guardan por marcador de MetaForge, así que regenerar las expediciones después de un parche no los borra.</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={doExport}>{PREVIEW ? 'Copiar progreso' : 'Exportar JSON'}</button>
            <button type="button" className="btn" onClick={() => { file.current!.dataset.mode = 'merge'; file.current!.click(); }}>Importar y combinar</button>
{!PREVIEW && <button type="button" className="btn" onClick={() => { if (confirm('Se reemplazará tu progreso actual por el del archivo. ¿Continuar?')) { file.current!.dataset.mode = 'replace'; file.current!.click(); } }}>Importar y reemplazar</button>}
          </div>
          <p className="hint">También acepta el progreso de la versión 4 (el valor <code>aw-done</code>).</p>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f, (e.target.dataset.mode as 'merge' | 'replace') ?? 'merge'); e.target.value = ''; }} />
        </section>

        {!PREVIEW && (
        <section>
          <h3>Sincronizar entre PC y celular</h3>
          <p className="hint">Usa el mismo código en los dos dispositivos. Quien tenga el código puede leer y cambiar ese progreso: no lo compartas. Si marcas y desmarcas en dos lados, gana el cambio más reciente de cada parada.</p>
          <div className="sync-row">
            <input className="input mono" value={code} placeholder="código de sincronización" aria-label="Código de sincronización" spellCheck={false} autoCapitalize="off" onChange={(e) => setCode(e.target.value)} />
            <button type="button" className="btn" onClick={() => saveCode(code)} disabled={code.trim().toLowerCase() === syncCode}>Usar</button>
            <button type="button" className="btn" onClick={() => saveCode(newSyncCode())}>Crear nuevo</button>
          </div>
          {syncCode ? (
            <p className={`hint sync-status sync-status--${sync.state}`}>
              {sync.state === 'ok' && `Sincronizado ${sync.at ? new Date(sync.at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}.`}
              {sync.state === 'syncing' && 'Sincronizando…'}
              {sync.state === 'idle' && 'Listo para sincronizar.'}
              {sync.state === 'error' && `No se pudo sincronizar: ${sync.error}. Tu progreso sigue guardado en este dispositivo.`}
              {' '}<button type="button" className="link" onClick={() => void syncNow()}>Sincronizar ahora</button>
              {' · '}<button type="button" className="link" onClick={() => saveCode('')}>Dejar de sincronizar</button>
            </p>
          ) : <p className="hint">Sin código, el progreso vive solo en este navegador.</p>}
        </section>
        )}

        {!PREVIEW && (
        <section>
          <h3>Sin conexión</h3>
          <p className="hint">La app, los datos y el mapa hasta el zoom 5 se guardan solos al instalarla. El zoom más nítido (6) se guarda al verlo, o completo con este botón (unos 20 MB más).</p>
          <button type="button" className="btn" onClick={() => void downloadMap()} disabled={!!dl}>
            {dl ? `Guardando mapa… ${dl.n}/${dl.total}` : 'Descargar el mapa completo'}
          </button>
        </section>
        )}

        {!PREVIEW && (
        <section>
          <h3>Zona de peligro</h3>
          <button type="button" className="btn btn--danger" onClick={() => { if (confirm(`Se borrarán tus ${doneCount} checks en este dispositivo${syncCode ? ' y en los sincronizados' : ''}. Exporta antes si quieres un respaldo. ¿Borrar?`)) { useStore.getState().resetProgress(); setMsg('Progreso borrado.'); } }}>
            Borrar todo el progreso
          </button>
        </section>
        )}

        {msg && <p className="dialog-msg" role="status">{msg}</p>}
        <footer className="dialog-foot">
          Datos de MetaForge{SNAPSHOT_AT ? ` del ${new Date(SNAPSHOT_AT).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}. Mapa y marcadores: MetaForge · RuneScape: Dragonwilds © Jagex. Uso personal.
        </footer>
      </div>
    </dialog>
  );
}
