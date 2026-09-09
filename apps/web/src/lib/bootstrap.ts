import { getSupabaseClient } from "@/lib/supabase";
import type { AccountAction } from "@ecomscaling/contracts";
import { fetchApiWithTimeout } from "@/lib/request-timeout";

export { fetchApiWithTimeout } from "@/lib/request-timeout";

export type { AccountAction };

export type BootstrapResponse = {
  user: {
    id: string;
    email?: string;
  };
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    platform_role: string;
    is_active: boolean;
    onboarding_completed_at: string | null;
  };
  memberships: Array<{
    organization_id: string;
    role: string;
    // "membership" = tienda propia del usuario (fila real en organization_members).
    // "consultant_assignment" / "platform_admin" = acceso de cartera, no es suya.
    accessSource: "membership" | "consultant_assignment" | "platform_admin";
    organization: {
      id: string;
      display_name: string;
      slug: string;
      status: string;
      timezone: string;
      currency_code: string;
    } | null;
  }>;
  subscriptions: Array<{
    id: string;
    organization_id: string;
    plan_code: string;
    status: string;
  }>;
};

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function getAccessToken() {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return null;
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  const shouldRefresh = expiresAtMs > 0 && expiresAtMs - Date.now() < 60_000;

  if (!shouldRefresh) {
    return session.access_token;
  }

  const {
    data: { session: refreshedSession },
    error,
  } = await supabase.auth.refreshSession();

  if (error) {
    return null;
  }

  return refreshedSession?.access_token ?? session.access_token;
}

async function refreshAccessToken() {
  const supabase = getSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.refreshSession();

  if (error) {
    return null;
  }

  return session?.access_token ?? null;
}

// Las rutas de IA no son peticiones normales: en fallo de cache el endpoint
// ejecuta el agente en linea y no responde hasta que termina (a04 tarda 90s de
// media, 226s el peor medido). Con el timeout general de 15s toda primera carga
// de un agente moria abortada, y el usuario veia un AbortError en vez del
// analisis. El limite de verdad lo pone el presupuesto del propio agente.
const AI_REQUEST_TIMEOUT_MS = 300_000;

export function defaultTimeoutFor(path: string): number | undefined {
  return path.includes("/ai/") ? AI_REQUEST_TIMEOUT_MS : undefined;
}

// `fetch` etiqueta un body de tipo string como text/plain, y Fastify trae
// parser propio para text/plain: el JSON llegaba al handler como cadena y no
// como objeto, asi que los campos del cuerpo eran undefined y la ruta
// respondia como si no le hubieran mandado nada. Se vio en
// PUT /v1/organizations/:id/store-scope, que contestaba "invalid_store_scope -
// Envia al menos una asignacion" con las asignaciones ya rellenadas. Cada call
// site ponia la cabecera a mano y el que se olvidaba fallaba en silencio: va
// aqui, que es por donde pasan todos.
function authHeaders(init: RequestInit, token: string) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = defaultTimeoutFor(path),
) {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("No hay sesion activa.");
  }

  const headers = authHeaders(init, token);

  const response = await fetchApiWithTimeout(
    `${apiUrl}${path}`,
    {
      ...init,
      headers,
    },
    timeoutMs,
  );

  if (response.status !== 401) {
    return response;
  }

  const refreshedToken = await refreshAccessToken();

  if (!refreshedToken) {
    return response;
  }

  const retryHeaders = authHeaders(init, refreshedToken);

  return fetchApiWithTimeout(
    `${apiUrl}${path}`,
    {
      ...init,
      headers: retryHeaders,
    },
    timeoutMs,
  );
}

export async function fetchBootstrap(token: string) {
  const response = await apiFetch("/v1/bootstrap", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string; detail?: string }
      | null;

    throw new Error(
      [
        `Bootstrap failed with status ${response.status}`,
        payload?.error,
        payload?.message,
        payload?.detail,
      ]
        .filter(Boolean)
        .join(" - "),
    );
  }

  return (await response.json()) as BootstrapResponse;
}

export async function fetchAccountActions(token: string) {
  const response = await apiFetch("/v1/actions", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return [] as AccountAction[];
  }

  const payload = (await response.json()) as { actions?: AccountAction[] };
  return payload.actions ?? [];
}
