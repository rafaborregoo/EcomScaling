import { createClient } from "@supabase/supabase-js";
import {
  MODEL_PRICING,
  setLiveModelPricing,
  type ModelPricing,
} from "@e-nora/ai";
import { createLogger } from "@e-nora/observability";
import { type AuthContext } from "./auth-context.js";
import { COPILOT_MODELS } from "./copilot-tokens.js";

/**
 * Tarifa de los modelos de IA, al dia sin deploy.
 *
 * - `syncModelPrices` (job diario `ai-pricing-sync` y boton del panel) lee la
 *   lista publica de LiteLLM, que sigue las tarifas oficiales de Anthropic y
 *   OpenAI, y la escribe en `ai_model_prices`. Luego pone coste a las
 *   ejecuciones que se quedaron sin el.
 * - `refreshLiveModelPricing` carga esa tabla en el runtime (cache de 1 h). Si
 *   la tabla no responde, se sigue calculando con MODEL_PRICING.
 */

const logger = createLogger("api:ai-model-pricing");

export const LITELLM_PRICES_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

type PricingEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
  OPENAI_MODEL?: string;
  ANTHROPIC_MODEL?: string;
};

export type ModelPriceRow = {
  model: string;
  provider: "anthropic" | "openai";
  input_per_mtok: number;
  output_per_mtok: number;
  cache_read_per_mtok: number | null;
};

function createServiceClient(env: PricingEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const alias = (model: string) => model.replace(/-(\d{8}|\d{4}-\d{2}-\d{2})$/, "");
const perMTok = (perToken: unknown) =>
  typeof perToken === "number" && Number.isFinite(perToken)
    ? Math.round(perToken * 1e6 * 1e6) / 1e6
    : null;

/**
 * Las filas de LiteLLM de los modelos que seguimos. Un precio fuera de rango
 * (negativo o por encima de 1000 USD/MTok) se descarta: es un error de la
 * fuente, y escribirlo inflaria o anularia el coste de todas las ejecuciones.
 */
export function pricesFromLiteLLM(
  source: Record<string, unknown>,
  models: readonly string[],
): { rows: ModelPriceRow[]; missing: string[] } {
  const rows: ModelPriceRow[] = [];
  const missing: string[] = [];
  for (const model of models) {
    const entry = (source[model] ?? source[alias(model)]) as Record<string, unknown> | undefined;
    const provider = entry?.litellm_provider;
    const input = perMTok(entry?.input_cost_per_token);
    const output = perMTok(entry?.output_cost_per_token);
    const valid = (v: number | null): v is number => v != null && v >= 0 && v <= 1000;
    if ((provider !== "anthropic" && provider !== "openai") || !valid(input) || !valid(output)) {
      missing.push(model);
      continue;
    }
    const cacheRead = perMTok(entry?.cache_read_input_token_cost);
    rows.push({
      model,
      provider,
      input_per_mtok: input,
      output_per_mtok: output,
      cache_read_per_mtok: valid(cacheRead) ? cacheRead : null,
    });
  }
  return { rows, missing };
}

/** Los modelos que merece la pena tarifar: los configurados y los que han corrido. */
async function trackedModels(env: PricingEnv, supabase: ReturnType<typeof createServiceClient>) {
  const models = new Set<string>(Object.keys(MODEL_PRICING));
  for (const m of COPILOT_MODELS) models.add(alias(m.anthropicModel));
  if (env.OPENAI_MODEL) models.add(alias(env.OPENAI_MODEL));
  if (env.ANTHROPIC_MODEL) models.add(alias(env.ANTHROPIC_MODEL));

  const { data: existing } = await supabase.from("ai_model_prices").select("model");
  for (const r of existing ?? []) models.add(r.model as string);

  // Un modelo que corrio sin tarifa es justo el que hay que ir a buscar.
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: unpriced } = await supabase
    .from("agent_runs")
    .select("model")
    .eq("cost_basis", "unknown_model")
    .gte("created_at", since)
    .not("model", "is", null)
    .limit(1000);
  for (const r of unpriced ?? []) models.add(alias(r.model as string));

  return [...models].sort();
}

export type PriceSyncSummary = {
  checked: number;
  changed: { model: string; from: string | null; to: string }[];
  missing: string[];
  repriced_runs: number;
};

export async function syncModelPrices(
  env: PricingEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<PriceSyncSummary> {
  const supabase = createServiceClient(env);
  const models = await trackedModels(env, supabase);

  const response = await fetchImpl(LITELLM_PRICES_URL, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`litellm_prices_fetch_failed_${response.status}`);
  const { rows, missing } = pricesFromLiteLLM((await response.json()) as Record<string, unknown>, models);

  const { data: current, error: loadError } = await supabase
    .from("ai_model_prices")
    .select("model, input_per_mtok, output_per_mtok");
  if (loadError) throw new Error(`ai_model_prices_load_failed: ${loadError.message}`);
  const before = new Map((current ?? []).map((r) => [r.model as string, r]));

  const now = new Date().toISOString();
  const changed: PriceSyncSummary["changed"] = [];
  type Upsert = ModelPriceRow & {
    source: "litellm" | "code_default";
    source_url: string | null;
    checked_at: string;
    updated_at?: string;
  };
  const upserts: Upsert[] = rows.map((row) => {
    const prev = before.get(row.model);
    const same =
      prev != null &&
      Number(prev.input_per_mtok) === row.input_per_mtok &&
      Number(prev.output_per_mtok) === row.output_per_mtok;
    if (!same) {
      changed.push({
        model: row.model,
        from: prev ? `${Number(prev.input_per_mtok)}/${Number(prev.output_per_mtok)}` : null,
        to: `${row.input_per_mtok}/${row.output_per_mtok}`,
      });
    }
    return {
      ...row,
      source: "litellm" as const,
      source_url: LITELLM_PRICES_URL,
      checked_at: now,
      ...(same ? {} : { updated_at: now }),
    };
  });

  // Lo que LiteLLM no tiene y nunca se ha anotado entra con la tarifa del
  // codigo, marcada como tal, para que el panel lo diga.
  for (const model of missing) {
    const fallback = MODEL_PRICING[model];
    if (!fallback || before.has(model)) continue;
    changed.push({ model, from: null, to: `${fallback.inputPerMTok}/${fallback.outputPerMTok}` });
    upserts.push({
      model,
      provider: model.startsWith("gpt-") ? "openai" : "anthropic",
      input_per_mtok: fallback.inputPerMTok,
      output_per_mtok: fallback.outputPerMTok,
      cache_read_per_mtok: null,
      source: "code_default",
      source_url: null,
      checked_at: now,
      updated_at: now,
    });
  }

  if (upserts.length) {
    const { error } = await supabase.from("ai_model_prices").upsert(upserts, { onConflict: "model" });
    if (error) throw new Error(`ai_model_prices_upsert_failed: ${error.message}`);
  }

  const { data: repriced, error: repriceError } = await supabase.rpc("reprice_unknown_agent_runs");
  if (repriceError) throw new Error(`reprice_unknown_agent_runs_failed: ${repriceError.message}`);

  cachedAt = 0;
  const summary = {
    checked: models.length,
    changed,
    missing: missing.filter((m) => !MODEL_PRICING[m] && !before.has(m)),
    repriced_runs: Number(repriced ?? 0),
  };
  logger.info("ai_model_prices_synced", summary);
  return summary;
}

let cachedAt = 0;
const LIVE_PRICING_TTL_MS = 60 * 60 * 1000;

/** Carga `ai_model_prices` en el runtime. Nunca lanza: sin tabla, respaldo del codigo. */
export async function refreshLiveModelPricing(env: PricingEnv): Promise<void> {
  if (Date.now() - cachedAt < LIVE_PRICING_TTL_MS) return;
  cachedAt = Date.now();
  try {
    const { data, error } = await createServiceClient(env)
      .from("ai_model_prices")
      .select("model, input_per_mtok, output_per_mtok, cache_read_per_mtok, updated_at");
    if (error) throw new Error(error.message);
    if (!data?.length) return;
    const prices: Record<string, ModelPricing> = {};
    let version = "";
    for (const r of data) {
      prices[r.model as string] = {
        inputPerMTok: Number(r.input_per_mtok),
        outputPerMTok: Number(r.output_per_mtok),
        ...(r.cache_read_per_mtok == null ? {} : { cacheReadPerMTok: Number(r.cache_read_per_mtok) }),
      };
      const day = String(r.updated_at).slice(0, 10);
      if (day > version) version = day;
    }
    setLiveModelPricing(prices, version);
  } catch (error) {
    logger.error("ai_model_prices_refresh_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function requirePlatformAdmin(context: AuthContext) {
  if (context.profile.platform_role !== "platform_admin") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
      message: "Solo un administrador de la plataforma puede ver y actualizar la tarifa de modelos.",
    };
  }
  return { ok: true as const };
}

export async function getAdminModelPrices(env: PricingEnv, context: AuthContext) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .from("ai_model_prices")
    .select("model, provider, input_per_mtok, output_per_mtok, cache_read_per_mtok, source, checked_at, updated_at")
    .order("provider")
    .order("model");
  if (error) {
    return { ok: false as const, statusCode: 500, error: "ai_model_prices_load_failed", detail: error.message };
  }

  const { count: unpricedRuns } = await supabase
    .from("agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("cost_basis", "unknown_model");

  return {
    ok: true as const,
    data: {
      prices: data ?? [],
      in_use: {
        openai: env.OPENAI_MODEL ?? null,
        anthropic: env.ANTHROPIC_MODEL ?? null,
      },
      unpriced_runs: unpricedRuns ?? 0,
    },
  };
}

export async function runAdminModelPriceSync(env: PricingEnv, context: AuthContext) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;
  try {
    return { ok: true as const, data: await syncModelPrices(env) };
  } catch (error) {
    return {
      ok: false as const,
      statusCode: 502,
      error: "ai_model_prices_sync_failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
