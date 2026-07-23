import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { shopifyGraphql } from "./shopify-client.js";
import { getValidShopifyAccessToken } from "./shopify-token-store.js";

type ApiEnv = LoadedApiEnv;

const logger = createLogger("shopify-count-reconcile");

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type CountComparison = {
  dataset: string;
  local: number;
  shopify: number;
  shopifyPrecision: string | undefined;
  diff: number;
};

/**
 * Compara conteos locales (DB) contra los conteos reales de Shopify Admin para
 * una conexion. `productsCount`/`ordersCount`/`customersCount` de la Admin
 * GraphQL API pueden venir con precision "AT_LEAST" en tiendas grandes -- se
 * reporta tal cual, no se asume exactitud (INT-01, criterio de cierre).
 */
export async function reconcileShopifyCounts(env: ApiEnv, connectionId: string) {
  const supabase = createServiceClient(env);

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, provider_account_id")
    .eq("id", connectionId)
    .eq("provider", "shopify")
    .maybeSingle();

  if (connectionError) {
    throw new Error(`shopify_connection_load_failed: ${connectionError.message}`);
  }

  if (!connection || !connection.provider_account_id) {
    throw new Error("shopify_connection_not_found");
  }

  const { data: store, error: storeError } = await supabase
    .from("shopify_stores")
    .select("id")
    .eq("connection_id", connectionId)
    .maybeSingle();

  if (storeError) {
    throw new Error(`shopify_store_load_failed: ${storeError.message}`);
  }

  if (!store) {
    throw new Error("shopify_store_not_found");
  }

  const accessToken = await getValidShopifyAccessToken(env, connectionId);
  const shopDomain = connection.provider_account_id;
  const organizationId = connection.organization_id;
  const storeId = store.id;

  const remote = await shopifyGraphql<{
    productsCount: { count: number; precision: string } | null;
    ordersCount: { count: number; precision: string } | null;
    customersCount: { count: number; precision: string } | null;
  }>(
    shopDomain,
    accessToken,
    `
      query ReconcileCounts {
        productsCount { count precision }
        ordersCount(query: "status:any") { count precision }
        customersCount { count precision }
      }
    `,
    {},
  );

  async function localCount(table: string, storeScoped: boolean) {
    let query = supabase.from(table).select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
    if (storeScoped) {
      query = query.eq("store_id", storeId);
    }
    const { count, error } = await query;
    if (error) {
      throw new Error(`${table}_count_failed: ${error.message}`);
    }
    return count ?? 0;
  }

  const [localProducts, localOrders, localCustomers, localRefunds] = await Promise.all([
    localCount("shopify_products", true),
    localCount("shopify_order_facts", true),
    localCount("shopify_customers", true),
    localCount("shopify_refunds", false),
  ]);

  const comparisons: CountComparison[] = [
    {
      dataset: "products",
      local: localProducts,
      shopify: remote.productsCount?.count ?? 0,
      shopifyPrecision: remote.productsCount?.precision,
      diff: localProducts - (remote.productsCount?.count ?? 0),
    },
    {
      dataset: "orders",
      local: localOrders,
      shopify: remote.ordersCount?.count ?? 0,
      shopifyPrecision: remote.ordersCount?.precision,
      diff: localOrders - (remote.ordersCount?.count ?? 0),
    },
    {
      dataset: "customers",
      local: localCustomers,
      shopify: remote.customersCount?.count ?? 0,
      shopifyPrecision: remote.customersCount?.precision,
      diff: localCustomers - (remote.customersCount?.count ?? 0),
    },
  ];

  logger.info("Shopify count reconciliation", {
    shop_domain: shopDomain,
    connection_id: connectionId,
    comparisons,
    local_refunds: localRefunds,
  });

  return { shopDomain, connectionId, comparisons, localRefunds };
}
