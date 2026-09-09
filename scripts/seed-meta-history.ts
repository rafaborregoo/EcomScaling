/**
 * Puebla la cuenta de Meta Ads de una organización de DEMO con ~18 meses de
 * insights diarios sintéticos (gasto, impresiones, clics, compras y valor de
 * compra atribuido) para poder ver y desarrollar los widgets de Meta (cartera
 * del consultor, pestaña Meta del dashboard, agentes a14/a02) sin una conexión
 * real ni esperar al backfill histórico.
 *
 * NO llama a la API de Meta: escribe directo en Supabase con service role, con
 * los mismos guardarraíles que seed-demo-user.ts (flag explícito + rechazo del
 * proyecto de producción). Es idempotente (upserts).
 *
 * Uso (Windows PowerShell):
 *   $env:ALLOW_META_SEED="true"; $env:SUPABASE_PRODUCTION_PROJECT_REF="<ref-prod>"; npm run seed:meta-history
 * o añade a .env.local:
 *   ALLOW_META_SEED=true
 *   SUPABASE_PRODUCTION_PROJECT_REF=<ref del proyecto de producción; si este
 *     es tu único proyecto/dev, cualquier valor distinto del ref actual>
 * y ejecuta: npm run seed:meta-history
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Guard explícito: este script hace upsert de datos sintéticos y nunca debe
  // ejecutarse por accidente contra el proyecto de producción.
  ALLOW_META_SEED: z.literal("true"),
  SUPABASE_PRODUCTION_PROJECT_REF: z.string().regex(/^[a-z0-9]{10,30}$/),
  SEED_ORG_SLUG: z.string().default("cliente-demo-store"),
  SEED_DAYS: z.coerce.number().int().min(30).max(1200).default(550),
  SEED_ADS: z.coerce.number().int().min(1).max(20).default(3),
});

const env = envSchema.parse(process.env);
const targetProjectRef = new URL(env.SUPABASE_URL).hostname.split(".")[0];
if (targetProjectRef === env.SUPABASE_PRODUCTION_PROJECT_REF) {
  throw new Error(
    "META_SEED_PRODUCTION_PROJECT_REFUSED: el seed requiere un proyecto Supabase distinto de producción",
  );
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket as any },
});

// PRNG determinista: re-ejecutar el seed produce las mismas cifras.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260901);
const jitter = (base: number, pct: number) =>
  base * (1 + (rand() * 2 - 1) * pct);

function isoDate(daysAgo: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function chunkedUpsert<T>(
  table: string,
  rows: T[],
  onConflict: string,
  select?: string,
): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    const query = supabase.from(table).upsert(slice as never, { onConflict });
    const { data, error } = select ? await query.select(select) : await query;
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
    if (data) {
      out.push(...(data as unknown as Array<Record<string, unknown>>));
    }
  }
  return out;
}

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, display_name, currency_code")
    .eq("slug", env.SEED_ORG_SLUG)
    .single();
  if (orgError || !org) {
    throw new Error(
      `No existe la organización con slug "${env.SEED_ORG_SLUG}": ${orgError?.message ?? "not found"}`,
    );
  }
  const organizationId = org.id as string;
  const currency = (org.currency_code as string) ?? "EUR";
  const nowIso = new Date().toISOString();

  // 1. Conexión de demo (sin OAuth real) + cuenta publicitaria.
  //
  // Datos de demo y una cuenta conectada de verdad no pueden convivir en la
  // misma organizacion: aunque esta conexion es suya (`demo-act-0`, nunca pisa
  // la real), la org acabaria con dos conexiones Meta y la de demo llega con
  // `is_selected = true` y 550 dias de insights inventados. Con Klaviyo paso
  // exactamente eso en produccion y /klaviyo mostro ingresos que no existian.
  const { data: existingReal } = await supabase
    .from("integration_connections")
    .select("provider_account_id")
    .eq("organization_id", organizationId)
    .eq("provider", "meta_ads")
    .neq("provider_account_id", "demo-act-0")
    .limit(1)
    .maybeSingle();
  if (existingReal) {
    throw new Error(
      `META_SEED_REAL_CONNECTION_REFUSED: la organizacion "${env.SEED_ORG_SLUG}" ya tiene una conexion Meta real (${existingReal.provider_account_id}). Apunta SEED_ORG_SLUG a una org sin Meta.`,
    );
  }

  const { data: connection, error: connError } = await supabase
    .from("integration_connections")
    .upsert(
      {
        organization_id: organizationId,
        provider: "meta_ads",
        provider_account_id: "demo-act-0",
        provider_account_name: "Meta Ads (datos de demo)",
        status: "connected",
        connected_at: nowIso,
        last_sync_at: nowIso,
        api_version: "v21.0",
      },
      { onConflict: "organization_id,provider,provider_account_id" },
    )
    .select("id")
    .single();
  if (connError || !connection) {
    throw new Error(
      `integration_connections seed failed: ${connError?.message}`,
    );
  }
  const connectionId = connection.id as string;

  const { data: adAccount, error: accError } = await supabase
    .from("meta_ad_accounts")
    .upsert(
      {
        organization_id: organizationId,
        connection_id: connectionId,
        external_ad_account_id: "act_demo_0",
        account_name: `${org.display_name} — Meta (demo)`,
        currency_code: currency,
        account_status_code: 1,
        is_selected: true,
        is_active: true,
        last_synced_at: nowIso,
      },
      { onConflict: "connection_id,external_ad_account_id" },
    )
    .select("id")
    .single();
  if (accError || !adAccount) {
    throw new Error(`meta_ad_accounts seed failed: ${accError?.message}`);
  }
  const adAccountId = adAccount.id as string;

  // 2. Insights diarios nivel `ad` con tendencia + estacionalidad semanal.
  type InsightRow = {
    organization_id: string;
    ad_account_id: string;
    level: "ad";
    external_entity_id: string;
    metric_date: string;
    breakdown_hash: "none";
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    inline_link_clicks: number;
    cpm: number;
    cpc: number;
    ctr: number;
    synced_at: string;
  };
  const insightRows: InsightRow[] = [];
  // Guardamos las cifras de compra por (ad, fecha) para las action metrics.
  const purchaseByKey = new Map<string, { purchases: number; value: number }>();

  for (let day = env.SEED_DAYS; day >= 0; day -= 1) {
    const date = isoDate(day);
    const progress = 1 - day / env.SEED_DAYS; // 0 -> 1 en el tiempo
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekend = dow === 0 || dow === 6 ? 0.8 : 1.05;
    // El negocio crece ~60% a lo largo del periodo.
    const growth = 0.7 + progress * 0.6;

    for (let ad = 0; ad < env.SEED_ADS; ad += 1) {
      const entityId = `demo-ad-${ad + 1}`;
      const spend = Math.max(
        3,
        jitter(28 * growth * weekend * (1 + ad * 0.35), 0.28),
      );
      const cpm = jitter(11 - progress * 2, 0.18); // baja algo con el tiempo
      const impressions = Math.round((spend / cpm) * 1000);
      const ctr = jitter(0.016 + progress * 0.006, 0.25);
      const clicks = Math.max(1, Math.round(impressions * ctr));
      const cvr = jitter(0.032 + progress * 0.01, 0.35);
      const purchases = Math.max(0, Math.round(clicks * cvr));
      const aov = jitter(52 + progress * 12, 0.15);
      const value = purchases * aov;

      insightRows.push({
        organization_id: organizationId,
        ad_account_id: adAccountId,
        level: "ad",
        external_entity_id: entityId,
        metric_date: date,
        breakdown_hash: "none",
        spend: Number(spend.toFixed(4)),
        impressions,
        reach: Math.round(impressions * 0.82),
        clicks,
        inline_link_clicks: Math.round(clicks * 0.9),
        cpm: Number(cpm.toFixed(6)),
        cpc: Number((spend / clicks).toFixed(6)),
        ctr: Number((ctr * 100).toFixed(6)),
        synced_at: nowIso,
      });
      purchaseByKey.set(`${entityId}|${date}`, {
        purchases,
        value: Number(value.toFixed(6)),
      });
    }
  }

  console.log(
    `Sembrando ${insightRows.length} filas de insights (${env.SEED_DAYS} días · ${env.SEED_ADS} anuncios)…`,
  );
  const savedRows = await chunkedUpsert(
    "meta_insight_rows_daily",
    insightRows,
    "ad_account_id,level,external_entity_id,metric_date,breakdown_hash,attribution_hash,action_report_time",
    "id, external_entity_id, metric_date",
  );

  // 3. Action metrics (actions + action_values) por fila. action_type debe
  // coincidir con meta_ad_accounts.canonical_purchase_action_type (default
  // 'omni_purchase') o meta_spend_summary devuelve 0 compras / ROAS.
  const actionRows: Array<Record<string, unknown>> = [];
  for (const row of savedRows) {
    const key = `${row.external_entity_id}|${row.metric_date}`;
    const p = purchaseByKey.get(key);
    if (!p) continue;
    for (const [metricName, value] of [
      ["actions", p.purchases],
      ["action_values", p.value],
    ] as const) {
      actionRows.push({
        organization_id: organizationId,
        insight_row_id: row.id,
        metric_name: metricName,
        action_type: "omni_purchase",
        attribution_window: "default",
        value,
      });
    }
  }
  console.log(`Sembrando ${actionRows.length} action metrics…`);
  await chunkedUpsert(
    "meta_insight_action_metrics",
    actionRows,
    "insight_row_id,metric_name,action_type,attribution_window",
  );

  console.log(
    `Listo. Meta demo para "${org.display_name}" con datos desde ${isoDate(
      env.SEED_DAYS,
    )}.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
