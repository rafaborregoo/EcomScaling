// AI-03: SQL Gateway de solo lectura para agentes IA.
// Primera capa de defensa (esta): validacion AST en Node antes de tocar la DB.
// Segunda capa (migracion db_08b): las vistas del esquema `ai` filtran por la
// organizacion fijada via GUC, por lo que ni una consulta que burlara esta
// validacion podria devolver datos de otro tenant.
import { parse } from "pgsql-ast-parser";
import type { SupabaseClient } from "@supabase/supabase-js";

// Vistas expuestas en el esquema `ai` (deben coincidir con la migracion db_08b).
export const GATEWAY_ALLOWED_TABLES = new Set([
  "shopify_stores",
  "shopify_products",
  "shopify_variants",
  "shopify_inventory_items",
  "shopify_inventory_current_state",
  "shopify_order_facts",
  "shopify_order_items",
  "shopify_refunds",
  "shopify_customers",
  "product_costs",
  "organization_financial_settings",
  "fixed_expenses",
  "organization_metric_targets",
  "alerts",
  "tasks",
  "meta_campaigns",
  "meta_ads",
  "meta_insight_rows_daily",
]);

// Tipos de sentencia que jamas pueden aparecer, ni siquiera dentro de un CTE.
// `with recursive` esta prohibido (no solo a nivel top-level, tambien anidado
// en una subquery): un CTE recursivo mal formado agota el statement_timeout
// de 8s en vez de fallar rapido, y los agentes no necesitan recursion para
// las consultas analiticas que hacen sobre las vistas de `ai`.
const FORBIDDEN_NODE_TYPES = new Set([
  "insert",
  "update",
  "delete",
  "truncate table",
  "create table",
  "create view",
  "create materialized view",
  "create index",
  "create schema",
  "create function",
  "alter table",
  "drop table",
  "drop index",
  "grant",
  "revoke",
  "set",
  "show",
  "copy",
  "do",
  "begin",
  "commit",
  "rollback",
  "refresh materialized view",
  "prepare",
  "deallocate",
  "with recursive",
]);

const FORBIDDEN_FUNCTIONS = new Set([
  "set_config",
  "current_setting",
  "lo_import",
  "lo_export",
  "dblink",
  "dblink_exec",
  "dblink_connect",
  "query_to_xml",
  "database_to_xml",
  "table_to_xml",
  "xpath_table",
  // SQO-04 (gap real cerrado 2026-07-29, fila 7 de la matriz de amenazas):
  // funciones que generan/expanden filas sin necesidad de tocar una tabla de
  // la allowlist -- un `select count(*) from generate_series(1, 10000000000)`
  // pasa la validacion de tablas pero puede agotar el statement_timeout de
  // 8s igual que un CTE recursivo, solo que sin pasar por FORBIDDEN_NODE_TYPES.
  "generate_series",
  "regexp_split_to_table",
  "jsonb_path_query",
]);

const TOP_LEVEL_ALLOWED_TYPES = new Set(["select", "union", "union all", "with", "values"]);

export type GatewayValidation =
  | { ok: true; tables: string[] }
  | { ok: false; reason: string };

type AstNode = Record<string, unknown>;

function isObject(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null;
}

function walk(node: unknown, visit: (node: AstNode) => void) {
  if (Array.isArray(node)) {
    for (const item of node) {
      walk(item, visit);
    }
    return;
  }

  if (!isObject(node)) {
    return;
  }

  visit(node);

  for (const value of Object.values(node)) {
    walk(value, visit);
  }
}

function readQName(value: unknown): { name: string | null; schema: string | null } {
  if (typeof value === "string") {
    return { name: value.toLowerCase(), schema: null };
  }

  if (isObject(value)) {
    const name = typeof value.name === "string" ? value.name.toLowerCase() : null;
    const schema = typeof value.schema === "string" ? value.schema.toLowerCase() : null;
    return { name, schema };
  }

  return { name: null, schema: null };
}

/**
 * Valida que el SQL del agente sea una unica sentencia SELECT/WITH que solo
 * referencia vistas de la allowlist (o CTEs propios), sin esquemas
 * cualificados ajenos a `ai` y sin funciones peligrosas.
 */
export function validateGatewaySql(sql: string): GatewayValidation {
  const cleaned = sql.trim().replace(/;+\s*$/, "");

  if (!cleaned) {
    return { ok: false, reason: "consulta_vacia" };
  }

  let statements;
  try {
    statements = parse(cleaned);
  } catch (error) {
    return {
      ok: false,
      reason: `sql_no_parseable: ${error instanceof Error ? error.message.slice(0, 200) : "error"}`,
    };
  }

  if (statements.length !== 1) {
    return { ok: false, reason: "solo_se_permite_una_sentencia" };
  }

  const statement = statements[0] as unknown as AstNode;
  const statementType = typeof statement.type === "string" ? statement.type : "";

  if (!TOP_LEVEL_ALLOWED_TYPES.has(statementType)) {
    return { ok: false, reason: `sentencia_no_permitida: ${statementType}` };
  }

  // Pase 1: tipos prohibidos en cualquier posicion + nombres de CTE.
  const cteNames = new Set<string>();
  let forbiddenType: string | null = null;

  walk(statement, (node) => {
    const nodeType = typeof node.type === "string" ? node.type : null;

    if (nodeType && FORBIDDEN_NODE_TYPES.has(nodeType) && !forbiddenType) {
      forbiddenType = nodeType;
    }

    if ((nodeType === "with" || nodeType === "with recursive") && Array.isArray(node.bind)) {
      for (const bind of node.bind) {
        if (isObject(bind)) {
          const { name } = readQName(bind.alias);
          if (name) {
            cteNames.add(name);
          }
        }
      }
    }
  });

  if (forbiddenType) {
    return { ok: false, reason: `operacion_prohibida: ${forbiddenType}` };
  }

  // Pase 2: referencias a tablas y llamadas a funciones.
  const tablesUsed = new Set<string>();
  let problem: string | null = null;

  walk(statement, (node) => {
    if (problem) {
      return;
    }

    const nodeType = typeof node.type === "string" ? node.type : null;

    if (nodeType === "table") {
      const { name, schema } = readQName(node.name ?? node);

      if (!name) {
        problem = "referencia_de_tabla_ilegible";
        return;
      }

      if (schema && schema !== "ai") {
        problem = `esquema_no_permitido: ${schema}.${name}`;
        return;
      }

      if (!GATEWAY_ALLOWED_TABLES.has(name) && !cteNames.has(name)) {
        problem = `tabla_fuera_de_allowlist: ${name}`;
        return;
      }

      if (GATEWAY_ALLOWED_TABLES.has(name)) {
        tablesUsed.add(name);
      }
    }

    if (nodeType === "call") {
      const { name, schema } = readQName(node.function);

      if (schema) {
        problem = `funcion_cualificada_no_permitida: ${schema}.${name ?? "?"}`;
        return;
      }

      if (name && (FORBIDDEN_FUNCTIONS.has(name) || name.startsWith("pg_"))) {
        problem = `funcion_prohibida: ${name}`;
      }
    }
  });

  if (problem) {
    return { ok: false, reason: problem };
  }

  return { ok: true, tables: Array.from(tablesUsed).sort() };
}

export type GatewayExecutionResult = {
  ok: boolean;
  rows?: unknown[];
  rowLimit?: number;
  error?: string;
  tablesUsed: string[];
  durationMs: number;
};

const GATEWAY_ABORT_TIMEOUT_MS = 12_000;
const GATEWAY_MAX_ROWS = 200;

/**
 * Valida, ejecuta y audita una consulta del agente. Toda invocacion (aceptada
 * o rechazada) queda registrada en agent_query_runs con tablas, filas y
 * duracion (criterio de cierre AI-03).
 */
export async function executeGatewayQuery(
  supabase: SupabaseClient,
  runId: string,
  organizationId: string,
  sql: string,
): Promise<GatewayExecutionResult> {
  const startedAt = Date.now();
  const validation = validateGatewaySql(sql);

  if (validation.ok === false) {
    await supabase.from("agent_query_runs").insert({
      run_id: runId,
      organization_id: organizationId,
      sql_text: sql.slice(0, 8000),
      was_rejected: true,
      rejection_reason: validation.reason,
      duration_ms: Date.now() - startedAt,
    });

    return {
      ok: false,
      error: `consulta_rechazada: ${validation.reason}`,
      tablesUsed: [],
      durationMs: Date.now() - startedAt,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GATEWAY_ABORT_TIMEOUT_MS);

  let rows: unknown[] | undefined;
  let rowLimit: number | undefined;
  let executionError: string | undefined;

  try {
    const { data, error } = await supabase
      .rpc("agent_sql_gateway", {
        target_organization_id: organizationId,
        query_sql: sql.trim().replace(/;+\s*$/, ""),
        max_rows: GATEWAY_MAX_ROWS,
      })
      .abortSignal(controller.signal);

    if (error) {
      executionError = `gateway_rpc_failed: ${error.message}`;
    } else if (data && typeof data === "object" && "error" in data) {
      executionError = `sql_error: ${String((data as { error: unknown }).error).slice(0, 300)}`;
    } else if (data && typeof data === "object" && "rows" in data) {
      const payload = data as { rows: unknown[]; row_limit?: number };
      rows = Array.isArray(payload.rows) ? payload.rows : [];
      if (typeof payload.row_limit === "number") {
        rowLimit = payload.row_limit;
      }
    } else {
      executionError = "gateway_respuesta_inesperada";
    }
  } catch (error) {
    executionError =
      error instanceof Error && error.name === "AbortError"
        ? "timeout_consulta"
        : `gateway_execution_failed: ${error instanceof Error ? error.message : "unknown"}`;
  } finally {
    clearTimeout(timeout);
  }

  const durationMs = Date.now() - startedAt;

  await supabase.from("agent_query_runs").insert({
    run_id: runId,
    organization_id: organizationId,
    sql_text: sql.slice(0, 8000),
    tables_used: validation.tables,
    rows_returned: rows ? rows.length : null,
    duration_ms: durationMs,
    was_rejected: Boolean(executionError),
    rejection_reason: executionError ?? null,
  });

  if (executionError) {
    return { ok: false, error: executionError, tablesUsed: validation.tables, durationMs };
  }

  const result: GatewayExecutionResult = {
    ok: true,
    rows: rows ?? [],
    tablesUsed: validation.tables,
    durationMs,
  };

  if (rowLimit !== undefined) {
    result.rowLimit = rowLimit;
  }

  return result;
}

// Catalogo de esquema que se anade al system prompt cuando el agente tiene la
// tool sql_select. Solo describe las vistas del esquema `ai`.
export const SQL_GATEWAY_SCHEMA_DOC = `## Tool sql_select: esquema disponible

Puedes ejecutar UNA sentencia SELECT (o WITH) por llamada sobre estas vistas, ya filtradas a la organizacion activa. Sin esquemas cualificados, maximo 200 filas por consulta (usa agregaciones), sin DDL/DML.

- shopify_stores(id, shop_name, myshopify_domain, currency_code, timezone, is_active)
- shopify_products(id, store_id, external_product_id, title, handle, vendor, product_type, status, published_at, external_created_at)
- shopify_variants(id, product_id, title, current_price, compare_at_price, position, is_active)
- shopify_inventory_items(id, variant_id, sku, tracked, current_unit_cost, cost_currency_code)
- shopify_inventory_current_state(id, inventory_item_id, location_id, available_quantity, on_hand_quantity, committed_quantity, incoming_quantity, is_active, updated_at)
- shopify_order_facts(id, store_id, order_name, financial_status, fulfillment_status, source_name, currency_code, gross_sales, discounts, refunds, net_sales, current_shipping_price, current_total_tax, current_total_price, total_items, is_first_customer_order, is_test_order, processed_at, external_created_at, cancelled_at)
  - Para ventas reales filtra: is_test_order = false and cancelled_at is null; usa coalesce(processed_at, external_created_at) como fecha.
- shopify_order_items(id, order_id, product_id, variant_id, title, sku_snapshot, vendor_snapshot, quantity_original, quantity_current, unit_price, original_line_total, discount_total, current_line_total, refunded_quantity, refunded_amount)
- shopify_refunds(id, order_id, total_refunded, currency_code, external_created_at)
- shopify_customers(id, store_id, customer_reference_hash, number_of_orders, amount_spent, currency_code, state, tags, external_created_at) -- sin PII, solo metricas
- product_costs(id, inventory_item_id, unit_cost, currency_code, source, valid_from, valid_until)
- organization_financial_settings(currency_code, payment_fee_pct, payment_fee_fixed, default_shipping_cost, vat_pct)
- fixed_expenses(id, name, category, amount, currency_code, billing_period, valid_from, valid_until, is_active)
- organization_metric_targets(id, metric_key, target_value, period, valid_from, valid_until)
- alerts(id, status, severity, title, message, metric_code, metric_value, threshold_value, first_detected_at, last_detected_at, resolved_at)
- tasks(id, alert_id, source, status, priority, title, description, due_at, completed_at, created_at)
- meta_campaigns(id, external_campaign_id, name, objective, effective_status, daily_budget, lifetime_budget, starts_at, ends_at)
- meta_ads(id, ad_set_id, external_ad_id, name, effective_status, parsed_angle, parsed_format, parsed_hook)
- meta_insight_rows_daily(id, campaign_id, ad_set_id, ad_id, level, metric_date, breakdown_hash, spend, impressions, reach, frequency, clicks, inline_link_clicks, cpm, cpc, ctr)
  - Para gasto sin duplicar usa level = 'ad' and breakdown_hash = 'none'.

Cita cada consulta usada en sources con kind "tool" y reference "sql_select: <resumen>".`;
