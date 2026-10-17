import { type AuthContext, createUserScopedClient, membershipCoversStore } from "./auth-context.js";
import { resolveShopifyStoreScope } from "./shopify-store-scope.js";

// "Hoy" de la app movil: ventas desde las 00:00 de la tienda hasta ahora, frente al mismo tramo del mismo dia de
// la semana pasada. `/shopify/metrics?days=1` no sirve para esto: son 24 horas moviles contra las 24 anteriores,
// y a las 9 de la manana compara la manana de hoy con la tarde de ayer.

const DAY_MS = 24 * 60 * 60 * 1000;

type SalesRow = { net_sales: number; orders_count: number; aov: number };

export type ShopifyTodayData = {
  currency_code: string | null;
  timezone: string;
  as_of: string;
  today: SalesRow;
  same_day_last_week: SalesRow | null;
};

/** Medianoche de hoy en `timeZone`, como instante UTC. Una zona invalida cae a UTC. */
export function startOfLocalDay(now: Date, timeZone: string): Date {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(now);
  } catch {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  // Desfase de la zona en este instante: la hora local leida como si fuera UTC, menos el instante real.
  const offset = Date.UTC(y, m - 1, d, get("hour"), get("minute"), get("second")) - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(y, m - 1, d) - offset);
}

const toRow = (row: Partial<SalesRow> | undefined): SalesRow => ({
  net_sales: Number(row?.net_sales) || 0,
  orders_count: Number(row?.orders_count) || 0,
  aov: Number(row?.aov) || 0,
});

export async function getShopifyToday(
  env: Parameters<typeof createUserScopedClient>[0],
  authorization: string,
  context: AuthContext,
  organizationId: string,
  connectionId?: string,
) {
  const membership = [...context.memberships, ...(context.storeMemberships ?? [])].find((item) => item.organization_id === organizationId);
  if (!membership) {
    return { ok: false as const, statusCode: 403, error: "organization_access_denied", message: "El usuario no pertenece a la organizacion solicitada." };
  }

  const supabase = createUserScopedClient(env, authorization.slice("Bearer ".length));
  const scope = await resolveShopifyStoreScope(supabase, organizationId, connectionId);
  if (scope.status === "selection_required") {
    return { ok: false as const, statusCode: 409, error: "shopify_store_selection_required", message: "shopify_store_selection_required: Selecciona una tienda para consultar importes sin mezclar tiendas." };
  }
  if (scope.status === "not_found") {
    return { ok: false as const, statusCode: 404, error: "shopify_connection_not_found", message: "La conexión de Shopify seleccionada no está activa en esta organización." };
  }
  if (!membershipCoversStore(membership, scope.storeId)) {
    return { ok: false as const, statusCode: 403, error: "store_access_denied", message: "Esta cuenta no tiene acceso a la tienda seleccionada." };
  }

  const now = new Date();
  if (!scope.storeId) {
    return { ok: true as const, data: { currency_code: null, timezone: "UTC", as_of: now.toISOString(), today: toRow(undefined), same_day_last_week: null } satisfies ShopifyTodayData };
  }

  const { data: store } = await supabase.from("shopify_stores").select("timezone").eq("id", scope.storeId).maybeSingle();
  const timezone = (store?.timezone as string | null) || "UTC";
  const start = startOfLocalDay(now, timezone);
  const summary = (from: Date, to: Date) =>
    supabase.rpc("shopify_sales_summary", { target_organization_id: organizationId, period_start: from.toISOString(), period_end: to.toISOString(), target_store_id: scope.storeId });

  const [today, lastWeek] = await Promise.all([summary(start, now), summary(new Date(start.getTime() - 7 * DAY_MS), new Date(now.getTime() - 7 * DAY_MS))]);
  if (today.error) throw new Error(`shopify_sales_summary_failed: ${today.error.message}`);

  return {
    ok: true as const,
    data: {
      currency_code: scope.currencyCode,
      timezone,
      as_of: now.toISOString(),
      today: toRow(today.data?.[0]),
      same_day_last_week: lastWeek.error ? null : toRow(lastWeek.data?.[0]),
    } satisfies ShopifyTodayData,
  };
}
