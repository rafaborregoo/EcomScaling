// Tracking semanal: cada lunes cierra la semana pasada (lunes a domingo) de cada
// tienda activa y la deja en `kpi_snapshots`. Antes lo capturaba el consultor a
// mano desde Tracking, y como nadie se acordaba la tabla estaba siempre vacía.
//
// Escritura por service role (ADR-0006 #7). Idempotente: la clave única es
// (organización, tienda, periodo, inicio, fin), así que repetir la pasada de la
// misma semana actualiza la fila en vez de duplicarla.
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";

const DAY_MS = 86_400_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** Semana cerrada más reciente (lunes a domingo, UTC, como el resto de métricas). */
export function lastClosedWeek(now: Date): { start: string; end: string } {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = today.getUTCDay() || 7; // domingo = 7
  const thisMonday = new Date(today.getTime() - (weekday - 1) * DAY_MS);
  const end = new Date(thisMonday.getTime() - DAY_MS);
  const start = new Date(end.getTime() - 6 * DAY_MS);
  return { start: isoDay(start), end: isoDay(end) };
}

const num = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

export async function runWeeklyKpiSnapshots(env: LoadedApiEnv, now = new Date()) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });
  const week = lastClosedWeek(now);
  const from = `${week.start}T00:00:00.000Z`;
  const to = `${week.end}T23:59:59.999Z`;

  const { data: stores, error } = await supabase
    .from("shopify_stores")
    .select("id, organization_id")
    .eq("is_active", true);
  if (error) throw new Error(`shopify_stores: ${error.message}`);

  const result = { period: week, stores: stores?.length ?? 0, saved: 0, failed: 0, failures: [] as Array<{ store_id: string; error: string }> };
  for (const store of stores ?? []) {
    const fail = (message: string) => {
      result.failed += 1;
      result.failures.push({ store_id: store.id, error: message });
    };
    try {
      const [sales, finance, meta] = await Promise.all([
        supabase.rpc("shopify_sales_summary", { target_organization_id: store.organization_id, period_start: from, period_end: to, target_store_id: store.id }),
        supabase.rpc("shopify_financial_summary", { target_organization_id: store.organization_id, period_start: from, period_end: to, target_store_id: store.id }),
        supabase.rpc("meta_spend_summary", { target_organization_id: store.organization_id, period_start: week.start, period_end: week.end, target_store_id: store.id }),
      ]);
      if (sales.error) {
        fail(`shopify_sales_summary: ${sales.error.message}`);
        continue;
      }
      const s = sales.data?.[0] ?? {};
      const f = finance.error ? null : (finance.data?.[0] ?? null);
      // Meta sin datos en la semana = null, no 0: un cero se leería "no se gastó".
      const m = !meta.error && Number(meta.data?.[0]?.days_with_data ?? 0) > 0 ? meta.data?.[0] : null;
      const { error: saveError } = await supabase.from("kpi_snapshots").upsert(
        {
          organization_id: store.organization_id,
          store_id: store.id,
          period: "weekly",
          period_start: week.start,
          period_end: week.end,
          net_sales: num(s.net_sales),
          orders_count: num(s.orders_count),
          aov: num(s.aov),
          net_profit: num(f?.net_profit),
          ad_spend: num(m?.spend),
          roas: num(m?.roas),
          cac: num(m?.cac),
          captured_by: null,
        },
        { onConflict: "organization_id,store_id,period,period_start,period_end" },
      );
      if (saveError) fail(`kpi_snapshots: ${saveError.message}`);
      else result.saved += 1;
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : String(cause));
    }
  }
  return result;
}
