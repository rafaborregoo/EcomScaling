import { createLogger } from "@e-nora/observability";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { getCached, setCached } from "./redis-cache.js";

const logger = createLogger("api:klaviyo-insights");

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  REDIS_URL?: string;
};

const MIN_PERIOD_DAYS = 1;
const MAX_PERIOD_DAYS = 3650;
const DEFAULT_PERIOD_DAYS = 90;
const CACHE_TTL_SECONDS = 60;

/**
 * El rendimiento de Klaviyo viene bucketizado por MES (klaviyo_report_values se
 * pide por periodos mensuales). Viaja con los datos para que la pantalla pueda
 * decir "mes" en vez de fingir una resolucion diaria que no existe.
 */
const PERFORMANCE_BUCKET = "month" as const;

export type KlaviyoEmailRow = {
  source: "flow" | "campaign";
  parent_id: string;
  parent_name: string;
  parent_status: string | null;
  trigger_type: string | null;
  send_time: string | null;
  message_id: string;
  external_message_id: string;
  position_in_parent: number;
  subject: string | null;
  preview_text: string | null;
  external_template_id: string | null;
  template_name: string | null;
  body_chars: number | null;
  tracks_opens: boolean | null;
  tracks_clicks: boolean | null;
  adds_utm: boolean;
  custom_utm_params: number;
};

export type KlaviyoHealthRow = {
  emails_total: number;
  emails_sin_asunto: number;
  emails_sin_cuerpo: number;
  emails_sin_utm: number;
  emails_sin_seguimiento_clics: number;
  flujos_activos: number;
  campanas_enviadas: number;
  listas: number;
  segmentos: number;
  metrica_conversion: string | null;
  ultimo_sync: string | null;
  ultimo_sync_estado: string | null;
  recursos_no_traidos: string | null;
};

export type KlaviyoPerformanceRow = {
  bucket_month: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  subject: string | null;
  send_time: string | null;
  trigger_type: string | null;
  revenue: number;
  conversions: number;
  recipients: number;
  delivered: number;
  opens_unique: number;
  clicks_unique: number;
  unsubscribes: number;
  bounced: number;
  spam_complaints: number;
};

export type KlaviyoInsightsData = {
  organization_id: string;
  // NULL = agregado de la organizacion. Con varias tiendas, cada una tiene su
  // cuenta de Klaviyo y estas cifras son solo de esa.
  store_id: string | null;
  period: { days: number | "all"; start: string | null; end: string };
  performance_bucket: typeof PERFORMANCE_BUCKET;
  connected: boolean;
  health: KlaviyoHealthRow | null;
  emails: KlaviyoEmailRow[];
  performance: KlaviyoPerformanceRow[];
  // Que bloques no se han podido calcular. Sin esta lista, un bloque roto y un
  // bloque vacio se dibujan igual.
  unavailable: string[];
};

type RpcResult = { data: unknown; error: { message: string } | null };

function rows<T>(result: RpcResult, name: string, unavailable: string[]): T[] {
  if (result.error) {
    unavailable.push(name);
    return [];
  }

  return (result.data ?? []) as T[];
}

function parsePeriodDays(daysInput: string | undefined): number | "all" {
  if (daysInput === "all") {
    return "all";
  }

  const parsed = Number(daysInput);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PERIOD_DAYS;
  }

  return Math.min(
    MAX_PERIOD_DAYS,
    Math.max(MIN_PERIOD_DAYS, Math.floor(parsed)),
  );
}

const isoDate = (value: Date) => value.toISOString().slice(0, 10);

/**
 * La conexion activa de la UI es de Shopify; la cuenta de Klaviyo cuelga de esa
 * misma tienda (klaviyo_accounts.store_id). Sin tienda, las funciones agregan
 * toda la organizacion, que es lo correcto para un cliente de una sola tienda.
 */
async function loadStoreIdForConnection(
  supabase: ReturnType<typeof createUserScopedClient>,
  organizationId: string,
  connectionId: string | undefined,
) {
  if (!connectionId) {
    return null;
  }

  const { data, error } = await supabase
    .from("shopify_stores")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (error) {
    throw new Error(`klaviyo_insights_store_load_failed: ${error.message}`);
  }

  return data?.id ?? null;
}

export async function getKlaviyoInsights(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  daysInput: string | undefined,
  connectionId?: string,
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

  const periodDays = parsePeriodDays(daysInput);
  const periodEnd = new Date();
  // Sin periodo, el rendimiento arranca en el origen de los datos que tenemos.
  const periodStart =
    periodDays === "all"
      ? null
      : new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  try {
    const storeId = await loadStoreIdForConnection(
      supabase,
      organizationId,
      connectionId,
    );

    // La tienda entra en la clave: sin ella, dos tiendas de la misma
    // organizacion compartirian cache y se verian los datos de la otra.
    const cacheKey = `klaviyo:insights:${organizationId}:${storeId ?? "org"}:${periodDays}`;
    const cached = await getCached<KlaviyoInsightsData>(
      env.REDIS_URL,
      cacheKey,
    );

    if (cached) {
      return { ok: true as const, data: cached };
    }

    const [connectionResult, healthResult, emailsResult, performanceResult] =
      await Promise.all([
        supabase
          .from("integration_connections")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("provider", "klaviyo")
          // Los intentos de OAuth sin terminar (`pending:`) no son cuentas, y
          // una organización puede tener una cuenta por tienda.
          .in("status", ["connected", "syncing", "error"])
          .not("provider_account_id", "like", "pending:%")
          .limit(1),
        supabase.rpc("klaviyo_measurement_health", {
          target_organization_id: organizationId,
          target_store_id: storeId,
        }),
        // El inventario no tiene ventana: un flujo activo existe hoy, no "en
        // los ultimos 30 dias".
        supabase.rpc("klaviyo_email_inventory", {
          target_organization_id: organizationId,
          target_store_id: storeId,
        }),
        supabase.rpc("klaviyo_email_report", {
          target_organization_id: organizationId,
          period_start: isoDate(
            periodStart ?? new Date(periodEnd.getFullYear() - 5, 0, 1),
          ),
          period_end: isoDate(periodEnd),
          target_store_id: storeId,
        }),
      ]);

    const unavailable: string[] = [];
    const health = rows<KlaviyoHealthRow>(
      healthResult,
      "salud",
      unavailable,
    )[0];

    const data: KlaviyoInsightsData = {
      organization_id: organizationId,
      store_id: storeId,
      period: {
        days: periodDays,
        start: periodStart?.toISOString() ?? null,
        end: periodEnd.toISOString(),
      },
      performance_bucket: PERFORMANCE_BUCKET,
      connected: Boolean(connectionResult.data?.length),
      health: health ?? null,
      emails: rows<KlaviyoEmailRow>(emailsResult, "emails", unavailable),
      performance: rows<KlaviyoPerformanceRow>(
        performanceResult,
        "rendimiento",
        unavailable,
      ),
      unavailable,
    };

    if (unavailable.length > 0) {
      logger.error("klaviyo_insights_blocks_unavailable", {
        organization_id: organizationId,
        blocks: unavailable,
      });
    }

    await setCached(env.REDIS_URL, cacheKey, data, CACHE_TTL_SECONDS);

    return { ok: true as const, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("klaviyo_insights_failed", {
      organization_id: organizationId,
      message,
    });

    return {
      ok: false as const,
      statusCode: 500,
      error: "klaviyo_insights_failed",
      detail: message,
    };
  }
}
