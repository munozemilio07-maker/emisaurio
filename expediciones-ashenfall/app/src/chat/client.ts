/**
 * Conversación con Claude a través del Worker (/api/chat).
 * El Worker devuelve los bloques de contenido tal cual; aquí se ejecutan los
 * tool_use contra la app y se reenvían los tool_result hasta que Claude termina.
 */
import { EXPEDITIONS, TOTAL } from '../data';
import { useStore, type ChatTurn } from '../state/store';
import { runTool, type ToolHost } from './tools';

type Block = { type: string; [k: string]: unknown };
interface ApiMessage { role: 'user' | 'assistant'; content: string | Block[] }
interface ApiReply { content?: Block[]; stop_reason?: string; error?: string; needsPassword?: boolean }

const PW_KEY = 'ashenfall-app-password';
export const getPassword = () => { try { return localStorage.getItem(PW_KEY) ?? ''; } catch { return ''; } };
export const setPassword = (p: string) => { try { localStorage.setItem(PW_KEY, p); } catch { /* sin almacenamiento */ } };

export class ChatError extends Error {
  constructor(message: string, readonly needsPassword = false) { super(message); }
}

const host: ToolHost = {
  done: () => useStore.getState().done,
  openExp: (n) => useStore.getState().openExp(n),
  select: (id) => useStore.getState().select(id),
  setMany: (ids, v) => useStore.getState().setMany(ids, v),
};

function appState() {
  const s = useStore.getState();
  const e = EXPEDITIONS[s.cur - 1];
  const hechas = e.stops.filter((x) => s.done[x.markerId]).length;
  return `<estado_app>Viendo la Expedición ${e.number} "${e.name}" (${e.region}): ${hechas}/${e.stops.length} paradas hechas. Progreso total: ${Object.keys(s.done).length}/${TOTAL}.</estado_app>`;
}

/**
 * Historial que se manda a la API. Solo crece (nunca se editan turnos previos):
 * los bloques de razonamiento de Claude deben volver intactos.
 */
let history: ApiMessage[] = [];
let seeded = false;

export function resetConversation() { history = []; seeded = true; }

async function call(messages: ApiMessage[], signal?: AbortSignal): Promise<ApiReply> {
  let r: Response;
  try {
    r = await fetch('/api/chat', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', ...(getPassword() ? { 'x-app-password': getPassword() } : {}) },
      body: JSON.stringify({ messages }),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ChatError(navigator.onLine ? 'No se pudo conectar con el servidor del chat.' : 'Sin conexión: el chat necesita internet. El mapa y tu progreso siguen funcionando.');
  }
  let data: ApiReply = {};
  try { data = await r.json(); } catch { /* respuesta no JSON */ }
  if (!r.ok) {
    if (r.status === 404 || (r.status >= 500 && !data.error)) throw new ChatError('El servidor del chat no está disponible. ¿Está corriendo el Worker? (npm run worker:dev)');
    throw new ChatError(data.error ?? `Error ${r.status} del chat.`, !!data.needsPassword);
  }
  return data;
}

/**
 * Manda un mensaje y resuelve con el texto final de Claude.
 * `prior` son los turnos ya mostrados (solo se usan para retomar tras recargar).
 * `onTool` avisa de cada herramienta usada, para mostrarlo en la interfaz.
 */
export async function send(text: string, prior: ChatTurn[], onTool?: (name: string) => void, signal?: AbortSignal): Promise<string> {
  if (!seeded) {
    // Tras recargar la página: retoma la conversación guardada como texto plano
    history = prior.map((t) => ({ role: t.role, content: t.text }));
    while (history.length && history[0].role !== 'user') history.shift();
    seeded = true;
  }
  const start = history.length;
  history.push({ role: 'user', content: [{ type: 'text', text: appState() }, { type: 'text', text }] });
  try {
    const out: string[] = [];
    for (let turn = 0; turn < 12; turn++) {
      const reply = await call(history, signal);
      const content = reply.content ?? [];
      history.push({ role: 'assistant', content });
      for (const b of content) if (b.type === 'text' && typeof b.text === 'string') out.push(b.text);

      if (reply.stop_reason === 'refusal') return out.join('\n\n') || 'No puedo ayudar con eso.';
      if (reply.stop_reason === 'max_tokens') return `${out.join('\n\n')}\n\n(La respuesta se cortó por longitud.)`;
      if (reply.stop_reason === 'pause_turn') continue;
      const uses = content.filter((b) => b.type === 'tool_use');
      if (reply.stop_reason !== 'tool_use' || !uses.length) return out.join('\n\n').trim() || 'Listo.';

      // Todos los resultados van juntos en un solo mensaje de usuario
      history.push({
        role: 'user',
        content: uses.map((u) => {
          onTool?.(String(u.name));
          try {
            const result = runTool(String(u.name), (u.input ?? {}) as Record<string, unknown>, host);
            return { type: 'tool_result', tool_use_id: u.id, content: typeof result === 'string' ? result : JSON.stringify(result) };
          } catch (e) {
            return { type: 'tool_result', tool_use_id: u.id, content: (e as Error).message, is_error: true };
          }
        }),
      });
    }
    return 'Me enredé usando las herramientas. ¿Me lo preguntas de otra forma?';
  } catch (e) {
    history.length = start; // el turno fallido no queda en el historial
    throw e;
  }
}
