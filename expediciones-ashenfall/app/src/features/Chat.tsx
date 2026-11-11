import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChatError, getPassword, resetConversation, send, setPassword } from '../chat/client';
import { useStore } from '../state/store';
import { IconClose, IconSend } from './icons';

const TOOL_LABEL: Record<string, string> = {
  buscar_paradas: 'Buscando paradas', ver_expedicion: 'Revisando la expedición', progreso: 'Revisando tu progreso',
  mostrar_en_mapa: 'Moviendo el mapa', marcar_hecho: 'Marcando paradas',
};
const SUGGESTIONS = ['Voy en Umbral Sands, ¿por dónde empiezo?', '¿Qué me falta en esta expedición?', '¿Cómo venzo a la Kalphite Queen en melee?', 'Llévame al vault más cercano que no he hecho'];

/** Markdown mínimo: negritas, viñetas y párrafos. Sin HTML crudo. */
function Md({ text }: { text: string }) {
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : p));
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={`l${out.length}`}>{list}</ul>); list = []; } };
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (m) { list.push(<li key={i}>{inline(m[1])}</li>); return; }
    flush();
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) out.push(<p key={i}><b>{inline(h[1])}</b></p>);
    else if (line.trim()) out.push(<p key={i}>{inline(line)}</p>);
  });
  flush();
  return <>{out}</>;
}

export function Chat() {
  const open = useStore((s) => s.chatOpen);
  const turns = useStore((s) => s.chat);
  const set = useStore((s) => s.set);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [askPw, setAskPw] = useState(false);
  const [pw, setPw] = useState(getPassword());
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [turns, busy, error, open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') set({ chatOpen: false }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, set]);

  const submit = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setError(null); setDraft('');
    const prior = useStore.getState().chat;
    set({ chat: [...prior, { role: 'user', text: q }] });
    setBusy('Pensando');
    abort.current = new AbortController();
    try {
      const answer = await send(q, prior, (name) => setBusy(TOOL_LABEL[name] ?? 'Trabajando'), abort.current.signal);
      set({ chat: [...useStore.getState().chat, { role: 'assistant', text: answer }] });
    } catch (e) {
      // el mensaje sin respuesta vuelve a la caja para reintentar
      set({ chat: useStore.getState().chat.slice(0, -1) });
      setDraft(q);
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message);
        if (e instanceof ChatError && e.needsPassword) setAskPw(true);
      }
    } finally { setBusy(null); }
  };

  if (!open) return null;
  return (
    <section className="chat" aria-label="Chat con Claude">
      <header className="chat-head">
        <div>
          <p className="kicker">Guía del cartógrafo</p>
          <h2>Chat con Claude</h2>
        </div>
        {turns.length > 0 && <button type="button" className="link" onClick={() => { abort.current?.abort(); resetConversation(); set({ chat: [] }); setError(null); }}>Nueva conversación</button>}
        <button type="button" className="icon-btn" aria-label="Cerrar el chat" onClick={() => set({ chatOpen: false })}><IconClose /></button>
      </header>

      <div className="chat-log" ref={log} aria-live="polite">
        {!turns.length && (
          <div className="chat-empty">
            <p>Dime dónde vas o qué quieres hacer. Conozco las expediciones, tu progreso y la guía del juego, y puedo mover el mapa por ti.</p>
            <div className="chat-suggest">
              {SUGGESTIONS.map((s) => <button key={s} type="button" className="chip" onClick={() => void submit(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`msg msg--${t.role}`}>{t.role === 'user' ? t.text : <Md text={t.text} />}</div>
        ))}
        {busy && <div className="msg msg--assistant msg--busy">{busy}<i>…</i></div>}
        {error && <div className="msg msg--error" role="alert">{error}</div>}
        {askPw && (
          <form className="chat-pw" onSubmit={(e) => { e.preventDefault(); setPassword(pw); setAskPw(false); setError(null); void submit(draft); }}>
            <label>Contraseña de la app<input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /></label>
            <button type="submit" className="btn btn--primary">Guardar y reintentar</button>
          </form>
        )}
      </div>

      <form className="chat-form" onSubmit={(e) => { e.preventDefault(); void submit(draft); }}>
        <textarea
          ref={input} value={draft} rows={1} placeholder="Escribe: voy en…, quiero…, ¿cómo…?" aria-label="Mensaje para Claude"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(draft); } }}
        />
        {busy
          ? <button type="button" className="btn" onClick={() => abort.current?.abort()}>Detener</button>
          : <button type="submit" className="btn btn--primary" aria-label="Enviar" disabled={!draft.trim()}><IconSend /></button>}
      </form>
    </section>
  );
}
