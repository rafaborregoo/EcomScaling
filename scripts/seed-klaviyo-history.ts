/**
 * Puebla la cuenta de Klaviyo de una organización de DEMO con ~14 meses de
 * campañas de email sintéticas + sus report values mensuales (destinatarios,
 * aperturas, clics, conversiones, ingresos atribuidos) para poder ver y
 * desarrollar el widget "Email · campañas por cliente" del dashboard del
 * consultor y el panel de rendimiento de /marketing sin una conexión real.
 *
 * NO llama a la API de Klaviyo: escribe directo en Supabase con service role,
 * con los mismos guardarraíles que seed-meta-history.ts (flag explícito +
 * rechazo del proyecto de producción). Es idempotente (upserts).
 *
 * Uso (Windows PowerShell):
 *   $env:ALLOW_KLAVIYO_SEED="true"; $env:SUPABASE_PRODUCTION_PROJECT_REF="<ref-prod>"; npm run seed:klaviyo-history
 * o añade a .env.local:
 *   ALLOW_KLAVIYO_SEED=true
 *   SUPABASE_PRODUCTION_PROJECT_REF=<ref del proyecto de producción; si este es
 *     tu único proyecto/dev, cualquier valor distinto del ref actual>
 * y ejecuta: npm run seed:klaviyo-history
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ALLOW_KLAVIYO_SEED: z.literal("true"),
  SUPABASE_PRODUCTION_PROJECT_REF: z.string().regex(/^[a-z0-9]{10,30}$/),
  SEED_ORG_SLUG: z.string().default("cliente-demo-store"),
  SEED_KLAVIYO_MONTHS: z.coerce.number().int().min(1).max(36).default(14),
  SEED_CAMPAIGNS_PER_MONTH: z.coerce.number().int().min(1).max(30).default(4),
});

const env = envSchema.parse(process.env);
const targetProjectRef = new URL(env.SUPABASE_URL).hostname.split(".")[0];
if (targetProjectRef === env.SUPABASE_PRODUCTION_PROJECT_REF) {
  throw new Error(
    "KLAVIYO_SEED_PRODUCTION_PROJECT_REFUSED: el seed requiere un proyecto Supabase distinto de producción",
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
const rand = mulberry32(20260902);
const jitter = (base: number, pct: number) =>
  base * (1 + (rand() * 2 - 1) * pct);

// Primer día del mes `monthsAgo` meses atrás y su día siguiente al último.
function monthBounds(monthsAgo: number): { start: string; endExcl: string } {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1),
  );
  const endExcl = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 1),
  );
  return {
    start: start.toISOString().slice(0, 10),
    endExcl: endExcl.toISOString().slice(0, 10),
  };
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

const CAMPAIGN_THEMES = [
  "Newsletter",
  "Novedades",
  "Restock",
  "Oferta flash",
  "Guía de producto",
  "Envío gratis",
  "Selección del equipo",
  "Recordatorio carrito",
];
const MONTH_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

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
  const currency = ((org.currency_code as string) ?? "EUR").toUpperCase();
  const nowIso = new Date().toISOString();

  // 1. Conexión Klaviyo de demo. NUNCA la de una cuenta real: reutilizarla
  // escribia las campanas sinteticas SOBRE la cuenta conectada, y /klaviyo las
  // mezclaba con los emails de verdad en la misma pantalla sin distinguirlas
  // -- el consultor leia como ingresos atribuidos unas cifras inventadas.
  // Paso en produccion sobre `cliente-demo-store`, que ademas de llamarse
  // "demo" es la org que tiene la clave real de Klaviyo.
  const { data: existing } = await supabase
    .from("integration_connections")
    .select("id, provider_account_id")
    .eq("organization_id", organizationId)
    .eq("provider", "klaviyo")
    .limit(1)
    .maybeSingle();

  const providerAccountId = "demo-klaviyo-0";
  if (existing && existing.provider_account_id !== providerAccountId) {
    throw new Error(
      `KLAVIYO_SEED_REAL_CONNECTION_REFUSED: la organizacion "${env.SEED_ORG_SLUG}" ya tiene una conexion Klaviyo real (${existing.provider_account_id}). Los datos de demo y una cuenta conectada no pueden convivir en la misma organizacion: apunta SEED_ORG_SLUG a una org sin Klaviyo.`,
    );
  }

  const { data: connection, error: connError } = await supabase
    .from("integration_connections")
    .upsert(
      {
        organization_id: organizationId,
        provider: "klaviyo",
        provider_account_id: providerAccountId,
        provider_account_name: "Klaviyo (datos de demo)",
        status: "connected",
        connected_at: nowIso,
        last_sync_at: nowIso,
      },
      { onConflict: "organization_id,provider,provider_account_id" },
    )
    .select("id")
    .single();
  if (connError || !connection) {
    throw new Error(`integration_connections seed failed: ${connError?.message}`);
  }
  const connectionId = connection.id as string;

  const { data: account, error: accError } = await supabase
    .from("klaviyo_accounts")
    .upsert(
      {
        organization_id: organizationId,
        connection_id: connectionId,
        external_account_id: providerAccountId,
        name: `${org.display_name} — Klaviyo (demo)`,
        timezone: "Europe/Madrid",
        currency_code: currency,
        conversion_metric_id: "demo-metric-placed-order",
        conversion_metric_name: "Placed Order",
        conversion_metric_source: "shopify",
        last_synced_at: nowIso,
      },
      { onConflict: "connection_id,external_account_id" },
    )
    .select("id")
    .single();
  if (accError || !account) {
    throw new Error(`klaviyo_accounts seed failed: ${accError?.message}`);
  }
  const accountId = account.id as string;

  // 2. Un report_run mensual + campañas del mes + un report_value por campaña.
  const months = env.SEED_KLAVIYO_MONTHS;
  const runRows: Array<Record<string, unknown>> = [];
  for (let m = months - 1; m >= 0; m -= 1) {
    const { start, endExcl } = monthBounds(m);
    const lastDay = new Date(new Date(endExcl).getTime() - 86400000)
      .toISOString()
      .slice(0, 10);
    runRows.push({
      organization_id: organizationId,
      account_id: accountId,
      report_type: "campaign-values-report",
      period_start: start,
      period_end: lastDay,
      timezone: "Europe/Madrid",
      currency_code: currency,
      status: "succeeded",
      idempotency_key: `demo:campaign-values:${start}`,
      started_at: nowIso,
      finished_at: nowIso,
    });
  }
  const savedRuns = await chunkedUpsert(
    "klaviyo_report_runs",
    runRows,
    "account_id,idempotency_key",
    "id, period_start, period_end, idempotency_key",
  );
  const runByStart = new Map(
    savedRuns.map((r) => [String(r.period_start), r]),
  );

  const campaignRows: Array<Record<string, unknown>> = [];
  // stats de cada campaña, indexadas por external_campaign_id, para la fase 3.
  const statsByCampaign = new Map<
    string,
    {
      runId: string;
      periodStart: string;
      periodEnd: string;
      recipients: number;
      delivered: number;
      opensUnique: number;
      clicksUnique: number;
      conversions: number;
      revenue: number;
      unsubscribes: number;
      bounced: number;
      spamComplaints: number;
      name: string;
    }
  >();

  for (let m = months - 1; m >= 0; m -= 1) {
    const { start, endExcl } = monthBounds(m);
    const run = runByStart.get(start);
    if (!run) continue;
    const progress = (months - 1 - m) / Math.max(1, months - 1); // 0..1
    const growth = 0.75 + progress * 0.5;
    const startMs = new Date(start).getTime();
    const spanMs = new Date(endExcl).getTime() - startMs;

    for (let c = 0; c < env.SEED_CAMPAIGNS_PER_MONTH; c += 1) {
      const [year, mon] = start.split("-").map((v) => Number(v));
      const externalId = `demo-camp-${start}-${c + 1}`;
      const theme = CAMPAIGN_THEMES[(m + c) % CAMPAIGN_THEMES.length];
      const name = `${theme} · ${MONTH_ES[(mon ?? 1) - 1]} ${year}`;
      // El mes en curso solo está a medias: nunca fechar un envío en el futuro.
      const sendMs = Math.min(
        Date.now() - 3600000,
        startMs +
          Math.floor(((c + 0.5) / env.SEED_CAMPAIGNS_PER_MONTH) * spanMs) +
          Math.floor(jitter(0, 0.4) * 86400000),
      );
      const sendTime = new Date(sendMs).toISOString();

      const recipients = Math.round(jitter(11000 * growth, 0.22));
      const delivered = Math.round(recipients * jitter(0.985, 0.005));
      const opensUnique = Math.round(delivered * jitter(0.47, 0.12));
      const clicksUnique = Math.round(delivered * jitter(0.031, 0.2));
      const conversions = Math.round(delivered * jitter(0.012, 0.25));
      const aov = jitter(64, 0.12);
      const revenue = Math.round(conversions * aov * 100) / 100;
      const unsubscribes = Math.round(delivered * jitter(0.0018, 0.3));
      const bounced = Math.round(recipients * jitter(0.013, 0.3));
      const spamComplaints = Math.round(delivered * jitter(0.0003, 0.5));

      campaignRows.push({
        organization_id: organizationId,
        account_id: accountId,
        external_campaign_id: externalId,
        name,
        status: "sent",
        send_time: sendTime,
        created_at_external: new Date(sendMs - 3 * 86400000).toISOString(),
        updated_at_external: sendTime,
        last_synced_at: nowIso,
        raw_data: { seeded: true, channel: "email" },
      });
      statsByCampaign.set(externalId, {
        runId: String(run.id),
        periodStart: String(run.period_start),
        periodEnd: String(run.period_end),
        recipients,
        delivered,
        opensUnique,
        clicksUnique,
        conversions,
        revenue,
        unsubscribes,
        bounced,
        spamComplaints,
        name,
      });
    }
  }

  console.log(`Sembrando ${campaignRows.length} campañas…`);
  await chunkedUpsert(
    "klaviyo_campaigns",
    campaignRows,
    "account_id,external_campaign_id",
  );

  // 3. report_values: una fila por campaña/mes con las stats en raw_data
  // (mismas claves que lee klaviyo_email_report / consultant_klaviyo_by_org).
  const valueRows: Array<Record<string, unknown>> = [];
  for (const [externalId, s] of statsByCampaign) {
    valueRows.push({
      organization_id: organizationId,
      report_run_id: s.runId,
      entity_type: "campaign",
      external_entity_id: externalId,
      entity_name: s.name,
      metric_id: "demo-metric-placed-order",
      period_start: s.periodStart,
      period_end: s.periodEnd,
      conversions: s.conversions,
      revenue: s.revenue,
      currency_code: currency,
      raw_data: {
        statistics: {
          recipients: s.recipients,
          delivered: s.delivered,
          opens_unique: s.opensUnique,
          clicks_unique: s.clicksUnique,
          conversion_uniques: s.conversions,
          conversion_value: s.revenue,
          unsubscribes: s.unsubscribes,
          bounced: s.bounced,
          spam_complaints: s.spamComplaints,
        },
      },
    });
  }
  console.log(`Sembrando ${valueRows.length} report values…`);
  await chunkedUpsert(
    "klaviyo_report_values",
    valueRows,
    "report_run_id,entity_type,external_entity_id,metric_id,period_start,period_end",
  );

  const totalRevenue = [...statsByCampaign.values()].reduce(
    (sum, s) => sum + s.revenue,
    0,
  );
  console.log(
    `OK · org ${env.SEED_ORG_SLUG} · ${campaignRows.length} campañas en ${months} meses · ingresos atribuidos ${totalRevenue.toFixed(0)} ${currency}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
