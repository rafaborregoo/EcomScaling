import { getSupabaseClient } from "@/lib/supabase";
import type { AccountAction } from "@e-nora/contracts";
import { fetchApiWithTimeout } from "@/lib/request-timeout";
import { getViewAs } from "@/lib/view-as";

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
    access_scope?: "organization" | "store";
    store_id?: string | null;
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

export const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const SESSION_EXPIRED_REDIRECT = "/login?reason=session_expired";
let sessionExpiryHandling = false;

// Los paneles del diagnóstico son composiciones de muchos GET independientes.
// Mantener la deduplicación aquí protege también los paneles antiguos que aún
// usan un useEffect local y evita que Strict Mode dispare dos veces la misma
// petición durante el montaje. Solo se cachean respuestas correctas; los 409,
// 401 y errores de red siguen siendo visibles y no se convierten en datos.
const API_GET_FRESH_MS = 30_000;
const apiGetCache = new Map<string, { response: Response; at: number }>();
const apiGetInflight = new Map<string, Promise<Response>>();

function apiGetKey(path: string, token: string) {
  return `${token.slice(-32)}:${path}`;
}

export function invalidateApiGetCache() {
  apiGetCache.clear();
}

async function clearExpiredSessionAndRedirect() {
  if (typeof window === "undefined" || sessionExpiryHandling) {
    return;
  }

  sessionExpiryHandling = true;
  try {
    // `local` removes the stale browser session without revoking sessions on
    // the user's other devices.
    await getSupabaseClient().auth.signOut({ scope: "local" });
  } finally {
    window.location.replace(SESSION_EXPIRED_REDIRECT);
  }
}

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

// Todas las escrituras del portal pasan por aqui, asi que es el unico sitio
// donde hace falta bloquearlas para que "ver como" (view-as.ts) sea de
// verdad solo lectura. No cubre las pocas pantallas que escriben directo
// contra Supabase con su propio cliente (registro, onboarding, perfil) --
// ninguna de ellas es a la que un admin entra "viendo como" un cliente.
function blockedByViewAs(method: string): Response | null {
  if (method === "GET" || method === "HEAD") return null;
  const viewAs = getViewAs();
  if (!viewAs) return null;
  return new Response(
    JSON.stringify({
      error: "view_as_read_only",
      message: `Estás viendo como ${viewAs.displayName} en modo lectura. Sal del modo "ver como" para poder escribir.`,
    }),
    { status: 403, headers: { "Content-Type": "application/json" } },
  );
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = defaultTimeoutFor(path),
) {
  const method = (init.method ?? "GET").toUpperCase();
  const blocked = blockedByViewAs(method);
  if (blocked) return blocked;

  if (method !== "GET" && method !== "HEAD") {
    invalidateApiGetCache();
  }

  const token = await getAccessToken();

  if (!token) {
    throw new Error("No hay sesion activa.");
  }

  const bypassCache = init.cache === "no-store";
  const cacheKey =
    method === "GET" && !bypassCache ? apiGetKey(path, token) : null;
  if (cacheKey) {
    const cached = apiGetCache.get(cacheKey);
    if (cached && Date.now() - cached.at < API_GET_FRESH_MS) {
      return cached.response.clone();
    }
    const inFlight = apiGetInflight.get(cacheKey);
    if (inFlight) {
      return (await inFlight).clone();
    }
  }

  const headers = authHeaders(init, token);

  const request = (async () => {
    const response = await fetchApiWithTimeout(
      `${apiUrl}${path}`,
      {
        ...init,
        headers,
      },
      timeoutMs,
    );

    if (response.status === 401) {
      const refreshedToken = await refreshAccessToken();
      if (!refreshedToken) {
        void clearExpiredSessionAndRedirect();
        return response;
      }

      const retryHeaders = authHeaders(init, refreshedToken);
      const retryResponse = await fetchApiWithTimeout(
        `${apiUrl}${path}`,
        {
          ...init,
          headers: retryHeaders,
        },
        timeoutMs,
      );

      if (retryResponse.status === 401) {
        void clearExpiredSessionAndRedirect();
      }
      return retryResponse;
    }

    return response;
  })();

  if (cacheKey) {
    apiGetInflight.set(cacheKey, request);
  }

  try {
    const response = await request;
    if (cacheKey && response.ok) {
      apiGetCache.set(cacheKey, { response: response.clone(), at: Date.now() });
    }
    return response;
  } finally {
    if (cacheKey) apiGetInflight.delete(cacheKey);
  }
}

export async function fetchBootstrap(token: string) {
  const response = await apiFetch("/v1/bootstrap", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      message?: string;
      detail?: string;
    } | null;

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
