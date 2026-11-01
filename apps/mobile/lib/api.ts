import { supabase } from "./supabase";
import { fetch as streamFetch } from "expo/fetch";

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

// La URL y la ruta se quedan en los logs: a la persona se le dice qué pasa y qué hacer.
const OFFLINE = "No hay conexión con E-NORA. Revisa tu conexión a internet y vuelve a intentarlo.";

function genericMessage(status: number) {
  if (status === 401) return "Tu sesión ha caducado. Vuelve a entrar.";
  if (status === 402) return "No queda saldo para hacer esto.";
  if (status === 403) return "No tienes permiso para hacer esto.";
  if (status === 404) return "No lo encontramos: puede que se haya borrado o movido.";
  if (status === 409) return "Ha cambiado mientras lo tenías abierto. Recarga y vuelve a intentarlo.";
  if (status === 429) return "Demasiadas peticiones seguidas. Espera un minuto.";
  if (status >= 400 && status < 500) return "Revisa los datos e inténtalo de nuevo.";
  return "Algo ha fallado por nuestra parte. Inténtalo de nuevo en unos segundos.";
}

/** Igual que la web: solo el `message` que la API escribe para la persona; nunca el código ni la ruta. */
async function failure(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as { error?: string; message?: string; statusCode?: number; can_upgrade?: boolean } | null;
  const code = typeof body?.error === "string" && /^[a-z0-9_]+$/.test(body.error) ? body.error : null;
  const human = body?.message && code && !/^[a-z0-9_]+$/.test(body.message) ? body.message : genericMessage(res.status);
  return Object.assign(new Error(human), { status: res.status, canUpgrade: body?.can_upgrade === true, code });
}

// Misma API que la web: Bearer con el JWT de Supabase.
export async function apiGet<T>(path: string): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  // Sin timeout, un firewall que descarta paquetes deja la pantalla cargando para siempre.
  const res = await fetch(`${apiUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {
    throw new Error(OFFLINE);
  });
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

// ponytail: tipo copiado de apps/web/src/lib/bootstrap.ts; moverlo a @e-nora/contracts cuando haya segunda pantalla que lo use.
export type Bootstrap = {
  user: { id: string; email?: string };
  profile: { full_name: string | null; platform_role: string };
  memberships: Array<{
    organization_id: string;
    role: string;
    organization: { display_name: string; currency_code: string } | null;
  }>;
};

// Escrituras (POST/DELETE...). Devuelve el JSON; en error lanza el mensaje de la API para enseñarlo tal cual.
/** Error de apiSend: el estado HTTP y, si es de saldo agotado, si quien lo lee puede subir el plan. */
export type ApiError = Error & { status?: number; canUpgrade?: boolean; code?: string | null };

export async function apiSend<T = unknown>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown, timeoutMs = 15_000): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch(() => {
    throw new Error(OFFLINE);
  });
  if (!res.ok) {
    throw await failure(res);
  }
  return (await res.json().catch(() => ({}))) as T;
}

/** POST con respuesta NDJSON en directo (una línea JSON por evento). Mismos errores que apiSend. */
export async function apiStream(path: string, body: unknown, onEvent: (event: { type: string; [key: string]: unknown }) => void, timeoutMs = 120_000): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await streamFetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch(() => {
    throw new Error(OFFLINE);
  });
  if (!res.ok) {
    throw await failure(res);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No se pudo leer la respuesta en directo.");
  const decoder = new TextDecoder();
  let pending = "";
  const accept = (line: string) => {
    if (line.trim()) onEvent(JSON.parse(line));
  };
  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    for (let nl = pending.indexOf("\n"); nl >= 0; nl = pending.indexOf("\n")) {
      accept(pending.slice(0, nl));
      pending = pending.slice(nl + 1);
    }
    if (done) break;
  }
  accept(pending);
}
