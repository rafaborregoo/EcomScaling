import { forecastStockDemand } from "@e-nora/contracts";

export const STOCK_COVERAGE_MIN_PERIOD_DAYS = 14;
export const STOCK_COVERAGE_MIN_UNITS = 5;
export const STOCK_COVERAGE_MIN_SELLING_DAYS = 3;
export const STOCK_SYNC_STALE_AFTER_HOURS = 48;

export type StockScenarioProjection = {
  target_date: string;
  days_from_now: number;
  projected_units: number;
  stockout_date: string | null;
};

/** Projects only a fresh, mature baseline; campaign uplift is never inferred. */
export function projectStockScenario(input: {
  available: number | null;
  averageDailySales: number | null;
  inventoryReliable: boolean;
  sampleMature: boolean;
  asOf: string;
  targetDate: string;
}): StockScenarioProjection | null {
  const asOf = Date.parse(input.asOf);
  const target = Date.parse(input.targetDate);
  if (!input.inventoryReliable || !input.sampleMature || input.available === null ||
      input.averageDailySales === null || input.averageDailySales <= 0 ||
      !Number.isFinite(asOf) || !Number.isFinite(target) || target < asOf) return null;
  const days = Math.ceil((target - asOf) / 86_400_000);
  const startingUnits = Math.max(0, input.available);
  const depletionDays = startingUnits / input.averageDailySales;
  const stockoutAt = Math.max(0, Math.ceil(depletionDays));
  const stockoutDate = stockoutAt <= days
    ? new Date(asOf + stockoutAt * 86_400_000).toISOString().slice(0, 10)
    : null;
  return {
    target_date: new Date(target).toISOString().slice(0, 10),
    days_from_now: days,
    projected_units: Math.max(0, Math.floor(startingUnits - input.averageDailySales * days)),
    stockout_date: stockoutDate,
  };
}

type OpenTaskRow = { store_id?: unknown; metadata?: unknown };

/** Exact product-ID dedupe for active restock tasks; never infer identity from similar titles. */
export function hasOpenStockTaskForProduct(
  productId: string,
  tasks: readonly OpenTaskRow[],
  selectedStoreId: string | null,
) {
  const normalizedProductId = productId.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(normalizedProductId)) return false;
  return tasks.some((task) => {
    const taskStoreId = typeof task.store_id === "string" ? task.store_id : null;
    if (selectedStoreId !== null && taskStoreId !== null && taskStoreId !== selectedStoreId) return false;
    const metadata = task.metadata && typeof task.metadata === "object" && !Array.isArray(task.metadata)
      ? task.metadata as Record<string, unknown>
      : null;
    const linkedProductId = metadata?.ai_shopify_product_id;
    return typeof linkedProductId === "string" && linkedProductId.toLowerCase() === normalizedProductId;
  });
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Adds transparent sample/freshness gates; it never supplies a purchase quantity. */
export function enrichStockRiskEvidence(
  rows: unknown[],
  options: {
    periodStart: string;
    periodEnd: string;
    now?: number;
    weeklyUnitsByProduct?: ReadonlyMap<string, readonly number[]>;
  },
) {
  const start = Date.parse(options.periodStart);
  const end = Date.parse(options.periodEnd);
  const now = options.now ?? Date.now();
  const periodDays = Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, (end - start) / 86_400_000)
    : 0;

  return rows.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as Record<string, unknown>;
    const sold = finiteNumber(row.quantity_sold_period ?? row.quantity_sold_30d);
    const sellingDays = finiteNumber(row.selling_days);
    const available = finiteNumber(row.available_quantity);
    const inventoryStatus = typeof row.inventory_status === "string"
      ? row.inventory_status
      : "unknown";
    const lastSync = typeof row.latest_inventory_sync_at === "string"
      ? Date.parse(row.latest_inventory_sync_at)
      : Number.NaN;
    const syncAgeHours = Number.isFinite(lastSync) && lastSync <= now + 5 * 60_000
      ? Math.max(0, (now - lastSync) / 3_600_000)
      : null;
    const inventoryReliable = inventoryStatus === "tracked_current" &&
      available !== null && syncAgeHours !== null && syncAgeHours <= STOCK_SYNC_STALE_AFTER_HOURS;
    const sampleMature = periodDays >= STOCK_COVERAGE_MIN_PERIOD_DAYS &&
      sold !== null && sold >= STOCK_COVERAGE_MIN_UNITS &&
      sellingDays !== null && sellingDays >= STOCK_COVERAGE_MIN_SELLING_DAYS;
    const preciseAverageDailySales = sampleMature && sold !== null
      ? sold / periodDays
      : null;
    const averageDailySales = preciseAverageDailySales === null
      ? null
      : Math.round(preciseAverageDailySales * 100) / 100;
    const daysOfCover = inventoryReliable && sampleMature && available !== null && preciseAverageDailySales !== null && preciseAverageDailySales > 0
      ? Math.round((available / preciseAverageDailySales) * 10) / 10
      : null;
    const productId = typeof row.product_id === "string" ? row.product_id : null;
    const weeklyUnits = productId ? options.weeklyUnitsByProduct?.get(productId) : undefined;
    const demandForecast = weeklyUnits
      ? forecastStockDemand(weeklyUnits, available, inventoryReliable)
      : null;

    return [{
      ...row,
      product_id: productId,
      available_quantity: available,
      quantity_sold_in_period: sold,
      period_days: Math.round(periodDays * 10) / 10,
      selling_days: sellingDays,
      inventory_status: inventoryStatus,
      inventory_sync_age_hours: syncAgeHours === null ? null : Math.round(syncAgeHours * 10) / 10,
      inventory_sync_is_stale: syncAgeHours === null || syncAgeHours > STOCK_SYNC_STALE_AFTER_HOURS,
      stock_coverage_sample_sufficient: sampleMature,
      average_daily_sales: averageDailySales,
      days_of_cover: daysOfCover,
      lead_time_days: null,
      reorder_quantity: null,
      demand_forecast: demandForecast,
    }];
  });
}
