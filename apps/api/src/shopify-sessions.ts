// Bloque de sync `sessions`: sesiones diarias y tasa de conversión de la
// tienda, vía ShopifyQL (`shopifyqlQuery`, schema `sessions`).
//
// Sin esto el módulo Shopify solo tenía el lado de pedidos: se veía cuánto se
// vendía, no cuánta gente entraba, así que no había embudo ni conversión.
//
// Requiere el scope `read_reports` en la conexión. Las conexiones autorizadas
// antes de añadirlo devuelven ACCESS_DENIED: el bloque lo detecta y deja un
// error legible en integration_sync_runs pidiendo reautorizar, sin tumbar el
// resto de bloques del sync.
//
// ADR-0006 pto 8: la documentación de ShopifyQL no fija los nombres exactos de
// las columnas que devuelve `TIMESERIES day`, ni garantiza que `conversion_rate`
// se pueda agrupar por tiempo (la propia doc la marca como métrica no
// "time-ordered"). Por eso: (a) las filas se mapean por NOMBRE de columna, no
// por posición; (b) la serie de sesiones y la de conversión van en dos consultas
// independientes, y si la segunda falla se registra el parseError y se sigue —
// la conversión propia (pedidos/sesiones) se calcula igual en SQL; (c) se
// loguean las columnas realmente devueltas la primera vez.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@e-nora/observability";
import { shopifyGraphql } from "./shopify-client.js";

const logger = createLogger("shopify-sessions");

// Ventana del import completo. Shopify conserva analítica bastante atrás, pero
// un año cubre las comparativas interanuales que usa el consultor sin pedir de
// más a un endpoint con su propio límite de coste.
const FULL_IMPORT_DAYS = 365;
// En incremental se repesca una ventana corta aunque el último sync fuese hace
// minutos: Shopify revisa la analítica de los días recientes, y el upsert
// in-place corrige el dato ya guardado.
const INCREMENTAL_MIN_DAYS = 7;

// Las dos métricas con las que nació el bloque. Si una de estas falla, el
// bloque falla: sin sesiones no hay nada que guardar.
const BASE_METRICS = ["sessions", "online_store_visitors"];
// Los tres pasos intermedios del embudo, en la misma unidad que `sessions`:
// visitas a la tienda online. Van en la MISMA consulta —misma fila, misma
// fecha, mismo denominador— pero son opcionales: si la tienda o la versión de
// la API las rechaza, se reintenta sin ellas. El embudo se queda corto; lo que
// no puede pasar es que el bloque entero deje de traer sesiones por ellas.
const FUNNEL_METRICS = [
  "sessions_with_cart_additions",
  "sessions_that_reached_checkout",
  "sessions_that_completed_checkout",
] as const;

/** ¿Vinieron las métricas del embudo en la respuesta? Se pregunta por las
 * columnas devueltas, no por si hubo reintento: lo que decide si hay dato es lo
 * que Shopify manda, no lo que nosotros pedimos. */
export function hasFunnelMetrics(
  columns: Array<{ name?: string | null }>,
): boolean {
  const names = new Set(columns.map((column) => column?.name));
  return FUNNEL_METRICS.every((metric) => names.has(metric));
}

/** `null` = ese día no pedimos la métrica. `0` = ese día nadie llegó a ese
 * paso. Confundirlos pinta un embudo que dice que la tienda no funciona. */
export function funnelMetric(
  record: Record<string, unknown>,
  metric: (typeof FUNNEL_METRICS)[number],
  available: boolean,
): number | null {
  return available ? Math.round(toNumber(record[metric])) : null;
}

type ShopifyqlResponse = {
  shopifyqlQuery?: {
    tableData?: {
      columns?: Array<{
        name?: string | null;
        dataType?: string | null;
        displayName?: string | null;
      }> | null;
      /** La doc la describe posicional; la API 2026-07 devuelve objetos. */
      rows?: Array<unknown[] | Record<string, unknown>> | null;
    } | null;
    parseErrors?: string[] | null;
  } | null;
};

export type SessionsSyncResult = {
  read: number;
  written: number;
  /** Aviso no fatal (p. ej. la conversión de Shopify no se pudo consultar). */
  warning: string | null;
};

export class ShopifyReportsScopeError extends Error {
  constructor(hasReportsScope = false) {
    super(
      hasReportsScope
        ? "shopify_reports_access_denied: Shopify ha rechazado ShopifyQL aunque read_reports sí está concedido. Shopify exige además acceso a datos protegidos de cliente Nivel 2 para esta consulta. Comprueba en el Dev Dashboard/Partner Dashboard de Shopify la solicitud de datos protegidos de la app y los campos requeridos; reinstalar o reautorizar la tienda no sustituye esa aprobación. Esto solo limita sesiones y conversión; el resto de la sincronización sigue disponible."
        : "shopify_read_reports_scope_missing: la conexión no tiene el permiso de informes. Reautoriza la tienda en Integraciones para activar sesiones y conversión.",
    );
    this.name = "ShopifyReportsScopeError";
  }
}

function isAccessDenied(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("access denied") ||
    lower.includes("access_denied") ||
    lower.includes("read_reports")
  );
}

/** `{ columns, rows }` -> filas como objetos, indexadas por nombre de columna. */
export function toRecords(
  tableData: NonNullable<
    NonNullable<ShopifyqlResponse["shopifyqlQuery"]>["tableData"]
  >,
): Array<Record<string, unknown>> {
  const columns = (tableData.columns ?? []).map((column, index) => ({
    name: column?.name ?? `col_${index}`,
    dataType: column?.dataType ?? null,
  }));
  return (tableData.rows ?? []).map((row) => {
    const record: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      // La doc describe `rows` como array posicional, pero la API 2026-07
      // devuelve cada fila como objeto con las columnas por nombre. Leerla solo
      // por indice daba 366 filas leidas y 0 escritas (ADR-0006 pto 8).
      record[column.name] = Array.isArray(row)
        ? (row[index] ?? null)
        : ((row as Record<string, unknown>)?.[column.name] ?? null);
    });
    return record;
  });
}

/** Columna de fecha de un `TIMESERIES day`: el nombre exacto no está fijado en
 * la doc, así que se busca por tipo y, si no, por nombre. */
function findDateKey(
  columns: Array<{ name?: string | null; dataType?: string | null }>,
): string | null {
  const byType = columns.find((column) =>
    ["date", "datetime", "time", "timestamp"].includes(
      (column?.dataType ?? "").toLowerCase(),
    ),
  );
  if (byType?.name) return byType.name;
  const byName = columns.find((column) =>
    /day|date|time|month|week/i.test(column?.name ?? ""),
  );
  return byName?.name ?? null;
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** "2026-09-03T00:00:00Z" | "2026-09-03" -> "2026-09-03" */
function toDateOnly(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const iso = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

async function runShopifyql(
  shopDomain: string,
  accessToken: string,
  query: string,
): Promise<{
  records: Array<Record<string, unknown>>;
  columns: Array<{ name?: string | null; dataType?: string | null }>;
  parseErrors: string[];
}> {
  const data = await shopifyGraphql<ShopifyqlResponse>(
    shopDomain,
    accessToken,
    `query Shopifyql($query: String!) {
      shopifyqlQuery(query: $query) {
        tableData {
          columns { name dataType displayName }
          rows
        }
        parseErrors
      }
    }`,
    { query },
  );

  const parseErrors = data.shopifyqlQuery?.parseErrors ?? [];
  const tableData = data.shopifyqlQuery?.tableData;
  if (!tableData) {
    return { records: [], columns: [], parseErrors };
  }
  return {
    records: toRecords(tableData),
    columns: tableData.columns ?? [],
    parseErrors,
  };
}

/**
 * Importa la serie diaria de sesiones de una tienda y la deja en
 * shopify_sessions_daily con upsert in-place.
 *
 * `sinceIso` = último sync (incremental) o null (import completo). Es el mismo
 * código para ambos casos, solo cambia la ventana (ADR-0006 pto 3).
 */
export async function syncShopifySessions(
  supabase: SupabaseClient,
  options: {
    shopDomain: string;
    accessToken: string;
    organizationId: string;
    storeId: string;
    connectionId: string;
    sinceIso: string | null;
    hasReportsScope?: boolean;
  },
): Promise<SessionsSyncResult> {
  const { shopDomain, accessToken, organizationId, storeId, sinceIso } = options;

  const days = sinceIso
    ? Math.max(
        INCREMENTAL_MIN_DAYS,
        Math.ceil((Date.now() - Date.parse(sinceIso)) / 86_400_000) + 1,
      )
    : FULL_IMPORT_DAYS;
  const since = `-${days}d`;

  const warnings: string[] = [];
  const runSessionsQuery = (metrics: string[]) =>
    runShopifyql(
      shopDomain,
      accessToken,
      `FROM sessions SHOW ${metrics.join(", ")} TIMESERIES day SINCE ${since} UNTIL today`,
    );

  let sessionsResult;
  try {
    sessionsResult = await runSessionsQuery([
      ...BASE_METRICS,
      ...FUNNEL_METRICS,
    ]);
    if (sessionsResult.parseErrors.length) {
      warnings.push(
        `pasos del embudo no disponibles: ${sessionsResult.parseErrors.join(" | ")}`,
      );
      sessionsResult = await runSessionsQuery(BASE_METRICS);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAccessDenied(message)) {
      throw new ShopifyReportsScopeError(options.hasReportsScope === true);
    }
    throw error;
  }

  if (sessionsResult.parseErrors.length) {
    throw new Error(
      `shopifyql_sessions_parse_error: ${sessionsResult.parseErrors.join(" | ")}`,
    );
  }

  const hasFunnel = hasFunnelMetrics(sessionsResult.columns);
  if (!hasFunnel && !warnings.length) {
    warnings.push("los pasos del embudo no venían en las columnas devueltas");
  }

  const dateKey = findDateKey(sessionsResult.columns);
  if (!dateKey) {
    // El supuesto de la doc no se cumple: que quede en el log qué devolvió.
    logger.error("ShopifyQL sessions sin columna de fecha reconocible", {
      connection_id: options.connectionId,
      shop_domain: shopDomain,
      columns: sessionsResult.columns.map((column) => ({
        name: column?.name,
        dataType: column?.dataType,
      })),
    });
    throw new Error("shopifyql_sessions_missing_date_column");
  }

  logger.info("ShopifyQL sessions recibido", {
    connection_id: options.connectionId,
    shop_domain: shopDomain,
    since,
    rows: sessionsResult.records.length,
    date_key: dateKey,
    columns: sessionsResult.columns.map((column) => column?.name),
  });

  // Tasa de conversión de Shopify: la doc marca conversion_rate como métrica no
  // ordenable por tiempo, así que puede fallar con TIMESERIES. Es opcional: si
  // falla, la conversión propia (pedidos/sesiones) se calcula en SQL igual.
  const conversionByDate = new Map<string, number>();
  try {
    const conversionResult = await runShopifyql(
      shopDomain,
      accessToken,
      `FROM sessions SHOW conversion_rate TIMESERIES day SINCE ${since} UNTIL today`,
    );
    if (conversionResult.parseErrors.length) {
      warnings.push(
        `conversion_rate no disponible: ${conversionResult.parseErrors.join(" | ")}`,
      );
    } else {
      const conversionDateKey =
        findDateKey(conversionResult.columns) ?? dateKey;
      for (const record of conversionResult.records) {
        const date = toDateOnly(record[conversionDateKey]);
        const rate = toNullableNumber(record["conversion_rate"]);
        if (date && rate !== null) conversionByDate.set(date, rate);
      }
    }
  } catch (error) {
    warnings.push(
      `conversion_rate no disponible: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  // Un solo aviso con todo lo que no vino: es lo que acaba en
  // integration_sync_runs y lo que se lee cuando alguien pregunta por qué al
  // embudo le falta un paso.
  const warning = warnings.length ? warnings.join(" | ") : null;
  if (warning) {
    logger.info("ShopifyQL: métricas opcionales no disponibles", {
      connection_id: options.connectionId,
      shop_domain: shopDomain,
      detail: warning,
    });
  }

  const rows = sessionsResult.records
    .map((record) => {
      const bucketDate = toDateOnly(record[dateKey]);
      if (!bucketDate) return null;
      return {
        organization_id: organizationId,
        store_id: storeId,
        bucket_date: bucketDate,
        sessions: Math.round(toNumber(record["sessions"])),
        online_store_visitors: Math.round(
          toNumber(record["online_store_visitors"]),
        ),
        conversion_rate: conversionByDate.get(bucketDate) ?? null,
        sessions_with_cart_additions: funnelMetric(
          record,
          "sessions_with_cart_additions",
          hasFunnel,
        ),
        sessions_that_reached_checkout: funnelMetric(
          record,
          "sessions_that_reached_checkout",
          hasFunnel,
        ),
        sessions_that_completed_checkout: funnelMetric(
          record,
          "sessions_that_completed_checkout",
          hasFunnel,
        ),
        raw: record,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (!rows.length) {
    return { read: sessionsResult.records.length, written: 0, warning };
  }

  const { error } = await supabase
    .from("shopify_sessions_daily")
    .upsert(rows, { onConflict: "store_id,bucket_date" });

  if (error) {
    throw new Error(`shopify_sessions_upsert_failed: ${error.message}`);
  }

  return { read: sessionsResult.records.length, written: rows.length, warning };
}
