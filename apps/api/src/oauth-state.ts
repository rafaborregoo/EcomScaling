import type { SupabaseClient } from "@supabase/supabase-js";

// El state de OAuth se siembra en la conexion pendiente al pulsar "Conectar" y
// es lo unico que ata la vuelta del proveedor a la organizacion que lo inicio.
// Reglas comunes a Shopify, Meta y Klaviyo:
//   - se busca por su valor exacto (indice integration_connections_oauth_state_idx),
//     nunca "entre las ultimas N" ni por dominio;
//   - caduca: un enlace de autorizacion viejo no sirve.

export const OAUTH_STATE_TTL_MS = 30 * 60 * 1000;

/** Campos de metadata que acompañan a un state recien emitido. */
export function issuedStateMetadata(state: string, now = new Date()) {
  return { state, state_issued_at: now.toISOString() };
}

/**
 * true si el state ya no vale. Las conexiones sembradas antes de esta regla
 * no llevan fecha: se aceptan para no romper una autorizacion en curso.
 */
export function isOAuthStateExpired(metadata: unknown, now = Date.now()) {
  if (typeof metadata !== "object" || metadata === null) return false;
  const issued = (metadata as Record<string, unknown>).state_issued_at;
  if (typeof issued !== "string") return false;
  const at = Date.parse(issued);
  return Number.isFinite(at) && now - at > OAUTH_STATE_TTL_MS;
}

export async function findConnectionByOAuthState<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  provider: string,
  state: string,
  columns: string,
): Promise<{ data: T | null; error: string | null }> {
  const { data, error } = await supabase
    .from("integration_connections")
    .select(columns)
    .eq("provider", provider)
    .eq("metadata->>state", state)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) return { data: null, error: error.message };
  return { data: ((data ?? [])[0] as unknown as T | undefined) ?? null, error: null };
}
