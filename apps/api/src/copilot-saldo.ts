import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  requireOperationalOrganization,
  type AuthContext,
} from "./auth-context.js";
import {
  describeBalance,
  finDelPeriodo,
  inicioDelPeriodo,
  modelosDelPlan,
  type CopilotBalance,
  type CopilotModelTier,
} from "./copilot-tokens.js";

const SALDO_POR_DEFECTO = 1_000_000;

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });
}

/**
 * A quien se le descuenta lo que gasta este usuario.
 *
 * Misma regla que `public.copilot_bank_organization` en SQL: si quien pregunta
 * pertenece a una consultora, paga la consultora; si no, la organizacion donde
 * corre. Aqui sale gratis porque el contexto ya trae las memberships con su
 * `accessSource`, asi que no hay round-trip -- pero si la regla cambia, hay que
 * cambiarla en los dos sitios.
 */
export function bankOrganizationId(
  context: AuthContext,
  organizationId: string,
): string {
  const consultora = context.memberships.find(
    (membership) => membership.accessSource === "consulting_organization",
  );
  return consultora?.organization_id ?? organizationId;
}

/**
 * El saldo del mes en curso para quien pregunta.
 *
 * No hay contador propio: el consumo se suma de `agent_runs`, que es donde ya
 * esta escrito. Un segundo contador seria un numero que hay que mantener
 * sincronizado con el primero, y en cuanto un run muera a medias dejarian de
 * cuadrar.
 */
export async function loadCopilotBalance(
  supabase: SupabaseClient,
  context: AuthContext,
  organizationId: string,
  now = new Date(),
): Promise<CopilotBalance> {
  const bankId = bankOrganizationId(context, organizationId);

  const [{ data: subscription }, { data: used }] = await Promise.all([
    supabase
      .from("service_subscriptions")
      .select("copilot_monthly_tokens, copilot_model_tier, status, ends_at")
      .eq("organization_id", bankId)
      .in("status", ["trial", "active"])
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("copilot_tokens_consumidos", {
      bank_organization_id: bankId,
      desde: inicioDelPeriodo(now).toISOString(),
      hasta: finDelPeriodo(now).toISOString(),
    }),
  ]);

  // Sin suscripcion el saldo no es infinito: es el de por defecto. La leccion
  // es de `assertStoreLimit`, donde "sin fila" significaba "sin limite" y dejo
  // conectar tiendas sin tope.
  const granted = Number(
    subscription?.copilot_monthly_tokens ?? SALDO_POR_DEFECTO,
  );
  const tier = ((subscription?.copilot_model_tier as string) ??
    "sonnet") as CopilotModelTier;

  return describeBalance({
    granted,
    used: Number(used ?? 0),
    tier,
    now,
  });
}

/** El saldo mas los modelos que ese plan deja elegir: lo que pinta el panel. */
export async function getCopilotBalance(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;

  const balance = await loadCopilotBalance(
    createServiceClient(env),
    context,
    organizationId,
  );

  return {
    ok: true as const,
    data: {
      ...balance,
      models: modelosDelPlan(balance.tier).map((model) => ({
        id: model.id,
        label: model.label,
        description: model.description,
      })),
    },
  };
}
