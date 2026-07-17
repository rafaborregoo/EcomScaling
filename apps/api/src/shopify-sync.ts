import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { shopifyGraphql } from "./shopify-client.js";
import { fetchBulkResult, groupBulkLinesByParent, runBulkOperation, type BulkLine } from "./shopify-bulk.js";
import { applyRefundAggregatesToOrderItems } from "./shopify-refund-aggregates.js";
import { getValidShopifyAccessToken } from "./shopify-token-store.js";

type ApiEnv = LoadedApiEnv;
const logger = createLogger("shopify-sync");

type ShopData = {
  shop: {
    id: string;
    name: string;
    myshopifyDomain: string;
    currencyCode: string;
    ianaTimezone: string;
    plan?: { displayName?: string | null } | null;
    primaryDomain?: { host?: string | null } | null;
    taxesIncluded?: boolean | null;
    weightUnit?: string | null;
  };
};

type LocationsData = {
  locations: {
    nodes: Array<{
      id: string;
      name: string;
      isActive: boolean;
      fulfillsOnlineOrders?: boolean | null;
      address?: Record<string, unknown> | null;
      createdAt?: string | null;
      updatedAt?: string | null;
    }>;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
};

type MoneySet = { shopMoney?: { amount?: string | null } | null } | null;

type BulkProductLine = BulkLine & {
  title: string;
  handle?: string | null;
  vendor?: string | null;
  productType?: string | null;
  status?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type BulkVariantLine = BulkLine & {
  title?: string | null;
  barcode?: string | null;
  price?: string | null;
  compareAtPrice?: string | null;
  position?: number | null;
  taxable?: boolean | null;
  inventoryPolicy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  inventoryItem?: {
    id: string;
    sku?: string | null;
    tracked?: boolean | null;
    requiresShipping?: boolean | null;
    countryCodeOfOrigin?: string | null;
    provinceCodeOfOrigin?: string | null;
    harmonizedSystemCode?: string | null;
    measurement?: { weight?: { value?: number | null; unit?: string | null } | null } | null;
  } | null;
};

type BulkInventoryLevelLine = BulkLine & {
  location: { id: string; name: string };
  quantities?: Array<{ id: string; name: string; quantity: number }> | null;
};

type BulkOrderLine = BulkLine & {
  name: string;
  createdAt?: string | null;
  processedAt?: string | null;
  updatedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  test?: boolean | null;
  sourceName?: string | null;
  displayFinancialStatus?: string | null;
  displayFulfillmentStatus?: string | null;
  currencyCode?: string | null;
  presentmentCurrencyCode?: string | null;
  currentSubtotalPriceSet?: MoneySet;
  currentTotalDiscountsSet?: MoneySet;
  totalShippingPriceSet?: MoneySet;
  currentTotalTaxSet?: MoneySet;
  currentTotalPriceSet?: MoneySet;
  customer?: { id?: string | null; numberOfOrders?: number | null } | null;
  refunds?: Array<{
    id: string;
    createdAt?: string | null;
    totalRefundedSet?: MoneySet;
  }> | null;
};

type BulkLineItemLine = BulkLine & {
  title: string;
  sku?: string | null;
  quantity?: number | null;
  currentQuantity?: number | null;
  variant?: { id: string } | null;
  originalUnitPriceSet?: MoneySet;
  discountedTotalSet?: MoneySet;
  originalTotalSet?: MoneySet;
};

type BulkRefundLineItemLine = BulkLine & {
  quantity?: number | null;
  subtotalSet?: MoneySet;
  totalTaxSet?: MoneySet;
  lineItem?: { id: string } | null;
};

type BulkCustomerLine = BulkLine & {
  numberOfOrders?: number | null;
  amountSpent?: { amount?: string | null; currencyCode?: string | null } | null;
  state?: string | null;
  tags?: string[] | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type BlockKey = "catalog" | "inventory" | "orders" | "refunds" | "customers";

type BlockState = {
  read: number;
  written: number;
  failed: number;
  error: string | null;
};

function createBlockState(): BlockState {
  return { read: 0, written: 0, failed: 0, error: null };
}

function createServiceClient(env: ApiEnv) {
  const realtimeTransport = WebSocket as any;

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: realtimeTransport,
    },
  });
}

function normalizeMoney(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.length) {
    return Number(value);
  }

  return 0;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function isMissingSyncScopeColumn(message: string) {
  return (
    message.includes("integration_sync_runs.sync_scope") ||
    (message.includes("sync_scope") && message.includes("does not exist"))
  );
}

async function ensureSyncRun(
  supabase: SupabaseClient,
  connectionId: string,
  organizationId: string,
  syncType: string,
  syncScope: BlockKey,
  now: string,
) {
  const { data, error } = await supabase
    .from("integration_sync_runs")
    .insert({
      connection_id: connectionId,
      organization_id: organizationId,
      provider: "shopify",
      sync_type: syncType,
      sync_scope: syncScope,
      status: "running",
      idempotency_key: `${syncType}:${syncScope}:${connectionId}:${now}`,
      started_at: now,
      records_read: 0,
      records_written: 0,
      records_failed: 0,
    })
    .select("id")
    .single();

  if (error && isMissingSyncScopeColumn(error.message)) {
    logger.info(
      "integration_sync_runs.sync_scope is missing; falling back to legacy sync run shape",
      {
        connectionId,
        organizationId,
        syncType,
        syncScope,
      },
    );

    const fallback = await supabase
      .from("integration_sync_runs")
      .insert({
        connection_id: connectionId,
        organization_id: organizationId,
        provider: "shopify",
        sync_type: syncType,
        status: "running",
        idempotency_key: `${syncType}:${syncScope}:${connectionId}:${now}`,
        started_at: now,
        records_read: 0,
        records_written: 0,
        records_failed: 0,
      })
      .select("id")
      .single();

    if (fallback.error || !fallback.data) {
      throw new Error(fallback.error?.message ?? "sync_run_create_failed");
    }

    return { id: fallback.data.id as string };
  }

  if (error || !data) {
    throw new Error(error?.message ?? "sync_run_create_failed");
  }

  return { id: data.id as string };
}

async function finishSyncRun(
  supabase: SupabaseClient,
  syncRunId: string,
  status: "succeeded" | "failed",
  counts: { read: number; written: number; failed: number },
  errorMessage?: string,
) {
  await supabase
    .from("integration_sync_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      records_read: counts.read,
      records_written: counts.written,
      records_failed: counts.failed,
      ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    .eq("id", syncRunId);
}

const UPSERT_BATCH_SIZE = 500;

function chunk<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

async function upsertBlockRows(
  supabase: SupabaseClient,
  block: BlockState,
  table: string,
  rows: Array<Record<string, unknown>>,
  onConflict: string,
) {
  if (!rows.length) {
    return;
  }

  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });

    if (error) {
      block.failed += batch.length;
      block.error = `${table}_upsert_failed: ${error.message}`;
      continue;
    }

    block.written += batch.length;
  }
}

async function selectAll<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  filterColumn: string,
  filterValues: string[],
): Promise<T[]> {
  if (!filterValues.length) {
    return [];
  }

  const results: T[] = [];

  for (const batch of chunk(filterValues, UPSERT_BATCH_SIZE)) {
    const { data } = await supabase.from(table).select(select).in(filterColumn, batch);
    if (data) {
      results.push(...(data as T[]));
    }
  }

  return results;
}

export async function runShopifyInitialSync(
  env: ApiEnv,
  connectionId: string,
  syncType: "initial_import" | "manual" | "incremental" = "initial_import",
) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }

  const supabase = createServiceClient(env);
  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, provider_account_id, provider_account_name, status, last_sync_at")
    .eq("id", connectionId)
    .maybeSingle();

  if (connectionError) {
    throw new Error(connectionError.message);
  }

  if (!connection) {
    throw new Error("shopify_connection_not_found");
  }

  let accessToken = await getValidShopifyAccessToken(env, connectionId);
  const shopDomain = connection.provider_account_id;

  if (!shopDomain) {
    throw new Error("shopify_domain_missing");
  }

  const now = new Date().toISOString();
  const blocks: Record<BlockKey, BlockState> = {
    catalog: createBlockState(),
    inventory: createBlockState(),
    orders: createBlockState(),
    refunds: createBlockState(),
    customers: createBlockState(),
  };

  const syncRuns: Record<BlockKey, { id: string }> = {
    catalog: await ensureSyncRun(supabase, connectionId, connection.organization_id, syncType, "catalog", now),
    inventory: await ensureSyncRun(supabase, connectionId, connection.organization_id, syncType, "inventory", now),
    orders: await ensureSyncRun(supabase, connectionId, connection.organization_id, syncType, "orders", now),
    refunds: await ensureSyncRun(supabase, connectionId, connection.organization_id, syncType, "refunds", now),
    customers: await ensureSyncRun(supabase, connectionId, connection.organization_id, syncType, "customers", now),
  };

  logger.info("Shopify sync started", {
    connection_id: connectionId,
    organization_id: connection.organization_id,
    shop_domain: shopDomain,
    sync_type: syncType,
  });

  await supabase
    .from("integration_connections")
    .update({ status: "syncing", last_error_message: null, last_error_at: null })
    .eq("id", connectionId);

  let storeId: string | null = null;
  let fatalError: string | null = null;

  try {
    const shopData = await shopifyGraphql<ShopData>(
      shopDomain,
      accessToken,
      `
        query ShopIdentity {
          shop {
            id
            name
            myshopifyDomain
            currencyCode
            ianaTimezone
            taxesIncluded
            weightUnit
            plan { displayName }
            primaryDomain { host }
          }
        }
      `,
      {},
    );

    const shop = shopData.shop;

    const { data: storeRow, error: storeError } = await supabase
      .from("shopify_stores")
      .upsert(
        {
          organization_id: connection.organization_id,
          connection_id: connection.id,
          external_shop_id: shop.id,
          myshopify_domain: shop.myshopifyDomain,
          primary_domain: shop.primaryDomain?.host ?? null,
          shop_name: shop.name,
          currency_code: shop.currencyCode,
          timezone: shop.ianaTimezone,
          plan_display_name: shop.plan?.displayName ?? null,
          weight_unit: shop.weightUnit ?? null,
          taxes_included: shop.taxesIncluded ?? null,
          is_active: true,
          external_updated_at: new Date().toISOString(),
        },
        { onConflict: "connection_id" },
      )
      .select("id")
      .single();

    if (storeError || !storeRow) {
      throw new Error(storeError?.message ?? "shopify_store_upsert_failed");
    }

    storeId = storeRow.id;
    logger.info("Shopify shop identity synced", {
      connection_id: connectionId,
      shop_domain: shopDomain,
      store_id: storeId,
    });
  } catch (error) {
    fatalError = error instanceof Error ? error.message : "shopify_store_sync_failed";
    for (const key of Object.keys(blocks) as BlockKey[]) {
      blocks[key].failed += 1;
      blocks[key].error = fatalError;
    }
  }

  if (storeId) {
    let locationMap = new Map<string, string>();

    const updatedAtCutoff = syncType === "incremental" ? connection.last_sync_at : null;
    const productsQueryFilter = updatedAtCutoff ? `(query: "updated_at:>='${updatedAtCutoff}'")` : "";
    const ordersQueryFilter = updatedAtCutoff ? `(query: "updated_at:>='${updatedAtCutoff}'")` : "";

    accessToken = await getValidShopifyAccessToken(env, connectionId);

    try {
      const locationsData = await shopifyGraphql<LocationsData>(
        shopDomain,
        accessToken,
        `
          query Locations($after: String) {
            locations(first: 50, after: $after) {
              nodes {
                id
                name
                isActive
                fulfillsOnlineOrders
                address {
                  address1
                  address2
                  city
                  country
                  countryCode
                  zip
                }
                createdAt
                updatedAt
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        `,
        { after: null },
      );

      const locationRows = locationsData.locations.nodes.map((location) => ({
        organization_id: connection.organization_id,
        store_id: storeId,
        external_location_id: location.id,
        name: location.name,
        is_active: location.isActive,
        fulfills_online_orders: location.fulfillsOnlineOrders ?? null,
        address_data: location.address ? location.address : null,
        external_created_at: location.createdAt ?? null,
        external_updated_at: location.updatedAt ?? null,
      }));

      blocks.inventory.read += locationRows.length;
      await upsertBlockRows(
        supabase,
        blocks.inventory,
        "shopify_locations",
        locationRows,
        "store_id,external_location_id",
      );

      const { data: locationRefs } = await supabase
        .from("shopify_locations")
        .select("id, external_location_id")
        .eq("store_id", storeId);

      locationMap = new Map((locationRefs ?? []).map((location) => [location.external_location_id, location.id]));
    } catch (error) {
      const message = error instanceof Error ? error.message : "shopify_locations_sync_failed";
      blocks.inventory.failed += 1;
      blocks.inventory.error = message;
    }

    try {
      const bulkResult = await runBulkOperation(
        shopDomain,
        accessToken,
        `{
          products${productsQueryFilter} {
            edges {
              node {
                id
                title
                handle
                vendor
                productType
                status
                publishedAt
                createdAt
                updatedAt
                variants {
                  edges {
                    node {
                      id
                      title
                      barcode
                      price
                      compareAtPrice
                      position
                      taxable
                      inventoryPolicy
                      createdAt
                      updatedAt
                      inventoryItem {
                        id
                        sku
                        tracked
                        requiresShipping
                        countryCodeOfOrigin
                        provinceCodeOfOrigin
                        harmonizedSystemCode
                        measurement { weight { value unit } }
                        inventoryLevels {
                          edges {
                            node {
                              id
                              location { id name }
                              quantities(names: ["available", "on_hand", "committed", "incoming"]) {
                                id
                                name
                                quantity
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }`,
      );

      const lines = await fetchBulkResult(bulkResult.url);
      const { topLevel: productLines, childrenByParentId } = groupBulkLinesByParent(lines);

      const productRows = (productLines as BulkProductLine[]).map((product) => ({
        organization_id: connection.organization_id,
        store_id: storeId,
        external_product_id: product.id,
        title: product.title,
        handle: product.handle ?? null,
        vendor: product.vendor ?? null,
        product_type: product.productType ?? null,
        status: product.status ?? null,
        published_at: product.publishedAt ?? null,
        external_created_at: product.createdAt ?? null,
        external_updated_at: product.updatedAt ?? null,
      }));

      blocks.catalog.read += productRows.length;
      await upsertBlockRows(supabase, blocks.catalog, "shopify_products", productRows, "store_id,external_product_id");

      const productRefs = await selectAll<{ id: string; external_product_id: string }>(
        supabase,
        "shopify_products",
        "id, external_product_id",
        "external_product_id",
        productRows.map((row) => row.external_product_id),
      );
      const productMap = new Map(productRefs.map((product) => [product.external_product_id, product.id]));

      if (productLines.length && !childrenByParentId.size) {
        logger.error("Shopify bulk grouping produced zero child lines for a non-empty product export", {
          connection_id: connectionId,
          shop_domain: shopDomain,
          product_lines: productLines.length,
          total_lines: lines.length,
        });
      }

      const variantLines: Array<{ productId: string; variant: BulkVariantLine }> = [];
      for (const product of productLines as BulkProductLine[]) {
        const productId = productMap.get(product.id);
        if (!productId) {
          continue;
        }
        for (const variant of (childrenByParentId.get(product.id) ?? []) as BulkVariantLine[]) {
          variantLines.push({ productId, variant });
        }
      }

      if (productMap.size && !variantLines.length) {
        logger.error("Shopify bulk grouping found no variants for any synced product - __parentId matching likely broke", {
          connection_id: connectionId,
          shop_domain: shopDomain,
          products_synced: productMap.size,
        });
      }

      const variantRows = variantLines.map(({ productId, variant }) => ({
        organization_id: connection.organization_id,
        product_id: productId,
        external_variant_id: variant.id,
        title: variant.title ?? null,
        barcode: variant.barcode ?? null,
        current_price: variant.price ?? null,
        compare_at_price: variant.compareAtPrice ?? null,
        position: variant.position ?? null,
        taxable: variant.taxable ?? null,
        inventory_policy: variant.inventoryPolicy ?? null,
        is_active: true,
        external_created_at: variant.createdAt ?? null,
        external_updated_at: variant.updatedAt ?? null,
      }));

      blocks.catalog.read += variantRows.length;
      await upsertBlockRows(supabase, blocks.catalog, "shopify_variants", variantRows, "product_id,external_variant_id");

      const variantRefs = await selectAll<{ id: string; external_variant_id: string }>(
        supabase,
        "shopify_variants",
        "id, external_variant_id",
        "external_variant_id",
        variantRows.map((row) => row.external_variant_id),
      );
      const variantMap = new Map(variantRefs.map((variant) => [variant.external_variant_id, variant.id]));

      const inventoryRows: Array<Record<string, unknown>> = [];
      const inventorySnapshotRows: Array<Record<string, unknown>> = [];

      for (const { variant } of variantLines) {
        const variantId = variantMap.get(variant.id);
        if (!variantId || !variant.inventoryItem) {
          continue;
        }

        inventoryRows.push({
          organization_id: connection.organization_id,
          variant_id: variantId,
          external_inventory_item_id: variant.inventoryItem.id,
          sku: variant.inventoryItem.sku ?? null,
          tracked: variant.inventoryItem.tracked ?? false,
          requires_shipping: variant.inventoryItem.requiresShipping ?? true,
          country_code_of_origin: variant.inventoryItem.countryCodeOfOrigin ?? null,
          province_code_of_origin: variant.inventoryItem.provinceCodeOfOrigin ?? null,
          harmonized_system_code: variant.inventoryItem.harmonizedSystemCode ?? null,
          measurement_data: variant.inventoryItem.measurement ?? null,
          external_updated_at: new Date().toISOString(),
        });

        for (const level of (childrenByParentId.get(variant.inventoryItem.id) ?? []) as BulkInventoryLevelLine[]) {
          const quantities = level.quantities ?? [];
          const quantityMap = Object.fromEntries(
            quantities.map((quantity) => [quantity.name, quantity.quantity]),
          ) as Record<string, number>;

          const locationId = locationMap.get(level.location.id);
          if (!locationId) {
            continue;
          }

          inventorySnapshotRows.push({
            organization_id: connection.organization_id,
            external_inventory_item_id: variant.inventoryItem.id,
            location_id: locationId,
            external_inventory_level_id: level.id,
            available_quantity: quantityMap.available ?? null,
            on_hand_quantity: quantityMap.on_hand ?? null,
            committed_quantity: quantityMap.committed ?? null,
            incoming_quantity: quantityMap.incoming ?? null,
            quantities_data: quantityMap,
            is_active: true,
            updated_at: new Date().toISOString(),
          });
        }
      }

      if (inventoryRows.length && locationMap.size && !inventorySnapshotRows.length) {
        logger.error("Shopify bulk grouping found no inventory levels despite tracked items and known locations", {
          connection_id: connectionId,
          shop_domain: shopDomain,
          inventory_items: inventoryRows.length,
          locations_known: locationMap.size,
        });
      }

      blocks.inventory.read += inventoryRows.length;
      await upsertBlockRows(
        supabase,
        blocks.inventory,
        "shopify_inventory_items",
        inventoryRows,
        "external_inventory_item_id",
      );

      const inventoryRefs = await selectAll<{ id: string; external_inventory_item_id: string }>(
        supabase,
        "shopify_inventory_items",
        "id, external_inventory_item_id",
        "external_inventory_item_id",
        inventoryRows.map((row) => row.external_inventory_item_id as string),
      );
      const inventoryMap = new Map(inventoryRefs.map((item) => [item.external_inventory_item_id, item.id]));

      const resolvedSnapshotRows = inventorySnapshotRows
        .map((row) => {
          const externalInventoryItemId =
            typeof row.external_inventory_item_id === "string" ? row.external_inventory_item_id : null;
          const inventoryItemId = externalInventoryItemId ? inventoryMap.get(externalInventoryItemId) : null;
          const { external_inventory_item_id: _externalInventoryItemId, ...snapshotRow } = row;
          return inventoryItemId ? { ...snapshotRow, inventory_item_id: inventoryItemId } : null;
        })
        .filter(Boolean) as Array<Record<string, unknown>>;

      blocks.inventory.read += resolvedSnapshotRows.length;
      await upsertBlockRows(
        supabase,
        blocks.inventory,
        "shopify_inventory_current_state",
        resolvedSnapshotRows,
        "inventory_item_id,location_id",
      );

      logger.info("Shopify catalog and inventory bulk sync completed", {
        connection_id: connectionId,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        catalog_written: blocks.catalog.written,
        inventory_written: blocks.inventory.written,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "shopify_catalog_sync_failed";
      blocks.catalog.failed += 1;
      blocks.catalog.error = blocks.catalog.error ?? message;
      blocks.inventory.failed += 1;
      blocks.inventory.error = blocks.inventory.error ?? message;
    }

    accessToken = await getValidShopifyAccessToken(env, connectionId);

    try {
      const bulkResult = await runBulkOperation(
        shopDomain,
        accessToken,
        `{
          orders${ordersQueryFilter} {
            edges {
              node {
                id
                name
                createdAt
                processedAt
                updatedAt
                cancelledAt
                cancelReason
                test
                sourceName
                displayFinancialStatus
                displayFulfillmentStatus
                currencyCode
                presentmentCurrencyCode
                currentSubtotalPriceSet { shopMoney { amount } }
                currentTotalDiscountsSet { shopMoney { amount } }
                totalShippingPriceSet { shopMoney { amount } }
                currentTotalTaxSet { shopMoney { amount } }
                currentTotalPriceSet { shopMoney { amount } }
                customer { id numberOfOrders }
                lineItems {
                  edges {
                    node {
                      id
                      title
                      sku
                      quantity
                      currentQuantity
                      variant { id }
                      originalUnitPriceSet { shopMoney { amount } }
                      discountedTotalSet { shopMoney { amount } }
                      originalTotalSet { shopMoney { amount } }
                    }
                  }
                }
                refunds {
                  id
                  createdAt
                  totalRefundedSet { shopMoney { amount } }
                }
              }
            }
          }
        }`,
      );

      const lines = await fetchBulkResult(bulkResult.url);
      const { topLevel: orderLines, childrenByParentId } = groupBulkLinesByParent(lines);

      const orderRows = (orderLines as BulkOrderLine[]).map((order) => ({
        organization_id: connection.organization_id,
        store_id: storeId,
        external_order_id: order.id,
        order_name: order.name,
        customer_reference_hash: order.customer?.id ? sha256(order.customer.id) : null,
        financial_status: order.displayFinancialStatus ?? null,
        fulfillment_status: order.displayFulfillmentStatus ?? null,
        source_name: order.sourceName ?? null,
        currency_code: order.currencyCode ?? null,
        presentment_currency_code: order.presentmentCurrencyCode ?? null,
        gross_sales: normalizeMoney(order.currentSubtotalPriceSet?.shopMoney?.amount),
        discounts: normalizeMoney(order.currentTotalDiscountsSet?.shopMoney?.amount),
        refunds:
          order.refunds?.reduce((total, refund) => total + normalizeMoney(refund.totalRefundedSet?.shopMoney?.amount), 0) ?? 0,
        net_sales:
          normalizeMoney(order.currentTotalPriceSet?.shopMoney?.amount) -
          (order.refunds?.reduce((total, refund) => total + normalizeMoney(refund.totalRefundedSet?.shopMoney?.amount), 0) ?? 0),
        current_subtotal_price: normalizeMoney(order.currentSubtotalPriceSet?.shopMoney?.amount),
        current_shipping_price: normalizeMoney(order.totalShippingPriceSet?.shopMoney?.amount),
        current_total_tax: normalizeMoney(order.currentTotalTaxSet?.shopMoney?.amount),
        current_total_price: normalizeMoney(order.currentTotalPriceSet?.shopMoney?.amount),
        total_items: ((childrenByParentId.get(order.id) ?? []) as BulkLineItemLine[]).reduce(
          (total, lineItem) => total + (lineItem.quantity ?? 0),
          0,
        ),
        is_first_customer_order: order.customer?.numberOfOrders === 1,
        is_test_order: order.test ?? false,
        external_created_at: order.createdAt ?? null,
        processed_at: order.processedAt ?? null,
        external_updated_at: order.updatedAt ?? null,
        cancelled_at: order.cancelledAt ?? null,
        cancel_reason: order.cancelReason ?? null,
      }));

      blocks.orders.read += orderRows.length;
      await upsertBlockRows(supabase, blocks.orders, "shopify_order_facts", orderRows, "store_id,external_order_id");

      const orderRefs = await selectAll<{ id: string; external_order_id: string }>(
        supabase,
        "shopify_order_facts",
        "id, external_order_id",
        "external_order_id",
        orderRows.map((row) => row.external_order_id),
      );
      const orderMap = new Map(orderRefs.map((order) => [order.external_order_id, order.id]));

      const lineItemsByOrderId: Array<{ orderId: string; lineItem: BulkLineItemLine }> = [];
      for (const order of orderLines as BulkOrderLine[]) {
        const orderId = orderMap.get(order.id);
        if (!orderId) {
          continue;
        }
        for (const lineItem of (childrenByParentId.get(order.id) ?? []) as BulkLineItemLine[]) {
          lineItemsByOrderId.push({ orderId, lineItem });
        }
      }

      if (orderMap.size && !lineItemsByOrderId.length) {
        logger.error("Shopify bulk grouping found no line items for any synced order - __parentId matching likely broke", {
          connection_id: connectionId,
          shop_domain: shopDomain,
          orders_synced: orderMap.size,
        });
      }

      const lineItemVariantRefs = await selectAll<{ id: string; external_variant_id: string; product_id: string }>(
        supabase,
        "shopify_variants",
        "id, external_variant_id, product_id",
        "external_variant_id",
        [...new Set(lineItemsByOrderId.map(({ lineItem }) => lineItem.variant?.id).filter((id): id is string => Boolean(id)))],
      );
      const lineItemVariantMap = new Map(lineItemVariantRefs.map((variant) => [variant.external_variant_id, variant]));

      const orderItemRows = lineItemsByOrderId.map(({ orderId, lineItem }) => {
        const matchedVariant = lineItem.variant?.id ? lineItemVariantMap.get(lineItem.variant.id) : null;

        return {
          organization_id: connection.organization_id,
          order_id: orderId,
          product_id: matchedVariant?.product_id ?? null,
          variant_id: matchedVariant?.id ?? null,
          external_line_item_id: lineItem.id,
          title: lineItem.title,
          sku_snapshot: lineItem.sku ?? null,
          vendor_snapshot: null,
          quantity_original: lineItem.quantity ?? 0,
          quantity_current: lineItem.currentQuantity ?? lineItem.quantity ?? 0,
          unit_price: normalizeMoney(lineItem.originalUnitPriceSet?.shopMoney?.amount),
          original_line_total: normalizeMoney(lineItem.originalTotalSet?.shopMoney?.amount),
          discount_total: normalizeMoney(lineItem.discountedTotalSet?.shopMoney?.amount),
          current_line_total: normalizeMoney(lineItem.originalTotalSet?.shopMoney?.amount),
          refunded_quantity: 0,
          refunded_amount: 0,
        };
      });

      blocks.orders.read += orderItemRows.length;
      await upsertBlockRows(
        supabase,
        blocks.orders,
        "shopify_order_items",
        orderItemRows,
        "order_id,external_line_item_id",
      );

      const orderItemRefs = await selectAll<{ id: string; external_line_item_id: string }>(
        supabase,
        "shopify_order_items",
        "id, external_line_item_id",
        "external_line_item_id",
        orderItemRows.map((row) => row.external_line_item_id),
      );
      const orderItemMap = new Map(orderItemRefs.map((item) => [item.external_line_item_id, item.id]));

      const refundsByOrderId: Array<{ orderId: string; currencyCode: string | null; refund: NonNullable<BulkOrderLine["refunds"]>[number] }> = [];
      for (const order of orderLines as BulkOrderLine[]) {
        const orderId = orderMap.get(order.id);
        if (!orderId) {
          continue;
        }
        for (const refund of order.refunds ?? []) {
          refundsByOrderId.push({ orderId, currencyCode: order.currencyCode ?? null, refund });
        }
      }

      const refundRows = refundsByOrderId.map(({ orderId, currencyCode, refund }) => ({
        organization_id: connection.organization_id,
        order_id: orderId,
        external_refund_id: refund.id,
        total_refunded: normalizeMoney(refund.totalRefundedSet?.shopMoney?.amount),
        currency_code: currencyCode,
        external_created_at: refund.createdAt ?? new Date().toISOString(),
      }));

      blocks.refunds.read += refundRows.length;
      await upsertBlockRows(supabase, blocks.refunds, "shopify_refunds", refundRows, "order_id,external_refund_id");

      const refundRefs = await selectAll<{ id: string; external_refund_id: string }>(
        supabase,
        "shopify_refunds",
        "id, external_refund_id",
        "external_refund_id",
        refundRows.map((row) => row.external_refund_id),
      );
      const refundMap = new Map(refundRefs.map((refund) => [refund.external_refund_id, refund.id]));

      const refundItemRows: Array<Record<string, unknown>> = [];
      for (const { refund } of refundsByOrderId) {
        const refundId = refundMap.get(refund.id);
        if (!refundId) {
          continue;
        }

        for (const refundLineItem of (childrenByParentId.get(refund.id) ?? []) as BulkRefundLineItemLine[]) {
          const lineItemId = refundLineItem.lineItem?.id ? orderItemMap.get(refundLineItem.lineItem.id) : null;
          if (!lineItemId) {
            continue;
          }

          refundItemRows.push({
            organization_id: connection.organization_id,
            refund_id: refundId,
            order_item_id: lineItemId,
            location_id: null,
            external_refund_line_item_id: refundLineItem.lineItem?.id ?? null,
            quantity: refundLineItem.quantity ?? 0,
            subtotal: normalizeMoney(refundLineItem.subtotalSet?.shopMoney?.amount),
            total_tax: normalizeMoney(refundLineItem.totalTaxSet?.shopMoney?.amount),
            restock_type: null,
          });
        }
      }

      if (refundMap.size && !refundItemRows.length) {
        logger.info("Shopify bulk grouping found no refund line items for any synced refund", {
          connection_id: connectionId,
          shop_domain: shopDomain,
          refunds_synced: refundMap.size,
        });
      }

      blocks.refunds.read += refundItemRows.length;
      await upsertBlockRows(
        supabase,
        blocks.refunds,
        "shopify_refund_items",
        refundItemRows,
        "refund_id,external_refund_line_item_id",
      );

      await applyRefundAggregatesToOrderItems(
        supabase,
        refundItemRows.map((row) => row.order_item_id as string),
      );

      logger.info("Shopify orders and refunds bulk sync completed", {
        connection_id: connectionId,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        orders_written: blocks.orders.written,
        refunds_written: blocks.refunds.written,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "shopify_orders_sync_failed";
      blocks.orders.failed += 1;
      blocks.orders.error = blocks.orders.error ?? message;
      blocks.refunds.failed += 1;
      blocks.refunds.error = blocks.refunds.error ?? message;
    }

    try {
      accessToken = await getValidShopifyAccessToken(env, connectionId);
      const customersQueryFilter = updatedAtCutoff ? `(query: "updated_at:>='${updatedAtCutoff}'")` : "";
      const bulkResult = await runBulkOperation(
        shopDomain,
        accessToken,
        `{
          customers${customersQueryFilter} {
            edges {
              node {
                id
                numberOfOrders
                amountSpent { amount currencyCode }
                state
                tags
                createdAt
                updatedAt
              }
            }
          }
        }`,
      );

      const lines = await fetchBulkResult(bulkResult.url);
      const { topLevel: customerLines } = groupBulkLinesByParent(lines);

      const customerRows = (customerLines as BulkCustomerLine[]).map((customer) => ({
        organization_id: connection.organization_id,
        store_id: storeId,
        external_customer_id: customer.id,
        customer_reference_hash: sha256(customer.id),
        number_of_orders: customer.numberOfOrders ?? 0,
        amount_spent: normalizeMoney(customer.amountSpent?.amount),
        currency_code: customer.amountSpent?.currencyCode ?? null,
        state: customer.state ?? null,
        tags: customer.tags ?? [],
        is_active: true,
        external_created_at: customer.createdAt ?? null,
        external_updated_at: customer.updatedAt ?? null,
      }));

      blocks.customers.read += customerRows.length;
      await upsertBlockRows(supabase, blocks.customers, "shopify_customers", customerRows, "store_id,external_customer_id");

      logger.info("Shopify customers bulk sync completed", {
        connection_id: connectionId,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        customers_written: blocks.customers.written,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "shopify_customers_sync_failed";
      blocks.customers.failed += 1;
      blocks.customers.error = message;
    }
  }

  const finishedAt = new Date().toISOString();

  for (const key of Object.keys(blocks) as BlockKey[]) {
    const block = blocks[key];
    await finishSyncRun(
      supabase,
      syncRuns[key].id,
      block.error ? "failed" : "succeeded",
      { read: block.read, written: block.written, failed: block.failed },
      block.error ?? undefined,
    );
  }

  const failedBlocks = (Object.entries(blocks) as Array<[BlockKey, BlockState]>).filter(([, block]) => block.error);

  if (failedBlocks.length) {
    const combinedError = failedBlocks.map(([key, block]) => `${key}: ${block.error}`).join(" | ");

    await supabase
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: finishedAt,
        last_error_message: combinedError,
        ...(storeId ? { last_sync_at: finishedAt } : {}),
      })
      .eq("id", connectionId);

    logger.error("Shopify sync finished with block failures", {
      connection_id: connectionId,
      organization_id: connection.organization_id,
      shop_domain: shopDomain,
      failed_blocks: failedBlocks.map(([key]) => key),
      error_message: combinedError,
    });

    if (fatalError) {
      throw new Error(fatalError);
    }

    return;
  }

  await supabase
    .from("integration_connections")
    .update({
      status: "connected",
      last_sync_at: finishedAt,
      last_error_message: null,
      last_error_at: null,
    })
    .eq("id", connectionId);

  logger.info("Shopify sync succeeded", {
    connection_id: connectionId,
    organization_id: connection.organization_id,
    shop_domain: shopDomain,
    records_written: Object.values(blocks).reduce((total, block) => total + block.written, 0),
  });
}
