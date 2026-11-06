import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaminoMetricRead } from "./camino-goal-progress.js";

/** A13's operating window is 30 days; monthly goal progress needs separate calendar reads. */
export async function loadA13CalendarGoalProgress(client: SupabaseClient, organizationId: string, storeId: string | null, now: Date) {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const previousPeriodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const previousEnd = new Date(periodStart.getTime() - 1);
  const read = async (rpc: string, start: Date, end: Date): Promise<CaminoMetricRead> => {
    const result = await client.rpc(rpc, { target_organization_id: organizationId, target_store_id: storeId, period_start: start.toISOString(), period_end: end.toISOString() });
    const rows = Array.isArray(result.data) ? result.data : result.data == null ? [] : [result.data];
    return { row: result.error ? null : rows[0] ?? null, error: result.error ? "source_read_failed" : null };
  };
  const [currentSales, previousSales, currentFinancial, previousFinancial] = await Promise.all([
    read("shopify_sales_summary", periodStart, now), read("shopify_sales_summary", previousPeriodStart, previousEnd),
    read("shopify_financial_summary", periodStart, now), read("shopify_financial_summary", previousPeriodStart, previousEnd),
  ]);
  return { periodStart, previousPeriodStart, currentSales, previousSales, currentFinancial, previousFinancial };
}
