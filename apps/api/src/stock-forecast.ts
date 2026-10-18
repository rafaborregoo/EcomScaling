import { type AuthContext, createUserScopedClient, membershipCoversStore } from "./auth-context.js";
import { resolveShopifyStoreScope } from "./shopify-store-scope.js";
import { enrichStockRiskEvidence } from "./stock-risk-evidence.js";

// Previsión de stock de la app móvil: solo lo que de verdad pide reponer. Mismo cruce stock/venta que A06
// (shopify_stock_risk_products + enrichStockRiskEvidence), filtrado a productos activos que se venden con
// regularidad, con inventario sincronizado y que se agotan dentro del horizonte. Lo que no se vende, lo que ya
// se repuso (cobertura de sobra), lo archivado y el stock sin sincronizar no salen.

const DAY_MS = 24 * 60 * 60 * 1000;
export const STOCK_FORECAST_PERIOD_DAYS = 30;
export const STOCK_FORECAST_HORIZON_DAYS = 14;

export type StockForecastItem = {
  product_id: string;
  title: string;
  image_url: string | null;
  available: number;
  daily_sales: number;
  days_of_cover: number;
  status: "out" | "soon";
};

type Enriched = ReturnType<typeof enrichStockRiskEvidence>[number] & { title?: unknown; available_quantity?: unknown };

/** Agotados primero (los que más vendían arriba), luego los que se agotan antes. */
export function selectStockForecast(rows: Enriched[], activeIds: ReadonlySet<string>, horizonDays = STOCK_FORECAST_HORIZON_DAYS) {
  return rows
    .flatMap((row) => {
      if (!row.product_id || !activeIds.has(row.product_id)) return [];
      if (row.days_of_cover == null || row.average_daily_sales == null || row.days_of_cover > horizonDays) return [];
      const available = Number(row.available_quantity);
      return [{
        product_id: row.product_id,
        title: typeof row.title === "string" ? row.title : "Producto",
        image_url: null,
        available,
        daily_sales: row.average_daily_sales,
        days_of_cover: row.days_of_cover,
        status: available <= 0 ? "out" as const : "soon" as const,
      }];
    })
    .sort((a, b) => (a.status === b.status ? (a.status === "out" ? b.daily_sales - a.daily_sales : a.days_of_cover - b.days_of_cover) : a.status === "out" ? -1 : 1));
}

export async function getStockForecast(
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
  if (scope.status === "not_found") {
    return { ok: false as const, statusCode: 404, error: "shopify_connection_not_found", message: "La conexión de Shopify seleccionada no está activa en esta organización." };
  }
  // Sin importes: con varias tiendas y ninguna elegida se miran todas (cada producto es de una sola tienda).
  const storeId = scope.status === "ready" ? scope.storeId : null;
  if (!membershipCoversStore(membership, storeId)) {
    return { ok: false as const, statusCode: 403, error: "store_access_denied", message: "Esta cuenta no tiene acceso a la tienda seleccionada." };
  }

  const now = new Date();
  const periodStart = new Date(now.getTime() - STOCK_FORECAST_PERIOD_DAYS * DAY_MS);
  const risk = await supabase.rpc("shopify_stock_risk_products", {
    target_organization_id: organizationId,
    period_start: periodStart.toISOString(),
    period_end: now.toISOString(),
    target_store_id: storeId,
  });
  if (risk.error) throw new Error(`shopify_stock_risk_products_failed: ${risk.error.message}`);

  const rows = enrichStockRiskEvidence((risk.data ?? []) as unknown[], { periodStart: periodStart.toISOString(), periodEnd: now.toISOString() }) as Enriched[];
  const ids = rows.flatMap((row) => (row.product_id ? [row.product_id] : []));
  const [products, media] = ids.length
    ? await Promise.all([
        supabase.from("shopify_products").select("id").eq("organization_id", organizationId).in("id", ids).eq("status", "ACTIVE"),
        supabase.from("shopify_product_media").select("product_id, source_url, position").eq("organization_id", organizationId).in("product_id", ids).eq("is_active", true).eq("media_content_type", "IMAGE").order("position", { ascending: true }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (products.error) throw new Error(`stock_forecast_products_failed: ${products.error.message}`);

  const images = new Map<string, string>();
  for (const m of (media.data ?? []) as Array<{ product_id: string; source_url: string | null }>) {
    if (m.source_url && !images.has(m.product_id)) images.set(m.product_id, m.source_url);
  }
  const items = selectStockForecast(rows, new Set(((products.data ?? []) as Array<{ id: string }>).map((p) => p.id)))
    .map((item) => ({ ...item, image_url: images.get(item.product_id) ?? null }));

  return {
    ok: true as const,
    data: {
      period_days: STOCK_FORECAST_PERIOD_DAYS,
      horizon_days: STOCK_FORECAST_HORIZON_DAYS,
      out: items.filter((i) => i.status === "out").length,
      soon: items.filter((i) => i.status === "soon").length,
      items,
    },
  };
}
