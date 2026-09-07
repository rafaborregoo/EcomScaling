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
import { createLogger } from "@ecomscaling/observability";
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

type ShopifyqlResponse = {
  shopifyqlQuery?: {
    tableData?: {
      columns?: Array<{
        name?: string | null;
        dataType?: string | null;
        displayName?: string | null;
      }> | null;
      rows?: unknown[][] | null;
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
  constructor() {
    super(
      "shopify_read_reports_scope_missing: la conexión no tiene el permiso de informes. Reautoriza la tienda en Integraciones para activar sesiones y conversión.",
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
function toRecords(
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
      record[column.name] = row?.[index] ?? null;
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

  let sessionsResult;
  try {
    sessionsResult = await runShopifyql(
      shopDomain,
      accessToken,
      `FROM sessions SHOW sessions, online_store_visitors TIMESERIES day SINCE ${since} UNTIL today`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isAccessDenied(message)) {
      throw new ShopifyReportsScopeError();
    }
    throw error;
  }

  if (sessionsResult.parseErrors.length) {
    throw new Error(
      `shopifyql_sessions_parse_error: ${sessionsResult.parseErrors.join(" | ")}`,
    );
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
  let warning: string | null = null;
  try {
    const conversionResult = await runShopifyql(
      shopDomain,
      accessToken,
      `FROM sessions SHOW conversion_rate TIMESERIES day SINCE ${since} UNTIL today`,
    );
    if (conversionResult.parseErrors.length) {
      warning = `conversion_rate no disponible: ${conversionResult.parseErrors.join(" | ")}`;
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
    warning = `conversion_rate no disponible: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }

  if (warning) {
    logger.info("ShopifyQL conversion_rate no disponible", {
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
