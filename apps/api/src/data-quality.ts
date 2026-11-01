/**
 * FASE 3 / D01 — lo que el CLIENTE ve de la calidad de su dato.
 *
 * Modulo aparte de `consultant.ts` a proposito, porque la regla es distinta y
 * conviene que se vea de lejos: el consultor lo ve todo, y el cliente solo lo
 * que ocurre en sus sistemas y **ya esta verificado**.
 *
 * Las dos condiciones -- `client_actionable` y estado verificado y vigente
 * (`investigating`/`explained`) -- son las de `isVisibleToClient` del contrato.
 * La politica RLS `data_quality_issues_select_cliente` es mas amplia
 * (`status <> 'open'`); esta consulta ademas excluye lo ya resuelto. Estan escritas dos veces a proposito:
 * aqui para pedir solo lo que toca, y en la RLS para que no se pueda leer otra
 * cosa aunque esta consulta se escriba mal. Si algun dia discrepan, manda la
 * RLS, que es la unica que no se puede saltar por descuido.
 *
 * Por que no `open`: un issue recien detectado es una sospecha del
 * motor. Avisar al cliente de una averia que no lo era erosiona la confianza
 * mas rapido que el fallo original, y ademas le hace perder el tiempo
 * reconectando algo que funciona.
 */
import { CLIENT_VISIBLE_STATUSES } from "@e-nora/contracts";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export async function listOrganizationDataQuality(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
  if (
    !context.memberships.some(
      (membership) => membership.organization_id === organizationId,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
      message: "No tienes acceso a esta tienda.",
    };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("data_quality_issues")
    .select(
      "id, source, dataset, issue_type, description, severity, status, downstream_effect, detected_at",
    )
    .eq("organization_id", organizationId)
    .eq("client_actionable", true)
    .in("status", [...CLIENT_VISIBLE_STATUSES])
    .order("detected_at", { ascending: false })
    .limit(50);

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "data_quality_load_failed",
      detail: error.message,
    };
  }

  return { ok: true as const, data: { issues: data ?? [] } };
}
