/**
 * Rentabilidad de la cartera del consultor (/panel, alcances cartera y cliente).
 *
 * Una sola lectura devuelve, tienda por tienda, el beneficio que ya calcula
 * `shopify_financial_summary` -- la formula NO se reimplementa aqui. Node solo
 * suma las cifras ya calculadas para el agregado de cada cliente y de la
 * cartera, y esa suma, con sus tramos y palancas, vive en @e-nora/contracts
 * (la pantalla de tienda usa las mismas reglas).
 *
 * Patron ADR-0006: lectura con service role + el alcance lo fija
 * `listConsultantOrganizations` (un consultor solo ve su cartera).
 *
 * ponytail: una RPC por tienda y por bloque (3 por tienda, 4 con serie diaria,
 * mas una serie mensual por cliente)
 * con concurrencia acotada y 60 s de cache. Con carteras de mas de ~150
 * tiendas hay que pasar a una funcion SQL `consultant_profitability_by_store`
 * que haga el lateral entero; el tope MAX_STORES evita que un platform_admin
 * dispare miles de llamadas mientras tanto.
 */
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import {
  aggregateClients,
  aggregateTotals,
  buildStoreRow,
  sortStores,
  targetsByKey,
  type ProfitStoreRow,
} from "@e-nora/contracts";
import type { AuthContext } from "./auth-context.js";
import { listConsultantOrganizations } from "./consultant.js";
import { getCached, setCached } from "./redis-cache.js";
import { selectCurrentTargets, type MetricTargetRow } from "./shopify-metrics.js";

const logger = createLogger("consultant-profitability");

type ApiEnv = LoadedApiEnv;

const ALLOWED_DAYS = [7, 30, 90, 365] as const;
const DEFAULT_DAYS = 30;
const MONTHLY_SERIES_MONTHS = 12;
const CACHE_TTL_SECONDS = 60;
const CONCURRENCY = 6;
const MAX_STORES = 150;
const DAY_MS = 24 * 60 * 60 * 1000;

export function normalizeProfitabilityDays(value: unknown): number {
  const parsed = Number(value);
  return (ALLOWED_DAYS as readonly number[]).includes(parsed) ? parsed : DEFAULT_DAYS;
}

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

/** Ejecuta `task` sobre cada elemento sin lanzar mas de `limit` a la vez. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]!);
    }
  });
  await Promise.all(workers);
  return results;
}

type StoreMeta = {
  id: string;
  organization_id: string;
  connection_id: string | null;
  shop_name: string | null;
  myshopify_domain: string | null;
  currency_code: string | null;
};

type TargetRow = MetricTargetRow & { organization_id: string; store_id: string | null };

type MonthlyRow = { bucket_month: string; net_revenue_ex_tax: unknown; net_profit: unknown };

export type ProfitabilityMonth = { month: string; revenue: number; profit: number };

export type ConsultantProfitability = {
  level: "portfolio" | "client";
  organization_id: string | null;
  period: { days: number; start: string; end: string };
  generated_at: string;
  stores: ProfitStoreRow[];
  clients: ReturnType<typeof aggregateClients>;
  totals: ReturnType<typeof aggregateTotals>;
  /** Serie mensual de las tiendas en la moneda de los totales. */
  monthly: ProfitabilityMonth[];
  /** Tiendas cuya lectura fallo: no se enseñan con datos a medias. */
  failed_stores: Array<{ store_id: string; shop_name: string }>;
  truncated: boolean;
  /**
   * Estado y ultimo sync de cada conexion (Shopify, Meta, Klaviyo) por cliente.
   * Solo lo que ya ve la mesa del consultor: ni cuentas ni mensajes de error.
   */
  connections: Array<{ organization_id: string; provider: string; status: string; last_sync_at: string | null }>;
};

export async function getConsultantProfitability(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  query: { days?: unknown; organizationId?: string | undefined },
) {
  const days = normalizeProfitabilityDays(query.days);

  const orgsResult = await listConsultantOrganizations(env, authorization, context);
  if (orgsResult.ok === false) return orgsResult;

  let organizations = orgsResult.data.organizations;
  if (query.organizationId) {
    organizations = organizations.filter((organization) => organization.id === query.organizationId);
    if (organizations.length === 0) {
      return {
        ok: false as const,
        statusCode: 403,
        error: "organization_not_in_portfolio",
        message: "Ese cliente no está en tu cartera.",
      };
    }
  }

  const cacheKey = `consultant:profitability:v2:${context.user.id}:${query.organizationId ?? "all"}:${days}`;
  const cached = await getCached<ConsultantProfitability>(env.REDIS_URL, cacheKey);
  if (cached) return { ok: true as const, data: cached };

  const supabase = createServiceClient(env);
  const orgIds = organizations.map((organization) => organization.id);
  const nameByOrg = new Map(organizations.map((organization) => [organization.id, organization.display_name]));

  if (orgIds.length === 0) {
    return { ok: true as const, data: emptyResult(query.organizationId ?? null, days) };
  }

  const end = new Date();
  const start = new Date(end.getTime() - days * DAY_MS);
  const previousStart = new Date(start.getTime() - days * DAY_MS);
  const today = end.toISOString().slice(0, 10);

  const [storesResult, targetsResult, connectionsResult] = await Promise.all([
    supabase
      .from("shopify_stores")
      .select("id, organization_id, connection_id, shop_name, myshopify_domain, currency_code")
      .in("organization_id", orgIds)
      .eq("is_active", true),
    supabase
      .from("organization_metric_targets")
      .select("organization_id, store_id, metric_key, target_value, period, valid_from, valid_until")
      .in("organization_id", orgIds)
      .lte("valid_from", today)
      .order("store_id", { ascending: false, nullsFirst: false })
      .order("valid_from", { ascending: false }),
    supabase
      .from("integration_connections")
      .select("organization_id, provider, status, last_sync_at")
      .in("organization_id", orgIds),
  ]);
  // Sin conexiones la pagina sigue siendo util: solo pierde la columna de datos.
  if (connectionsResult.error) {
    logger.error("consultant_profitability_connections_failed", connectionsResult.error.message);
  }

  if (storesResult.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "consultant_profitability_stores_failed",
      detail: storesResult.error.message,
    };
  }
  // Sin objetivos el panel sigue siendo util (pierde/ok), solo pierde el "vs objetivo".
  if (targetsResult.error) {
    logger.error("consultant_profitability_targets_failed", targetsResult.error.message);
  }

  const allStores = (storesResult.data ?? []) as StoreMeta[];
  const truncated = allStores.length > MAX_STORES;
  const stores = allStores.slice(0, MAX_STORES);
  const targetRows = (targetsResult.data ?? []) as unknown as TargetRow[];
  const withDaily = Boolean(query.organizationId);

  const loaded = await mapLimit(stores, CONCURRENCY, async (store) => {
    const rpcArgs = (periodStart: Date, periodEnd: Date) => ({
      target_organization_id: store.organization_id,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      target_store_id: store.id,
    });
    const [financial, previous, funnel, daily] = await Promise.all([
      supabase.rpc("shopify_financial_summary", rpcArgs(start, end)),
      supabase.rpc("shopify_financial_summary", rpcArgs(previousStart, start)),
      supabase.rpc("shopify_funnel_summary", rpcArgs(start, end)),
      withDaily
        ? supabase.rpc("shopify_sales_daily", rpcArgs(start, end))
        : Promise.resolve({ data: null, error: null }),
    ]);
    return { store, financial, previous, funnel, daily };
  });

  // Los gastos fijos son de la organizacion y el SQL los carga enteros a cada
  // tienda: se reparten por facturacion para que las tiendas de un cliente
  // sumen su beneficio real (ver StoreRowInput.fixedShare).
  const revenueOf = (item: (typeof loaded)[number]) =>
    Array.isArray(item.financial.data) ? Number(item.financial.data[0]?.net_revenue_ex_tax) || 0 : 0;
  const orgRevenue = new Map<string, number>();
  const orgStores = new Map<string, number>();
  for (const item of loaded) {
    const org = item.store.organization_id;
    orgRevenue.set(org, (orgRevenue.get(org) ?? 0) + Math.max(0, revenueOf(item)));
    orgStores.set(org, (orgStores.get(org) ?? 0) + 1);
  }
  const fixedShareOf = (item: (typeof loaded)[number]) => {
    const org = item.store.organization_id;
    const total = orgRevenue.get(org) ?? 0;
    return total > 0 ? Math.max(0, revenueOf(item)) / total : 1 / (orgStores.get(org) ?? 1);
  };

  const failed: ConsultantProfitability["failed_stores"] = [];
  const rows: ProfitStoreRow[] = [];

  for (const item of loaded) {
    const { store } = item;
    if (item.financial.error || !Array.isArray(item.financial.data)) {
      logger.error("consultant_profitability_store_failed", {
        store_id: store.id,
        error: item.financial.error?.message ?? "sin datos",
      });
      failed.push({ store_id: store.id, shop_name: store.shop_name ?? store.myshopify_domain ?? "Tienda" });
      continue;
    }
    // Comparativas y embudo son un añadido: si fallan se pierde el matiz, no la tienda.
    const own = targetRows.filter(
      (row) => row.organization_id === store.organization_id && (row.store_id === null || row.store_id === store.id),
    );
    const targets = targetsByKey(selectCurrentTargets(own, today));

    rows.push(
      buildStoreRow({
        store: {
          id: store.id,
          organization_id: store.organization_id,
          organization_name: nameByOrg.get(store.organization_id) ?? "Cliente",
          connection_id: store.connection_id,
          shop_name: store.shop_name,
          domain: store.myshopify_domain,
          currency_code: store.currency_code,
        },
        financial: (item.financial.data[0] ?? null) as Record<string, unknown> | null,
        previous: item.previous.error ? null : ((item.previous.data?.[0] ?? null) as Record<string, unknown> | null),
        funnel: item.funnel.error ? null : ((item.funnel.data?.[0] ?? null) as Record<string, unknown> | null),
        targets,
        periodDays: days,
        fixedShare: fixedShareOf(item),
        daily: Array.isArray(item.daily.data)
          ? (item.daily.data as Array<{ net_sales?: unknown }>).map((day) => Number(day.net_sales) || 0)
          : [],
      }),
    );
  }

  const sorted = sortStores(rows);
  const totals = aggregateTotals(sorted);
  // Serie mensual por ORGANIZACION (no por tienda): la funcion SQL reparte los
  // fijos una sola vez a nivel de cliente. Solo clientes cuyas tiendas estan
  // todas en la moneda de los totales: no se suman divisas.
  const monthlyOrgs = [...new Set(sorted.map((row) => row.organization_id))].filter((org) =>
    sorted.filter((row) => row.organization_id === org).every((row) => row.currency_code === totals.currency_code),
  );
  const monthlyResults = await mapLimit(monthlyOrgs, CONCURRENCY, async (org) => {
    const result = await supabase.rpc("shopify_financial_monthly", {
      target_organization_id: org,
      months_back: MONTHLY_SERIES_MONTHS,
      target_store_id: null,
    });
    return result;
  });
  const months = new Map<string, ProfitabilityMonth>();
  for (const result of monthlyResults) {
    if (result.error || !Array.isArray(result.data)) continue;
    for (const row of result.data as MonthlyRow[]) {
      const month = row.bucket_month;
      const current = months.get(month) ?? { month, revenue: 0, profit: 0 };
      current.revenue += Number(row.net_revenue_ex_tax) || 0;
      current.profit += Number(row.net_profit) || 0;
      months.set(month, current);
    }
  }

  const data: ConsultantProfitability = {
    level: query.organizationId ? "client" : "portfolio",
    organization_id: query.organizationId ?? null,
    period: { days, start: start.toISOString(), end: end.toISOString() },
    generated_at: end.toISOString(),
    stores: sorted,
    clients: aggregateClients(sorted),
    totals,
    monthly: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    failed_stores: failed,
    truncated,
    connections: ((connectionsResult.data ?? []) as ConsultantProfitability["connections"]).filter(
      (connection) => connection.status !== "pending_deletion",
    ),
  };

  await setCached(env.REDIS_URL, cacheKey, data, CACHE_TTL_SECONDS);
  return { ok: true as const, data };
}

function emptyResult(organizationId: string | null, days: number): ConsultantProfitability {
  const end = new Date();
  return {
    level: organizationId ? "client" : "portfolio",
    organization_id: organizationId,
    period: { days, start: new Date(end.getTime() - days * DAY_MS).toISOString(), end: end.toISOString() },
    generated_at: end.toISOString(),
    stores: [],
    clients: [],
    totals: aggregateTotals([]),
    monthly: [],
    failed_stores: [],
    truncated: false,
    connections: [],
  };
}
