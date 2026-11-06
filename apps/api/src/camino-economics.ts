import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveShopifyFinancialCurrencyCoverage } from "./shopify-financial-currency.js";

/**
 * Ruta económica del Camino: margen mes a mes, qué costes entran en él y cuánto
 * se puede fiar uno de la meta. Todo sale de datos observados con las mismas
 * funciones que el panel; nada de esto lo decide un modelo.
 */

type Row = Record<string, unknown>;

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : value === null || value === undefined ? null : Number.isFinite(Number(value)) ? Number(value) : null);

export type MonthFinancial = {
  month: string;
  orders: number;
  revenue: number | null;
  profit: number | null;
  /** Null si faltan costes o la moneda no cuadra: un margen incompleto no se dibuja como dato. */
  margin_pct: number | null;
  in_progress: boolean;
};

export type CostItem = { key: string; label: string; amount: number | null; included: boolean; note: string | null };
export type SignalState = "ok" | "warn" | "missing";
export type ConfidenceSignal = { key: string; label: string; state: SignalState; detail: string };
export type DataConfidence = { level: "low" | "medium" | "high"; signals: ConfidenceSignal[] };

const monthStart = (now: Date, back: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));

/** Del mes actual hacia atrás, igual que `shopify_financial_monthly`, con la cobertura de cada mes. */
export async function financialMonths(service: SupabaseClient, organizationId: string, storeId: string | null, count: number, now = new Date()) {
  const starts = Array.from({ length: count }, (_, index) => monthStart(now, count - 1 - index));
  const rows = await Promise.all(
    starts.map(async (start, index) => {
      const next = index === count - 1 ? null : starts[index + 1]!;
      const end = next ? new Date(next.getTime() - 1) : now;
      const { data, error } = await service.rpc("shopify_financial_summary", {
        target_organization_id: organizationId,
        period_start: start.toISOString(),
        period_end: end.toISOString(),
        target_store_id: storeId,
      });
      const row = !error && Array.isArray(data) ? ((data[0] as Row | undefined) ?? null) : null;
      return { month: start.toISOString().slice(0, 7), row };
    }),
  );
  return rows;
}

export function monthFinancial(entry: { month: string; row: Row | null }, currencyOk: boolean, currentMonth: string): MonthFinancial {
  const { month, row } = entry;
  const orders = num(row?.orders_count) ?? 0;
  const complete = currencyOk && row?.has_settings === true && num(row?.items_without_cost) === 0 && orders > 0;
  return {
    month,
    orders,
    revenue: currencyOk && row ? num(row.net_revenue_ex_tax) : null,
    profit: complete ? num(row?.net_profit) : null,
    margin_pct: complete ? num(row?.net_margin_pct) : null,
    in_progress: month === currentMonth,
  };
}

/** Qué costes entran en el margen de un periodo y cuáles faltan. Con alguno fuera, el margen es parcial. */
export function costCoverage(row: Row | null): CostItem[] {
  const settings = row?.has_settings === true;
  const withoutCost = num(row?.items_without_cost) ?? 0;
  const ads = num(row?.ads_spend);
  const notConfigured = "Sin configurar en los ajustes financieros";
  return [
    { key: "cogs", label: "Coste de producto", amount: num(row?.cogs), included: withoutCost === 0, note: withoutCost ? `${withoutCost.toLocaleString("es-ES")} ${withoutCost === 1 ? "artículo vendido" : "artículos vendidos"} sin coste` : null },
    { key: "payment_fees", label: "Comisiones de pago", amount: num(row?.payment_fees), included: settings, note: settings ? null : notConfigured },
    { key: "shipping", label: "Envíos", amount: num(row?.shipping_costs), included: settings, note: settings ? null : notConfigured },
    { key: "fixed", label: "Gastos fijos", amount: num(row?.fixed_costs), included: (num(row?.fixed_expenses_count) ?? 0) > 0, note: (num(row?.fixed_expenses_count) ?? 0) > 0 ? null : "No hay gastos fijos registrados" },
    { key: "ads", label: "Publicidad", amount: ads, included: (ads ?? 0) > 0, note: (ads ?? 0) > 0 ? null : "Sin gasto publicitario medido en el periodo" },
  ];
}

export type ConfidenceInput = {
  /** Meses desde el primer pedido; null si no hay pedidos. */
  historyMonths: number | null;
  /** Hay pedidos del mismo mes de la meta un año antes. */
  coversSeason: boolean;
  seasonLabel: string | null;
  missingCosts: string[];
  adsMeasured: boolean;
  disconnected: string[];
};

export function dataConfidence(input: ConfidenceInput): DataConfidence {
  const history = input.historyMonths ?? 0;
  const signals: ConfidenceSignal[] = [
    {
      key: "history",
      label: "Histórico",
      state: history >= 12 ? "ok" : history >= 3 ? "warn" : "missing",
      detail: history ? `${history.toLocaleString("es-ES")} ${history === 1 ? "mes" : "meses"} con pedidos` : "Sin pedidos registrados",
    },
    {
      key: "season",
      label: "Estacionalidad",
      state: input.coversSeason ? "ok" : "warn",
      detail: input.coversSeason ? `Hay ventas de ${input.seasonLabel ?? "ese mes"} del año anterior` : "No hay ventas del mismo mes del año anterior",
    },
    {
      key: "costs",
      label: "Costes",
      state: input.missingCosts.length ? "warn" : "ok",
      detail: input.missingCosts.length ? `Faltan: ${input.missingCosts.join(", ").toLowerCase()}` : "Todos los costes medidos",
    },
    {
      key: "investment",
      label: "Inversión",
      state: input.adsMeasured ? "ok" : "warn",
      detail: input.adsMeasured ? "Hay inversión publicitaria medida; el plan no fija un presupuesto" : "Sin inversión publicitaria medida ni presupuesto en el plan",
    },
    {
      key: "integrations",
      label: "Integraciones",
      state: input.disconnected.length ? "warn" : "ok",
      detail: input.disconnected.length ? `Sin conectar o sin datos recientes: ${input.disconnected.join(", ")}` : "Conectadas y al día",
    },
  ];
  const warnings = signals.filter((signal) => signal.state === "warn").length;
  const level = signals.some((signal) => signal.state === "missing") || warnings >= 3 ? "low" : warnings ? "medium" : "high";
  return { level, signals };
}

const INTEGRATION_LABEL: Record<string, string> = { shopify: "Shopify", meta_ads: "Meta Ads", klaviyo: "Klaviyo" };
const FRESH_MS = 48 * 3_600_000;

export function staleIntegrations(connections: Array<{ provider?: unknown; status?: unknown; last_sync_at?: unknown }>, now: Date) {
  return Object.keys(INTEGRATION_LABEL)
    .filter((provider) => {
      const own = connections.filter((connection) => connection.provider === provider);
      return !own.some((connection) => ["connected", "syncing"].includes(String(connection.status)) && now.getTime() - Date.parse(String(connection.last_sync_at)) <= FRESH_MS);
    })
    .map((provider) => INTEGRATION_LABEL[provider]!);
}

const seasonLabel = (date: Date) => new Intl.DateTimeFormat("es-ES", { month: "long", timeZone: "UTC" }).format(date);

export async function loadPlanEconomics(service: SupabaseClient, organizationId: string, storeId: string | null, goalDate: string | null, now = new Date()) {
  const firstOrderQuery = service
    .from("shopify_order_facts")
    .select("processed_at")
    .eq("organization_id", organizationId)
    .eq("is_test_order", false)
    .not("processed_at", "is", null)
    .order("processed_at", { ascending: true })
    .limit(1);
  const [entries, currency, firstOrder, connections] = await Promise.all([
    financialMonths(service, organizationId, storeId, 6, now),
    resolveShopifyFinancialCurrencyCoverage(service, organizationId, storeId),
    (storeId ? firstOrderQuery.eq("store_id", storeId) : firstOrderQuery).maybeSingle(),
    service.from("integration_connections").select("provider, status, last_sync_at").eq("organization_id", organizationId),
  ]);
  const currentMonth = now.toISOString().slice(0, 7);
  const currencyOk = currency.status === "compatible";
  const months = entries.map((entry) => monthFinancial(entry, currencyOk, currentMonth));

  // Los costes del último mes con pedidos: el actual puede estar recién empezado.
  const costEntry = [...entries].reverse().find((entry) => (num(entry.row?.orders_count) ?? 0) > 0) ?? null;
  const items = costCoverage(costEntry?.row ?? null);
  const missing = items.filter((item) => !item.included);

  const first = firstOrder.data?.processed_at ? new Date(String(firstOrder.data.processed_at)) : null;
  const historyMonths = first ? Math.max(1, (now.getUTCFullYear() - first.getUTCFullYear()) * 12 + now.getUTCMonth() - first.getUTCMonth() + 1) : null;
  const target = goalDate ? new Date(`${goalDate.slice(0, 10)}T00:00:00Z`) : null;
  const seasonStart = target ? new Date(Date.UTC(target.getUTCFullYear() - 1, target.getUTCMonth() + 1, 1)) : null;

  return {
    months,
    costs: { month: costEntry?.month ?? null, items, partial: missing.length > 0 },
    currency_compatible: currencyOk,
    confidence: dataConfidence({
      historyMonths,
      coversSeason: Boolean(first && seasonStart && first < seasonStart),
      seasonLabel: target ? seasonLabel(target) : null,
      missingCosts: missing.filter((item) => item.key !== "ads").map((item) => item.label),
      adsMeasured: items.some((item) => item.key === "ads" && item.included),
      disconnected: connections.error ? ["no se pudo comprobar"] : staleIntegrations(connections.data ?? [], now),
    }),
  };
}
