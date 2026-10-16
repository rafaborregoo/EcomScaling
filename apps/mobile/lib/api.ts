import { supabase } from "./supabase";

export const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

// Misma API que la web: Bearer con el JWT de Supabase.
export async function apiGet<T>(path: string): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  // Sin timeout, un firewall que descarta paquetes deja la pantalla cargando para siempre.
  const res = await fetch(`${apiUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {
    throw new Error(`No llego a la API (${apiUrl}). Revisa wifi y firewall.`);
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
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
export type ApiError = Error & { status?: number; canUpgrade?: boolean };

export async function apiSend<T = unknown>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown, timeoutMs = 15_000): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  }).catch(() => {
    throw new Error(`No llego a la API (${apiUrl}). Revisa wifi y firewall.`);
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string; message?: string; can_upgrade?: boolean } | null;
    throw Object.assign(new Error(detail?.message ?? detail?.error ?? `${path} -> ${res.status}`), { status: res.status, canUpgrade: detail?.can_upgrade === true });
  }
  return (await res.json().catch(() => ({}))) as T;
}
