import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { ShopifyGraphError, shopifyGraphql } from "./shopify-client.js";
import {
  fetchBulkResult,
  groupBulkLinesByParent,
  runBulkOperation,
  type BulkLine,
} from "./shopify-bulk.js";
import { applyRefundAggregatesToOrderItems } from "./shopify-refund-aggregates.js";
import { explainShopifyError } from "./shopify-permissions.js";
import {
  ShopifyReportsScopeError,
  syncShopifySessions,
} from "./shopify-sessions.js";
import { getValidShopifyAccessToken } from "./shopify-token-store.js";
import {
  checkOperationalOrganization,
  isOperationalOrganizationError,
  assertConnectionIngestible,
} from "./operational-organization.js";

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
    unitCost?: { amount?: string | null; currencyCode?: string | null } | null;
    measurement?: {
      weight?: { value?: number | null; unit?: string | null } | null;
    } | null;
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
  tags?: string[] | null;
  returnStatus?: string | null;
  paymentGatewayNames?: string[] | null;
  risk?: { assessments?: Array<{ riskLevel?: string | null }> | null } | null;
  transactions?: Array<{
    id: string;
    kind?: string | null;
    status?: string | null;
    gateway?: string | null;
    paymentId?: string | null;
    processedAt?: string | null;
    createdAt?: string | null;
    amountSet?: { shopMoney?: { amount?: string | null; currencyCode?: string | null } | null } | null;
    fees?: Array<{ amount?: { amount?: string | null } | null }> | null;
  }> | null;
  fulfillments?: Array<{
    id: string;
    status?: string | null;
    displayStatus?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    inTransitAt?: string | null;
    deliveredAt?: string | null;
    estimatedDeliveryAt?: string | null;
    trackingInfo?: Array<{ company?: string | null; number?: string | null }> | null;
  }> | null;
  customer?: { id?: string | null; numberOfOrders?: number | null } | null;
  customerJourneySummary?: {
    customerOrderIndex?: number | null;
    daysToConversion?: number | null;
    firstVisit?: CustomerVisitLine | null;
    lastVisit?: CustomerVisitLine | null;
  } | null;
  refunds?: Array<{
    id: string;
    createdAt?: string | null;
    totalRefundedSet?: MoneySet;
  }> | null;
};

// `moments` es una connection y las operaciones bulk solo admiten cinco y a dos
// niveles: no se pide. `firstVisit`/`lastVisit` son objetos planos y caben.
type CustomerVisitLine = {
  occurredAt?: string | null;
  landingPage?: string | null;
  referrerUrl?: string | null;
  source?: string | null;
  sourceType?: string | null;
  utmParameters?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
  } | null;
};

// `discountApplications` es una connection, asi que en bulk sus nodos bajan
// como HIJOS del pedido, mezclados con las lineas, y no tienen `id` propio.
type BulkDiscountApplicationLine = BulkLine & {
  allocationMethod?: string | null;
  targetType?: string | null;
  code?: string | null;
  title?: string | null;
};

/**
 * Una linea de pedido, identificada por su GID y no por descarte.
 *
 * Positivo y no negativo a proposito: un filtro que dijera "lo que no sea un
 * descuento es una linea" meteria en `shopify_order_items` cualquier tipo de
 * hijo que Shopify añada mañana a la query, sin avisar. Y esa es la tabla que
 * sostiene todo el analisis por producto.
 */
function isLineItemChild(child: BulkLine): child is BulkLineItemLine {
  return typeof child.id === "string" && child.id.includes("/LineItem/");
}

function isDiscountApplicationChild(
  child: BulkLine,
): child is BulkDiscountApplicationLine {
  return (
    typeof (child as BulkDiscountApplicationLine).allocationMethod === "string"
  );
}

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
  defaultEmailAddress?: { marketingState?: string | null } | null;
  defaultPhoneNumber?: { marketingState?: string | null } | null;
  verifiedEmail?: boolean | null;
  locale?: string | null;
  // Sin defaultAddress a proposito: la ubicacion del cliente no la usa nadie y
  // es dato protegido de Shopify. Lo que no se pide no hay que justificarlo.
  lastOrder?: { processedAt?: string | null } | null;
};

type BulkAbandonedCheckoutLine = BulkLine & {
  abandonedCheckoutUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  completedAt?: string | null;
  lineItemsQuantity?: number | null;
  totalPriceSet?: {
    shopMoney?: { amount?: string | null; currencyCode?: string | null } | null;
  } | null;
  subtotalPriceSet?: MoneySet;
  customer?: { id: string } | null;
  shippingAddress?: { countryCodeV2?: string | null } | null;
};

type BulkAbandonedCheckoutItemLine = BulkLine & {
  title?: string | null;
  quantity?: number | null;
  variant?: { id: string } | null;
  originalUnitPriceSet?: MoneySet;
};

type BulkDiscountValue = {
  percentage?: number | null;
  amount?: { amount?: string | null } | null;
};

type BulkDiscountNodeLine = BulkLine & {
  discount?: {
    __typename?: string | null;
    title?: string | null;
    status?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    createdAt?: string | null;
    usageLimit?: number | null;
    appliesOncePerCustomer?: boolean | null;
    asyncUsageCount?: number | null;
    customerGets?: { value?: BulkDiscountValue | null } | null;
  } | null;
};

type BulkDiscountCodeLine = BulkLine & {
  code?: string | null;
};

type BulkMarketingEventLine = BulkLine & {
  type?: string | null;
  description?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  channelHandle?: string | null;
  app?: { handle?: string | null } | null;
};

type BulkCollectionLine = BulkLine & {
  title?: string | null;
  handle?: string | null;
  updatedAt?: string | null;
  ruleSet?: { appliedDisjunctively?: boolean | null } | null;
};

/**
 * Traduce el `__typename` del descuento y su valor a las tres columnas de
 * `shopify_discounts` que luego permiten decir "este codigo se llevo X".
 *
 * `discount_class` es que clase de promocion es (un envio gratis no tiene
 * importe, un 2x1 tampoco) y `value_type` como esta expresado el numero. Se
 * separan porque un free shipping sin valor y un porcentaje del 0% son cosas
 * distintas y con una sola columna se verian igual.
 */
export function classifyDiscount(
  typeName: string,
  value: BulkDiscountValue | null | undefined,
) {
  const percentage = value?.percentage;
  const fixedAmount = value?.amount?.amount;

  const valueType =
    typeof percentage === "number"
      ? "percentage"
      : fixedAmount != null
        ? "fixed_amount"
        : null;

  const discountClass = typeName.includes("FreeShipping")
    ? "free_shipping"
    : typeName.includes("Bxgy")
      ? "bxgy"
      : typeName.includes("App")
        ? "app"
        : valueType;

  return {
    discountClass,
    valueType,
    // Shopify devuelve el porcentaje como fraccion: 0.15 son 15 puntos.
    amount:
      typeof percentage === "number"
        ? percentage * 100
        : fixedAmount != null
          ? normalizeMoney(fixedAmount)
          : null,
  };
}

type BlockKey =
  | "catalog"
  | "inventory"
  | "orders"
  | "refunds"
  | "customers"
  | "sessions"
  | "abandoned_checkouts"
  | "discounts"
  | "marketing_events"
  | "collections";

type BlockState = {
  read: number;
  written: number;
  failed: number;
  error: string | null;
  /**
   * Lo que no llego pero no rompe la tienda: un permiso que el catalogo marca
   * como opcional. Se cuenta, se dice, y NO deja la conexion en error -- si no,
   * una tienda sin analitica de Shopify aparece igual de rota que una sin
   * pedidos.
   */
  warning: string | null;
};

function createBlockState(): BlockState {
  return { read: 0, written: 0, failed: 0, error: null, warning: null };
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

export function buildShopifySyncIdempotencyKey(
  syncType: string,
  syncScope: BlockKey,
  connectionId: string,
  now: string,
) {
  if (syncType === "initial_import") {
    return `${syncType}:${syncScope}:${connectionId}`;
  }
  return `${syncType}:${syncScope}:${connectionId}:${now.slice(0, 13)}`;
}

async function ensureSyncRun(
  supabase: SupabaseClient,
  connectionId: string,
  organizationId: string,
  syncType: string,
  syncScope: BlockKey,
  now: string,
) {
  const idempotencyKey = buildShopifySyncIdempotencyKey(
    syncType,
    syncScope,
    connectionId,
    now,
  );

  const { data: existing } = await supabase
    .from("integration_sync_runs")
    .select("id, status")
    .eq("provider", "shopify")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id as string,
      alreadySucceeded: existing.status === "succeeded",
    };
  }

  const { data, error } = await supabase
    .from("integration_sync_runs")
    .insert({
      connection_id: connectionId,
      organization_id: organizationId,
      provider: "shopify",
      sync_type: syncType,
      sync_scope: syncScope,
      status: "running",
      idempotency_key: idempotencyKey,
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
        idempotency_key: idempotencyKey,
        started_at: now,
        records_read: 0,
        records_written: 0,
        records_failed: 0,
      })
      .select("id")
      .single();

    if (fallback.error || !fallback.data) {
      const { data: raced } = await supabase
        .from("integration_sync_runs")
        .select("id, status")
        .eq("provider", "shopify")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (raced) {
        return {
          id: raced.id as string,
          alreadySucceeded: raced.status === "succeeded",
        };
      }
      throw new Error(fallback.error?.message ?? "sync_run_create_failed");
    }

    return { id: fallback.data.id as string, alreadySucceeded: false };
  }

  if (error || !data) {
    const { data: raced } = await supabase
      .from("integration_sync_runs")
      .select("id, status")
      .eq("provider", "shopify")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (raced) {
      return {
        id: raced.id as string,
        alreadySucceeded: raced.status === "succeeded",
      };
    }
    throw new Error(error?.message ?? "sync_run_create_failed");
  }

  return { id: data.id as string, alreadySucceeded: false };
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
    const { data } = await supabase
      .from(table)
      .select(select)
      .in(filterColumn, batch);
    if (data) {
      results.push(...(data as T[]));
    }
  }

  return results;
}

/**
 * Lanza una query bulk con los campos nuevos y, si Shopify la rechaza por su
 * forma, la repite pidiendo solo lo que ya funcionaba.
 *
 * Se reintenta en dos casos, y solo en esos dos: `userErrors` del validador de
 * bulk (limite de cinco connections y dos niveles) y un error de esquema de
 * GraphQL, que es como llega un campo que cambio entre versiones de la API.
 * Ese segundo llega sin status HTTP y sin marca de reintentable, que es lo que
 * lo distingue de un 401, un 500 o un rate limit: esos se propagan, porque
 * repetir la operacion seria pagar dos veces la misma espera para nada.
 *
 * Existe porque perder un campo nuevo es malo, pero perder los pedidos o los
 * clientes enteros por un campo nuevo es mucho peor.
 */
async function runBulkWithSchemaFallback(
  shopDomain: string,
  accessToken: string,
  buildQuery: (withExtras: boolean) => string,
  onFallback: (error: unknown) => void,
) {
  try {
    return {
      result: await runBulkOperation(shopDomain, accessToken, buildQuery(true)),
      extrasIncluded: true,
    };
  } catch (error) {
    const isQueryRejection =
      error instanceof ShopifyGraphError
        ? !error.retryable && error.externalStatus === undefined
        : error instanceof Error &&
          // Rechazo al enviar la query, o bulk que arranca y Shopify falla
          // despues por datos protegidos del cliente: en los dos casos el
          // reintento sin los campos extra es lo que salva el bloque.
          (error.message.includes("bulk_operation_start_failed") ||
            error.message.includes("bulk_operation_failed: ACCESS_DENIED"));

    if (!isQueryRejection) throw error;

    onFallback(error);

    return {
      result: await runBulkOperation(
        shopDomain,
        accessToken,
        buildQuery(false),
      ),
      extrasIncluded: false,
    };
  }
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
    .select(
      "id, organization_id, provider_account_id, provider_account_name, status, scopes, last_sync_at",
    )
    .eq("id", connectionId)
    .maybeSingle();

  if (connectionError) {
    throw new Error(connectionError.message);
  }

  if (!connection) {
    throw new Error("shopify_connection_not_found");
  }
  assertConnectionIngestible(connection.status);

  const operational = await checkOperationalOrganization(
    supabase,
    connection.organization_id,
  );
  if (isOperationalOrganizationError(operational))
    throw new Error(operational.error);

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
    sessions: createBlockState(),
    abandoned_checkouts: createBlockState(),
    discounts: createBlockState(),
    marketing_events: createBlockState(),
    collections: createBlockState(),
  };

  // Recorriendo `blocks` y no una lista aparte: son las mismas claves, y
  // mantenerlas en dos sitios es como el bloque de sesiones se quedo sin fila
  // hasta que alguien lo noto.
  const syncRuns = {} as Record<
    BlockKey,
    { id: string; alreadySucceeded: boolean }
  >;
  for (const key of Object.keys(blocks) as BlockKey[]) {
    syncRuns[key] = await ensureSyncRun(
      supabase,
      connectionId,
      connection.organization_id,
      syncType,
      key,
      now,
    );
  }

  if (Object.values(syncRuns).every((run) => run.alreadySucceeded)) {
    logger.info(
      "Shopify sync skipped because the idempotent run already succeeded",
      {
        connection_id: connectionId,
        organization_id: connection.organization_id,
        sync_type: syncType,
      },
    );
    return;
  }

  logger.info("Shopify sync started", {
    connection_id: connectionId,
    organization_id: connection.organization_id,
    shop_domain: shopDomain,
    sync_type: syncType,
  });

  await supabase
    .from("integration_connections")
    .update({
      status: "syncing",
      last_error_message: null,
      last_error_at: null,
    })
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
      organization_id: connection.organization_id,
      shop_domain: shopDomain,
      store_id: storeId,
    });
  } catch (error) {
    fatalError =
      error instanceof Error ? error.message : "shopify_store_sync_failed";
    for (const key of Object.keys(blocks) as BlockKey[]) {
      blocks[key].failed += 1;
      blocks[key].error = fatalError;
    }
  }

  if (storeId) {
    let locationMap = new Map<string, string>();

    const updatedAtCutoff =
      syncType === "incremental" ? connection.last_sync_at : null;
    const productsQueryFilter = updatedAtCutoff
      ? `(query: "updated_at:>='${updatedAtCutoff}'")`
      : "";
    const ordersQueryFilter = updatedAtCutoff
      ? `(query: "updated_at:>='${updatedAtCutoff}'")`
      : "";

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

      locationMap = new Map(
        (locationRefs ?? []).map((location) => [
          location.external_location_id,
          location.id,
        ]),
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "shopify_locations_sync_failed";
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
                        unitCost { amount currencyCode }
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
      const { topLevel: productLines, childrenByParentId } =
        groupBulkLinesByParent(lines);

      const productRows = (productLines as BulkProductLine[]).map(
        (product) => ({
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
        }),
      );

      blocks.catalog.read += productRows.length;
      await upsertBlockRows(
        supabase,
        blocks.catalog,
        "shopify_products",
        productRows,
        "store_id,external_product_id",
      );

      const productRefs = await selectAll<{
        id: string;
        external_product_id: string;
      }>(
        supabase,
        "shopify_products",
        "id, external_product_id",
        "external_product_id",
        productRows.map((row) => row.external_product_id),
      );
      const productMap = new Map(
        productRefs.map((product) => [product.external_product_id, product.id]),
      );

      if (productLines.length && !childrenByParentId.size) {
        logger.error(
          "Shopify bulk grouping produced zero child lines for a non-empty product export",
          {
            connection_id: connectionId,
            organization_id: connection.organization_id,
            shop_domain: shopDomain,
            product_lines: productLines.length,
            total_lines: lines.length,
          },
        );
      }

      const variantLines: Array<{
        productId: string;
        variant: BulkVariantLine;
      }> = [];
      for (const product of productLines as BulkProductLine[]) {
        const productId = productMap.get(product.id);
        if (!productId) {
          continue;
        }
        for (const variant of (childrenByParentId.get(product.id) ??
          []) as BulkVariantLine[]) {
          variantLines.push({ productId, variant });
        }
      }

      if (productMap.size && !variantLines.length) {
        logger.error(
          "Shopify bulk grouping found no variants for any synced product - __parentId matching likely broke",
          {
            connection_id: connectionId,
            organization_id: connection.organization_id,
            shop_domain: shopDomain,
            products_synced: productMap.size,
          },
        );
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
      await upsertBlockRows(
        supabase,
        blocks.catalog,
        "shopify_variants",
        variantRows,
        "product_id,external_variant_id",
      );

      const variantRefs = await selectAll<{
        id: string;
        external_variant_id: string;
      }>(
        supabase,
        "shopify_variants",
        "id, external_variant_id",
        "external_variant_id",
        variantRows.map((row) => row.external_variant_id),
      );
      const variantMap = new Map(
        variantRefs.map((variant) => [variant.external_variant_id, variant.id]),
      );

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
          country_code_of_origin:
            variant.inventoryItem.countryCodeOfOrigin ?? null,
          province_code_of_origin:
            variant.inventoryItem.provinceCodeOfOrigin ?? null,
          harmonized_system_code:
            variant.inventoryItem.harmonizedSystemCode ?? null,
          current_unit_cost: variant.inventoryItem.unitCost?.amount ?? null,
          cost_currency_code:
            variant.inventoryItem.unitCost?.currencyCode ?? null,
          measurement_data: variant.inventoryItem.measurement ?? null,
          external_updated_at: new Date().toISOString(),
        });

        for (const level of (childrenByParentId.get(variant.inventoryItem.id) ??
          []) as BulkInventoryLevelLine[]) {
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

      if (
        inventoryRows.length &&
        locationMap.size &&
        !inventorySnapshotRows.length
      ) {
        logger.error(
          "Shopify bulk grouping found no inventory levels despite tracked items and known locations",
          {
            connection_id: connectionId,
            organization_id: connection.organization_id,
            shop_domain: shopDomain,
            inventory_items: inventoryRows.length,
            locations_known: locationMap.size,
          },
        );
      }

      blocks.inventory.read += inventoryRows.length;
      await upsertBlockRows(
        supabase,
        blocks.inventory,
        "shopify_inventory_items",
        inventoryRows,
        "external_inventory_item_id",
      );

      const inventoryRefs = await selectAll<{
        id: string;
        external_inventory_item_id: string;
      }>(
        supabase,
        "shopify_inventory_items",
        "id, external_inventory_item_id",
        "external_inventory_item_id",
        inventoryRows.map((row) => row.external_inventory_item_id as string),
      );
      const inventoryMap = new Map(
        inventoryRefs.map((item) => [item.external_inventory_item_id, item.id]),
      );

      const resolvedSnapshotRows = inventorySnapshotRows
        .map((row) => {
          const externalInventoryItemId =
            typeof row.external_inventory_item_id === "string"
              ? row.external_inventory_item_id
              : null;
          const inventoryItemId = externalInventoryItemId
            ? inventoryMap.get(externalInventoryItemId)
            : null;
          const {
            external_inventory_item_id: _externalInventoryItemId,
            ...snapshotRow
          } = row;
          return inventoryItemId
            ? { ...snapshotRow, inventory_item_id: inventoryItemId }
            : null;
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
        organization_id: connection.organization_id,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        catalog_written: blocks.catalog.written,
        inventory_written: blocks.inventory.written,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "shopify_catalog_sync_failed";
      blocks.catalog.failed += 1;
      blocks.catalog.error = blocks.catalog.error ?? message;
      blocks.inventory.failed += 1;
      blocks.inventory.error = blocks.inventory.error ?? message;
    }

    accessToken = await getValidShopifyAccessToken(env, connectionId);

    try {
      // ADR-0006 pto 8: la documentacion no garantiza que estos bloques
      // anidados pasen el validador de operaciones bulk (limite de cinco
      // connections y dos niveles de profundidad), y no hay forma de
      // comprobarlo sin una tienda real conectada. Si Shopify rechazara la
      // query, dejarian de sincronizarse los PEDIDOS enteros -- mucho peor que
      // quedarse sin los extras. Por eso van todos detras de una bandera y se
      // reintenta una vez sin ellos, dejando constancia de que se cayeron.
      //
      // Los escalares (tags, returnStatus, paymentGatewayNames) se quedan en la
      // base: no pueden romper el validador, y separarlos evita perderlos en un
      // reintento que solo tenia que castigar a lo anidado.
      const buildOrdersQuery = (withExtras: boolean) => `{
          orders${ordersQueryFilter} {
            edges {
              node {
                ${
                  withExtras
                    ? `customerJourneySummary {
                  customerOrderIndex
                  daysToConversion
                  firstVisit {
                    occurredAt
                    landingPage
                    referrerUrl
                    source
                    sourceType
                    utmParameters { source medium campaign }
                  }
                  lastVisit { source sourceType }
                }
                risk { assessments { riskLevel } }
                transactions(first: 10) {
                  id
                  kind
                  status
                  gateway
                  paymentId
                  processedAt
                  createdAt
                  amountSet { shopMoney { amount currencyCode } }
                  fees { amount { amount } }
                }
                fulfillments(first: 10) {
                  id
                  status
                  displayStatus
                  createdAt
                  updatedAt
                  inTransitAt
                  deliveredAt
                  estimatedDeliveryAt
                  trackingInfo { company number }
                }
                discountApplications(first: 10) {
                  edges {
                    node {
                      allocationMethod
                      targetType
                      ... on DiscountCodeApplication { code }
                      ... on ManualDiscountApplication { title }
                      ... on ScriptDiscountApplication { title }
                      ... on AutomaticDiscountApplication { title }
                    }
                  }
                }`
                    : ""
                }
                tags
                returnStatus
                paymentGatewayNames
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
        }`;

      const { result: bulkResult, extrasIncluded } =
        await runBulkWithSchemaFallback(
          shopDomain,
          accessToken,
          buildOrdersQuery,
          // `error` y no `info`: la atribucion deja de llegar entera y desde
          // fuera no se distingue de "esta tienda no tiene visitas atribuidas".
          (error) =>
            logger.error(
              `Shopify rechazo los campos extra en la query bulk de pedidos de la conexion ${connectionId}; los pedidos se sincronizan sin atribucion, cobros, envios ni descuentos`,
              error,
            ),
        );

      const lines = await fetchBulkResult(bulkResult.url);
      const { topLevel: orderLines, childrenByParentId } =
        groupBulkLinesByParent(lines);

      const orderRows = (orderLines as BulkOrderLine[]).map((order) => {
      const journey = order.customerJourneySummary;
      const firstVisit = journey?.firstVisit;
      const utm = firstVisit?.utmParameters;

      return {
        organization_id: connection.organization_id,
        store_id: storeId,
        external_order_id: order.id,
        order_name: order.name,
        customer_reference_hash: order.customer?.id
          ? sha256(order.customer.id)
          : null,
        financial_status: order.displayFinancialStatus ?? null,
        fulfillment_status: order.displayFulfillmentStatus ?? null,
        source_name: order.sourceName ?? null,
        currency_code: order.currencyCode ?? null,
        presentment_currency_code: order.presentmentCurrencyCode ?? null,
        gross_sales: normalizeMoney(
          order.currentSubtotalPriceSet?.shopMoney?.amount,
        ),
        discounts: normalizeMoney(
          order.currentTotalDiscountsSet?.shopMoney?.amount,
        ),
        refunds:
          order.refunds?.reduce(
            (total, refund) =>
              total +
              normalizeMoney(refund.totalRefundedSet?.shopMoney?.amount),
            0,
          ) ?? 0,
        net_sales:
          normalizeMoney(order.currentTotalPriceSet?.shopMoney?.amount) -
          (order.refunds?.reduce(
            (total, refund) =>
              total +
              normalizeMoney(refund.totalRefundedSet?.shopMoney?.amount),
            0,
          ) ?? 0),
        current_subtotal_price: normalizeMoney(
          order.currentSubtotalPriceSet?.shopMoney?.amount,
        ),
        current_shipping_price: normalizeMoney(
          order.totalShippingPriceSet?.shopMoney?.amount,
        ),
        current_total_tax: normalizeMoney(
          order.currentTotalTaxSet?.shopMoney?.amount,
        ),
        current_total_price: normalizeMoney(
          order.currentTotalPriceSet?.shopMoney?.amount,
        ),
        total_items: (
          (childrenByParentId.get(order.id) ?? []) as BulkLineItemLine[]
        ).reduce((total, lineItem) => total + (lineItem.quantity ?? 0), 0),
        // `customer.numberOfOrders` es el total ACTUAL del cliente, no la
        // posicion de ESTE pedido: con el, los tres pedidos de quien repite
        // salian los tres a false, incluido el primero. En produccion estaba a
        // false en los 721 pedidos. `customerOrderIndex` si es la posicion.
        // Null cuando no hay atribucion: mejor sin dato que con uno falso.
        tags: order.tags ?? [],
        return_status: order.returnStatus ?? null,
        payment_gateway_names: order.paymentGatewayNames ?? [],
        // Shopify devuelve varias evaluaciones de riesgo; la del pedido es la
        // primera. Sin `?? null` un pedido sin evaluar guardaria "undefined".
        risk_level: order.risk?.assessments?.[0]?.riskLevel ?? null,
        customer_order_index: journey?.customerOrderIndex ?? null,
        is_first_customer_order:
          typeof journey?.customerOrderIndex === "number"
            ? journey.customerOrderIndex === 1
            : null,
        days_to_conversion: journey?.daysToConversion ?? null,
        // Adquisicion y cierre por separado: mezclarlas es el error clasico de
        // atribucion -- la campana que lo trajo no suele ser la que lo cerro.
        first_visit_at: firstVisit?.occurredAt ?? null,
        first_visit_source: firstVisit?.source ?? null,
        first_visit_source_type: firstVisit?.sourceType ?? null,
        first_visit_landing_page: firstVisit?.landingPage ?? null,
        first_visit_referrer_url: firstVisit?.referrerUrl ?? null,
        first_visit_utm_source: utm?.source ?? null,
        first_visit_utm_medium: utm?.medium ?? null,
        first_visit_utm_campaign: utm?.campaign ?? null,
        last_visit_source: journey?.lastVisit?.source ?? null,
        last_visit_source_type: journey?.lastVisit?.sourceType ?? null,
        is_test_order: order.test ?? false,
        external_created_at: order.createdAt ?? null,
        processed_at: order.processedAt ?? null,
        external_updated_at: order.updatedAt ?? null,
        cancelled_at: order.cancelledAt ?? null,
        cancel_reason: order.cancelReason ?? null,
      };
      });

      blocks.orders.read += orderRows.length;
      await upsertBlockRows(
        supabase,
        blocks.orders,
        "shopify_order_facts",
        orderRows,
        "store_id,external_order_id",
      );

      const orderRefs = await selectAll<{
        id: string;
        external_order_id: string;
      }>(
        supabase,
        "shopify_order_facts",
        "id, external_order_id",
        "external_order_id",
        orderRows.map((row) => row.external_order_id),
      );
      const orderMap = new Map(
        orderRefs.map((order) => [order.external_order_id, order.id]),
      );

      const lineItemsByOrderId: Array<{
        orderId: string;
        lineItem: BulkLineItemLine;
      }> = [];
      const discountApplicationsByOrderId: Array<{
        orderId: string;
        application: BulkDiscountApplicationLine;
      }> = [];
      for (const order of orderLines as BulkOrderLine[]) {
        const orderId = orderMap.get(order.id);
        if (!orderId) {
          continue;
        }
        // Solo lo que ES una linea de pedido. Desde que la query pide tambien
        // `discountApplications`, este mismo cubo trae dos tipos de hijo, y
        // meter una aplicacion de descuento en `shopify_order_items` seria
        // corromper la tabla que sostiene todo el analisis por producto.
        for (const child of childrenByParentId.get(order.id) ?? []) {
          if (isLineItemChild(child)) {
            lineItemsByOrderId.push({ orderId, lineItem: child });
          } else if (isDiscountApplicationChild(child)) {
            discountApplicationsByOrderId.push({
              orderId,
              application: child,
            });
          }
        }
      }

      if (orderMap.size && !lineItemsByOrderId.length) {
        logger.error(
          "Shopify bulk grouping found no line items for any synced order - __parentId matching likely broke",
          {
            connection_id: connectionId,
            organization_id: connection.organization_id,
            shop_domain: shopDomain,
            orders_synced: orderMap.size,
          },
        );
      }

      const lineItemVariantRefs = await selectAll<{
        id: string;
        external_variant_id: string;
        product_id: string;
      }>(
        supabase,
        "shopify_variants",
        "id, external_variant_id, product_id",
        "external_variant_id",
        [
          ...new Set(
            lineItemsByOrderId
              .map(({ lineItem }) => lineItem.variant?.id)
              .filter((id): id is string => Boolean(id)),
          ),
        ],
      );
      const lineItemVariantMap = new Map(
        lineItemVariantRefs.map((variant) => [
          variant.external_variant_id,
          variant,
        ]),
      );

      const orderItemRows = lineItemsByOrderId.map(({ orderId, lineItem }) => {
        const matchedVariant = lineItem.variant?.id
          ? lineItemVariantMap.get(lineItem.variant.id)
          : null;

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
          unit_price: normalizeMoney(
            lineItem.originalUnitPriceSet?.shopMoney?.amount,
          ),
          original_line_total: normalizeMoney(
            lineItem.originalTotalSet?.shopMoney?.amount,
          ),
          discount_total: normalizeMoney(
            lineItem.discountedTotalSet?.shopMoney?.amount,
          ),
          current_line_total: normalizeMoney(
            lineItem.originalTotalSet?.shopMoney?.amount,
          ),
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

      const orderItemRefs = await selectAll<{
        id: string;
        external_line_item_id: string;
      }>(
        supabase,
        "shopify_order_items",
        "id, external_line_item_id",
        "external_line_item_id",
        orderItemRows.map((row) => row.external_line_item_id),
      );
      const orderItemMap = new Map(
        orderItemRefs.map((item) => [item.external_line_item_id, item.id]),
      );

      const refundsByOrderId: Array<{
        orderId: string;
        currencyCode: string | null;
        refund: NonNullable<BulkOrderLine["refunds"]>[number];
      }> = [];
      for (const order of orderLines as BulkOrderLine[]) {
        const orderId = orderMap.get(order.id);
        if (!orderId) {
          continue;
        }
        for (const refund of order.refunds ?? []) {
          refundsByOrderId.push({
            orderId,
            currencyCode: order.currencyCode ?? null,
            refund,
          });
        }
      }

      const refundRows = refundsByOrderId.map(
        ({ orderId, currencyCode, refund }) => ({
          organization_id: connection.organization_id,
          order_id: orderId,
          external_refund_id: refund.id,
          total_refunded: normalizeMoney(
            refund.totalRefundedSet?.shopMoney?.amount,
          ),
          currency_code: currencyCode,
          external_created_at: refund.createdAt ?? new Date().toISOString(),
        }),
      );

      blocks.refunds.read += refundRows.length;
      await upsertBlockRows(
        supabase,
        blocks.refunds,
        "shopify_refunds",
        refundRows,
        "order_id,external_refund_id",
      );

      const refundRefs = await selectAll<{
        id: string;
        external_refund_id: string;
      }>(
        supabase,
        "shopify_refunds",
        "id, external_refund_id",
        "external_refund_id",
        refundRows.map((row) => row.external_refund_id),
      );
      const refundMap = new Map(
        refundRefs.map((refund) => [refund.external_refund_id, refund.id]),
      );

      const refundItemRows: Array<Record<string, unknown>> = [];
      for (const { refund } of refundsByOrderId) {
        const refundId = refundMap.get(refund.id);
        if (!refundId) {
          continue;
        }

        for (const refundLineItem of (childrenByParentId.get(refund.id) ??
          []) as BulkRefundLineItemLine[]) {
          const lineItemId = refundLineItem.lineItem?.id
            ? orderItemMap.get(refundLineItem.lineItem.id)
            : null;
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
            subtotal: normalizeMoney(
              refundLineItem.subtotalSet?.shopMoney?.amount,
            ),
            total_tax: normalizeMoney(
              refundLineItem.totalTaxSet?.shopMoney?.amount,
            ),
            restock_type: null,
          });
        }
      }

      if (refundMap.size && !refundItemRows.length) {
        logger.info(
          "Shopify bulk grouping found no refund line items for any synced refund",
          {
            connection_id: connectionId,
            organization_id: connection.organization_id,
            shop_domain: shopDomain,
            refunds_synced: refundMap.size,
          },
        );
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

      // --- Cobros, envios y descuentos aplicados ---------------------------
      // Vienen dentro del mismo pedido, asi que no cuestan una llamada mas.
      // Si el reintento tuvo que quitar los extras, estos arrays llegan vacios
      // y no se escribe nada: mejor sin filas que con filas a medias.
      const transactionRows: Array<Record<string, unknown>> = [];
      const fulfillmentRows: Array<Record<string, unknown>> = [];

      for (const order of orderLines as BulkOrderLine[]) {
        const orderId = orderMap.get(order.id);
        if (!orderId) continue;

        for (const transaction of order.transactions ?? []) {
          const amount = normalizeMoney(
            transaction.amountSet?.shopMoney?.amount,
          );
          // Shopify devuelve las comisiones como lista (puede haber varias por
          // transaccion): la comision real del cobro es la suma, no la primera.
          const fee = (transaction.fees ?? []).reduce(
            (total, item) => total + normalizeMoney(item.amount?.amount),
            0,
          );

          transactionRows.push({
            organization_id: connection.organization_id,
            store_id: storeId,
            order_id: orderId,
            external_transaction_id: transaction.id,
            kind: transaction.kind ?? null,
            status: transaction.status ?? null,
            gateway: transaction.gateway ?? null,
            payment_method: transaction.paymentId ?? null,
            amount,
            currency_code:
              transaction.amountSet?.shopMoney?.currencyCode ?? null,
            fee_amount: fee,
            net_amount: amount - fee,
            processed_at: transaction.processedAt ?? null,
            external_created_at: transaction.createdAt ?? null,
          });
        }

        for (const fulfillment of order.fulfillments ?? []) {
          fulfillmentRows.push({
            organization_id: connection.organization_id,
            store_id: storeId,
            order_id: orderId,
            external_fulfillment_id: fulfillment.id,
            status: fulfillment.status ?? null,
            display_status: fulfillment.displayStatus ?? null,
            external_created_at: fulfillment.createdAt ?? null,
            in_transit_at: fulfillment.inTransitAt ?? null,
            delivered_at: fulfillment.deliveredAt ?? null,
            estimated_delivery_at: fulfillment.estimatedDeliveryAt ?? null,
            tracking_company:
              fulfillment.trackingInfo?.[0]?.company ?? null,
            tracking_numbers: (fulfillment.trackingInfo ?? [])
              .map((info) => info.number)
              .filter((number): number is string => Boolean(number)),
            external_updated_at: fulfillment.updatedAt ?? null,
          });
        }
      }

      // La posicion la fija el orden en que Shopify devuelve los descuentos del
      // pedido, y es parte de la clave: un pedido puede llevar el mismo codigo
      // aplicado a dos objetivos distintos.
      const positionByOrder = new Map<string, number>();
      const discountApplicationRows = discountApplicationsByOrderId.map(
        ({ orderId, application }) => {
          const position = positionByOrder.get(orderId) ?? 0;
          positionByOrder.set(orderId, position + 1);

          return {
            organization_id: connection.organization_id,
            order_id: orderId,
            // El enlace a `shopify_discounts` lo pone el bloque de promociones,
            // que es quien conoce los ids. Aqui se guarda el texto, que es lo
            // que sobrevive si la promocion se borra en Shopify.
            code: application.code ?? null,
            title: application.title ?? null,
            allocation_method: application.allocationMethod ?? null,
            target_type: application.targetType ?? null,
            amount: 0,
            position,
          };
        },
      );

      blocks.orders.read += transactionRows.length + fulfillmentRows.length;
      await upsertBlockRows(
        supabase,
        blocks.orders,
        "shopify_order_transactions",
        transactionRows,
        "store_id,external_transaction_id",
      );
      await upsertBlockRows(
        supabase,
        blocks.orders,
        "shopify_fulfillments",
        fulfillmentRows,
        "store_id,external_fulfillment_id",
      );
      await upsertBlockRows(
        supabase,
        blocks.orders,
        "shopify_order_discount_applications",
        discountApplicationRows,
        "order_id,position",
      );

      logger.info("Shopify orders and refunds bulk sync completed", {
        connection_id: connectionId,
        organization_id: connection.organization_id,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        orders_written: blocks.orders.written,
        refunds_written: blocks.refunds.written,
        // Si esto sale en false, la tienda se queda sin atribucion y sin
        // "primer pedido": es lo primero que hay que mirar cuando esas
        // metricas aparezcan vacias.
        extras_included: extrasIncluded,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "shopify_orders_sync_failed";
      blocks.orders.failed += 1;
      blocks.orders.error = blocks.orders.error ?? message;
      blocks.refunds.failed += 1;
      blocks.refunds.error = blocks.refunds.error ?? message;
    }

    try {
      accessToken = await getValidShopifyAccessToken(env, connectionId);
      const customersQueryFilter = updatedAtCutoff
        ? `(query: "updated_at:>='${updatedAtCutoff}'")`
        : "";
      // Consentimiento, idioma y geografia cambiaron de forma entre versiones
      // de la Admin API (`emailMarketingConsent` paso a `defaultEmailAddress`),
      // asi que van detras de la misma bandera que los extras de pedidos: si
      // esta tienda responde con otro esquema, se pierden estos campos, no los
      // clientes.
      const buildCustomersQuery = (withExtras: boolean) => `{
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
                ${
                  withExtras
                    ? `defaultEmailAddress { marketingState }
                defaultPhoneNumber { marketingState }
                verifiedEmail
                locale
                lastOrder { processedAt }`
                    : ""
                }
              }
            }
          }
        }`;

      const { result: bulkResult, extrasIncluded: customerExtrasIncluded } =
        await runBulkWithSchemaFallback(
          shopDomain,
          accessToken,
          buildCustomersQuery,
          (error) =>
            logger.error(
              `Shopify rechazo los campos extra en la query bulk de clientes de la conexion ${connectionId}; los clientes se sincronizan sin consentimiento, idioma ni geografia`,
              error,
            ),
        );

      const lines = await fetchBulkResult(bulkResult.url);
      const { topLevel: customerLines } = groupBulkLinesByParent(lines);

      const customerRows = (customerLines as BulkCustomerLine[]).map(
        (customer) => ({
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
          email_marketing_state:
            customer.defaultEmailAddress?.marketingState ?? null,
          sms_marketing_state:
            customer.defaultPhoneNumber?.marketingState ?? null,
          verified_email: customer.verifiedEmail ?? null,
          locale: customer.locale ?? null,
          last_order_at: customer.lastOrder?.processedAt ?? null,
        }),
      );

      blocks.customers.read += customerRows.length;
      await upsertBlockRows(
        supabase,
        blocks.customers,
        "shopify_customers",
        customerRows,
        "store_id,external_customer_id",
      );

      logger.info("Shopify customers bulk sync completed", {
        connection_id: connectionId,
        organization_id: connection.organization_id,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        customers_written: blocks.customers.written,
        extras_included: customerExtrasIncluded,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "shopify_customers_sync_failed";
      blocks.customers.failed += 1;
      const hasCustomersScope =
        Array.isArray(connection.scopes) &&
        connection.scopes.includes("read_customers");
      blocks.customers.error = message.includes(
        "bulk_operation_failed: ACCESS_DENIED",
      )
        ? hasCustomersScope
          ? "shopify_customers_access_denied: Shopify ha rechazado el acceso a clientes aunque la conexión tiene read_customers. La app necesita aprobación de datos protegidos de clientes en Shopify; después reautoriza la tienda en Integraciones."
          : "shopify_customers_scope_missing: la conexión no tiene read_customers. Reautoriza la tienda en Integraciones después de añadir ese permiso."
        : message;
    }

    // --- Carritos abandonados ---------------------------------------------
    // Dinero que ya dijo que si y se fue. `completedAt` es la mitad que
    // importa: sin el, un carrito que acabo en compra se contaria como perdido
    // y la tasa de recuperacion saldria siempre por los suelos.
    try {
      accessToken = await getValidShopifyAccessToken(env, connectionId);
      const checkoutsQueryFilter = updatedAtCutoff
        ? `(query: "updated_at:>='${updatedAtCutoff}'")`
        : "";
      const bulkResult = await runBulkOperation(
        shopDomain,
        accessToken,
        `{
          abandonedCheckouts${checkoutsQueryFilter} {
            edges {
              node {
                id
                abandonedCheckoutUrl
                createdAt
                updatedAt
                completedAt
                lineItemsQuantity
                totalPriceSet { shopMoney { amount currencyCode } }
                subtotalPriceSet { shopMoney { amount } }
                customer { id }
                shippingAddress { countryCodeV2 }
                lineItems {
                  edges {
                    node {
                      id
                      title
                      quantity
                      variant { id }
                      originalUnitPriceSet { shopMoney { amount } }
                    }
                  }
                }
              }
            }
          }
        }`,
      );

      const lines = await fetchBulkResult(bulkResult.url);
      const { topLevel: checkoutLines, childrenByParentId } =
        groupBulkLinesByParent(lines);

      const checkoutRows = (
        checkoutLines as BulkAbandonedCheckoutLine[]
      ).map((checkout) => ({
        organization_id: connection.organization_id,
        store_id: storeId,
        external_checkout_id: checkout.id,
        // Mismo hash que en los pedidos: es lo que permite cruzar el carrito
        // con la compra posterior sin guardar un solo dato personal.
        customer_reference_hash: checkout.customer?.id
          ? sha256(checkout.customer.id)
          : null,
        total_price: normalizeMoney(checkout.totalPriceSet?.shopMoney?.amount),
        subtotal_price: normalizeMoney(
          checkout.subtotalPriceSet?.shopMoney?.amount,
        ),
        currency_code: checkout.totalPriceSet?.shopMoney?.currencyCode ?? null,
        total_items: checkout.lineItemsQuantity ?? 0,
        completed_at: checkout.completedAt ?? null,
        recovery_url: checkout.abandonedCheckoutUrl ?? null,
        country_code: checkout.shippingAddress?.countryCodeV2 ?? null,
        external_created_at: checkout.createdAt ?? null,
        external_updated_at: checkout.updatedAt ?? null,
      }));

      blocks.abandoned_checkouts.read += checkoutRows.length;
      await upsertBlockRows(
        supabase,
        blocks.abandoned_checkouts,
        "shopify_abandoned_checkouts",
        checkoutRows,
        "store_id,external_checkout_id",
      );

      const checkoutRefs = await selectAll<{
        id: string;
        external_checkout_id: string;
      }>(
        supabase,
        "shopify_abandoned_checkouts",
        "id, external_checkout_id",
        "external_checkout_id",
        checkoutRows.map((row) => row.external_checkout_id),
      );
      const checkoutMap = new Map(
        checkoutRefs.map((row) => [row.external_checkout_id, row.id]),
      );

      const checkoutItems: Array<{
        checkoutId: string;
        item: BulkAbandonedCheckoutItemLine;
      }> = [];
      for (const checkout of checkoutLines) {
        const checkoutId = checkoutMap.get(checkout.id);
        if (!checkoutId) continue;
        for (const child of childrenByParentId.get(checkout.id) ?? []) {
          checkoutItems.push({
            checkoutId,
            item: child as BulkAbandonedCheckoutItemLine,
          });
        }
      }

      const checkoutVariantRefs = await selectAll<{
        id: string;
        external_variant_id: string;
        product_id: string;
      }>(
        supabase,
        "shopify_variants",
        "id, external_variant_id, product_id",
        "external_variant_id",
        [
          ...new Set(
            checkoutItems
              .map(({ item }) => item.variant?.id)
              .filter((id): id is string => Boolean(id)),
          ),
        ],
      );
      const checkoutVariantMap = new Map(
        checkoutVariantRefs.map((variant) => [
          variant.external_variant_id,
          variant,
        ]),
      );

      const checkoutItemRows = checkoutItems.map(({ checkoutId, item }) => {
        const matchedVariant = item.variant?.id
          ? checkoutVariantMap.get(item.variant.id)
          : null;

        return {
          organization_id: connection.organization_id,
          checkout_id: checkoutId,
          variant_id: matchedVariant?.id ?? null,
          product_id: matchedVariant?.product_id ?? null,
          external_line_item_id: item.id,
          title: item.title ?? "",
          quantity: item.quantity ?? 0,
          unit_price: normalizeMoney(
            item.originalUnitPriceSet?.shopMoney?.amount,
          ),
        };
      });

      blocks.abandoned_checkouts.read += checkoutItemRows.length;
      await upsertBlockRows(
        supabase,
        blocks.abandoned_checkouts,
        "shopify_abandoned_checkout_items",
        checkoutItemRows,
        "checkout_id,external_line_item_id",
      );

      logger.info("Shopify abandoned checkouts bulk sync completed", {
        connection_id: connectionId,
        organization_id: connection.organization_id,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        checkouts_written: blocks.abandoned_checkouts.written,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "shopify_abandoned_checkouts_sync_failed";
      blocks.abandoned_checkouts.failed += 1;
      blocks.abandoned_checkouts.error = message;
    }

    // --- Promociones -------------------------------------------------------
    // Sin filtro incremental a proposito: son pocas, cambian de estado sin que
    // `updated_at` sea fiable en todos los tipos de descuento, y el upsert
    // in-place hace que traerlas enteras cada vez no cueste filas duplicadas.
    try {
      accessToken = await getValidShopifyAccessToken(env, connectionId);
      const bulkResult = await runBulkOperation(
        shopDomain,
        accessToken,
        `{
          discountNodes {
            edges {
              node {
                id
                discount {
                  __typename
                  ... on DiscountCodeBasic {
                    title status startsAt endsAt createdAt
                    usageLimit appliesOncePerCustomer asyncUsageCount
                    codes(first: 1) { edges { node { code } } }
                    customerGets {
                      value {
                        ... on DiscountPercentage { percentage }
                        ... on DiscountAmount { amount { amount } }
                      }
                    }
                  }
                  ... on DiscountCodeBxgy {
                    title status startsAt endsAt createdAt
                    usageLimit appliesOncePerCustomer asyncUsageCount
                    codes(first: 1) { edges { node { code } } }
                  }
                  ... on DiscountCodeFreeShipping {
                    title status startsAt endsAt createdAt
                    usageLimit appliesOncePerCustomer asyncUsageCount
                    codes(first: 1) { edges { node { code } } }
                  }
                  ... on DiscountAutomaticBasic {
                    title status startsAt endsAt createdAt asyncUsageCount
                    customerGets {
                      value {
                        ... on DiscountPercentage { percentage }
                        ... on DiscountAmount { amount { amount } }
                      }
                    }
                  }
                  ... on DiscountAutomaticBxgy {
                    status startsAt endsAt createdAt asyncUsageCount
                  }
                  ... on DiscountAutomaticFreeShipping {
                    title status startsAt endsAt createdAt asyncUsageCount
                  }
                }
              }
            }
          }
        }`,
      );

      const lines = await fetchBulkResult(bulkResult.url);
      const { topLevel: discountLines, childrenByParentId } =
        groupBulkLinesByParent(lines);

      const discountRows = (discountLines as BulkDiscountNodeLine[]).map(
        (node) => {
          const discount = node.discount;
          const typeName = discount?.__typename ?? "";
          // El codigo baja como hijo de la connection `codes`, no inline. Un
          // descuento automatico no tiene ninguno, y esa es justo la
          // distincion que interesa: el automatico se lo lleva todo el mundo.
          const code =
            (childrenByParentId.get(node.id)?.[0] as BulkDiscountCodeLine)
              ?.code ?? null;

          const classified = classifyDiscount(
            typeName,
            discount?.customerGets?.value,
          );

          return {
            organization_id: connection.organization_id,
            store_id: storeId,
            external_discount_id: node.id,
            title: discount?.title ?? null,
            code,
            status: discount?.status ?? null,
            discount_class: classified.discountClass,
            value_type: classified.valueType,
            value: classified.amount,
            // `asyncUsageCount` se actualiza de forma asincrona segun la
            // propia documentacion: sirve para ordenar promociones por uso,
            // no para cuadrar contabilidad al centimo.
            usage_count: discount?.asyncUsageCount ?? 0,
            usage_limit: discount?.usageLimit ?? null,
            applies_once_per_customer:
              discount?.appliesOncePerCustomer ?? null,
            starts_at: discount?.startsAt ?? null,
            ends_at: discount?.endsAt ?? null,
            external_created_at: discount?.createdAt ?? null,
          };
        },
      );

      blocks.discounts.read += discountRows.length;
      await upsertBlockRows(
        supabase,
        blocks.discounts,
        "shopify_discounts",
        discountRows,
        "store_id,external_discount_id",
      );

      // Enganchar los descuentos ya aplicados en pedidos. El bloque de pedidos
      // guarda el texto del codigo porque es lo que sobrevive si la promocion
      // se borra; el enlace lo pone aqui, que es quien conoce los ids.
      const discountIdByCode = new Map<string, string>();
      const storedDiscounts = await selectAll<{
        id: string;
        external_discount_id: string;
        code: string | null;
      }>(
        supabase,
        "shopify_discounts",
        "id, external_discount_id, code",
        "external_discount_id",
        discountRows.map((row) => row.external_discount_id),
      );
      for (const stored of storedDiscounts) {
        if (stored.code) discountIdByCode.set(stored.code, stored.id);
      }

      for (const [code, discountId] of discountIdByCode) {
        await supabase
          .from("shopify_order_discount_applications")
          .update({ discount_id: discountId })
          .eq("organization_id", connection.organization_id)
          .eq("code", code)
          .is("discount_id", null);
      }

      logger.info("Shopify discounts bulk sync completed", {
        connection_id: connectionId,
        organization_id: connection.organization_id,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        discounts_written: blocks.discounts.written,
        codes_linked: discountIdByCode.size,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "shopify_discounts_sync_failed";
      blocks.discounts.failed += 1;
      blocks.discounts.error = message;
    }

    // --- Campañas declaradas en Shopify ------------------------------------
    try {
      accessToken = await getValidShopifyAccessToken(env, connectionId);
      // `channelHandle` y `app` son los dos campos de MarketingEvent que mas
      // se han movido entre versiones: detras de la bandera para que un
      // cambio de esquema cueste dos columnas y no las campañas enteras.
      const buildMarketingEventsQuery = (withExtras: boolean) => `{
          marketingEvents {
            edges {
              node {
                id
                type
                description
                startedAt
                endedAt
                utmSource
                utmMedium
                utmCampaign
                ${withExtras ? `channelHandle\n                app { handle }` : ""}
              }
            }
          }
        }`;

      const { result: bulkResult, extrasIncluded: eventExtrasIncluded } =
        await runBulkWithSchemaFallback(
          shopDomain,
          accessToken,
          buildMarketingEventsQuery,
          (error) =>
            logger.error(
              `Shopify rechazo channelHandle/app en la query bulk de campañas de la conexion ${connectionId}; las campañas se sincronizan sin canal ni app`,
              error,
            ),
        );

      const lines = await fetchBulkResult(bulkResult.url);
      const { topLevel: eventLines } = groupBulkLinesByParent(lines);

      const eventRows = (eventLines as BulkMarketingEventLine[]).map(
        (event) => ({
          organization_id: connection.organization_id,
          store_id: storeId,
          external_event_id: event.id,
          event_type: event.type ?? null,
          channel_handle: event.channelHandle ?? null,
          app_handle: event.app?.handle ?? null,
          description: event.description ?? null,
          // Los mismos UTM que llegan en la atribucion del pedido: es el
          // enganche que permite decir "esta campaña trajo estos pedidos".
          utm_source: event.utmSource ?? null,
          utm_medium: event.utmMedium ?? null,
          utm_campaign: event.utmCampaign ?? null,
          started_at: event.startedAt ?? null,
          ended_at: event.endedAt ?? null,
          external_created_at: event.startedAt ?? null,
        }),
      );

      blocks.marketing_events.read += eventRows.length;
      await upsertBlockRows(
        supabase,
        blocks.marketing_events,
        "shopify_marketing_events",
        eventRows,
        "store_id,external_event_id",
      );

      logger.info("Shopify marketing events bulk sync completed", {
        connection_id: connectionId,
        organization_id: connection.organization_id,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        events_written: blocks.marketing_events.written,
        extras_included: eventExtrasIncluded,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "shopify_marketing_events_sync_failed";
      blocks.marketing_events.failed += 1;
      blocks.marketing_events.error = message;
    }

    // --- Colecciones -------------------------------------------------------
    // Sin filtro incremental: hacen falta enteras para poder rehacer la tabla
    // de pertenencia, y son pocas.
    try {
      accessToken = await getValidShopifyAccessToken(env, connectionId);
      const bulkResult = await runBulkOperation(
        shopDomain,
        accessToken,
        `{
          collections {
            edges {
              node {
                id
                title
                handle
                updatedAt
                ruleSet { appliedDisjunctively }
                products { edges { node { id } } }
              }
            }
          }
        }`,
      );

      const lines = await fetchBulkResult(bulkResult.url);
      const { topLevel: collectionLines, childrenByParentId } =
        groupBulkLinesByParent(lines);

      const collectionRows = (collectionLines as BulkCollectionLine[]).map(
        (collection) => ({
          organization_id: connection.organization_id,
          store_id: storeId,
          external_collection_id: collection.id,
          title: collection.title ?? "",
          handle: collection.handle ?? null,
          // Una coleccion con reglas es automatica; una manual no tiene
          // `ruleSet`. No hace falta pedir `productsCount`: los productos
          // bajan como hijos y contarlos aqui sale exacto y gratis.
          is_automated: Boolean(collection.ruleSet),
          products_count: (childrenByParentId.get(collection.id) ?? []).length,
          external_updated_at: collection.updatedAt ?? null,
        }),
      );

      blocks.collections.read += collectionRows.length;
      await upsertBlockRows(
        supabase,
        blocks.collections,
        "shopify_collections",
        collectionRows,
        "store_id,external_collection_id",
      );

      const collectionRefs = await selectAll<{
        id: string;
        external_collection_id: string;
      }>(
        supabase,
        "shopify_collections",
        "id, external_collection_id",
        "external_collection_id",
        collectionRows.map((row) => row.external_collection_id),
      );
      const collectionMap = new Map(
        collectionRefs.map((row) => [row.external_collection_id, row.id]),
      );

      const productExternalIds = [
        ...new Set(
          collectionLines.flatMap((collection) =>
            (childrenByParentId.get(collection.id) ?? []).map(
              (child) => child.id,
            ),
          ),
        ),
      ];
      const productRefs = await selectAll<{
        id: string;
        external_product_id: string;
      }>(
        supabase,
        "shopify_products",
        "id, external_product_id",
        "external_product_id",
        productExternalIds,
      );
      const productMap = new Map(
        productRefs.map((row) => [row.external_product_id, row.id]),
      );

      const membershipRows: Array<Record<string, unknown>> = [];
      for (const collection of collectionLines) {
        const collectionId = collectionMap.get(collection.id);
        if (!collectionId) continue;
        for (const child of childrenByParentId.get(collection.id) ?? []) {
          const productId = productMap.get(child.id);
          if (!productId) continue;
          membershipRows.push({
            organization_id: connection.organization_id,
            collection_id: collectionId,
            product_id: productId,
          });
        }
      }

      // Un producto sacado de una coleccion no deja rastro en la respuesta, y
      // una pertenencia caducada falsea las ventas por categoria en silencio.
      // Como las colecciones se traen enteras, la tabla se rehace: solo se
      // borra despues de tener las filas nuevas calculadas.
      // ponytail: borrado por organizacion, no por coleccion. Si esto pasa a
      // ejecutarse por tienda dentro de una org multi-tienda, filtrar por
      // collection_id.
      if (membershipRows.length) {
        await supabase
          .from("shopify_product_collections")
          .delete()
          .eq("organization_id", connection.organization_id);
      }

      blocks.collections.read += membershipRows.length;
      await upsertBlockRows(
        supabase,
        blocks.collections,
        "shopify_product_collections",
        membershipRows,
        "product_id,collection_id",
      );

      logger.info("Shopify collections bulk sync completed", {
        connection_id: connectionId,
        organization_id: connection.organization_id,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        collections_written: blocks.collections.written,
        memberships: membershipRows.length,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "shopify_collections_sync_failed";
      blocks.collections.failed += 1;
      blocks.collections.error = message;
    }

    // Sesiones y conversión (ShopifyQL). Bloque independiente: si la conexión
    // no tiene `read_reports` falla solo este, el resto del sync sigue.
    try {
      accessToken = await getValidShopifyAccessToken(env, connectionId);
      const sessionsResult = await syncShopifySessions(supabase, {
        shopDomain,
        accessToken,
        organizationId: connection.organization_id,
        storeId,
        connectionId,
        sinceIso: updatedAtCutoff,
        hasReportsScope:
          Array.isArray(connection.scopes) &&
          connection.scopes.includes("read_reports"),
      });
      blocks.sessions.read += sessionsResult.read;
      blocks.sessions.written += sessionsResult.written;
      logger.info("Shopify sessions block finished", {
        connection_id: connectionId,
        organization_id: connection.organization_id,
        shop_domain: shopDomain,
        sessions_written: sessionsResult.written,
        warning: sessionsResult.warning,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "shopify_sessions_sync_failed";
      // Las sesiones dependen de read_reports, que es opcional (y ademas del
      // acceso a datos protegidos, que Shopify concede aparte). Sin ellas se
      // pierde la tasa de conversion, no la tienda.
      if (error instanceof ShopifyReportsScopeError) {
        blocks.sessions.warning = message;
      } else {
        blocks.sessions.failed += 1;
        blocks.sessions.error = message;
      }
    }
  }

  // Lo que la tienda concedio de verdad: sin esto, un fallo de Shopify se
  // podria confundir con un permiso que si esta concedido.
  const connectionScopes = Array.isArray(connection.scopes)
    ? (connection.scopes as string[])
    : [];

  const finishedAt = new Date().toISOString();

  for (const key of Object.keys(blocks) as BlockKey[]) {
    const block = blocks[key];
    await finishSyncRun(
      supabase,
      syncRuns[key].id,
      block.error ? "failed" : "succeeded",
      { read: block.read, written: block.written, failed: block.failed },
      // Aqui el error deja de ser interno y lo lee una persona: si Shopify
      // denego por un permiso que la tienda NO tiene, se dice cual y como
      // arreglarlo; si lo tiene, el mensaje original ya explicaba el motivo.
      block.error
        ? explainShopifyError(block.error, connectionScopes)
        : (block.warning ?? undefined),
    );
  }

  const failedBlocks = (
    Object.entries(blocks) as Array<[BlockKey, BlockState]>
  ).filter(([, block]) => block.error);

  if (failedBlocks.length) {
    const combinedError = failedBlocks
      .map(
        ([key, block]) =>
          `${key}: ${explainShopifyError(block.error ?? "", connectionScopes)}`,
      )
      .join(" | ");

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
    records_written: Object.values(blocks).reduce(
      (total, block) => total + block.written,
      0,
    ),
  });
}
