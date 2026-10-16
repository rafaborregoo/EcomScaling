/**
 * Consumo de IA por agente (panel de platform admin): cuantas veces corre cada
 * agente y cuantos tokens de entrada y salida gasta. La agregacion es SQL
 * (`admin_ai_usage_by_agent`); aqui solo se separa el copiloto, que tiene saldo
 * propio y no cuenta en el total de los agentes, y se suman las filas ya
 * agregadas para el total.
 */
import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";

const COPILOT_CODE = "a09_copiloto_consultor";
const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90, all: null } as const;
export type AiUsageRange = keyof typeof RANGE_DAYS;

export type AiUsageRow = {
  agent_code: string;
  agent_name: string;
  run_count: number;
  succeeded_count: number;
  failed_count: number;
  rejected_count: number;
  running_count: number;
  zero_token_runs: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  total_cost_usd: number;
  runs_by_trigger: Record<string, number>;
  runs_by_model: Record<string, number>;
  first_run_at: string | null;
  last_run_at: string | null;
};

const NUMERIC = [
  "run_count", "succeeded_count", "failed_count", "rejected_count", "running_count", "zero_token_runs",
  "input_tokens", "output_tokens", "cache_read_tokens", "cache_creation_tokens", "total_cost_usd",
] as const;

/** Suma de filas: la tabla del panel y su total salen de aqui, para que cuadren. */
export function sumUsage(rows: AiUsageRow[]) {
  const total = Object.fromEntries(NUMERIC.map((key) => [key, 0])) as Record<(typeof NUMERIC)[number], number>;
  for (const row of rows) for (const key of NUMERIC) total[key] += row[key];
  return { ...total, total_cost_usd: Math.round(total.total_cost_usd * 10_000) / 10_000 };
}

export async function getAdminAiUsage(env: LoadedApiEnv, context: AuthContext, rangeInput: unknown) {
  if (context.profile.platform_role !== "platform_admin") {
    return { ok: false as const, statusCode: 403, error: "platform_admin_required", message: "Solo un platform admin puede ver el consumo de IA." };
  }
  const range: AiUsageRange = typeof rangeInput === "string" && rangeInput in RANGE_DAYS ? (rangeInput as AiUsageRange) : "all";
  const days = RANGE_DAYS[range];
  const since = days === null ? null : new Date(Date.now() - days * 86_400_000).toISOString();

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("admin_ai_usage_by_agent", { since, include_copilot: true });
  if (error) return { ok: false as const, statusCode: 500, error: "ai_usage_load_failed", detail: error.message };

  const all = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    ...Object.fromEntries(NUMERIC.map((key) => [key, Number(row[key] ?? 0)])),
  })) as AiUsageRow[];
  const agents = all.filter((row) => row.agent_code !== COPILOT_CODE);
  return {
    ok: true as const,
    data: {
      range,
      since,
      generated_at: new Date().toISOString(),
      agents,
      totals: sumUsage(agents),
      copilot: all.find((row) => row.agent_code === COPILOT_CODE) ?? null,
    },
  };
}
