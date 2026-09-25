// ¿Este cliente tiene consultor, o se vale de los agentes?
//
// Hasta ahora el producto no sabia responder esto desde el lado del cliente:
// `consultant_assignments` solo se consultaba consultor -> organizaciones,
// nunca al reves. Y la diferencia importa mucho:
//
//   - Con consultor: la IA propone, el consultor decide, el cliente ejecuta.
//   - Sin consultor: no hay quien decida. El orquestador seguia lanzando 8
//     agentes dos veces al dia para esa organizacion, sus salidas nacian en
//     `pending_approval`, y `decideAgentOutput` solo admitia consultor o
//     platform admin. Nadie iba a aprobarlas nunca: la IA corria, gastaba
//     presupuesto y producia analisis que no veria nadie.
//
// Decision (Rafa, 2026-09-06): sin consultor asignado, el owner/manager del
// propio cliente decide sobre lo que la IA quiere ESCRIBIR en su dominio. Los
// analisis de solo lectura no necesitan aprobacion de nadie -- ese criterio ya
// estaba, y la restriccion que los ocultaba vivia solo en un array del
// frontend, no en el backend.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";

type ApiEnv = LoadedApiEnv;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

export type AssignedConsultant = {
  user_id: string;
  full_name: string | null;
  is_primary: boolean;
};

/**
 * El consultor asignado a una organizacion, o null si no tiene ninguno activo.
 * El principal primero: una organizacion puede tener varios.
 */
export async function getAssignedConsultant(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<AssignedConsultant | null> {
  const { data, error } = await supabase
    .from("consultant_assignments")
    .select("consultant_user_id, is_primary")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", data.consultant_user_id as string)
    .maybeSingle();

  return {
    user_id: data.consultant_user_id as string,
    full_name: (profile?.full_name as string | null) ?? null,
    is_primary: Boolean(data.is_primary),
  };
}

/**
 * Atajo para los gates: si no hay consultor, el cliente se gobierna solo.
 *
 * Se comprueba contra la base y no contra el contexto de sesion a proposito --
 * `context.memberships` describe lo que ve QUIEN pregunta, no quien asesora a
 * la organizacion por la que pregunta.
 */
export async function hasAssignedConsultant(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("consultant_assignments")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_active", true);

  // Ante un error de lectura se asume que SI hay consultor: es el lado
  // conservador (no se amplia quien puede aprobar escrituras de la IA por un
  // fallo transitorio de red).
  if (error) return true;
  return (count ?? 0) > 0;
}

/**
 * Endpoint del portal: quien acompaña a este cliente.
 *
 * Lo puede pedir cualquier miembro de la organizacion -- saber quien te
 * asesora no es un dato sensible, y es lo que decide la forma entera del
 * panel del cliente.
 */
export async function getClientConsultant(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  if (
    !context.memberships.some(
      (item) => item.organization_id === organizationId,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  const consultant = await getAssignedConsultant(
    createServiceClient(env),
    organizationId,
  );

  return {
    ok: true as const,
    data: { organization_id: organizationId, consultant },
  };
}
