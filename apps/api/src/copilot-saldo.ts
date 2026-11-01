import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { estimateCostUsd, pricingFor } from "@e-nora/ai";
import { COPILOT_DEFAULT_MONTHLY_CREDITS, copilotCreditsForCost } from "@e-nora/contracts";
import { refreshLiveModelPricing } from "./ai-model-pricing.js";
import {
  requireOperationalOrganization,
  type AuthContext,
} from "./auth-context.js";
import {
  COPILOT_MODELS,
  describeBalance,
  finDelPeriodo,
  inicioDelPeriodo,
  modelosDelPlan,
  type CopilotBalance,
  type CopilotModelTier,
} from "./copilot-tokens.js";

const SALDO_POR_DEFECTO = COPILOT_DEFAULT_MONTHLY_CREDITS;

export function copilotModelConsumption(model: (typeof COPILOT_MODELS)[number]) {
  const price = pricingFor(model.anthropicModel);
  const exampleCost = estimateCostUsd(model.anthropicModel, 10_000, 1_000);
  return {
    input_credits_per_1k: price ? copilotCreditsForCost(price.inputPerMTok / 1000) : null,
    output_credits_per_1k: price ? copilotCreditsForCost(price.outputPerMTok / 1000) : null,
    example_credits: exampleCost === null ? null : copilotCreditsForCost(exampleCost),
    example_cost_usd: exampleCost,
  };
}

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
  OPENAI_API_KEY?: string | undefined;
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
 * Si quien pregunta puede subir el plan que paga este saldo: solo el propietario
 * de la organizacion que lo paga (la consultora, si pertenece a una). El resto
 * ve «avisa al propietario» en vez de un boton que no puede usar.
 */
export function canUpgradePlan(context: AuthContext, organizationId: string): boolean {
  const bankId = bankOrganizationId(context, organizationId);
  return context.memberships.some((membership) => membership.organization_id === bankId && membership.role === "owner");
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

  const [subscriptionResult, usageResult] = await Promise.all([
    supabase
      .from("service_subscriptions")
      .select("copilot_monthly_tokens, copilot_model_tier, status, ends_at")
      .eq("organization_id", bankId)
      .in("status", ["trial", "active"])
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.rpc("copilot_credit_usage", {
      bank_organization_id: bankId,
      desde: inicioDelPeriodo(now).toISOString(),
      hasta: finDelPeriodo(now).toISOString(),
    }),
  ]);

  if (subscriptionResult.error) {
    throw new Error(`copilot_subscription_load_failed: ${subscriptionResult.error.message}`);
  }
  if (usageResult.error) {
    throw new Error(`copilot_usage_load_failed: ${usageResult.error.message}`);
  }

  const subscription = subscriptionResult.data;
  const used = usageResult.data;
  if (used === null || used === undefined) {
    throw new Error("copilot_usage_missing");
  }
  const usage = used as { used: number; unpriced_runs: number; by_model: Array<{ model: string; runs: number; credits: number; cost_usd: number }> };
  if (Number(usage.unpriced_runs) !== 0) throw new Error("copilot_usage_unpriced");
  const usedTokens = Number(usage.used);
  if (!Number.isFinite(usedTokens) || usedTokens < 0) {
    throw new Error("copilot_usage_invalid");
  }

  // Sin suscripcion el saldo no es infinito: es el de por defecto. La leccion
  // es de `assertStoreLimit`, donde "sin fila" significaba "sin limite" y dejo
  // conectar tiendas sin tope.
  const granted = Number(
    subscription?.copilot_monthly_tokens ?? SALDO_POR_DEFECTO,
  );
  const tier = ((subscription?.copilot_model_tier as string) ??
    "sonnet") as CopilotModelTier;

  return { ...describeBalance({
    granted,
    used: usedTokens,
    tier,
    now,
  }), by_model: usage.by_model ?? [] };
}

/** El saldo mas los modelos que ese plan deja elegir: lo que pinta el panel. */
export async function getCopilotBalance(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  await refreshLiveModelPricing(env);


  const balance = await loadCopilotBalance(
    createServiceClient(env),
    context,
    organizationId,
  );

  return {
    ok: true as const,
    data: {
      ...balance,
      can_upgrade: canUpgradePlan(context, organizationId),
      // Todos los elegibles, con el motivo si este plan o servidor no puede atenderlos
      // (el panel web sigue usando `models`, que solo trae los disponibles).
      all_models: COPILOT_MODELS.filter((model) => model.selectable).map((model) => {
        const available = modelosDelPlan(balance.tier, Boolean(env.OPENAI_API_KEY)).some((m) => m.id === model.id);
        const reason = available
          ? null
          : model.provider === "openai" && !env.OPENAI_API_KEY
            ? "No disponible por ahora"
            : "Requiere el plan avanzado";
        return { id: model.id, label: model.label, description: model.description, available, reason, ...copilotModelConsumption(model) };
      }),
      models: modelosDelPlan(balance.tier, Boolean(env.OPENAI_API_KEY)).map((model) => ({
        id: model.id,
        label: model.label,
        description: model.description,
        ...copilotModelConsumption(model),
      })),
    },
  };
}
