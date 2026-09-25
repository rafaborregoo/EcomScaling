import { createClient } from "@supabase/supabase-js";
import {
  EFFECT_WINDOW_DAYS,
  measureInterventionEffect,
  type InterventionEffectMetric,
} from "@ecomscaling/contracts";
import { type LoadedApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { seriesPorMetrica } from "./signal-engine.js";

/**
 * F8: mide el efecto de negocio de las intervenciones que tienen metrica
 * objetivo declarada (`intervention_effects`). Corre en la cadena nocturna y
 * cada vez que el consultor declara o cambia una: la ventana posterior crece
 * cada dia hasta madurar a las 4 semanas.
 */

const logger = createLogger("intervention-effect-engine");
const DAY_MS = 86_400_000;

function service(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}

type EffectRow = {
  id: string;
  store_id: string | null;
  intervention_id: string;
  metric: InterventionEffectMetric;
  started_at: string;
};

async function dailySeries(
  supabase: any,
  organizationId: string,
  storeId: string | null,
  from: Date,
  to: Date,
) {
  const { data, error } = await supabase.rpc("shopify_sales_daily", {
    target_organization_id: organizationId,
    period_start: from.toISOString(),
    period_end: to.toISOString(),
    target_store_id: storeId,
  });
  if (error) throw new Error(`shopify_sales_daily_failed: ${error.message}`);
  // Como en D05: el ultimo dia puede ir a medias y no es un dia bajo.
  const filas = ((data ?? []) as { bucket_date: string; net_sales: number; orders_count: number }[]);
  const completas = to.getTime() > Date.now() - DAY_MS ? filas.slice(0, -1) : filas;

  let query = supabase
    .from("shopify_sessions_daily")
    .select("bucket_date, sessions")
    .eq("organization_id", organizationId)
    .gte("bucket_date", from.toISOString().slice(0, 10))
    .lte("bucket_date", to.toISOString().slice(0, 10));
  if (storeId) query = query.eq("store_id", storeId);
  const { data: sesiones, error: errorSesiones } = await query;
  if (errorSesiones) throw new Error(`shopify_sessions_daily_failed: ${errorSesiones.message}`);
  // Sin tienda concreta, las sesiones de todas se suman por dia, igual que
  // `shopify_sales_daily` con target_store_id null suma los pedidos.
  const porDia = new Map<string, number>();
  for (const r of sesiones ?? []) {
    porDia.set(r.bucket_date as string, (porDia.get(r.bucket_date as string) ?? 0) + Number(r.sessions));
  }
  return seriesPorMetrica(completas, porDia);
}

export async function runInterventionEffectEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = service(env);
  const { data, error } = await supabase
    .from("intervention_effects")
    .select("id, store_id, intervention_id, metric, started_at")
    .eq("organization_id", organizationId);
  if (error) throw new Error(`intervention_effects_load_failed: ${error.message}`);

  const now = new Date();
  let measured = 0;
  for (const row of (data ?? []) as EffectRow[]) {
    const start = Date.parse(row.started_at);
    const from = new Date(start - EFFECT_WINDOW_DAYS * DAY_MS);
    const to = new Date(Math.min(start + EFFECT_WINDOW_DAYS * DAY_MS, now.getTime()));
    const series = await dailySeries(supabase, organizationId, row.store_id, from, to);
    const m = measureInterventionEffect(series[row.metric], row.started_at, now.toISOString());
    const { error: updateError } = await supabase
      .from("intervention_effects")
      .update({ ...m, measured_at: now.toISOString() })
      .eq("id", row.id);
    if (updateError) {
      logger.error("intervention_effect_write_failed", {
        organization_id: organizationId,
        intervention_id: row.intervention_id,
        error: updateError.message,
      });
      continue;
    }
    measured += 1;
  }
  return { organization_id: organizationId, declared: (data ?? []).length, measured };
}

export async function runInterventionEffectEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = service(env);
  const loaded = await supabase.from("organizations").select("id").in("status", ["onboarding", "active"]);
  if (loaded.error) throw new Error(`intervention_effect_organizations_load_failed: ${loaded.error.message}`);
  const summary = { organizations: 0, succeeded: 0, failed: 0, measured: 0 };
  for (const organization of loaded.data ?? []) {
    summary.organizations += 1;
    try {
      const result = await runInterventionEffectEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.measured += result.measured;
    } catch (error) {
      summary.failed += 1;
      logger.error("intervention_effect_failed", {
        organization_id: organization.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return summary;
}
