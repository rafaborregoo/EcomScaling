import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { isIntegrationFeatureEnabled } from "@ecomscaling/integrations";
import { getOrgMetaBackfillStatus } from "./meta-sync.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  INTEGRATION_FEATURE_FLAGS?: string;
};

const DEFAULT_PERIOD_DAYS = 30;
const MAX_PERIOD_DAYS = 3650;

export async function getMetaMetrics(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  daysInput: string | undefined,
  // Tienda activa del selector. Sin ella se devuelve el agregado del cliente,
  // que es lo que piden la cartera del consultor y los agentes.
  connectionId?: string,
) {
  if (!isIntegrationFeatureEnabled("meta_ads", env.INTEGRATION_FEATURE_FLAGS)) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "integration_disabled",
      message: "La integracion Meta Ads esta desactivada por feature flag.",
    };
  }

  if (
    !context.memberships.some(
      (membership) => membership.organization_id === organizationId,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  let periodDays: number | "all" = DEFAULT_PERIOD_DAYS;
  if (daysInput === "all") {
    periodDays = "all";
  } else if (daysInput) {
    const parsed = Number(daysInput);
    if (Number.isFinite(parsed) && parsed > 0) {
      periodDays = Math.min(MAX_PERIOD_DAYS, Math.floor(parsed));
    }
  }

  const periodEnd = new Date();
  const periodStart =
    periodDays === "all"
      ? null
      : new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const periodStartDate = periodStart?.toISOString().slice(0, 10) ?? null;
  const periodEndDate = periodEnd.toISOString().slice(0, 10);

  // El selector de la UI maneja ids de conexion Shopify; las funciones SQL
  // filtran por tienda. La traduccion se hace aqui para que el frontend siga
  // usando un unico identificador de tienda en todas las pantallas.
  //
  // Si la conexion no resuelve a ninguna tienda (sync aun sin completar) se
  // cae al agregado en vez de devolver cero: un cero se lee como "no hay
  // gasto" y aqui significaria "no se ha podido filtrar".
  let storeId: string | null = null;
  if (connectionId) {
    const { data: store } = await supabase
      .from("shopify_stores")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("connection_id", connectionId)
      .maybeSingle();
    storeId = (store?.id as string | undefined) ?? null;
  }

  const [summaryResult, dailyResult, byCampaignResult] = await Promise.all([
    supabase.rpc("meta_spend_summary", {
      target_organization_id: organizationId,
      period_start: periodStartDate,
      period_end: periodEndDate,
      target_store_id: storeId,
    }),
    periodStartDate
      ? supabase.rpc("meta_spend_daily", {
          target_organization_id: organizationId,
          period_start: periodStartDate,
          period_end: periodEndDate,
          target_store_id: storeId,
        })
      : Promise.resolve({ data: null, error: null }),
    // Desglose por campaña: es lo que cierra el hilo del calendario (que
    // campaña se lanzo, con que pieza, y que atribuyo Meta).
    supabase.rpc("meta_spend_by_campaign", {
      target_organization_id: organizationId,
      period_start: periodStartDate,
      period_end: periodEndDate,
      target_store_id: storeId,
    }),
  ]);

  const { data, error } = summaryResult;

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "meta_metrics_load_failed",
      detail: error.message,
    };
  }

  // No fatal: el sparkline es un adorno de la tarjeta KPI.
  type MetaDailyRow = { bucket_date: string; spend: number };
  const daily = !dailyResult.error && Array.isArray(dailyResult.data)
    ? (dailyResult.data as MetaDailyRow[]).map((row) => ({
        date: row.bucket_date,
        spend: Number(row.spend) || 0,
      }))
    : [];

  const backfill = await getOrgMetaBackfillStatus(supabase, organizationId);

  const summary = data?.[0] ?? {
    spend: 0,
    impressions: 0,
    clicks: 0,
    purchases: 0,
    purchase_value: 0,
    roas: null,
    cac: null,
    days_with_data: 0,
    // Sin filas no hay procedencia que declarar: lista vacia, no el default
    // del sistema, para no aparentar que se midio algo.
    purchase_action_types: [],
  };

  // Igual que el sparkline: el desglose es informacion añadida. Si falla, la
  // tarjeta de adquisicion sigue saliendo con su total.
  type MetaCampaignRow = {
    campaign_id: string;
    campaign_name: string | null;
    spend: number | string | null;
    purchases: number | string | null;
    purchase_value: number | string | null;
    roas: number | string | null;
    purchase_action_type: string | null;
  };
  const campaigns =
    !byCampaignResult.error && Array.isArray(byCampaignResult.data)
      ? (byCampaignResult.data as MetaCampaignRow[])
      : [];

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      period: {
        days: periodDays,
        start: periodStart?.toISOString() ?? null,
        end: periodEnd.toISOString(),
      },
      acquisition: summary,
      daily,
      campaigns,
      backfill,
    },
  };
}
