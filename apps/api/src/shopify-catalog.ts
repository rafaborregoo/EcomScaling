import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import {
  isMissingShopifyProductMetadataSchema,
  normalizeShopifyProductTags,
  shopifyProductDescriptionText,
} from "./shopify-product-metadata.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
};

type CatalogQuery = {
  connectionId?: string;
  q?: string;
  status?: string;
  page?: string;
  targetsPage?: string;
  periodDays?: string;
  sort?: string;
  filter?: string;
};

type CatalogDiscountRow = {
  id: string;
  store_id: string;
  title: string | null;
  code: string | null;
  codes: string[] | null;
  codes_coverage: string | null;
  configuration_coverage: string | null;
  summary: string | null;
  rule_data: unknown;
  status: string | null;
  discount_class: string | null;
  value_type: string | null;
  value: number | null;
  usage_count: number;
  usage_limit: number | null;
  uses_per_order_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  external_updated_at: string | null;
};

type CatalogStore = {
  id: string;
  connection_id: string;
  shop_name: string;
  currency_code: string | null;
};

type CatalogBundleComponentRow = {
  parent_variant_id: string;
  component_variant_id: string | null;
  external_component_variant_id: string;
  component_quantity: number;
  verification_status: "confirmed" | "unresolved_component";
};

type CatalogProductActivityRow = {
  product_id: string;
  variant_id: string | null;
  units_ordered: number;
  units_refunded: number;
  orders_count: number;
  last_order_at: string | null;
};

type CatalogSelectedOption = { name: string; value: string };

const PAGE_SIZE = 24;
const DISCOUNT_PAGE_SIZE = 25;
const DISCOUNT_TARGET_PAGE_SIZE = 100;
const VARIANT_PAGE_SIZE = 50;
const IN_FILTER_BATCH_SIZE = 100;
const PRODUCT_STATUSES = new Set(["ACTIVE", "DRAFT", "ARCHIVED", "DELETED"]);
const PRODUCT_SORTS = new Set(["sales", "stock", "margin", "updated", "name"]);
const PRODUCT_FILTERS = new Set(["out", "low", "no_cost", "no_sales"]);
const SPARK_WEEKS = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function queryInBatches<T>(
  values: string[],
  query: (batch: string[]) => Promise<{ data: T[] | null; error: any }>,
) {
  const data: T[] = [];
  for (let offset = 0; offset < values.length; offset += IN_FILTER_BATCH_SIZE) {
    const result = await query(values.slice(offset, offset + IN_FILTER_BATCH_SIZE));
    if (result.error) return { data: null, error: result.error };
    data.push(...(result.data ?? []));
  }
  return { data, error: null };
}

function isProductMediaSchemaMissing(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" ||
    error.message?.includes("shopify_product_media") === true;
}

function isProductMediaCoverageSchemaMissing(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" ||
    error.message?.includes("shopify_product_media_sync_coverage") === true;
}

function isProductBundleSchemaMissing(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" ||
    error.message?.includes("shopify_product_bundle_components") === true ||
    error.message?.includes("shopify_bundle_sync_coverage") === true;
}

function isInventoryStateSchemaMissing(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" ||
    error.message?.includes("shopify_inventory_current_state") === true;
}

function isSelectedOptionsSchemaMissing(error: { code?: string; message?: string }) {
  return (error.code === "42703" || error.code === "PGRST204") &&
    error.message?.includes("selected_options") === true;
}

function normalizeSelectedOptions(value: unknown): CatalogSelectedOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option) => {
    if (!option || typeof option !== "object") return [];
    const candidate = option as Record<string, unknown>;
    return typeof candidate.name === "string" && typeof candidate.value === "string"
      ? [{ name: candidate.name, value: candidate.value }]
      : [];
  });
}

function isDiscountTargetsSchemaMissing(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" ||
    error.message?.includes("shopify_discount_targets") === true ||
    error.message?.includes("shopify_discount_target_sync_coverage") === true;
}

function isDiscountDetailsSchemaMissing(error: { code?: string; message?: string }) {
  return error.code === "42703" || error.code === "PGRST204" ||
    /\b(codes|codes_coverage|configuration_coverage|summary|rule_data|uses_per_order_limit)\b/i.test(error.message ?? "");
}

type CatalogProductMetricsRow = {
  product_id: string;
  units_ordered: number;
  units_refunded: number;
  orders_count: number;
  last_order_at: string | null;
  stock_available: number | null;
  tracked_variants: number;
  variants_total: number;
  variants_out: number;
  variants_low: number;
  variants_without_cost: number;
  price_min: number | null;
  price_max: number | null;
  order_lines: number;
  lines_missing_cost: number;
  lines_missing_net: number;
  net_revenue: number | null;
  cogs: number | null;
};

type CatalogWeeklyRow = { product_id: string; week_start: string; units_ordered: number; units_refunded: number };

function isCatalogMetricsSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error) && (
    error!.code === "PGRST202" || error!.code === "42883" ||
    /shopify_catalog_(product_metrics|product_ranking|summary|product_weekly|product_copurchase)/.test(error!.message ?? "")
  );
}

// Lunes (UTC) de cada una de las ultimas `count` semanas, la mas antigua primero.
export function weekStarts(end: Date, count: number) {
  const monday = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: count }, (_unused, index) => {
    const week = new Date(monday.getTime() - (count - 1 - index) * 7 * DAY_MS);
    return week.toISOString().slice(0, 10);
  });
}

export function fillWeekly(rows: CatalogWeeklyRow[], end: Date, count: number) {
  const byWeek = new Map(rows.map((row) => [String(row.week_start).slice(0, 10), row]));
  return weekStarts(end, count).map((week) => ({
    week_start: week,
    units_ordered: Number(byWeek.get(week)?.units_ordered ?? 0),
    units_refunded: Number(byWeek.get(week)?.units_refunded ?? 0),
  }));
}

// El margen solo se da cuando todas las lineas del periodo tienen coste e
// importe neto: con huecos, "sin coste" cuenta como gratis e infla el numero.
export function productMetricsView(row: CatalogProductMetricsRow) {
  const revenue = row.net_revenue == null ? null : Number(row.net_revenue);
  const marginComplete = row.order_lines > 0 && row.lines_missing_cost === 0 && row.lines_missing_net === 0 && revenue != null && revenue > 0;
  return {
    units_ordered: Number(row.units_ordered),
    units_refunded: Number(row.units_refunded),
    return_rate: Number(row.units_ordered) > 0 ? Number(row.units_refunded) / Number(row.units_ordered) : null,
    orders_count: Number(row.orders_count),
    last_order_at: row.last_order_at,
    stock_available: row.stock_available == null ? null : Number(row.stock_available),
    tracked_variants: Number(row.tracked_variants),
    variants_total: Number(row.variants_total),
    variants_out: Number(row.variants_out),
    variants_low: Number(row.variants_low),
    variants_without_cost: Number(row.variants_without_cost),
    price_min: row.price_min == null ? null : Number(row.price_min),
    price_max: row.price_max == null ? null : Number(row.price_max),
    margin_complete: marginComplete,
    margin_pct: marginComplete ? (revenue! - Number(row.cogs ?? 0)) / revenue! : null,
  };
}

const DISCOUNT_PERIODS = new Set([30, 90, 365]);
const DISCOUNT_SORTS = new Set(["recent", "usage", "ending", "name"]);
const DISCOUNT_FILTERS = new Set(["ending", "limit", "app"]);
const DISCOUNT_ENDING_DAYS = 7;
const DISCOUNT_LIMIT_SHARE = 0.8;

type DiscountMetricsRow = {
  discount_id: string;
  orders_count: number;
  discount_amount: number | null;
  amount_coverage: string;
  net_revenue: number;
  new_customer_orders: number;
  known_customer_orders: number;
  last_order_at: string | null;
  baseline_orders: number;
  baseline_net_revenue: number;
};

type DiscountSummaryRow = {
  id: string;
  status: string | null;
  ends_at: string | null;
  usage_count: number;
  usage_limit: number | null;
  configuration_coverage?: string | null;
};

function isDiscountMetricsSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(error) && (
    error!.code === "PGRST202" || error!.code === "42883" ||
    /shopify_discount_(metrics|weekly|top_products|codes_usage)/.test(error!.message ?? "")
  );
}

export function discountPeriodDays(value: string | undefined) {
  const parsed = Number(value ?? 90);
  return DISCOUNT_PERIODS.has(parsed) ? parsed : 90;
}

// "Cerca del limite" y "acaba pronto" salen de columnas que PostgREST no sabe
// comparar entre si, asi que se evaluan aqui sobre filas ligeras (no es agregacion).
export function discountAlertKinds(row: DiscountSummaryRow, now: Date) {
  const kinds: string[] = [];
  const active = row.status?.toUpperCase() === "ACTIVE";
  if (active && row.ends_at) {
    const ms = new Date(row.ends_at).getTime() - now.getTime();
    if (ms >= 0 && ms <= DISCOUNT_ENDING_DAYS * DAY_MS) kinds.push("ending");
  }
  if (active && row.usage_limit && row.usage_count / row.usage_limit >= DISCOUNT_LIMIT_SHARE) kinds.push("limit");
  if (row.configuration_coverage === "app_managed") kinds.push("app");
  return kinds;
}

// Con menos de 5 pedidos sin promocion, comparar tickets medios es ruido.
const DISCOUNT_MIN_ORDERS_FOR_COMPARISON = 5;

export function discountMetricsView(row: DiscountMetricsRow | undefined) {
  if (!row) {
    return { orders: 0, discount_amount: 0, amount_coverage: "complete", net_revenue: 0, aov: null, aov_baseline: null, new_customer_share: null, last_order_at: null };
  }
  const orders = Number(row.orders_count);
  const revenue = Number(row.net_revenue);
  const baselineOrders = Number(row.baseline_orders);
  return {
    orders,
    discount_amount: row.discount_amount == null ? null : Number(row.discount_amount),
    amount_coverage: row.amount_coverage,
    net_revenue: revenue,
    aov: orders > 0 ? revenue / orders : null,
    aov_baseline: baselineOrders >= DISCOUNT_MIN_ORDERS_FOR_COMPARISON ? Number(row.baseline_net_revenue) / baselineOrders : null,
    new_customer_share: Number(row.known_customer_orders) > 0 ? Number(row.new_customer_orders) / Number(row.known_customer_orders) : null,
    last_order_at: row.last_order_at,
  };
}

async function loadDiscountMetrics(
  client: any,
  organizationId: string,
  storeIds: string[],
  discountIds: string[] | null,
  periodDays: number,
) {
  const end = new Date();
  const start = new Date(end.getTime() - periodDays * DAY_MS);
  const metrics = await client.rpc("shopify_discount_metrics", {
    target_organization_id: organizationId,
    target_store_ids: storeIds,
    target_discount_ids: discountIds,
    target_period_start: start.toISOString(),
    target_period_end: end.toISOString(),
  });
  if (isDiscountMetricsSchemaMissing(metrics.error)) {
    return { coverage: "migration_pending" as const, byId: new Map<string, DiscountMetricsRow>(), weekly: new Map<string, number[]>(), end, start };
  }
  if (metrics.error) return { coverage: "unavailable" as const, byId: new Map<string, DiscountMetricsRow>(), weekly: new Map<string, number[]>(), end, start };

  const weekly = new Map<string, number[]>();
  const withOrders = ((metrics.data ?? []) as DiscountMetricsRow[]).map((row) => row.discount_id);
  const weeklyIds = discountIds ?? withOrders;
  if (weeklyIds.length) {
    const weeklyResult = await client.rpc("shopify_discount_weekly", {
      target_organization_id: organizationId,
      target_store_ids: storeIds,
      target_discount_ids: weeklyIds,
      target_period_end: end.toISOString(),
      weeks: SPARK_WEEKS,
    });
    if (!weeklyResult.error) {
      const weeks = weekStarts(end, SPARK_WEEKS);
      for (const row of (weeklyResult.data ?? []) as Array<{ discount_id: string; week_start: string; orders_count: number }>) {
        const index = weeks.indexOf(String(row.week_start).slice(0, 10));
        if (index < 0) continue;
        const series = weekly.get(row.discount_id) ?? Array(SPARK_WEEKS).fill(0);
        series[index] = Number(row.orders_count);
        weekly.set(row.discount_id, series);
      }
    }
  }
  return {
    coverage: "observed_only" as const,
    byId: new Map(((metrics.data ?? []) as DiscountMetricsRow[]).map((row) => [row.discount_id, row])),
    weekly,
    end,
    start,
  };
}

function pageNumber(value: string | undefined) {
  const parsed = Number(value ?? 1);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 100_000
    ? parsed
    : null;
}

async function catalogScope(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  connectionId?: string,
) {
  if (!context.memberships.some((membership) => membership.organization_id === organizationId)) {
    return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
  }

  const token = authorization.slice("Bearer ".length);
  const client = createUserScopedClient(env, token);
  let storeQuery = client
    .from("shopify_stores")
    .select("id, connection_id, shop_name, currency_code")
    .eq("organization_id", organizationId);
  if (connectionId) storeQuery = storeQuery.eq("connection_id", connectionId);
  const { data, error } = await storeQuery;
  if (error) throw new Error(`shopify_catalog_stores_failed: ${error.message}`);
  const stores = (data ?? []) as CatalogStore[];
  if (connectionId && stores.length === 0) {
    return { ok: false as const, statusCode: 404, error: "shopify_store_not_found" };
  }
  return { ok: true as const, client, stores };
}

export async function listShopifyCatalogProducts(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  input: CatalogQuery,
) {
  const page = pageNumber(input.page);
  if (page === null) return { ok: false as const, statusCode: 400, error: "invalid_page" };
  if (input.connectionId && !UUID_PATTERN.test(input.connectionId)) {
    return { ok: false as const, statusCode: 400, error: "invalid_connection_id" };
  }
  const status = input.status?.toUpperCase() ?? "";
  if (status && !PRODUCT_STATUSES.has(status)) {
    return { ok: false as const, statusCode: 400, error: "invalid_product_status" };
  }
  const sort = input.sort ?? "sales";
  if (!PRODUCT_SORTS.has(sort)) return { ok: false as const, statusCode: 400, error: "invalid_product_sort" };
  const filter = input.filter ?? "";
  if (filter && !PRODUCT_FILTERS.has(filter)) return { ok: false as const, statusCode: 400, error: "invalid_product_filter" };
  const periodDays = input.periodDays === undefined ? 90 : Number(input.periodDays);
  if (![30, 90, 365].includes(periodDays)) return { ok: false as const, statusCode: 400, error: "invalid_product_activity_period" };

  try {
    const scope = await catalogScope(env, authorization, context, organizationId, input.connectionId);
    if (!scope.ok) return scope;
    const { client, stores } = scope;
    if (stores.length === 0) {
      return { ok: true as const, data: { organization_id: organizationId, page, page_size: PAGE_SIZE, total: 0, products: [], summary: null, metrics_coverage: "unavailable", period_days: periodDays } };
    }

    const storeById = new Map(stores.map((store) => [store.id, store]));
    const search = input.q?.trim().slice(0, 120) ?? "";
    const searchTerm = search.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
    const start = (page - 1) * PAGE_SIZE;
    const storeIds = stores.map((store) => store.id);
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - periodDays * DAY_MS);

    // El orden y el filtro por ventas, stock o margen se resuelven en SQL sobre
    // todo el catalogo: ordenar solo la pagina cargada daria un "mas vendidos"
    // falso. Si la migracion aun no esta, se cae al listado de siempre.
    const rankingResult = await client.rpc("shopify_catalog_product_ranking", {
      target_organization_id: organizationId,
      target_store_ids: storeIds,
      search_term: searchTerm,
      target_status: status,
      target_filter: filter,
      target_sort: sort,
      target_period_start: periodStart.toISOString(),
      target_period_end: periodEnd.toISOString(),
      page_size: PAGE_SIZE,
      page_offset: start,
    });
    const metricsAvailable = !rankingResult.error;
    if (rankingResult.error && !isCatalogMetricsSchemaMissing(rankingResult.error)) {
      throw new Error(`shopify_catalog_ranking_failed: ${rankingResult.error.message}`);
    }
    const rankedRows = (rankingResult.data ?? []) as Array<{ product_id: string; total_count: number }>;
    const rankedIds = rankedRows.map((row) => row.product_id);
    const rankedTotal = rankedRows.length ? Number(rankedRows[0]?.total_count ?? 0) : 0;
    if (metricsAvailable && rankedIds.length === 0) {
      const emptySummary = await client.rpc("shopify_catalog_summary", {
        target_organization_id: organizationId,
        target_store_ids: storeIds,
        target_period_start: periodStart.toISOString(),
        target_period_end: periodEnd.toISOString(),
      });
      return { ok: true as const, data: { organization_id: organizationId, page, page_size: PAGE_SIZE, total: 0, products: [], summary: emptySummary.data?.[0] ?? null, metrics_coverage: "available", period_days: periodDays } };
    }

    const loadProductPage = (withMetadata: boolean) => {
      if (metricsAvailable) {
        return (client as any)
          .from("shopify_products")
          .select(withMetadata
            ? "id, store_id, title, handle, vendor, product_type, status, published_at, external_updated_at, description_html, tags, shopify_category_id, shopify_category_name, metadata_coverage"
            : "id, store_id, title, handle, vendor, product_type, status, published_at, external_updated_at")
          .eq("organization_id", organizationId)
          .in("id", rankedIds);
      }
      let query = (client as any)
        .from("shopify_products")
        .select(withMetadata
          ? "id, store_id, title, handle, vendor, product_type, status, published_at, external_updated_at, description_html, tags, shopify_category_id, shopify_category_name, metadata_coverage"
          : "id, store_id, title, handle, vendor, product_type, status, published_at, external_updated_at", { count: "exact" })
        .eq("organization_id", organizationId)
        .in("store_id", stores.map((store) => store.id));
      if (status) query = query.eq("status", status);
      else query = query.neq("status", "DELETED");
      if (searchTerm) {
        const pattern = `%${searchTerm}%`;
        query = query.or([
          `title.ilike.${pattern}`,
          `handle.ilike.${pattern}`,
          `vendor.ilike.${pattern}`,
          `product_type.ilike.${pattern}`,
        ].join(","));
      }
      return query
        .order("title", { ascending: true })
        .order("id", { ascending: true })
        .range(start, start + PAGE_SIZE - 1);
    };
    let productResult = await loadProductPage(true);
    const metadataSchemaMissing = Boolean(productResult.error && isMissingShopifyProductMetadataSchema(productResult.error));
    if (metadataSchemaMissing) productResult = await loadProductPage(false);
    const { data: rawData, count, error } = productResult;
    if (error) throw new Error(`shopify_catalog_products_failed: ${error.message}`);
    const rankOf = new Map(rankedIds.map((id, index) => [id, index]));
    const data = metricsAvailable
      ? [...(rawData ?? [])].sort((left: any, right: any) => (rankOf.get(left.id) ?? 0) - (rankOf.get(right.id) ?? 0))
      : rawData;

    const productIds = ((data ?? []) as Array<Record<string, any>>).map((product) => product.id as string);

    const metricsByProduct = new Map<string, ReturnType<typeof productMetricsView>>();
    const weeklyByProduct = new Map<string, ReturnType<typeof fillWeekly>>();
    let catalogSummary: Record<string, number> | null = null;
    let metricsCoverage: "available" | "migration_pending" | "unavailable" = metricsAvailable ? "available" : "migration_pending";
    if (metricsAvailable && productIds.length) {
      const [metricsResult, weeklyResult, summaryResult] = await Promise.all([
        client.rpc("shopify_catalog_product_metrics", {
          target_organization_id: organizationId,
          target_store_ids: storeIds,
          target_product_ids: productIds,
          target_period_start: periodStart.toISOString(),
          target_period_end: periodEnd.toISOString(),
        }),
        client.rpc("shopify_catalog_product_weekly", {
          target_organization_id: organizationId,
          target_store_ids: storeIds,
          target_product_ids: productIds,
          target_period_end: periodEnd.toISOString(),
          weeks: SPARK_WEEKS,
        }),
        client.rpc("shopify_catalog_summary", {
          target_organization_id: organizationId,
          target_store_ids: storeIds,
          target_period_start: periodStart.toISOString(),
          target_period_end: periodEnd.toISOString(),
        }),
      ]);
      if (metricsResult.error || weeklyResult.error) {
        // Sin metricas el catalogo sigue siendo util; se dice, no se inventan ceros.
        metricsCoverage = "unavailable";
      } else {
        for (const row of (metricsResult.data ?? []) as CatalogProductMetricsRow[]) {
          metricsByProduct.set(row.product_id, productMetricsView(row));
        }
        const weeklyRows = (weeklyResult.data ?? []) as CatalogWeeklyRow[];
        for (const id of productIds) {
          weeklyByProduct.set(id, fillWeekly(weeklyRows.filter((row) => row.product_id === id), periodEnd, SPARK_WEEKS));
        }
      }
      if (!summaryResult.error) {
        const row = (summaryResult.data ?? [])[0] as Record<string, unknown> | undefined;
        catalogSummary = row ? Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])) : null;
      }
    }
    const { data: media, error: mediaError } = productIds.length
      ? await client
          .from("shopify_product_media")
          .select("product_id, source_url, alt_text, position")
          .eq("organization_id", organizationId)
          .in("store_id", stores.map((store) => store.id))
          .in("product_id", productIds)
          .eq("is_active", true)
          .eq("media_content_type", "IMAGE")
          .order("position", { ascending: true })
      : { data: [], error: null };
    if (mediaError && !isProductMediaSchemaMissing(mediaError)) {
      throw new Error(`shopify_catalog_product_media_failed: ${mediaError.message}`);
    }

    const primaryMediaByProduct = new Map<string, { source_url: string; alt_text: string | null }>();
    for (const item of media ?? []) {
      if (item.source_url && !primaryMediaByProduct.has(item.product_id)) {
        primaryMediaByProduct.set(item.product_id, {
          source_url: item.source_url,
          alt_text: item.alt_text,
        });
      }
    }

    return {
      ok: true as const,
      data: {
        organization_id: organizationId,
        page,
        page_size: PAGE_SIZE,
        total: metricsAvailable ? rankedTotal : count ?? 0,
        summary: catalogSummary,
        metrics_coverage: metricsCoverage,
        period_days: periodDays,
        products: ((data ?? []) as Array<Record<string, any>>).map((rawProduct) => {
          const { description_html: _descriptionHtml, ...product } = rawProduct as typeof rawProduct & { description_html?: string | null };
          return {
            ...product,
            description_text: metadataSchemaMissing ? null : shopifyProductDescriptionText(_descriptionHtml),
            tags: metadataSchemaMissing ? [] : normalizeShopifyProductTags((rawProduct as { tags?: unknown }).tags),
            shopify_category_id: metadataSchemaMissing ? null : (rawProduct as { shopify_category_id?: string | null }).shopify_category_id ?? null,
            shopify_category_name: metadataSchemaMissing ? null : (rawProduct as { shopify_category_name?: string | null }).shopify_category_name ?? null,
            metadata_coverage: metadataSchemaMissing ? "migration_pending" : (rawProduct as { metadata_coverage?: string }).metadata_coverage ?? "pending",
            primary_image_url: primaryMediaByProduct.get(product.id)?.source_url ?? null,
            primary_image_alt: primaryMediaByProduct.get(product.id)?.alt_text ?? null,
            store_name: storeById.get(product.store_id)?.shop_name ?? "Tienda Shopify",
            currency_code: storeById.get(product.store_id)?.currency_code ?? null,
            metrics: metricsByProduct.get(product.id) ?? null,
            weekly_units: weeklyByProduct.get(product.id)?.map((week) => week.units_ordered) ?? null,
          };
        }),
      },
    };
  } catch (error) {
    return { ok: false as const, statusCode: 500, error: "shopify_catalog_load_failed", detail: error instanceof Error ? error.message : "unknown_error" };
  }
}

export async function listShopifyCatalogDiscounts(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  input: CatalogQuery,
) {
  const page = pageNumber(input.page);
  if (page === null) return { ok: false as const, statusCode: 400, error: "invalid_page" };
  if (input.connectionId && !UUID_PATTERN.test(input.connectionId)) {
    return { ok: false as const, statusCode: 400, error: "invalid_connection_id" };
  }
  const status = input.status?.toUpperCase() ?? "";
  if (status && !["ACTIVE", "SCHEDULED", "EXPIRED", "DISABLED"].includes(status)) {
    return { ok: false as const, statusCode: 400, error: "invalid_discount_status" };
  }
  const sort = input.sort ?? "recent";
  if (!DISCOUNT_SORTS.has(sort)) return { ok: false as const, statusCode: 400, error: "invalid_discount_sort" };
  const filter = input.filter ?? "";
  if (filter && !DISCOUNT_FILTERS.has(filter)) return { ok: false as const, statusCode: 400, error: "invalid_discount_filter" };
  const periodDays = discountPeriodDays(input.periodDays);

  try {
    const scope = await catalogScope(env, authorization, context, organizationId, input.connectionId);
    if (!scope.ok) return scope;
    const { client, stores } = scope;
    if (!stores.length) {
      return { ok: true as const, data: { organization_id: organizationId, page, page_size: DISCOUNT_PAGE_SIZE, total: 0, discounts: [], details_coverage: "available" as const, summary: null, metrics_coverage: "observed_only" as const, period_days: periodDays } };
    }

    const start = (page - 1) * DISCOUNT_PAGE_SIZE;
    const search = input.q?.trim().slice(0, 120) ?? "";
    const escapedSearch = search.replace(/[%_,()]/g, "\\$&");
    const storesIds = stores.map((store) => store.id);

    // Resumen de la cabecera: filas ligeras de todas las promociones de la tienda
    // (son centenares como mucho), de donde salen contadores y el filtro por aviso.
    const now = new Date();
    const summaryRowsResult = await client
      .from("shopify_discounts")
      .select("id, status, ends_at, usage_count, usage_limit, configuration_coverage")
      .eq("organization_id", organizationId)
      .in("store_id", storesIds)
      .limit(5000);
    const summaryColumnsMissing = summaryRowsResult.error && isDiscountDetailsSchemaMissing(summaryRowsResult.error);
    const summaryRowsFallback = summaryColumnsMissing
      ? await client
          .from("shopify_discounts")
          .select("id, status, ends_at, usage_count, usage_limit")
          .eq("organization_id", organizationId)
          .in("store_id", storesIds)
          .limit(5000)
      : summaryRowsResult;
    if (summaryRowsFallback.error) throw new Error(`shopify_catalog_discounts_summary_failed: ${summaryRowsFallback.error.message}`);
    const summaryRows = (summaryRowsFallback.data ?? []) as unknown as DiscountSummaryRow[];
    const filterIds = filter
      ? summaryRows.filter((row) => discountAlertKinds(row, now).includes(filter)).map((row) => row.id)
      : null;

    const runQuery = (includeDetails: boolean) => {
      const columns = includeDetails
        ? "id, store_id, title, code, codes, codes_coverage, configuration_coverage, summary, rule_data, status, discount_class, value_type, value, usage_count, usage_limit, uses_per_order_limit, starts_at, ends_at, external_updated_at"
        : "id, store_id, title, code, status, discount_class, value_type, value, usage_count, usage_limit, starts_at, ends_at, external_updated_at";
      let query = client
        .from("shopify_discounts")
        .select(columns, { count: "exact" })
        .eq("organization_id", organizationId)
        .in("store_id", storesIds);
      if (status) query = query.eq("status", status);
      if (filterIds) query = query.in("id", filterIds.length ? filterIds.slice(0, 1000) : ["00000000-0000-0000-0000-000000000000"]);
      if (search) query = query.or(`title.ilike.%${escapedSearch}%,code.ilike.%${escapedSearch}%`);
      const ordered = sort === "usage"
        ? query.order("usage_count", { ascending: false })
        : sort === "ending"
          ? query.order("ends_at", { ascending: true, nullsFirst: false })
          : sort === "name"
            ? query.order("title", { ascending: true })
            : query.order("starts_at", { ascending: false, nullsFirst: false });
      return ordered
        .order("id", { ascending: true })
        .range(start, start + DISCOUNT_PAGE_SIZE - 1);
    };

    let result = await runQuery(true);
    let detailsCoverage: "available" | "migration_pending" = "available";
    if (result.error && isDiscountDetailsSchemaMissing(result.error)) {
      result = await runQuery(false);
      detailsCoverage = "migration_pending";
    }
    if (result.error) throw new Error(`shopify_catalog_discounts_failed: ${result.error.message}`);

    const pageRows = (result.data ?? []) as unknown as CatalogDiscountRow[];
    // Una sola llamada sin filtro de ids sirve a la cabecera y a las tarjetas de la pagina.
    const metrics = await loadDiscountMetrics(client, organizationId, storesIds, null, periodDays);
    const metricRows = [...metrics.byId.values()];
    const attributed = metricRows.every((row) => row.amount_coverage === "complete");

    const storeById = new Map(stores.map((store) => [store.id, store]));
    const discounts = pageRows.map((discount) => ({
      ...discount,
      codes: discount.codes ?? (discount.code ? [discount.code] : []),
      codes_coverage: discount.codes_coverage ?? "unknown",
      configuration_coverage: discount.configuration_coverage ?? (detailsCoverage === "available" ? "unknown" : "migration_pending"),
      store_name: storeById.get(discount.store_id)?.shop_name ?? "Tienda Shopify",
      currency_code: storeById.get(discount.store_id)?.currency_code ?? null,
      metrics: metrics.coverage === "observed_only" ? discountMetricsView(metrics.byId.get(discount.id)) : null,
      weekly_orders: metrics.coverage === "observed_only" ? metrics.weekly.get(discount.id) ?? Array(SPARK_WEEKS).fill(0) : null,
    }));

    return {
      ok: true as const,
      data: {
        organization_id: organizationId,
        page,
        page_size: DISCOUNT_PAGE_SIZE,
        total: result.count ?? 0,
        details_coverage: detailsCoverage,
        discounts,
        period_days: periodDays,
        metrics_coverage: metrics.coverage,
        summary: {
          total: summaryRows.length,
          active: summaryRows.filter((row) => row.status?.toUpperCase() === "ACTIVE").length,
          scheduled: summaryRows.filter((row) => row.status?.toUpperCase() === "SCHEDULED").length,
          expired: summaryRows.filter((row) => row.status?.toUpperCase() === "EXPIRED").length,
          disabled: summaryRows.filter((row) => row.status?.toUpperCase() === "DISABLED").length,
          closed: summaryRows.filter((row) => ["EXPIRED", "DISABLED"].includes(row.status?.toUpperCase() ?? "")).length,
          ending_soon: summaryRows.filter((row) => discountAlertKinds(row, now).includes("ending")).length,
          near_limit: summaryRows.filter((row) => discountAlertKinds(row, now).includes("limit")).length,
          app_managed: summaryRows.filter((row) => discountAlertKinds(row, now).includes("app")).length,
          discount_amount: metrics.coverage === "observed_only" && attributed
            ? metricRows.reduce((sum, row) => sum + Number(row.discount_amount ?? 0), 0)
            : null,
        },
      },
    };
  } catch (error) {
    return { ok: false as const, statusCode: 500, error: "shopify_catalog_discounts_load_failed", detail: error instanceof Error ? error.message : "unknown_error" };
  }
}

export async function getShopifyCatalogDiscount(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  discountId: string,
  input: Pick<CatalogQuery, "connectionId" | "page" | "targetsPage" | "periodDays">,
) {
  const page = pageNumber(input.page);
  if (page === null) return { ok: false as const, statusCode: 400, error: "invalid_page" };
  const periodDays = discountPeriodDays(input.periodDays);
  const targetsPage = pageNumber(input.targetsPage);
  if (targetsPage === null) return { ok: false as const, statusCode: 400, error: "invalid_targets_page" };
  if (!UUID_PATTERN.test(discountId)) return { ok: false as const, statusCode: 404, error: "discount_not_found" };
  if (input.connectionId && !UUID_PATTERN.test(input.connectionId)) {
    return { ok: false as const, statusCode: 400, error: "invalid_connection_id" };
  }

  try {
    const scope = await catalogScope(env, authorization, context, organizationId, input.connectionId);
    if (!scope.ok) return scope;
    const { client, stores } = scope;
    if (!stores.length) return { ok: false as const, statusCode: 404, error: "discount_not_found" };

    const storesIds = stores.map((store) => store.id);
    const runDiscountQuery = (includeDetails: boolean) => {
      const columns = includeDetails
        ? "id, store_id, title, code, codes, codes_coverage, configuration_coverage, summary, rule_data, status, discount_class, value_type, value, usage_count, usage_limit, uses_per_order_limit, starts_at, ends_at, external_updated_at"
        : "id, store_id, title, code, status, discount_class, value_type, value, usage_count, usage_limit, starts_at, ends_at, external_updated_at";
      return (client as any)
        .from("shopify_discounts")
        .select(columns)
        .eq("organization_id", organizationId)
        .in("store_id", storesIds)
        .eq("id", discountId)
        .maybeSingle();
    };
    let discountResult = await runDiscountQuery(true);
    let detailsCoverage: "available" | "migration_pending" = "available";
    if (discountResult.error && isDiscountDetailsSchemaMissing(discountResult.error)) {
      discountResult = await runDiscountQuery(false);
      detailsCoverage = "migration_pending";
    }
    if (discountResult.error) throw new Error(`shopify_catalog_discount_failed: ${discountResult.error.message}`);
    if (!discountResult.data) return { ok: false as const, statusCode: 404, error: "discount_not_found" };

    const discountStore = stores.find((store) => store.id === discountResult.data.store_id);
    const discount: CatalogDiscountRow & { store_name: string; currency_code: string | null } = {
      ...(discountResult.data as unknown as CatalogDiscountRow),
      codes: (discountResult.data as unknown as CatalogDiscountRow).codes ??
        ((discountResult.data as unknown as CatalogDiscountRow).code ? [(discountResult.data as unknown as CatalogDiscountRow).code!] : []),
      codes_coverage: (discountResult.data as unknown as CatalogDiscountRow).codes_coverage ?? "unknown",
      configuration_coverage: (discountResult.data as unknown as CatalogDiscountRow).configuration_coverage ??
        (detailsCoverage === "available" ? "unknown" : "migration_pending"),
      store_name: discountStore?.shop_name ?? "Tienda Shopify",
      currency_code: discountStore?.currency_code ?? null,
    };

    const start = (page - 1) * DISCOUNT_PAGE_SIZE;
    const targetsStart = (targetsPage - 1) * DISCOUNT_TARGET_PAGE_SIZE;
    const [targetsResult, targetCoverageResult, applicationsResult] = await Promise.all([
      client.from("shopify_discount_targets")
        .select("rule_side, target_type, external_target_id, target_title", { count: "exact" })
        .eq("organization_id", organizationId)
        .eq("store_id", discount.store_id)
        .eq("discount_id", discountId)
        .eq("is_active", true)
        .order("rule_side", { ascending: true })
        .order("target_type", { ascending: true })
        .order("external_target_id", { ascending: true })
        .range(targetsStart, targetsStart + DISCOUNT_TARGET_PAGE_SIZE - 1),
      client.from("shopify_discount_target_sync_coverage")
        .select("rule_side, status, discounts_scanned, targets_scanned, last_synced_at, error_code")
        .eq("organization_id", organizationId)
        .eq("store_id", discount.store_id),
      client.from("shopify_order_discount_applications")
        .select("id, order_id, code, title, amount, amount_coverage, position", { count: "exact" })
        .eq("organization_id", organizationId)
        .eq("store_id", discount.store_id)
        .eq("discount_id", discountId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(start, start + DISCOUNT_PAGE_SIZE - 1),
    ]);

    const targetsMissing = targetsResult.error && isDiscountTargetsSchemaMissing(targetsResult.error);
    const targetCoverageMissing = targetCoverageResult.error && isDiscountTargetsSchemaMissing(targetCoverageResult.error);
    if (targetsResult.error && !targetsMissing) throw new Error(`shopify_catalog_discount_targets_failed: ${targetsResult.error.message}`);
    if (targetCoverageResult.error && !targetCoverageMissing) throw new Error(`shopify_catalog_discount_target_coverage_failed: ${targetCoverageResult.error.message}`);

    const applicationsMissing = applicationsResult.error && (
      applicationsResult.error.code === "42P01" || applicationsResult.error.code === "PGRST205" ||
      (applicationsResult.error.code === "42703" || applicationsResult.error.code === "PGRST204") &&
        /store_id|amount_coverage/.test(applicationsResult.error.message)
    );
    if (applicationsResult.error && !applicationsMissing) {
      throw new Error(`shopify_catalog_discount_applications_failed: ${applicationsResult.error.message}`);
    }
    const applicationRows = applicationsMissing ? [] : applicationsResult.data ?? [];
    const orderIds = [...new Set(applicationRows.map((application) => application.order_id))];
    const { data: orders, error: ordersError } = orderIds.length
      ? await client.from("shopify_order_facts")
          .select("id, external_order_id, order_name, processed_at, external_created_at, currency_code")
          .eq("organization_id", organizationId)
          .eq("store_id", discount.store_id)
          .in("id", orderIds)
      : { data: [], error: null };
    if (ordersError) throw new Error(`shopify_catalog_discount_orders_failed: ${ordersError.message}`);
    const orderById = new Map((orders ?? []).map((order) => [order.id, order]));
    const applications = applicationRows.map((application) => {
      const order = orderById.get(application.order_id);
      return {
        ...application,
        order_name: order?.order_name ?? order?.external_order_id ?? null,
        order_at: order?.processed_at ?? order?.external_created_at ?? null,
        currency_code: order?.currency_code ?? discount.currency_code,
      };
    }).sort((left, right) => (right.order_at ?? "").localeCompare(left.order_at ?? ""));

    const targetsCoverage = targetsMissing || targetCoverageMissing
      ? "migration_pending"
      : targetsResult.error || targetCoverageResult.error
        ? "unavailable"
        : "available";
    const applicationCoverage = applicationsMissing
      ? "migration_pending"
      : applicationsResult.error
        ? "unavailable"
        : applications.length < (applicationsResult.count ?? 0)
          ? "partial_page"
          : "observed_only";

    const metrics = await loadDiscountMetrics(client, organizationId, [discount.store_id], [discountId], periodDays);
    const metricArgs = {
      target_organization_id: organizationId,
      target_store_id: discount.store_id,
      target_discount_id: discountId,
      target_period_start: metrics.start.toISOString(),
      target_period_end: metrics.end.toISOString(),
    };
    const [topResult, codesResult] = metrics.coverage === "observed_only"
      ? await Promise.all([
          client.rpc("shopify_discount_top_products", { ...metricArgs, result_limit: 8 }),
          client.rpc("shopify_discount_codes_usage", metricArgs),
        ])
      : [null, null];

    return {
      ok: true as const,
      data: {
        organization_id: organizationId,
        discount,
        period_days: periodDays,
        metrics_coverage: metrics.coverage,
        metrics: metrics.coverage === "observed_only" ? discountMetricsView(metrics.byId.get(discountId)) : null,
        weekly_orders: metrics.coverage === "observed_only" ? metrics.weekly.get(discountId) ?? Array(SPARK_WEEKS).fill(0) : null,
        top_products: topResult && !topResult.error
          ? (topResult.data ?? []).map((row: { product_id: string | null; title: string; units: number }) => ({ product_id: row.product_id, title: row.title, units: Number(row.units) }))
          : null,
        codes_usage: codesResult && !codesResult.error
          ? (codesResult.data ?? []).map((row: { code: string; orders_count: number; discount_amount: number | null; amount_coverage: string }) => ({
              code: row.code,
              orders: Number(row.orders_count),
              discount_amount: row.discount_amount == null ? null : Number(row.discount_amount),
              amount_coverage: row.amount_coverage,
            }))
          : null,
        details_coverage: detailsCoverage,
        targets: targetsMissing ? [] : targetsResult.data ?? [],
        targets_total: targetsMissing ? null : targetsResult.count ?? 0,
        targets_page: targetsPage,
        targets_page_size: DISCOUNT_TARGET_PAGE_SIZE,
        target_coverage: {
          status: targetsCoverage,
          by_rule_side: targetsMissing || targetCoverageMissing ? [] : targetCoverageResult.data ?? [],
        },
        applications,
        applications_coverage: applicationCoverage,
        applications_total: applicationsMissing ? null : applicationsResult.count ?? 0,
        applications_page: page,
        applications_page_size: DISCOUNT_PAGE_SIZE,
      },
    };
  } catch (error) {
    return { ok: false as const, statusCode: 500, error: "shopify_catalog_discount_load_failed", detail: error instanceof Error ? error.message : "unknown_error" };
  }
}

export async function getShopifyCatalogProduct(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
  productId: string,
  input: Pick<CatalogQuery, "connectionId" | "page" | "periodDays">,
) {
  const page = pageNumber(input.page);
  if (page === null) return { ok: false as const, statusCode: 400, error: "invalid_page" };
  const periodDays = input.periodDays === undefined ? 90 : Number(input.periodDays);
  if (![30, 90, 365].includes(periodDays)) {
    return { ok: false as const, statusCode: 400, error: "invalid_product_activity_period" };
  }
  if (!UUID_PATTERN.test(productId)) {
    return { ok: false as const, statusCode: 404, error: "product_not_found" };
  }
  if (input.connectionId && !UUID_PATTERN.test(input.connectionId)) {
    return { ok: false as const, statusCode: 400, error: "invalid_connection_id" };
  }

  try {
    const scope = await catalogScope(env, authorization, context, organizationId, input.connectionId);
    if (!scope.ok) return scope;
    const { client, stores } = scope;
    if (stores.length === 0) return { ok: false as const, statusCode: 404, error: "product_not_found" };

    const loadProduct = (withMetadata: boolean) => (client as any)
      .from("shopify_products")
      .select(withMetadata
        ? "id, store_id, external_product_id, title, handle, vendor, product_type, status, published_at, external_created_at, external_updated_at, description_html, tags, shopify_category_id, shopify_category_name, metadata_coverage"
        : "id, store_id, external_product_id, title, handle, vendor, product_type, status, published_at, external_created_at, external_updated_at")
      .eq("organization_id", organizationId)
      .in("store_id", stores.map((store) => store.id))
      .eq("id", productId)
      .maybeSingle();
    let productResult = await loadProduct(true);
    const metadataSchemaMissing = Boolean(productResult.error && isMissingShopifyProductMetadataSchema(productResult.error));
    if (metadataSchemaMissing) productResult = await loadProduct(false);
    const { data: rawProduct, error: productError } = productResult;
    if (productError) throw new Error(`shopify_catalog_product_failed: ${productError.message}`);
    if (!rawProduct) return { ok: false as const, statusCode: 404, error: "product_not_found" };
    const { description_html: _descriptionHtml, ...productFields } = rawProduct as Record<string, any>;
    const product: Record<string, any> = {
      ...productFields,
      description_text: metadataSchemaMissing ? null : shopifyProductDescriptionText(_descriptionHtml),
      tags: metadataSchemaMissing ? [] : normalizeShopifyProductTags((rawProduct as { tags?: unknown }).tags),
      shopify_category_id: metadataSchemaMissing ? null : rawProduct.shopify_category_id,
      shopify_category_name: metadataSchemaMissing ? null : rawProduct.shopify_category_name,
      metadata_coverage: metadataSchemaMissing ? "migration_pending" : rawProduct.metadata_coverage,
    };

    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const { data: activityRows, error: activityError } = await client.rpc(
      "shopify_product_variant_activity",
      {
        target_organization_id: organizationId,
        target_store_id: product.store_id,
        target_product_ids: [productId],
        target_period_start: periodStart.toISOString(),
        target_period_end: periodEnd.toISOString(),
      },
    );
    const typedActivityRows = (activityRows ?? []) as CatalogProductActivityRow[];
    const activitySchemaMissing = activityError && (
      activityError.code === "PGRST202" || activityError.code === "42883" ||
      activityError.message?.includes("shopify_product_variant_activity") === true
    );
    const bundleActivityResult = await client.rpc("shopify_product_bundle_activity", {
      target_organization_id: organizationId,
      target_store_id: product.store_id,
      target_parent_product_ids: [product.external_product_id],
      target_period_start: periodStart.toISOString(),
      target_period_end: periodEnd.toISOString(),
    });
    const bundleActivityError = bundleActivityResult.error;
    const bundleActivitySchemaMissing = bundleActivityError && (
      bundleActivityError.code === "PGRST202" || bundleActivityError.code === "42883" ||
      bundleActivityError.message?.includes("shopify_product_bundle_activity") === true
    );
    const bundleActivityRow = bundleActivityResult.data?.[0] ?? null;
    const unclassifiedBundleLines = Number(bundleActivityRow?.unclassified_line_count ?? 0);

    // Metricas de la ficha: el periodo, el anterior (para el cambio), los
    // ultimos 14 dias (ritmo actual), la serie semanal, la cobertura por
    // variante (ventas de 30 dias) y los productos que se compran juntos. Si
    // alguna falta, la ficha sigue: se dice cual, no se rellena con ceros.
    const previousStart = new Date(periodStart.getTime() - periodDays * DAY_MS);
    const recentStart = new Date(periodEnd.getTime() - 14 * DAY_MS);
    const coverStart = new Date(periodEnd.getTime() - 30 * DAY_MS);
    const metricsArgs = (from: Date, to: Date) => ({
      target_organization_id: organizationId,
      target_store_ids: [product.store_id],
      target_product_ids: [productId],
      target_period_start: from.toISOString(),
      target_period_end: to.toISOString(),
    });
    const weeksCount = Math.min(Math.ceil(periodDays / 7), 52);
    const [currentMetricsResult, previousMetricsResult, recentMetricsResult, weeklyResult, copurchaseResult, coverResult] = await Promise.all([
      client.rpc("shopify_catalog_product_metrics", metricsArgs(periodStart, periodEnd)),
      client.rpc("shopify_catalog_product_metrics", metricsArgs(previousStart, periodStart)),
      client.rpc("shopify_catalog_product_metrics", metricsArgs(recentStart, periodEnd)),
      client.rpc("shopify_catalog_product_weekly", {
        target_organization_id: organizationId,
        target_store_ids: [product.store_id],
        target_product_ids: [productId],
        target_period_end: periodEnd.toISOString(),
        weeks: weeksCount,
      }),
      client.rpc("shopify_catalog_product_copurchase", {
        target_organization_id: organizationId,
        target_store_id: product.store_id,
        target_product_id: productId,
        target_period_start: periodStart.toISOString(),
        target_period_end: periodEnd.toISOString(),
        max_rows: 5,
      }),
      client.rpc("shopify_product_variant_activity", {
        target_organization_id: organizationId,
        target_store_id: product.store_id,
        target_product_ids: [productId],
        target_period_start: coverStart.toISOString(),
        target_period_end: periodEnd.toISOString(),
      }),
    ]);
    const metricsError = currentMetricsResult.error ?? previousMetricsResult.error ?? recentMetricsResult.error ?? weeklyResult.error;
    const productMetricsCoverage: "available" | "migration_pending" | "unavailable" = !metricsError
      ? "available"
      : isCatalogMetricsSchemaMissing(metricsError) ? "migration_pending" : "unavailable";
    const currentMetricsRow = ((currentMetricsResult.data ?? []) as CatalogProductMetricsRow[])[0] ?? null;
    const previousMetricsRow = ((previousMetricsResult.data ?? []) as CatalogProductMetricsRow[])[0] ?? null;
    const recentMetricsRow = ((recentMetricsResult.data ?? []) as CatalogProductMetricsRow[])[0] ?? null;
    const coverUnitsByVariant = new Map(
      ((coverResult.data ?? []) as CatalogProductActivityRow[])
        .filter((row) => row.variant_id)
        .map((row) => [row.variant_id as string, Number(row.units_ordered)]),
    );

    const start = (page - 1) * VARIANT_PAGE_SIZE;
    const variantsWithOptions = await client
      .from("shopify_variants")
      .select("id, external_image_id, title, selected_options, barcode, current_price, compare_at_price, position, inventory_policy, is_active, external_updated_at", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("store_id", product.store_id)
      .eq("product_id", productId)
      .order("position", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + VARIANT_PAGE_SIZE - 1);
    const selectedOptionsSchemaMissing = Boolean(variantsWithOptions.error && isSelectedOptionsSchemaMissing(variantsWithOptions.error));
    const variantsResult = selectedOptionsSchemaMissing
      ? await client
          .from("shopify_variants")
          .select("id, external_image_id, title, barcode, current_price, compare_at_price, position, inventory_policy, is_active, external_updated_at", { count: "exact" })
          .eq("organization_id", organizationId)
          .eq("store_id", product.store_id)
          .eq("product_id", productId)
          .order("position", { ascending: true })
          .order("id", { ascending: true })
          .range(start, start + VARIANT_PAGE_SIZE - 1)
      : variantsWithOptions;
    const count = variantsResult.count;
    const variantsError = variantsResult.error;
    if (variantsError) throw new Error(`shopify_catalog_variants_failed: ${variantsError.message}`);
    const variants = (variantsResult.data ?? []).map((variant) => ({
      ...variant,
      selected_options: selectedOptionsSchemaMissing
        ? []
        : normalizeSelectedOptions((variant as { selected_options?: unknown }).selected_options),
    }));

    const variantIds = (variants ?? []).map((variant) => variant.id);
    const { data: inventory, error: inventoryError } = variantIds.length
      ? await client
          .from("shopify_inventory_items")
          .select("id, variant_id, sku, tracked, current_unit_cost, cost_currency_code, external_updated_at")
          .eq("organization_id", organizationId)
          .eq("store_id", product.store_id)
          .in("variant_id", variantIds)
      : { data: [], error: null };
    if (inventoryError) throw new Error(`shopify_catalog_inventory_failed: ${inventoryError.message}`);

    const inventoryItemIds = (inventory ?? []).map((item) => item.id);
    const today = new Date().toISOString().slice(0, 10);
    const { data: savedCosts, error: savedCostsError } = inventoryItemIds.length
      ? await client
          .from("product_costs")
          .select("inventory_item_id, unit_cost, currency_code, source, valid_from")
          .eq("organization_id", organizationId)
          .in("inventory_item_id", inventoryItemIds)
          .lte("valid_from", today)
          .or(`valid_until.is.null,valid_until.gte.${today}`)
          .order("valid_from", { ascending: false })
      : { data: [], error: null };
    if (savedCostsError) throw new Error(`shopify_catalog_product_costs_failed: ${savedCostsError.message}`);

    const { data: inventoryState, error: inventoryStateError } = inventoryItemIds.length
      ? await client
          .from("shopify_inventory_current_state")
          .select("inventory_item_id, location_id, available_quantity, on_hand_quantity, committed_quantity, incoming_quantity, is_active, updated_at")
          .eq("organization_id", organizationId)
          .in("inventory_item_id", inventoryItemIds)
          .eq("is_active", true)
      : { data: [], error: null };
    if (inventoryStateError && !isInventoryStateSchemaMissing(inventoryStateError)) {
      throw new Error(`shopify_catalog_inventory_levels_failed: ${inventoryStateError.message}`);
    }
    const locationIds = [...new Set((inventoryState ?? []).map((level) => level.location_id))];
    const { data: locations, error: locationsError } = locationIds.length
      ? await client
          .from("shopify_locations")
          .select("id, name")
          .eq("organization_id", organizationId)
          .eq("store_id", product.store_id)
          .in("id", locationIds)
      : { data: [], error: null };
    if (locationsError) {
      throw new Error(`shopify_catalog_locations_failed: ${locationsError.message}`);
    }

    const allVariantRefs: Array<{ id: string; external_variant_id: string; title: string | null }> = [];
    for (let offset = 0; ; offset += 1000) {
      const { data: variantRefs, error: variantRefsError } = await client
        .from("shopify_variants")
        .select("id, external_variant_id, title")
        .eq("organization_id", organizationId)
        .eq("store_id", product.store_id)
        .eq("product_id", productId)
        .order("id", { ascending: true })
        .range(offset, offset + 999);
      if (variantRefsError) throw new Error(`shopify_catalog_discount_variant_refs_failed: ${variantRefsError.message}`);
      const rows = variantRefs ?? [];
      allVariantRefs.push(...rows);
      if (rows.length < 1000) break;
    }
    const allVariantExternalIds = allVariantRefs.map((variant) => variant.external_variant_id);
    const { data: productCollectionRefs, error: productCollectionError } = await client
      .from("shopify_product_collections")
      .select("collection_id")
      .eq("organization_id", organizationId)
      .eq("product_id", productId);
    if (productCollectionError) throw new Error(`shopify_catalog_discount_collections_failed: ${productCollectionError.message}`);
    const collectionIds = [...new Set((productCollectionRefs ?? []).map((row) => row.collection_id))];
    const { data: collections, error: collectionsError } = collectionIds.length
      ? await client
          .from("shopify_collections")
          .select("external_collection_id")
          .eq("organization_id", organizationId)
          .eq("store_id", product.store_id)
          .in("id", collectionIds)
      : { data: [], error: null };
    if (collectionsError) throw new Error(`shopify_catalog_discount_collection_refs_failed: ${collectionsError.message}`);

    const queryDiscountTargets = (
      targetType: "all" | "product" | "variant" | "collection",
      targetIds: string[],
    ) => queryInBatches(targetIds, async (batch) => client
      .from("shopify_discount_targets")
      .select("discount_id, rule_side, target_type, external_target_id, target_title")
      .eq("organization_id", organizationId)
      .eq("store_id", product.store_id)
      .eq("is_active", true)
      .eq("target_type", targetType)
      .in("external_target_id", batch));
    const [allTargets, productTargets, variantTargets, collectionTargets] = await Promise.all([
      queryDiscountTargets("all", ["all"]),
      queryDiscountTargets("product", [product.external_product_id]),
      queryDiscountTargets("variant", allVariantExternalIds),
      queryDiscountTargets("collection", (collections ?? []).map((collection) => collection.external_collection_id)),
    ]);
    const targetResults = [allTargets, productTargets, variantTargets, collectionTargets];
    const missingTargetSchema = targetResults.some((result) => result.error && isDiscountTargetsSchemaMissing(result.error));
    const targetReadError = targetResults.find((result) => result.error && !isDiscountTargetsSchemaMissing(result.error))?.error;
    if (targetReadError) throw new Error(`shopify_catalog_discount_targets_failed: ${targetReadError.message}`);

    const { data: targetCoverage, error: targetCoverageError } = await client
      .from("shopify_discount_target_sync_coverage")
      .select("rule_side, status, discounts_scanned, targets_scanned, last_synced_at, error_code")
      .eq("organization_id", organizationId)
      .eq("store_id", product.store_id);
    if (targetCoverageError && !isDiscountTargetsSchemaMissing(targetCoverageError)) {
      throw new Error(`shopify_catalog_discount_coverage_failed: ${targetCoverageError.message}`);
    }

    const { data: media, error: mediaError } = await client
      .from("shopify_product_media")
      .select("external_media_id, source_url, alt_text, width, height, position")
      .eq("organization_id", organizationId)
      .eq("store_id", product.store_id)
      .eq("product_id", productId)
      .eq("is_active", true)
      .eq("media_content_type", "IMAGE")
      .order("position", { ascending: true });
    if (mediaError && !isProductMediaSchemaMissing(mediaError)) {
      throw new Error(`shopify_catalog_product_media_failed: ${mediaError.message}`);
    }
    const productMedia = mediaError ? [] : media ?? [];
    const { data: mediaCoverageRow, error: mediaCoverageError } = await client
      .from("shopify_product_media_sync_coverage")
      .select("status, products_scanned, images_scanned, last_attempt_at, last_successful_full_sync_at, error_code")
      .eq("organization_id", organizationId)
      .eq("store_id", product.store_id)
      .maybeSingle();
    const mediaCoverageStatus = mediaError || (mediaCoverageError && isProductMediaCoverageSchemaMissing(mediaCoverageError))
      ? "migration_pending"
      : mediaCoverageError
        ? "unavailable"
        : mediaCoverageRow?.status ?? "pending";

    const bundleComponents: CatalogBundleComponentRow[] = [];
    let bundleComponentsError: any = null;
    if (variantIds.length) {
      for (let offset = 0; ; offset += 500) {
        const result = await client
          .from("shopify_product_bundle_components")
          .select("parent_variant_id, component_variant_id, external_component_variant_id, component_quantity, verification_status")
          .eq("organization_id", organizationId)
          .eq("store_id", product.store_id)
          .eq("is_active", true)
          .in("parent_variant_id", variantIds)
          .order("parent_variant_id", { ascending: true })
          .order("external_component_variant_id", { ascending: true })
          .range(offset, offset + 499);
        if (result.error) {
          bundleComponentsError = result.error;
          break;
        }
        const page = (result.data ?? []) as CatalogBundleComponentRow[];
        bundleComponents.push(...page);
        if (page.length < 500) break;
      }
    }
    if (bundleComponentsError && !isProductBundleSchemaMissing(bundleComponentsError)) {
      throw new Error(`shopify_catalog_bundle_components_failed: ${bundleComponentsError.message}`);
    }
    const { data: bundleCoverageRow, error: bundleCoverageError } = await client
      .from("shopify_bundle_sync_coverage")
      .select("status, variants_scanned, bundle_variants_count, components_count, unresolved_components_count, last_synced_at, error_code")
      .eq("organization_id", organizationId)
      .eq("store_id", product.store_id)
      .maybeSingle();
    if (bundleCoverageError && !isProductBundleSchemaMissing(bundleCoverageError)) {
      throw new Error(`shopify_catalog_bundle_coverage_failed: ${bundleCoverageError.message}`);
    }
    const bundleVariantIds = [...new Set(
      (bundleComponents ?? [])
        .map((component) => component.component_variant_id)
        .filter((id): id is string => Boolean(id)),
    )];
    const componentVariantRefs = await queryInBatches<{ id: string; title: string | null; product_id: string }>(bundleVariantIds, async (batch) => client
      .from("shopify_variants")
      .select("id, title, product_id")
      .eq("organization_id", organizationId)
      .eq("store_id", product.store_id)
      .in("id", batch));
    if (componentVariantRefs.error) {
      throw new Error(`shopify_catalog_bundle_variants_failed: ${componentVariantRefs.error.message}`);
    }
    const componentProductIds = [...new Set((componentVariantRefs.data ?? []).map((variant) => variant.product_id))];
    const componentProductRefs = await queryInBatches<{ id: string; title: string | null }>(componentProductIds, async (batch) => client
      .from("shopify_products")
      .select("id, title")
      .eq("organization_id", organizationId)
      .eq("store_id", product.store_id)
      .in("id", batch));
    if (componentProductRefs.error) {
      throw new Error(`shopify_catalog_bundle_products_failed: ${componentProductRefs.error.message}`);
    }

    const savedCostByInventoryItemId = new Map<string, NonNullable<typeof savedCosts>[number]>();
    for (const cost of savedCosts ?? []) {
      if (!savedCostByInventoryItemId.has(cost.inventory_item_id)) {
        savedCostByInventoryItemId.set(cost.inventory_item_id, cost);
      }
    }
    const inventoryWithCosts = (inventory ?? []).map((item) => {
      const savedCost = savedCostByInventoryItemId.get(item.id);
      return {
        ...item,
        current_unit_cost: savedCost?.unit_cost ?? item.current_unit_cost,
        cost_currency_code: savedCost?.currency_code ?? item.cost_currency_code,
        cost_source: savedCost?.source ?? (item.current_unit_cost == null ? null : "shopify"),
      };
    });
    const inventoryByVariantId = new Map(inventoryWithCosts.map((item) => [item.variant_id, item]));
    const variantIdByInventoryItemId = new Map((inventory ?? []).map((item) => [item.id, item.variant_id]));
    const locationNameById = new Map((locations ?? []).map((location) => [location.id, location.name]));
    const levelsByVariantId = new Map<string, Array<{
      location_id: string;
      location_name: string;
      available_quantity: number | null;
      on_hand_quantity: number | null;
      committed_quantity: number | null;
      incoming_quantity: number | null;
      updated_at: string;
    }>>();
    for (const level of inventoryState ?? []) {
      const variantId = variantIdByInventoryItemId.get(level.inventory_item_id);
      // Location IDs are store-scoped. Discard stale or cross-store references.
      const locationName = locationNameById.get(level.location_id);
      if (!variantId || !locationName) continue;
      const rows = levelsByVariantId.get(variantId) ?? [];
      rows.push({
        location_id: level.location_id,
        location_name: locationName,
        available_quantity: level.available_quantity,
        on_hand_quantity: level.on_hand_quantity,
        committed_quantity: level.committed_quantity,
        incoming_quantity: level.incoming_quantity,
        updated_at: level.updated_at,
      });
      levelsByVariantId.set(variantId, rows);
    }
    const mediaByExternalId = new Map(productMedia.map((item) => [item.external_media_id, item]));
    const componentVariantById = new Map((componentVariantRefs.data ?? []).map((variant) => [variant.id, variant]));
    const componentProductById = new Map((componentProductRefs.data ?? []).map((componentProduct) => [componentProduct.id, componentProduct]));
    const componentsByParentVariantId = new Map<string, CatalogBundleComponentRow[]>();
    for (const component of bundleComponents) {
      const rows = componentsByParentVariantId.get(component.parent_variant_id) ?? [];
      rows.push(component);
      componentsByParentVariantId.set(component.parent_variant_id, rows);
    }
    const bundleCoverageStatus = bundleComponentsError || bundleCoverageError
      ? "migration_pending"
      : bundleCoverageRow?.status ?? "pending";
    const matchedDiscountTargets = missingTargetSchema
      ? []
      : targetResults.flatMap((result) => result.data ?? []);
    const matchedDiscountIds = [...new Set(matchedDiscountTargets.map((target) => target.discount_id))];
    const { data: matchedDiscounts, error: matchedDiscountsError } = await queryInBatches(
      matchedDiscountIds,
      async (batch) => client
        .from("shopify_discounts")
        .select("id, title, code, codes, codes_coverage, configuration_coverage, summary, status, discount_class, starts_at, ends_at")
        .eq("organization_id", organizationId)
        .eq("store_id", product.store_id)
        .in("id", batch),
    );
    if (matchedDiscountsError && !isDiscountDetailsSchemaMissing(matchedDiscountsError)) {
      throw new Error(`shopify_catalog_product_discounts_failed: ${matchedDiscountsError.message}`);
    }
    const discountById = new Map((matchedDiscounts ?? []).map((discount) => [discount.id, discount]));
    type MatchedPromotion = {
      discount: NonNullable<typeof matchedDiscounts>[number];
      rule_side: string;
      targets: Array<{ target_type: string; external_target_id: string; title: string | null }>;
    };
    const matchedOffersByKey = new Map<string, MatchedPromotion>();
    for (const target of matchedDiscountTargets) {
      const discount = discountById.get(target.discount_id);
      if (!discount) continue;
      const key = `${target.discount_id}:${target.rule_side}`;
      const offer: MatchedPromotion = matchedOffersByKey.get(key) ?? {
        discount,
        rule_side: target.rule_side,
        targets: [],
      };
      if (!offer.targets.some((item) => item.external_target_id === target.external_target_id && item.target_type === target.target_type)) {
        offer.targets.push({
          target_type: target.target_type,
          external_target_id: target.external_target_id,
          title: target.target_title,
        });
      }
      matchedOffersByKey.set(key, offer);
    }
    const matchedOffers = [...matchedOffersByKey.values()].map(({ discount, rule_side, targets }) => ({
      ...discount,
      codes: discount.codes ?? (discount.code ? [discount.code] : []),
      matched_rule_side: rule_side,
      matched_targets: targets,
    }));
    const targetCoverageBySide = new Map((targetCoverage ?? []).map((coverage) => [coverage.rule_side, coverage]));
    const discountTargetCoverageStatus = missingTargetSchema || targetCoverageError ||
      (matchedDiscountsError && isDiscountDetailsSchemaMissing(matchedDiscountsError))
      ? "migration_pending"
      : ["gets", "buys"].every((side) => targetCoverageBySide.get(side)?.status === "complete")
        ? "complete"
        : ["gets", "buys"].some((side) => targetCoverageBySide.get(side)?.status === "failed")
          ? "failed"
          : ["gets", "buys"].some((side) => targetCoverageBySide.get(side)?.status === "partial")
            ? "partial"
            : "pending";
    const primaryMedia = productMedia.find((item) => item.source_url) ?? null;
    const store = stores.find((item) => item.id === product.store_id);
    const variantRefById = new Map(allVariantRefs.map((variant) => [variant.id, variant]));
    const normalizedActivityRows = activityError
      ? []
      : typedActivityRows.map((row) => ({
          ...row,
          variant_title: row.variant_id ? variantRefById.get(row.variant_id)?.title ?? null : null,
        }));
    const activitySummary = normalizedActivityRows.reduce((summary, row) => ({
      units_ordered: summary.units_ordered + row.units_ordered,
      units_refunded: summary.units_refunded + row.units_refunded,
      last_order_at: row.last_order_at && (!summary.last_order_at || row.last_order_at > summary.last_order_at)
        ? row.last_order_at
        : summary.last_order_at,
    }), {
      units_ordered: 0,
      units_refunded: 0,
      last_order_at: null as string | null,
    });
    const activityByVariantId = new Map(
      normalizedActivityRows
        .filter((row) => row.variant_id)
        .map((row) => [row.variant_id as string, row]),
    );
    return {
      ok: true as const,
      data: {
        organization_id: organizationId,
        product: {
          ...product,
          primary_image_url: primaryMedia?.source_url ?? null,
          primary_image_alt: primaryMedia?.alt_text ?? null,
          store_name: store?.shop_name ?? "Tienda Shopify",
          currency_code: store?.currency_code ?? null,
          connection_id: store?.connection_id ?? null,
        },
        media: productMedia,
        media_coverage: mediaCoverageStatus,
        media_sync: {
          products_scanned: mediaCoverageRow?.products_scanned ?? null,
          images_scanned: mediaCoverageRow?.images_scanned ?? null,
          last_attempt_at: mediaCoverageRow?.last_attempt_at ?? null,
          last_successful_full_sync_at: mediaCoverageRow?.last_successful_full_sync_at ?? null,
          error_code: mediaCoverageRow?.error_code ?? null,
        },
        selected_options_coverage: selectedOptionsSchemaMissing ? "migration_pending" : "available",
        variants: (variants ?? []).map((variant) => {
          const image = variant.external_image_id
            ? mediaByExternalId.get(variant.external_image_id)
            : null;
          return {
            ...variant,
            image: image
              ? {
                  source_url: image.source_url,
                  alt_text: image.alt_text,
                  width: image.width,
                  height: image.height,
                }
              : null,
            inventory: inventoryByVariantId.get(variant.id) ?? null,
            inventory_levels: levelsByVariantId.get(variant.id) ?? [],
            activity: activityByVariantId.get(variant.id) ?? null,
            cover: (() => {
              const tracked = inventoryByVariantId.get(variant.id)?.tracked === true;
              const available = (levelsByVariantId.get(variant.id) ?? []).reduce((sum, level) => sum + Math.max(level.available_quantity ?? 0, 0), 0);
              const perDay = coverResult.error ? null : (coverUnitsByVariant.get(variant.id) ?? 0) / 30;
              return {
                tracked,
                available,
                units_per_day_30d: perDay,
                // Sin ventas en 30 dias no hay ritmo con el que dividir: ni "0 dias" ni "infinito".
                days_of_cover: tracked && perDay != null && perDay > 0 ? available / perDay : null,
              };
            })(),
            bundle_components: componentsByParentVariantId.has(variant.id)
              ? (componentsByParentVariantId.get(variant.id) ?? []).map((component) => {
                  const childVariant = component.component_variant_id
                    ? componentVariantById.get(component.component_variant_id)
                    : null;
                  const childProduct = childVariant
                    ? componentProductById.get(childVariant.product_id)
                    : null;
                  return {
                    component_variant_id: component.component_variant_id,
                    external_component_variant_id: component.external_component_variant_id,
                    product_title: childProduct?.title ?? null,
                    variant_title: childVariant?.title ?? null,
                    quantity: component.component_quantity,
                    verification_status: component.verification_status,
                  };
                })
              : bundleCoverageStatus === "complete"
                ? []
                : null,
          };
        }),
        bundle_coverage: {
          status: bundleCoverageStatus,
          variants_scanned: bundleCoverageRow?.variants_scanned ?? null,
          bundle_variants_count: bundleCoverageRow?.bundle_variants_count ?? null,
          components_count: bundleCoverageRow?.components_count ?? null,
          unresolved_components_count: bundleCoverageRow?.unresolved_components_count ?? null,
          last_synced_at: bundleCoverageRow?.last_synced_at ?? null,
          error_code: bundleCoverageRow?.error_code ?? null,
        },
        related_promotions: matchedOffers,
        promotion_target_coverage: {
          status: discountTargetCoverageStatus,
          by_rule_side: ["gets", "buys"].map((side) => ({
            rule_side: side,
            ...(targetCoverageBySide.get(side) ?? {}),
          })),
        },
        product_activity: {
          status: activityError
            ? activitySchemaMissing ? "migration_pending" : "unavailable"
            : "observed_only",
          coverage_note: "Solo agrega pedidos sincronizados y no garantiza el historial completo de Shopify.",
          period_days: periodDays,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          currency_code: store?.currency_code ?? null,
          ...activitySummary,
          variants: normalizedActivityRows,
        },
        bundle_parent_activity: {
          status: bundleActivityError
            ? bundleActivitySchemaMissing ? "migration_pending" : "unavailable"
            : unclassifiedBundleLines > 0 ? "partial" : "observed_only",
          period_days: periodDays,
          bundle_group_count: Number(bundleActivityRow?.bundle_group_count ?? 0),
          bundles_sold: Number(bundleActivityRow?.bundles_sold ?? 0),
          last_order_at: bundleActivityRow?.last_order_at ?? null,
          unclassified_line_count: unclassifiedBundleLines,
          coverage_note: "Cuenta cada LineItemGroup una vez y conserva las cantidades e importes en sus líneas componentes. Solo resume pedidos sincronizados.",
        },
        inventory_levels_coverage: inventoryStateError
          ? "migration_pending"
          : "available",
        metrics_coverage: productMetricsCoverage,
        product_metrics: productMetricsCoverage === "available" && currentMetricsRow
          ? {
              ...productMetricsView(currentMetricsRow),
              previous_units_ordered: previousMetricsRow ? Number(previousMetricsRow.units_ordered) : null,
              units_per_day_14d: recentMetricsRow ? Number(recentMetricsRow.units_ordered) / 14 : null,
            }
          : null,
        weekly: productMetricsCoverage === "available"
          ? fillWeekly((weeklyResult.data ?? []) as CatalogWeeklyRow[], periodEnd, weeksCount)
          : null,
        copurchase: copurchaseResult.error
          ? { status: isCatalogMetricsSchemaMissing(copurchaseResult.error) ? "migration_pending" : "unavailable", product_orders: null, items: [] }
          : {
              status: "observed_only",
              product_orders: Number((copurchaseResult.data ?? [])[0]?.product_orders ?? 0),
              items: ((copurchaseResult.data ?? []) as Array<{ other_product_id: string; other_title: string; orders_together: number; share: number | null }>).map((row) => ({
                product_id: row.other_product_id,
                title: row.other_title,
                orders_together: Number(row.orders_together),
                share: row.share == null ? null : Number(row.share),
              })),
            },
        variant_page: page,
        variant_page_size: VARIANT_PAGE_SIZE,
        variant_total: count ?? 0,
      },
    };
  } catch (error) {
    return { ok: false as const, statusCode: 500, error: "shopify_catalog_product_load_failed", detail: error instanceof Error ? error.message : "unknown_error" };
  }
}
