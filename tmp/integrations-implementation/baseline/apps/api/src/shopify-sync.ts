import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import type { Json } from "@e-nora/db";
import { createLogger } from "@e-nora/observability";
import { ShopifyGraphError, shopifyGraphql } from "./shopify-client.js";
import {
  forEachBulkRootChildrenBatch,
  forEachBulkRootBatch,
  forEachBulkResultBatch,
  runBulkOperation,
  type BulkLine,
} from "./shopify-bulk.js";
import { applyRefundAggregatesToOrderItems } from "./shopify-refund-aggregates.js";
import { sumShopifyLineDiscountAllocations } from "./shopify-order-line-money.js";
import { isMissingShopifyNetMetricsSchema, withoutShopifyNetMetrics } from "./shopify-order-line-net.js";
import { aggregateShopifyDiscountAllocations, type ShopifyDiscountAllocation } from "./shopify-discount-allocations.js";
import {
  buildShopifyProductMediaRows,
  type ShopifyProductMediaLine,
} from "./shopify-product-media.js";
import { isMissingShopifyProductMetadataSchema } from "./shopify-product-metadata.js";
import { explainShopifyError } from "./shopify-permissions.js";
import { requiresIntegrationReauthorization } from "./integration-sync-retry.js";
import { mapWithConcurrency } from "./async-concurrency.js";
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
  descriptionHtml?: string | null;
  tags?: string[] | null;
  category?: { id?: string | null; name?: string | null; fullName?: string | null } | null;
  status?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type BulkVariantLine = BulkLine & {
  product?: { id?: string | null } | null;
  title?: string | null;
  selectedOptions?: Array<{ name?: string | null; value?: string | null }> | null;
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

type BulkBundleComponentLine = BulkLine & {
  quantity?: number | null;
  productVariant?: { id?: string | null } | null;
};

type BulkBundleParentVariantLine = BulkLine & {
  requiresComponents?: boolean | null;
};

type BulkInventoryLevelLine = BulkLine & {
  location: { id: string; name: string };
  quantities?: Array<{ id: string; name: string; quantity: number }> | null;
};

type BulkInventoryItemLine = BulkLine & {
  sku?: string | null;
  tracked?: boolean | null;
  requiresShipping?: boolean | null;
  countryCodeOfOrigin?: string | null;
  provinceCodeOfOrigin?: string | null;
  harmonizedSystemCode?: string | null;
  unitCost?: { amount?: string | null; currencyCode?: string | null } | null;
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
  shippingAddress?: {
    countryCodeV2?: string | null;
    provinceCode?: string | null;
  } | null;
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
  index?: number | null;
  code?: string | null;
  title?: string | null;
};

type BulkShippingLine = BulkLine & {
  discountAllocations?: ShopifyDiscountAllocation[] | null;
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
  lineItemGroup?: {
    id?: string | null;
    productId?: string | null;
    variantId?: string | null;
    quantity?: number | null;
    title?: string | null;
  } | null;
  originalUnitPriceSet?: MoneySet;
  originalTotalSet?: MoneySet;
  priceAfterAllDiscountsBeforeTaxesSet?: MoneySet;
  discountAllocations?: ShopifyDiscountAllocation[] | null;
};

function isShippingLineChild(child: BulkLine): child is BulkShippingLine {
  return typeof child.id === "string" && child.id.includes("/ShippingLine/");
}

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
    summary?: string | null;
    status?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    createdAt?: string | null;
    usageLimit?: number | null;
    appliesOncePerCustomer?: boolean | null;
    asyncUsageCount?: number | null;
    usesPerOrderLimit?: number | null;
    context?: { __typename?: string | null } | null;
    combinesWith?: {
      orderDiscounts?: boolean | null;
      productDiscounts?: boolean | null;
      shippingDiscounts?: boolean | null;
    } | null;
    minimumRequirement?: unknown;
    customerBuys?: unknown;
    customerGets?: {
      appliesOnOneTimePurchase?: boolean | null;
      appliesOnSubscription?: boolean | null;
      items?: { __typename?: string | null } | null;
      value?: BulkDiscountValue | null;
    } | null;
  } | null;
};

type BulkDiscountCodeLine = BulkLine & {
  code?: string | null;
};

type BulkDiscountTargetNodeLine = BulkLine & {
  discount?: {
    __typename?: string | null;
    customerGets?: { items?: BulkDiscountTargetItems | null } | null;
    customerBuys?: { items?: BulkDiscountTargetItems | null } | null;
  } | null;
};

type BulkDiscountTargetItems = {
  __typename?: string | null;
};

type BulkDiscountTargetLine = BulkLine & {
  title?: string | null;
  product?: { id?: string | null } | null;
};

function buildDiscountTargetBulkQuery(side: "gets" | "buys") {
  const targetItems = `items {
    __typename
    ... on DiscountProducts {
      products { edges { node { id title } } }
      productVariants { edges { node { id title product { id title } } } }
    }
    ... on DiscountCollections {
      collections { edges { node { id title } } }
    }
  }`;
  const getField = `customerGets { ${targetItems} }`;
  const buyField = `customerBuys { ${targetItems} }`;
  const typeFragments = side === "gets"
    ? `... on DiscountCodeBasic { ${getField} }
       ... on DiscountCodeBxgy { ${getField} }
       ... on DiscountAutomaticBasic { ${getField} }
       ... on DiscountAutomaticBxgy { ${getField} }`
    : `... on DiscountCodeBxgy { ${buyField} }
       ... on DiscountAutomaticBxgy { ${buyField} }`;
  return `{
    discountNodes {
      edges {
        node {
          id
          discount {
            __typename
            ${typeFragments}
          }
        }
      }
    }
  }`;
}

const SHOPIFY_DISCOUNT_TYPES = new Set([
  "DiscountCodeBasic",
  "DiscountCodeBxgy",
  "DiscountAutomaticBasic",
  "DiscountAutomaticBxgy",
  "DiscountCodeFreeShipping",
  "DiscountAutomaticFreeShipping",
  "DiscountCodeApp",
  "DiscountAutomaticApp",
]);

export function isKnownShopifyDiscountType(discountType: string) {
  return SHOPIFY_DISCOUNT_TYPES.has(discountType);
}

function classifyDiscountTargetId(id: string): "product" | "variant" | "collection" | null {
  if (/^gid:\/\/shopify\/Product\/\d+$/.test(id)) return "product";
  if (/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(id)) return "variant";
  if (/^gid:\/\/shopify\/Collection\/\d+$/.test(id)) return "collection";
  return null;
}

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
  | "collections"
  | "fulfillment_events";

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

type NormalizedFulfillmentReason = {
  reason_code:
    | "customs_hold"
    | "address_issue"
    | "delivery_attempt"
    | "carrier_delay"
    | "carrier_failure"
    | "unknown";
  reason_confidence: number;
};

/** The original carrier message is classified transiently and never persisted. */
export function classifyFulfillmentEventReason(
  status: string,
  message: string | null | undefined,
): NormalizedFulfillmentReason {
  const normalized = (message ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  if (/\b(customs?|aduanas?|customs clearance|clearance hold|import duty|border inspection)\b/.test(normalized)) {
    return { reason_code: "customs_hold", reason_confidence: 0.98 };
  }
  if (/\b(incorrect address|wrong address|address issue|undeliverable|direccion incorrecta|direccion incompleta)\b/.test(normalized)) {
    return { reason_code: "address_issue", reason_confidence: 0.95 };
  }
  if (status === "ATTEMPTED_DELIVERY") {
    return { reason_code: "delivery_attempt", reason_confidence: 0.99 };
  }
  if (status === "DELAYED") {
    return { reason_code: "carrier_delay", reason_confidence: 0.99 };
  }
  if (status === "FAILURE") {
    return { reason_code: "carrier_failure", reason_confidence: 0.95 };
  }
  return { reason_code: "unknown", reason_confidence: 0 };
}

type ShopifyFulfillmentEvent = {
  id: string;
  status: string;
  happenedAt: string;
  estimatedDeliveryAt?: string | null;
  message?: string | null;
};

type FulfillmentEventsResponse = {
  node: {
    id: string;
    events: {
      nodes: ShopifyFulfillmentEvent[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  } | null;
};

const FULFILLMENT_EVENTS_QUERY = `query FulfillmentEvents($id: ID!, $first: Int!, $after: String) {
  node(id: $id) {
    ... on Fulfillment {
      id
      events(first: $first, after: $after) {
        nodes { id status happenedAt estimatedDeliveryAt message }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

type LocalFulfillmentForEventSync = {
  id: string;
  external_fulfillment_id: string;
  external_created_at: string | null;
  external_updated_at: string | null;
  delivered_at: string | null;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_external_updated_at: string | null;
  next_cursor: string | null;
  event_count: number | null;
  sync_status: "complete" | "partial" | "failed" | null;
};

async function syncShopifyFulfillmentEvents(input: {
  supabase: SupabaseClient;
  shopDomain: string;
  accessToken: string;
  organizationId: string;
  storeId: string;
}): Promise<{ read: number; written: number; failed: number; warning: string | null }> {
  const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const { data: fulfillments, error: fulfillmentError } = await input.supabase.rpc(
    "shopify_fulfillment_event_candidates",
    {
      p_organization_id: input.organizationId,
      p_store_id: input.storeId,
      p_created_after: cutoff,
    },
  );
  if (fulfillmentError) throw new Error("fulfillment_event_candidates_unavailable");
  const candidates = (fulfillments ?? []) as LocalFulfillmentForEventSync[];
  if (!candidates.length) return { read: 0, written: 0, failed: 0, warning: null };

  let read = 0;
  let written = 0;
  let failed = 0;
  let partial = 0;
  let pagesRemaining = 60;
  for (const fulfillment of candidates) {
    const changed = (fulfillment.last_external_updated_at ?? null) !== (fulfillment.external_updated_at ?? null);
    let cursor = changed ? null : fulfillment.next_cursor ?? null;
    let eventCount = changed || !fulfillment.next_cursor ? 0 : Number(fulfillment.event_count ?? 0);
    let status: "complete" | "partial" | "failed" = "partial";
    let errorCode: string | null = null;
    let lastPageInfo = { hasNextPage: false, endCursor: null as string | null };

    try {
      for (let page = 0; page < 3 && pagesRemaining > 0; page += 1) {
        const response = await shopifyGraphql<FulfillmentEventsResponse>(
          input.shopDomain,
          input.accessToken,
          FULFILLMENT_EVENTS_QUERY,
          { id: fulfillment.external_fulfillment_id, first: 100, after: cursor },
        );
        pagesRemaining -= 1;
        read += 1;
        if (!response.node || !response.node.events) {
          errorCode = "fulfillment_events_node_unavailable";
          status = "failed";
          break;
        }
        const events = response.node.events.nodes ?? [];
        const eventRows = events.map((event) => {
          const reason = classifyFulfillmentEventReason(event.status, event.message);
          const normalizedStatus = new Set([
            "ATTEMPTED_DELIVERY", "CARRIER_PICKED_UP", "CONFIRMED", "DELAYED",
            "DELIVERED", "FAILURE", "IN_TRANSIT", "LABEL_PRINTED",
            "LABEL_PURCHASED", "OUT_FOR_DELIVERY", "READY_FOR_PICKUP",
          ]).has(event.status) ? event.status : "OTHER";
          return {
            organization_id: input.organizationId,
            store_id: input.storeId,
            fulfillment_id: fulfillment.id,
            external_event_id: event.id,
            status: normalizedStatus,
            happened_at: event.happenedAt,
            estimated_delivery_at: event.estimatedDeliveryAt ?? null,
            ...reason,
          };
        });
        if (eventRows.length) {
          const { error } = await input.supabase
            .from("shopify_fulfillment_events")
            .upsert(eventRows, { onConflict: "store_id,external_event_id" });
          if (error) {
            errorCode = "fulfillment_events_persist_failed";
            status = "failed";
            break;
          }
          written += eventRows.length;
          eventCount += eventRows.length;
        }
        lastPageInfo = response.node.events.pageInfo;
        cursor = lastPageInfo.endCursor;
        if (!lastPageInfo.hasNextPage) {
          status = "complete";
          break;
        }
        status = "partial";
      }
    } catch {
      errorCode = "shopify_fulfillment_events_read_failed";
      status = "failed";
    }

    const attemptedAt = new Date().toISOString();
    const completedAt = status === "complete" ? attemptedAt : fulfillment.last_success_at ?? null;
    const { error: stateUpsertError } = await input.supabase
      .from("shopify_fulfillment_event_sync_state")
      .upsert({
        fulfillment_id: fulfillment.id,
        organization_id: input.organizationId,
        store_id: input.storeId,
        last_attempt_at: attemptedAt,
        last_success_at: completedAt,
        last_external_updated_at: changed ? fulfillment.external_updated_at : fulfillment.last_external_updated_at ?? fulfillment.external_updated_at,
        next_cursor: status === "complete" ? null : lastPageInfo.hasNextPage ? lastPageInfo.endCursor : null,
        event_count: eventCount,
        status,
        error_code: errorCode,
      }, { onConflict: "fulfillment_id" });
    if (!stateUpsertError) {
      const { error: exceptionRefreshError } = await input.supabase.rpc(
        "refresh_shopify_delivery_exception",
        {
          p_organization_id: input.organizationId,
          p_store_id: input.storeId,
          p_fulfillment_id: fulfillment.id,
        },
      );
      if (exceptionRefreshError) {
        errorCode = "delivery_exception_refresh_failed";
        status = "failed";
        await input.supabase
          .from("shopify_fulfillment_event_sync_state")
          .update({ status, error_code: errorCode })
          .eq("fulfillment_id", fulfillment.id)
          .eq("store_id", input.storeId);
      }
    }
    if (stateUpsertError || errorCode) failed += 1;
    if (!stateUpsertError && status === "partial") partial += 1;
    if (pagesRemaining <= 0) break;
  }

  const warning = failed || partial || candidates.some((row) => !row.last_attempt_at)
    ? "La sincronización de eventos de fulfillment sigue parcial; la ausencia de eventos no prueba ausencia de incidencias."
    : null;
  return { read, written, failed, warning };
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

function isShopifyAuthorizationFailure(message: string) {
  return requiresIntegrationReauthorization(message) ||
    /^(Faltan permisos de Shopify|Shopify denego el acceso)/i.test(message);
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
  const { error } = await supabase
    .from("integration_sync_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      records_read: counts.read,
      records_written: counts.written,
      records_failed: counts.failed,
      // Sync runs can be reused by idempotency key. Clear an old warning/error
      // when a later attempt for that run completes without one.
      error_message: errorMessage ?? null,
    })
    .eq("id", syncRunId);
  if (error) throw new Error(`shopify_sync_run_finish_failed: ${error.message}`);
}

const UPSERT_BATCH_SIZE = 500;

function isProductMediaCoverageSchemaMissing(error: { code?: string; message?: string }) {
  return error.code === "42P01" || error.code === "PGRST205" ||
    error.message?.includes("shopify_product_media_sync_coverage") === true;
}

function isMissingShopifyBundleGroupSchema(message: string) {
  const mentionsBundleColumn = message.includes("bundle_group_") || message.includes("bundle_parent_");
  return mentionsBundleColumn && (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

function isMissingShopifyCollectionSyncMarker(message: string) {
  return message.includes("last_seen_at") && (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

function withoutShopifyBundleGroupFields(row: Record<string, unknown>) {
  const {
    bundle_group_coverage: _coverage,
    bundle_group_id: _groupId,
    bundle_parent_title: _parentTitle,
    bundle_parent_external_product_id: _parentProductId,
    bundle_parent_external_variant_id: _parentVariantId,
    bundle_parent_quantity: _parentQuantity,
    ...legacyRow
  } = row;
  return legacyRow;
}

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
    let { error } = await supabase.from(table).upsert(batch, { onConflict });

    if (error && table === "shopify_order_items") {
      let fallbackRows = batch;
      for (let attempt = 0; error && attempt < 2; attempt += 1) {
        const missingNetMetrics = isMissingShopifyNetMetricsSchema(error.message);
        const missingBundleGroups = isMissingShopifyBundleGroupSchema(error.message);
        if (!missingNetMetrics && !missingBundleGroups) break;
        fallbackRows = fallbackRows.map((row) => {
          const withoutNet = missingNetMetrics
            ? withoutShopifyNetMetrics(row)
            : row;
          return missingBundleGroups
            ? withoutShopifyBundleGroupFields(withoutNet)
            : withoutNet;
        });
        const retry = await supabase.from(table).upsert(fallbackRows, { onConflict });
        error = retry.error;
        if (!error) {
          block.warning = block.warning ?? "shopify_order_item_metrics_or_bundle_migration_pending";
          logger.info("Shopify order-line metrics migration is pending; stored compatible order-line fields", {
            rows: batch.length,
            omitted_net_metrics: missingNetMetrics,
            omitted_bundle_groups: missingBundleGroups,
          });
        }
      }
    }

    if (error && table === "shopify_products" && isMissingShopifyProductMetadataSchema(error)) {
      const legacyRows = batch.map(({
        description_html,
        tags,
        shopify_category_id,
        shopify_category_name,
        metadata_coverage,
        ...row
      }) => row);
      const retry = await supabase.from(table).upsert(legacyRows, { onConflict });
      error = retry.error;
      if (!error) {
        block.warning = block.warning ?? "shopify_product_metadata_migration_pending";
        logger.info("Shopify product metadata migration is pending; stored core product fields", {
          rows: batch.length,
        });
      }
    }

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
  organizationId: string,
  scopeColumn: string,
  scopeValues: string[],
): Promise<T[]> {
  if (!filterValues.length || !scopeValues.length) {
    return [];
  }

  const results: T[] = [];

  for (const scopeBatch of chunk(scopeValues, UPSERT_BATCH_SIZE)) {
    for (const batch of chunk(filterValues, UPSERT_BATCH_SIZE)) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .eq("organization_id", organizationId)
        .in(filterColumn, batch)
        .in(scopeColumn, scopeBatch);
      if (error) {
        throw new Error(`${table}_reference_read_failed: ${error.message}`);
      }
      results.push(...((data ?? []) as T[]));
    }
  }

  return results;
}

async function persistShopifyProductMediaSnapshot(
  supabase: SupabaseClient,
  storeId: string,
  syncedProductIds: string[],
  rows: ReturnType<typeof buildShopifyProductMediaRows>["rows"],
) {
  for (const batch of chunk(rows, UPSERT_BATCH_SIZE)) {
    const { error } = await supabase
      .from("shopify_product_media")
      .upsert(batch, { onConflict: "product_id,external_media_id" });
    if (error) throw new Error(`shopify_product_media_upsert_failed: ${error.message}`);
  }

  const activeMediaByProduct = new Map<string, Set<string>>();
  for (const row of rows) {
    const active = activeMediaByProduct.get(row.product_id) ?? new Set<string>();
    active.add(row.external_media_id);
    activeMediaByProduct.set(row.product_id, active);
  }

  for (const productIds of chunk(syncedProductIds, 200)) {
    const existing: Array<{ id: string; product_id: string; external_media_id: string }> = [];
    let offset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("shopify_product_media")
        .select("id, product_id, external_media_id")
        .eq("store_id", storeId)
        .in("product_id", productIds)
        .range(offset, offset + 999);
      if (error) throw new Error(`shopify_product_media_read_failed: ${error.message}`);
      const page = (data ?? []) as typeof existing;
      existing.push(...page);
      if (page.length < 1000) break;
      offset += page.length;
    }

    const staleIds = existing
      .filter((media) => !activeMediaByProduct.get(media.product_id)?.has(media.external_media_id))
      .map((media) => media.id);
    for (const staleBatch of chunk(staleIds, UPSERT_BATCH_SIZE)) {
      const { error } = await supabase
        .from("shopify_product_media")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("store_id", storeId)
        .in("id", staleBatch);
      if (error) throw new Error(`shopify_product_media_retire_failed: ${error.message}`);
    }
  }
}

async function writeShopifyProductMediaCoverage(input: {
  supabase: SupabaseClient;
  organizationId: string;
  storeId: string;
  status: "running" | "complete" | "partial" | "failed";
  attemptedAt: string;
  fullSnapshot?: boolean;
  productsScanned?: number;
  imagesScanned?: number;
  errorCode?: string | null;
}) {
  const { supabase, organizationId, storeId, status, attemptedAt } = input;
  const { data: previous, error: readError } = await supabase
    .from("shopify_product_media_sync_coverage")
    .select("last_successful_full_sync_at, products_scanned, images_scanned")
    .eq("organization_id", organizationId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (readError) {
    if (isProductMediaCoverageSchemaMissing(readError)) return { available: false as const };
    throw new Error(`shopify_product_media_coverage_read_failed: ${readError.message}`);
  }

  const completedFullSnapshot = status === "complete" && input.fullSnapshot === true;
  const lastSuccessfulFullSyncAt = completedFullSnapshot
    ? attemptedAt
    : previous?.last_successful_full_sync_at ?? null;
  const productsScanned = completedFullSnapshot
    ? input.productsScanned ?? 0
    : previous?.products_scanned ?? 0;
  const imagesScanned = completedFullSnapshot
    ? input.imagesScanned ?? 0
    : previous?.images_scanned ?? 0;
  const nextStatus = status === "complete" && !lastSuccessfulFullSyncAt ? "partial" : status;
  const { error: writeError } = await supabase
    .from("shopify_product_media_sync_coverage")
    .upsert({
      organization_id: organizationId,
      store_id: storeId,
      status: nextStatus,
      products_scanned: productsScanned,
      images_scanned: imagesScanned,
      last_attempt_at: attemptedAt,
      last_successful_full_sync_at: lastSuccessfulFullSyncAt,
      error_code: nextStatus === "failed"
        ? input.errorCode ?? "shopify_product_media_sync_failed"
        : nextStatus === "partial" ? input.errorCode ?? null : null,
      updated_at: attemptedAt,
    }, { onConflict: "store_id" });
  if (writeError) {
    if (isProductMediaCoverageSchemaMissing(writeError)) return { available: false as const };
    throw new Error(`shopify_product_media_coverage_write_failed: ${writeError.message}`);
  }
  return { available: true as const, status: nextStatus };
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
    fulfillment_events: createBlockState(),
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

  const { error: markSyncingError } = await supabase
    .from("integration_connections")
    .update({
      status: "syncing",
      last_error_message: null,
      last_error_at: null,
    })
    .eq("id", connectionId);
  if (markSyncingError) throw new Error(`shopify_connection_mark_syncing_failed: ${markSyncingError.message}`);

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
    const variantsQueryFilter = updatedAtCutoff
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
                descriptionHtml
                tags
                category { id name fullName }
                status
                publishedAt
                createdAt
                updatedAt
              }
            }
          }
        }`,
      );

      const productUpsertFailureCount = blocks.catalog.failed;
      const observedProductExternalIds = new Set<string>();
      await forEachBulkResultBatch(bulkResult.url, UPSERT_BATCH_SIZE, async (batch) => {
        const productRows = (batch as BulkProductLine[]).map((product) => ({
          organization_id: connection.organization_id,
          store_id: storeId,
          external_product_id: product.id,
          title: product.title,
          handle: product.handle ?? null,
          vendor: product.vendor ?? null,
          product_type: product.productType ?? null,
          description_html: product.descriptionHtml ?? null,
          tags: product.tags ?? [],
          shopify_category_id: product.category?.id ?? null,
          shopify_category_name: product.category?.fullName ?? product.category?.name ?? null,
          metadata_coverage: "complete",
          status: product.status ?? null,
          published_at: product.publishedAt ?? null,
          external_created_at: product.createdAt ?? null,
          external_updated_at: product.updatedAt ?? null,
        }));
        blocks.catalog.read += productRows.length;
        for (const product of productRows) {
          observedProductExternalIds.add(product.external_product_id);
        }
        await upsertBlockRows(
          supabase,
          blocks.catalog,
          "shopify_products",
          productRows,
          "store_id,external_product_id",
        );
      });
      const productSnapshotComplete =
        syncType !== "incremental" &&
        blocks.catalog.failed === productUpsertFailureCount;

      // Las variantes se exportan en una conexión raíz que también incluye
      // productos sin cambios durante una sincronización incremental.
      const syncedProductCount = observedProductExternalIds.size;

      // En una importación completa, la ausencia en el bulk solo se considera
      // borrado cuando la lectura y todos los upserts del snapshot acabaron.
      // Nunca inferimos borrados durante un incremental o un bloque parcial.
      if (productSnapshotComplete) {
        for (let offset = 0; ; offset += UPSERT_BATCH_SIZE) {
          const { data: productPage, error: productReadError } = await supabase
            .from("shopify_products")
            .select("id, external_product_id")
            .eq("organization_id", connection.organization_id)
            .eq("store_id", storeId)
            .order("id", { ascending: true })
            .range(offset, offset + UPSERT_BATCH_SIZE - 1);
          if (productReadError) throw new Error(`shopify_product_reconcile_read_failed: ${productReadError.message}`);
          const page = (productPage ?? []) as Array<{ id: string; external_product_id: string }>;
          const staleBatch = page
            .filter((product) => !observedProductExternalIds.has(product.external_product_id))
            .map((product) => product.id);
          if (staleBatch.length) {
          const deletedAt = new Date().toISOString();
          const { error } = await supabase
            .from("shopify_products")
            .update({ status: "DELETED", external_updated_at: deletedAt })
            .eq("organization_id", connection.organization_id)
            .eq("store_id", storeId)
            .in("id", staleBatch);
          if (error) throw new Error(`shopify_product_retire_failed: ${error.message}`);

          const { error: variantError } = await supabase
            .from("shopify_variants")
            .update({ is_active: false })
            .eq("organization_id", connection.organization_id)
            .eq("store_id", storeId)
            .in("product_id", staleBatch);
          if (variantError) throw new Error(`shopify_product_variants_retire_failed: ${variantError.message}`);

          for (let variantOffset = 0; ; variantOffset += 500) {
            const { data, error: variantReadError } = await supabase
              .from("shopify_variants")
              .select("id")
              .eq("organization_id", connection.organization_id)
              .eq("store_id", storeId)
              .in("product_id", staleBatch)
              .range(variantOffset, variantOffset + 499);
            if (variantReadError) throw new Error(`shopify_product_variant_read_failed: ${variantReadError.message}`);
            const page = (data ?? []) as Array<{ id: string }>;
            const variantIdBatch = page.map((variant) => variant.id);
            for (const variantIds of chunk(variantIdBatch, 100)) {
              const { error: parentBundleError } = await supabase
                .from("shopify_product_bundle_components")
                .update({ is_active: false, updated_at: deletedAt })
                .eq("organization_id", connection.organization_id)
                .eq("store_id", storeId)
                .in("parent_variant_id", variantIds);
              if (parentBundleError) throw new Error(`shopify_product_bundle_parent_retire_failed: ${parentBundleError.message}`);

              const { error: componentBundleError } = await supabase
                .from("shopify_product_bundle_components")
                .update({ is_active: false, updated_at: deletedAt })
                .eq("organization_id", connection.organization_id)
                .eq("store_id", storeId)
                .in("component_variant_id", variantIds);
              if (componentBundleError) throw new Error(`shopify_product_bundle_component_retire_failed: ${componentBundleError.message}`);
            }
            if (page.length < 500) break;
          }

          const { error: mediaError } = await supabase
            .from("shopify_product_media")
            .update({ is_active: false, updated_at: deletedAt })
            .eq("organization_id", connection.organization_id)
            .eq("store_id", storeId)
            .in("product_id", staleBatch);
          if (mediaError) throw new Error(`shopify_product_media_retire_failed: ${mediaError.message}`);
          }
          if (page.length < UPSERT_BATCH_SIZE) break;
        }
      }

      // Media es un subbloque independiente: un permiso/campo de galería que
      // falte no debe impedir importar productos, variantes ni pedidos.
      const mediaAttemptAt = new Date().toISOString();
      try {
        const coverage = await writeShopifyProductMediaCoverage({
          supabase,
          organizationId: connection.organization_id,
          storeId,
          status: "running",
          attemptedAt: mediaAttemptAt,
        });
        if (!coverage.available) blocks.catalog.warning ??= "shopify_product_media_coverage_migration_pending";
      } catch (coverageError) {
        blocks.catalog.warning ??= "shopify_product_media_coverage_unavailable";
        logger.error("Shopify product media coverage could not be marked running", {
          connection_id: connectionId,
          store_id: storeId,
          error: coverageError instanceof Error ? coverageError.message : String(coverageError),
        });
      }
      try {
        accessToken = await getValidShopifyAccessToken(env, connectionId);
        const mediaBulkResult = await runBulkOperation(
          shopDomain,
          accessToken,
          `{
            products${productsQueryFilter} {
              edges {
                node {
                  id
                  media {
                    edges {
                      node {
                        id
                        mediaContentType
                        ... on MediaImage {
                          alt
                          image { url width height }
                        }
                      }
                    }
                  }
                }
              }
            }
          }`,
        );
        let mediaProductsScanned = 0;
        let mediaImagesScanned = 0;
        let mediaProductReferencesMissing = 0;
        await forEachBulkRootBatch(mediaBulkResult.url, 25, async (rootBatch) => {
          const mediaProducts = rootBatch.map(({ root }) => root);
          const productRefs = await selectAll<{ id: string; external_product_id: string }>(
            supabase,
            "shopify_products",
            "id, external_product_id",
            "external_product_id",
            mediaProducts.map((product) => product.id),
            connection.organization_id,
            "store_id",
            [storeId],
          );
          const productIdByExternalId = new Map(
            productRefs.map((product) => [product.external_product_id, product.id]),
          );
          if (productIdByExternalId.size !== mediaProducts.length) {
            mediaProductReferencesMissing += mediaProducts.length - productIdByExternalId.size;
          }
          const mediaByProductExternalId = new Map<string, BulkLine[]>();
          for (const group of rootBatch) {
            for (const [parentId, children] of group.childrenByParentId) {
              mediaByProductExternalId.set(parentId, children);
            }
          }
          const mediaSnapshot = buildShopifyProductMediaRows({
            organizationId: connection.organization_id,
            storeId,
            syncedAt: new Date().toISOString(),
            products: mediaProducts,
            productIdByExternalId,
            mediaByProductExternalId: mediaByProductExternalId as Map<
              string,
              ShopifyProductMediaLine[]
            >,
          });
          mediaProductsScanned += mediaSnapshot.syncedProductIds.length;
          mediaImagesScanned += mediaSnapshot.rows.length;
          blocks.catalog.read += mediaSnapshot.rows.length;
          await persistShopifyProductMediaSnapshot(
            supabase,
            storeId,
            mediaSnapshot.syncedProductIds,
            mediaSnapshot.rows,
          );
          blocks.catalog.written += mediaSnapshot.rows.length;
        });
        const fullMediaSnapshot = syncType !== "incremental";
        const mediaCoverage = await writeShopifyProductMediaCoverage({
          supabase,
          organizationId: connection.organization_id,
          storeId,
          status: mediaProductReferencesMissing ? "partial" : "complete",
          attemptedAt: new Date().toISOString(),
          fullSnapshot: fullMediaSnapshot && mediaProductReferencesMissing === 0,
          productsScanned: mediaProductsScanned,
          imagesScanned: mediaImagesScanned,
          errorCode: mediaProductReferencesMissing ? "shopify_media_product_reference_incomplete" : null,
        });
        if (!mediaCoverage.available) blocks.catalog.warning ??= "shopify_product_media_coverage_migration_pending";
        if (mediaProductReferencesMissing) {
          blocks.catalog.warning = "shopify_product_media_snapshot_partial: faltan referencias locales de producto; se conservaron imágenes anteriores";
        }
        logger.info("Shopify product media sync completed", {
          connection_id: connectionId,
          organization_id: connection.organization_id,
          shop_domain: shopDomain,
          products_synced: mediaProductsScanned,
          images_synced: mediaImagesScanned,
          products_without_local_reference: mediaProductReferencesMissing,
          coverage_status: mediaCoverage.available ? mediaCoverage.status : "migration_pending",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "shopify_product_media_sync_failed";
        blocks.catalog.failed += 1;
        blocks.catalog.error = explainShopifyError(
          message,
          Array.isArray(connection.scopes) ? connection.scopes : [],
        );
        try {
          const coverage = await writeShopifyProductMediaCoverage({
            supabase,
            organizationId: connection.organization_id,
            storeId,
            status: "failed",
            attemptedAt: new Date().toISOString(),
            errorCode: message.slice(0, 120),
          });
          if (!coverage.available) blocks.catalog.warning ??= "shopify_product_media_coverage_migration_pending";
        } catch (coverageError) {
          logger.error("Shopify product media failure coverage could not be saved", {
            connection_id: connectionId,
            store_id: storeId,
            error: coverageError instanceof Error ? coverageError.message : String(coverageError),
          });
        }
        logger.error("Shopify product media sync failed; base catalog remains available", {
          connection_id: connectionId,
          organization_id: connection.organization_id,
          shop_domain: shopDomain,
          error: message,
        });
      }

      // La consulta por producto solo devuelve hasta 250 variantes por producto.
      // Shopify ofrece productVariants como conexión raíz para exportar el catálogo
      // completo, incluso cuando un producto supera ese tamaño.
      accessToken = await getValidShopifyAccessToken(env, connectionId);
      const variantBulkResult = await runBulkOperation(
        shopDomain,
        accessToken,
        `{
          productVariants${variantsQueryFilter} {
            edges {
              node {
                id
                product { id }
                title
                selectedOptions { name value }
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
        }`,
      );
      const variantUpsertFailureCount = blocks.catalog.failed;
      const observedVariantIds = new Set<string>();
      let exportedVariantCount = 0;
      let mappedVariantCount = 0;
      let inventoryItemCount = 0;
      let inventoryLevelCount = 0;
      await forEachBulkRootBatch(
        variantBulkResult.url,
        100,
        async (rootBatch) => {
          const variants = rootBatch.map((group) => group.root as BulkVariantLine);
          const productExternalIds = [...new Set(variants.flatMap((variant) => variant.product?.id ? [variant.product.id] : []))];
          const productRefs = await selectAll<{ id: string; external_product_id: string }>(
            supabase,
            "shopify_products",
            "id, external_product_id",
            "external_product_id",
            productExternalIds,
            connection.organization_id,
            "store_id",
            [storeId],
          );
          const productIdByExternalId = new Map(
            productRefs.map((product) => [product.external_product_id, product.id]),
          );
          exportedVariantCount += variants.length;
          const variantRows: Array<Record<string, unknown>> = [];
          const variantByExternalId = new Map<string, {
            variant: BulkVariantLine;
            childrenByParentId: Map<string, BulkLine[]>;
          }>();
          for (let index = 0; index < rootBatch.length; index += 1) {
            const group = rootBatch[index]!;
            const variant = variants[index]!;
            const externalProductId = variant.product?.id;
            const productId = externalProductId ? productIdByExternalId.get(externalProductId) : null;
            if (!productId) continue;
            mappedVariantCount += 1;
            observedVariantIds.add(variant.id);
            variantByExternalId.set(variant.id, {
              variant,
              childrenByParentId: group.childrenByParentId,
            });
            const selectedOptions = (group.childrenByParentId.get(variant.id) ?? [])
              .filter((line) => typeof line.name === "string" && typeof line.value === "string")
              .map((line) => ({ name: line.name as string, value: line.value as string }));
            const inlineSelectedOptions = (variant.selectedOptions ?? [])
              .filter((option) => typeof option.name === "string" && option.name.trim() && typeof option.value === "string" && option.value.trim())
              .map((option) => ({ name: option.name!.trim(), value: option.value!.trim() }));
            variantRows.push({
              organization_id: connection.organization_id,
              store_id: storeId,
              product_id: productId,
              external_variant_id: variant.id,
              title: variant.title ?? null,
              selected_options: inlineSelectedOptions.length ? inlineSelectedOptions : selectedOptions,
              barcode: variant.barcode ?? null,
              current_price: variant.price ?? null,
              compare_at_price: variant.compareAtPrice ?? null,
              position: variant.position ?? null,
              taxable: variant.taxable ?? null,
              inventory_policy: variant.inventoryPolicy ?? null,
              is_active: true,
              external_created_at: variant.createdAt ?? null,
              external_updated_at: variant.updatedAt ?? null,
            });
          }

          blocks.catalog.read += variantRows.length;
          await upsertBlockRows(
            supabase,
            blocks.catalog,
            "shopify_variants",
            variantRows,
            "product_id,external_variant_id",
          );

          const variantRefs: Array<{ id: string; external_variant_id: string }> = [];
          for (const variantBatch of chunk(variantRows, UPSERT_BATCH_SIZE)) {
            const { data, error } = await supabase
              .from("shopify_variants")
              .select("id, external_variant_id")
              .eq("organization_id", connection.organization_id)
              .eq("store_id", storeId)
              .in("product_id", [...new Set(variantBatch.map((row) => row.product_id as string))])
              .in("external_variant_id", variantBatch.map((row) => row.external_variant_id as string));
            if (error) throw new Error(`shopify_variant_reference_read_failed: ${error.message}`);
            variantRefs.push(...((data ?? []) as typeof variantRefs));
          }
          if (variantRefs.length !== variantRows.length) {
            blocks.catalog.failed += Math.max(0, variantRows.length - variantRefs.length);
            blocks.catalog.error ??= "shopify_variant_reference_incomplete";
          }
          const variantIdByExternalId = new Map(
            variantRefs.map((variant) => [variant.external_variant_id, variant.id]),
          );

          const inventoryRows: Array<Record<string, unknown>> = [];
          const inventorySnapshotRows: Array<Record<string, unknown>> = [];
          for (const { variant, childrenByParentId } of variantByExternalId.values()) {
            const variantId = variantIdByExternalId.get(variant.id);
            const inventoryItem = variant.inventoryItem;
            if (!variantId || !inventoryItem) continue;
            inventoryRows.push({
              organization_id: connection.organization_id,
              store_id: storeId,
              variant_id: variantId,
              external_inventory_item_id: inventoryItem.id,
              sku: inventoryItem.sku ?? null,
              tracked: inventoryItem.tracked ?? false,
              requires_shipping: inventoryItem.requiresShipping ?? true,
              country_code_of_origin: inventoryItem.countryCodeOfOrigin ?? null,
              province_code_of_origin: inventoryItem.provinceCodeOfOrigin ?? null,
              harmonized_system_code: inventoryItem.harmonizedSystemCode ?? null,
              current_unit_cost: inventoryItem.unitCost?.amount ?? null,
              cost_currency_code: inventoryItem.unitCost?.currencyCode ?? null,
              measurement_data: inventoryItem.measurement ?? null,
              external_updated_at: new Date().toISOString(),
            });
            for (const level of (childrenByParentId.get(inventoryItem.id) ?? []) as BulkInventoryLevelLine[]) {
              const quantities = level.quantities ?? [];
              const quantityMap = Object.fromEntries(quantities.map((quantity) => [quantity.name, quantity.quantity])) as Record<string, number>;
              const locationId = locationMap.get(level.location.id);
              if (!locationId) continue;
              inventorySnapshotRows.push({
                organization_id: connection.organization_id,
                external_inventory_item_id: inventoryItem.id,
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

          inventoryItemCount += inventoryRows.length;
          inventoryLevelCount += inventorySnapshotRows.length;
          blocks.inventory.read += inventoryRows.length;
          await upsertBlockRows(
            supabase,
            blocks.inventory,
            "shopify_inventory_items",
            inventoryRows,
            "store_id,external_inventory_item_id",
          );
          const inventoryRefs = await selectAll<{ id: string; external_inventory_item_id: string }>(
            supabase,
            "shopify_inventory_items",
            "id, external_inventory_item_id",
            "external_inventory_item_id",
            inventoryRows.map((row) => row.external_inventory_item_id as string),
            connection.organization_id,
            "store_id",
            [storeId],
          );
          if (inventoryRefs.length !== inventoryRows.length) {
            blocks.inventory.failed += Math.max(0, inventoryRows.length - inventoryRefs.length);
            blocks.inventory.error ??= "shopify_inventory_item_reference_incomplete";
          }
          const inventoryMap = new Map(inventoryRefs.map((item) => [item.external_inventory_item_id, item.id]));
          const resolvedSnapshotRows = inventorySnapshotRows.flatMap((row) => {
            const externalInventoryItemId = row.external_inventory_item_id as string;
            const inventoryItemId = inventoryMap.get(externalInventoryItemId);
            if (!inventoryItemId) return [];
            const { external_inventory_item_id: _externalInventoryItemId, ...snapshotRow } = row;
            return [{ ...snapshotRow, inventory_item_id: inventoryItemId }];
          });
          if (resolvedSnapshotRows.length !== inventorySnapshotRows.length) {
            blocks.inventory.failed += Math.max(0, inventorySnapshotRows.length - resolvedSnapshotRows.length);
            blocks.inventory.error ??= "shopify_inventory_snapshot_reference_incomplete";
          }
          blocks.inventory.read += resolvedSnapshotRows.length;
          await upsertBlockRows(
            supabase,
            blocks.inventory,
            "shopify_inventory_current_state",
            resolvedSnapshotRows,
            "inventory_item_id,location_id",
          );
        },
        {
          inlineParentIds: (line) => {
            const inventoryItem = (line as BulkVariantLine).inventoryItem;
            return inventoryItem?.id ? [inventoryItem.id] : [];
          },
        },
      );

      if (syncedProductCount && !exportedVariantCount) {
        logger.error(
          "Shopify bulk grouping found no variants for any synced product - __parentId matching likely broke",
          {
            connection_id: connectionId,
            organization_id: connection.organization_id,
            shop_domain: shopDomain,
            products_synced: syncedProductCount,
          },
        );
      }
      const variantSnapshotComplete =
        syncType !== "incremental" &&
        mappedVariantCount === exportedVariantCount &&
        blocks.catalog.failed === variantUpsertFailureCount;

      if (variantSnapshotComplete) {
        for (let offset = 0; ; offset += UPSERT_BATCH_SIZE) {
          const { data: variantPage, error: variantReadError } = await supabase
            .from("shopify_variants")
            .select("id, external_variant_id")
            .eq("organization_id", connection.organization_id)
            .eq("store_id", storeId)
            .order("id", { ascending: true })
            .range(offset, offset + UPSERT_BATCH_SIZE - 1);
          if (variantReadError) throw new Error(`shopify_variant_reconcile_read_failed: ${variantReadError.message}`);
          const page = (variantPage ?? []) as Array<{ id: string; external_variant_id: string }>;
          const staleBatch = page
            .filter((variant) => !observedVariantIds.has(variant.external_variant_id))
            .map((variant) => variant.id);
          if (staleBatch.length) {
          const { error } = await supabase
            .from("shopify_variants")
            .update({ is_active: false })
            .eq("organization_id", connection.organization_id)
            .eq("store_id", storeId)
            .in("id", staleBatch);
          if (error) throw new Error(`shopify_variant_retire_failed: ${error.message}`);

          for (const variantIdBatch of chunk(staleBatch, 100)) {
            const { error: parentBundleError } = await supabase
              .from("shopify_product_bundle_components")
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq("organization_id", connection.organization_id)
              .eq("store_id", storeId)
              .in("parent_variant_id", variantIdBatch);
            if (parentBundleError) throw new Error(`shopify_variant_bundle_parent_retire_failed: ${parentBundleError.message}`);

            const { error: componentBundleError } = await supabase
              .from("shopify_product_bundle_components")
              .update({ is_active: false, updated_at: new Date().toISOString() })
              .eq("organization_id", connection.organization_id)
              .eq("store_id", storeId)
              .in("component_variant_id", variantIdBatch);
            if (componentBundleError) throw new Error(`shopify_variant_bundle_component_retire_failed: ${componentBundleError.message}`);
          }
          }
          if (page.length < UPSERT_BATCH_SIZE) break;
        }
      }

      // Los packs nativos de Shopify exponen su composicion por variante.
      // Solo se guardan relaciones confirmadas por la API; el nombre del
      // producto nunca se usa para inferir componentes.
      try {
        accessToken = await getValidShopifyAccessToken(env, connectionId);
        const bundleBulkResult = await runBulkOperation(
          shopDomain,
          accessToken,
          `{
            productVariants {
              edges {
                node {
                  id
                  requiresComponents
                  productVariantComponents {
                    edges {
                      node {
                        id
                        quantity
                        productVariant { id }
                      }
                    }
                  }
                }
              }
            }
          }`,
        );
        const bundleSnapshotAt = new Date().toISOString();
        let bundleVariantsScanned = 0;
        let requiredBundleVariantsCount = 0;
        let bundleComponentsWritten = 0;
        let unresolvedComponents = 0;
        await forEachBulkRootBatch(bundleBulkResult.url, 100, async (rootBatch) => {
          const bundleVariants = rootBatch.map(({ root }) => root as BulkBundleParentVariantLine);
          const rootGroupByExternalId = new Map(rootBatch.map((group) => [group.root.id, group]));
          const requiredBundleVariants = bundleVariants.filter((variant) => variant.requiresComponents === true);
          bundleVariantsScanned += bundleVariants.length;
          requiredBundleVariantsCount += requiredBundleVariants.length;
          const externalVariantIds = new Set<string>();
          for (const parent of requiredBundleVariants) {
            externalVariantIds.add(parent.id);
            const components = (rootGroupByExternalId.get(parent.id)?.childrenByParentId.get(parent.id) ?? []) as BulkBundleComponentLine[];
            for (const component of components) {
              if (component.productVariant?.id) externalVariantIds.add(component.productVariant.id);
            }
          }
          const localVariantRefs = await selectAll<{ id: string; external_variant_id: string }>(
            supabase,
            "shopify_variants",
            "id, external_variant_id",
            "external_variant_id",
            [...externalVariantIds],
            connection.organization_id,
            "store_id",
            [storeId],
          );
          const localVariantIdByExternalId = new Map(
            localVariantRefs.map((variant) => [variant.external_variant_id, variant.id]),
          );
          const bundleRowsByKey = new Map<string, Record<string, unknown>>();

          for (const parent of requiredBundleVariants) {
            const components = (rootGroupByExternalId.get(parent.id)?.childrenByParentId.get(parent.id) ?? []) as BulkBundleComponentLine[];
            if (!components.length) unresolvedComponents += 1;
            const parentVariantId = localVariantIdByExternalId.get(parent.id);
            if (!parentVariantId) {
              unresolvedComponents += Math.max(components.length, 1);
              continue;
            }

            for (const component of components) {
              const externalComponentVariantId = component.productVariant?.id;
              if (!externalComponentVariantId) {
                unresolvedComponents += 1;
                continue;
              }
              const componentVariantId = localVariantIdByExternalId.get(externalComponentVariantId) ?? null;
              if (!componentVariantId) unresolvedComponents += 1;
              bundleRowsByKey.set(
                `${parent.id}\u0000${externalComponentVariantId}`,
                {
                  organization_id: connection.organization_id,
                  store_id: storeId,
                  parent_variant_id: parentVariantId,
                  component_variant_id: componentVariantId,
                  external_parent_variant_id: parent.id,
                  external_component_variant_id: externalComponentVariantId,
                  component_quantity: Math.max(1, component.quantity ?? 1),
                  verification_status: componentVariantId ? "confirmed" : "unresolved_component",
                  is_active: true,
                  last_seen_at: bundleSnapshotAt,
                },
              );
            }
          }

          const bundleRows = [...bundleRowsByKey.values()];
          for (const batch of chunk(bundleRows, UPSERT_BATCH_SIZE)) {
            const { error } = await supabase
              .from("shopify_product_bundle_components")
              .upsert(batch, {
                onConflict: "store_id,external_parent_variant_id,external_component_variant_id",
              });
            if (error) throw new Error(`shopify_bundle_components_upsert_failed: ${error.message}`);
          }
          bundleComponentsWritten += bundleRows.length;
        });

        // Una lectura parcial o con referencias sin resolver no puede retirar
        // relaciones previas: la ausencia de una fila no prueba que el pack
        // haya cambiado en Shopify.
        const bundleSnapshotComplete = unresolvedComponents === 0;
        if (bundleSnapshotComplete) {
          const { error } = await supabase
            .from("shopify_product_bundle_components")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("organization_id", connection.organization_id)
            .eq("store_id", storeId)
            .eq("is_active", true)
            .neq("last_seen_at", bundleSnapshotAt);
          if (error) throw new Error(`shopify_bundle_components_retire_failed: ${error.message}`);
        }

        const status = unresolvedComponents > 0 ? "partial" : "complete";
        const { error: coverageError } = await supabase
          .from("shopify_bundle_sync_coverage")
          .upsert(
            {
              organization_id: connection.organization_id,
              store_id: storeId,
              status,
              variants_scanned: bundleVariantsScanned,
              bundle_variants_count: requiredBundleVariantsCount,
              components_count: bundleComponentsWritten,
              unresolved_components_count: unresolvedComponents,
              last_synced_at: new Date().toISOString(),
              error_code: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "store_id" },
          );
        if (coverageError) throw new Error(`shopify_bundle_coverage_upsert_failed: ${coverageError.message}`);

        blocks.catalog.read += bundleVariantsScanned + bundleComponentsWritten;
        blocks.catalog.written += bundleComponentsWritten;
        if (status === "partial") {
          blocks.catalog.warning = "shopify_bundle_coverage_partial: faltan referencias de componentes confirmadas en Shopify.";
        }
        logger.info("Shopify native bundle sync completed", {
          connection_id: connectionId,
          organization_id: connection.organization_id,
          store_id: storeId,
          variants_scanned: bundleVariantsScanned,
          bundle_variants: requiredBundleVariantsCount,
          components_written: bundleComponentsWritten,
          unresolved_components: unresolvedComponents,
          coverage_status: status,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "shopify_bundle_sync_failed";
        blocks.catalog.failed += 1;
        blocks.catalog.error = message;
        await supabase
          .from("shopify_bundle_sync_coverage")
          .upsert(
            {
              organization_id: connection.organization_id,
              store_id: storeId,
              status: "failed",
              variants_scanned: 0,
              bundle_variants_count: 0,
              components_count: 0,
              unresolved_components_count: 0,
              last_synced_at: new Date().toISOString(),
              error_code: message.slice(0, 120),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "store_id" },
          );
        logger.error("Shopify native bundle sync failed; coverage is not complete", {
          connection_id: connectionId,
          organization_id: connection.organization_id,
          store_id: storeId,
          error: message,
        });
      }

      // Shopify sustituyo ProductVariant.image por media. Se consulta aparte
      // para que el permiso de archivos no aumente la superficie de fallo del
      // bulk principal de catálogo e inventario.
      try {
        accessToken = await getValidShopifyAccessToken(env, connectionId);
        const variantMediaResult = await runBulkOperation(
          shopDomain,
          accessToken,
          `{
            productVariants${variantsQueryFilter} {
              edges {
                node {
                  id
                  media {
                    edges {
                      node { id mediaContentType }
                    }
                  }
                }
              }
            }
          }`,
        );
        await forEachBulkRootBatch(variantMediaResult.url, UPSERT_BATCH_SIZE, async (rootBatch) => {
          const externalVariantIds = rootBatch.map(({ root }) => root.id);
          const { data: variantRefs, error: variantRefsError } = await supabase
            .from("shopify_variants")
            .select("id, external_variant_id")
            .eq("organization_id", connection.organization_id)
            .eq("store_id", storeId)
            .in("external_variant_id", externalVariantIds);
          if (variantRefsError) throw new Error(`shopify_variant_reference_read_failed: ${variantRefsError.message}`);
          const variantIdByExternalId = new Map(
            ((variantRefs ?? []) as Array<{ id: string; external_variant_id: string }>)
              .map((variant) => [variant.external_variant_id, variant.id]),
          );
          const variantImageRows = rootBatch.flatMap(({ root, childrenByParentId }) => {
            const localVariantId = variantIdByExternalId.get(root.id);
            if (!localVariantId) return [];
            const image = childrenByParentId
              .get(root.id)
              ?.find((media) => media.mediaContentType === "IMAGE");
            return [{ id: localVariantId, external_image_id: image?.id ?? null }];
          });
          if (!variantImageRows.length) return;
          await mapWithConcurrency(variantImageRows, 8, async (row) => {
            const { error } = await supabase
              .from("shopify_variants")
              .update({ external_image_id: row.external_image_id })
              .eq("organization_id", connection.organization_id)
              .eq("store_id", storeId)
              .eq("id", row.id);
            if (error) {
              throw new Error(`shopify_variant_media_update_failed: ${error.message}`);
            }
          });
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "shopify_variant_media_sync_failed";
        blocks.catalog.failed += 1;
        blocks.catalog.error = explainShopifyError(
          message,
          Array.isArray(connection.scopes) ? connection.scopes : [],
        );
        logger.error("Shopify variant media sync failed; products and variants remain available", {
          connection_id: connectionId,
          organization_id: connection.organization_id,
          shop_domain: shopDomain,
          error: message,
        });
      }

      // Shopify's bulk JSONL export does not reliably emit inventoryLevels
      // when the connection is nested under ProductVariant.inventoryItem.
      // Export InventoryItem as the root connection so each level is a child
      // of its inventory item and can be mapped to our persisted location.
      try {
        accessToken = await getValidShopifyAccessToken(env, connectionId);
        const inventoryLevelsBulkResult = await runBulkOperation(
          shopDomain,
          accessToken,
          `{
            inventoryItems {
              edges {
                node {
                  id
                  sku
                  tracked
                  requiresShipping
                  countryCodeOfOrigin
                  provinceCodeOfOrigin
                  harmonizedSystemCode
                  unitCost { amount currencyCode }
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
          }`,
        );
        let separateInventoryLevelCount = 0;
        await forEachBulkRootBatch(
          inventoryLevelsBulkResult.url,
          UPSERT_BATCH_SIZE,
          async (groups) => {
            const externalInventoryItemIds = groups.map(
              ({ root }) => root.id,
            );
            const existingInventoryRefs = await selectAll<{
              id: string;
              external_inventory_item_id: string;
              variant_id: string;
            }>(
              supabase,
              "shopify_inventory_items",
              "id, external_inventory_item_id, variant_id",
              "external_inventory_item_id",
              externalInventoryItemIds,
              connection.organization_id,
              "store_id",
              [storeId],
            );
            const variantIdByExternalId = new Map(
              existingInventoryRefs.map((item) => [
                item.external_inventory_item_id,
                item.variant_id,
              ]),
            );
            const inventoryItemRows = groups.map(({ root }) => {
              const item = root as BulkInventoryItemLine;
              return {
                organization_id: connection.organization_id,
                store_id: storeId,
                variant_id: variantIdByExternalId.get(item.id),
                external_inventory_item_id: item.id,
                sku: item.sku ?? null,
                tracked: item.tracked ?? false,
                requires_shipping: item.requiresShipping ?? true,
                country_code_of_origin: item.countryCodeOfOrigin ?? null,
                province_code_of_origin: item.provinceCodeOfOrigin ?? null,
                harmonized_system_code: item.harmonizedSystemCode ?? null,
                current_unit_cost: item.unitCost?.amount ?? null,
                cost_currency_code: item.unitCost?.currencyCode ?? null,
                external_updated_at: new Date().toISOString(),
              };
            });
            blocks.inventory.read += inventoryItemRows.length;
            await upsertBlockRows(
              supabase,
              blocks.inventory,
              "shopify_inventory_items",
              inventoryItemRows,
              "store_id,external_inventory_item_id",
            );
            const inventoryRefs = await selectAll<{
              id: string;
              external_inventory_item_id: string;
            }>(
              supabase,
              "shopify_inventory_items",
              "id, external_inventory_item_id",
              "external_inventory_item_id",
              externalInventoryItemIds,
              connection.organization_id,
              "store_id",
              [storeId],
            );
            const inventoryIdByExternalId = new Map(
              inventoryRefs.map((item) => [
                item.external_inventory_item_id,
                item.id,
              ]),
            );
            const snapshotRows: Array<Record<string, unknown>> = [];
            for (const { root, childrenByParentId } of groups) {
              const inventoryItemId = inventoryIdByExternalId.get(root.id);
              if (!inventoryItemId) continue;
              const levels = (childrenByParentId.get(root.id) ?? []) as BulkInventoryLevelLine[];
              for (const level of levels) {
                const locationId = locationMap.get(level.location.id);
                if (!locationId) continue;
                const quantities = level.quantities ?? [];
                const quantityMap = Object.fromEntries(
                  quantities.map((quantity) => [quantity.name, quantity.quantity]),
                ) as Record<string, number>;
                snapshotRows.push({
                  organization_id: connection.organization_id,
                  inventory_item_id: inventoryItemId,
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
            separateInventoryLevelCount += snapshotRows.length;
            blocks.inventory.read += snapshotRows.length;
            await upsertBlockRows(
              supabase,
              blocks.inventory,
              "shopify_inventory_current_state",
              snapshotRows,
              "inventory_item_id,location_id",
            );
          },
        );
        inventoryLevelCount += separateInventoryLevelCount;
        logger.info("Shopify inventory levels bulk sync completed", {
          connection_id: connectionId,
          organization_id: connection.organization_id,
          shop_domain: shopDomain,
          inventory_levels_written: separateInventoryLevelCount,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "shopify_inventory_levels_sync_failed";
        blocks.inventory.failed += 1;
        blocks.inventory.error = blocks.inventory.error ?? message;
      }

      if (inventoryItemCount && locationMap.size && !inventoryLevelCount) {
        logger.error(
          "Shopify bulk grouping found no inventory levels despite tracked items and known locations",
          {
            connection_id: connectionId,
            organization_id: connection.organization_id,
            shop_domain: shopDomain,
            inventory_items: inventoryItemCount,
            locations_known: locationMap.size,
          },
        );
      }

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
                discountApplications {
                  edges {
                    node {
                      index
                      allocationMethod
                      targetType
                      ... on DiscountCodeApplication { code }
                      ... on ManualDiscountApplication { title }
                      ... on ScriptDiscountApplication { title }
                      ... on AutomaticDiscountApplication { title }
                    }
                  }
                }
                shippingLines {
                  edges {
                    node {
                      id
                      discountAllocations {
                        allocatedAmountSet { shopMoney { amount currencyCode } }
                        discountApplication { index }
                      }
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
                shippingAddress { countryCodeV2 provinceCode }
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
                      lineItemGroup { id productId variantId quantity title }
                      originalUnitPriceSet { shopMoney { amount } }
                      originalTotalSet { shopMoney { amount } }
                      ${withExtras ? "priceAfterAllDiscountsBeforeTaxesSet { shopMoney { amount } } discountAllocations { allocatedAmountSet { shopMoney { amount currencyCode } } discountApplication { index } }" : ""}
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

      let ordersResolved = 0;
      let lineItemsScanned = 0;
      await forEachBulkRootBatch(bulkResult.url, 25, async (rootBatch) => {
      const orderLines = rootBatch.map(({ root }) => root);
      const childrenByParentId = new Map<string, BulkLine[]>();
      for (const group of rootBatch) {
        for (const [parentId, children] of group.childrenByParentId) {
          childrenByParentId.set(parentId, children);
        }
      }

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
        shipping_country_code: order.shippingAddress?.countryCodeV2 ?? null,
        shipping_region_code: order.shippingAddress?.provinceCode ?? null,
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
        connection.organization_id,
        "store_id",
        [storeId],
      );
      const orderMap = new Map(
        orderRefs.map((order) => [order.external_order_id, order.id]),
      );
      ordersResolved += orderMap.size;
      const unresolvedOrderCount = orderRows.filter(
        (row) => !orderMap.has(row.external_order_id),
      ).length;
      if (unresolvedOrderCount) {
        blocks.orders.failed += unresolvedOrderCount;
        blocks.orders.error = "shopify_order_reference_incomplete";
        logger.error("Shopify orders were not all available for relationship sync", {
          connection_id: connectionId,
          store_id: storeId,
          orders_in_batch: orderRows.length,
          orders_resolved: orderMap.size,
          orders_missing: unresolvedOrderCount,
        });
      }

      const lineItemsByOrderId: Array<{
        orderId: string;
        lineItem: BulkLineItemLine;
      }> = [];
      const discountApplicationsByOrderId: Array<{
        orderId: string;
        application: BulkDiscountApplicationLine;
      }> = [];
      const discountAllocationsByOrderAndIndex = new Map<string, number>();
      const allocationGroupsByOrderId = new Map<
        string,
        Array<Array<ShopifyDiscountAllocation> | null | undefined>
      >();
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
            const groups = allocationGroupsByOrderId.get(orderId) ?? [];
            groups.push(child.discountAllocations);
            allocationGroupsByOrderId.set(orderId, groups);
          } else if (isDiscountApplicationChild(child)) {
            discountApplicationsByOrderId.push({
              orderId,
              application: child,
            });
          } else if (isShippingLineChild(child)) {
            const groups = allocationGroupsByOrderId.get(orderId) ?? [];
            groups.push(child.discountAllocations);
            allocationGroupsByOrderId.set(orderId, groups);
          }
        }
        const allocationsByIndex = aggregateShopifyDiscountAllocations(
          allocationGroupsByOrderId.get(orderId) ?? [],
        );
        for (const [index, amount] of allocationsByIndex) {
          discountAllocationsByOrderAndIndex.set(`${orderId}:${index}`, amount);
        }
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
        connection.organization_id,
        "store_id",
        [storeId],
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
        const bundleGroup = lineItem.lineItemGroup;
        const bundleGroupWasRead = "lineItemGroup" in lineItem;

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
          // Shopify's discountedTotalSet is a post-discount price, not the
          // discount amount. Use the actual allocations to keep this column
          // consistent with REST webhooks and the margin RPC.
          discount_total: sumShopifyLineDiscountAllocations(
            lineItem.discountAllocations,
          ),
          current_line_total: normalizeMoney(
            lineItem.originalTotalSet?.shopMoney?.amount,
          ),
          ...(bundleGroupWasRead
            ? !bundleGroup
              ? {
                  bundle_group_coverage: "not_bundle",
                  bundle_group_id: null,
                  bundle_parent_title: null,
                  bundle_parent_external_product_id: null,
                  bundle_parent_external_variant_id: null,
                  bundle_parent_quantity: null,
                }
              : {
                  bundle_group_coverage:
                    bundleGroup.id &&
                    bundleGroup.title &&
                    typeof bundleGroup.quantity === "number" &&
                    bundleGroup.quantity > 0
                      ? "confirmed"
                      : "partial",
                  bundle_group_id: bundleGroup.id ?? null,
                  bundle_parent_title: bundleGroup.title ?? null,
                  bundle_parent_external_product_id: bundleGroup.productId ?? null,
                  bundle_parent_external_variant_id: bundleGroup.variantId ?? null,
                  bundle_parent_quantity:
                    typeof bundleGroup.quantity === "number" && bundleGroup.quantity > 0
                      ? bundleGroup.quantity
                      : null,
                }
            : {}),
          ...(extrasIncluded &&
          typeof lineItem.currentQuantity === "number" &&
          lineItem.priceAfterAllDiscountsBeforeTaxesSet?.shopMoney?.amount != null
            ? {
                net_quantity: lineItem.currentQuantity,
                net_revenue: normalizeMoney(
                  lineItem.priceAfterAllDiscountsBeforeTaxesSet.shopMoney.amount,
                ),
                net_metrics_source: "shopify_graphql_exact",
              }
            : {}),
        };
      });
      lineItemsScanned += orderItemRows.length;

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
        connection.organization_id,
        "order_id",
        [...new Set(orderItemRows.map((row) => row.order_id as string))],
      );
      const orderItemMap = new Map(
        orderItemRefs.map((item) => [item.external_line_item_id, item.id]),
      );
      const unresolvedOrderItemCount = orderItemRows.filter(
        (row) => !orderItemMap.has(row.external_line_item_id),
      ).length;
      if (unresolvedOrderItemCount) {
        blocks.orders.failed += unresolvedOrderItemCount;
        blocks.orders.error = "shopify_order_item_reference_incomplete";
        logger.error("Shopify order lines were not all available for refund relationships", {
          connection_id: connectionId,
          store_id: storeId,
          line_items_in_batch: orderItemRows.length,
          line_items_resolved: orderItemMap.size,
          line_items_missing: unresolvedOrderItemCount,
        });
      }

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
        connection.organization_id,
        "order_id",
        [...new Set(refundRows.map((row) => row.order_id as string))],
      );
      const refundMap = new Map(
        refundRefs.map((refund) => [refund.external_refund_id, refund.id]),
      );
      const unresolvedRefundCount = refundRows.filter(
        (row) => !refundMap.has(row.external_refund_id as string),
      ).length;
      if (unresolvedRefundCount) {
        blocks.refunds.failed += unresolvedRefundCount;
        blocks.refunds.error = "shopify_refund_reference_incomplete";
        logger.error("Shopify refunds were not all available for line relationships", {
          connection_id: connectionId,
          store_id: storeId,
          refunds_in_batch: refundRows.length,
          refunds_resolved: refundMap.size,
          refunds_missing: unresolvedRefundCount,
        });
      }

      const refundItemRows: Array<Record<string, unknown>> = [];
      let unresolvedRefundLineItemCount = 0;
      for (const { refund } of refundsByOrderId) {
        const refundId = refundMap.get(refund.id);
        if (!refundId) {
          unresolvedRefundLineItemCount += (childrenByParentId.get(refund.id) ?? []).length;
          continue;
        }

        for (const refundLineItem of (childrenByParentId.get(refund.id) ??
          []) as BulkRefundLineItemLine[]) {
          const lineItemId = refundLineItem.lineItem?.id
            ? orderItemMap.get(refundLineItem.lineItem.id)
            : null;
          if (!lineItemId) {
            unresolvedRefundLineItemCount += 1;
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

      if (unresolvedRefundLineItemCount) {
        blocks.refunds.failed += unresolvedRefundLineItemCount;
        blocks.refunds.error = "shopify_refund_line_item_reference_incomplete";
        logger.error("Shopify refund lines were omitted because their local references were missing", {
          connection_id: connectionId,
          store_id: storeId,
          refund_lines_missing: unresolvedRefundLineItemCount,
        });
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
            store_id: storeId,
            order_id: orderId,
            // El enlace a `shopify_discounts` lo pone el bloque de promociones,
            // que es quien conoce los ids. Aqui se guarda el texto, que es lo
            // que sobrevive si la promocion se borra en Shopify.
            code: application.code ?? null,
            title: application.title ?? null,
            allocation_method: application.allocationMethod ?? null,
            target_type: application.targetType ?? null,
            amount:
              application.index == null
                ? 0
                : discountAllocationsByOrderAndIndex.get(
                    `${orderId}:${application.index}`,
                  ) ?? 0,
            amount_coverage:
              !extrasIncluded || application.index == null
                ? "unavailable"
                : "complete",
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
      });

      if (ordersResolved && !lineItemsScanned) {
        logger.error(
          "Shopify bulk grouping found no line items for any synced order - __parentId matching likely broke",
          {
            connection_id: connectionId,
            organization_id: connection.organization_id,
            shop_domain: shopDomain,
            orders_synced: ordersResolved,
          },
        );
      }

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

    // Tracking events are a separate bounded read. Carrier message text is
    // inspected only in memory to derive a small reason code; no address or
    // source message is persisted, logged, or sent to the model.
    try {
      accessToken = await getValidShopifyAccessToken(env, connectionId);
      const eventSync = await syncShopifyFulfillmentEvents({
        supabase,
        shopDomain,
        accessToken,
        organizationId: connection.organization_id,
        storeId,
      });
      blocks.fulfillment_events.read += eventSync.read;
      blocks.fulfillment_events.written += eventSync.written;
      blocks.fulfillment_events.failed += eventSync.failed;
      blocks.fulfillment_events.warning = eventSync.warning;
    } catch (error) {
      blocks.fulfillment_events.failed += 1;
      blocks.fulfillment_events.warning =
        error instanceof Error
          ? error.message
          : "fulfillment_events_sync_unavailable";
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

      await forEachBulkResultBatch(bulkResult.url, UPSERT_BATCH_SIZE, async (batch) => {
        const customerRows = (batch as BulkCustomerLine[]).map((customer) => ({
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
        }));
        blocks.customers.read += customerRows.length;
        await upsertBlockRows(
          supabase,
          blocks.customers,
          "shopify_customers",
          customerRows,
          "store_id,external_customer_id",
        );
      });
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

      let checkoutsScanned = 0;
      await forEachBulkRootBatch(bulkResult.url, 100, async (rootBatch) => {
      const checkoutLines = rootBatch.map(({ root }) => root) as BulkAbandonedCheckoutLine[];
      const childrenByParentId = new Map<string, BulkLine[]>();
      for (const group of rootBatch) {
        for (const [parentId, children] of group.childrenByParentId) {
          childrenByParentId.set(parentId, children);
        }
      }
      checkoutsScanned += checkoutLines.length;

      const checkoutRows = checkoutLines.map((checkout) => ({
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
        connection.organization_id,
        "store_id",
        [storeId],
      );
      const checkoutMap = new Map(
        checkoutRefs.map((row) => [row.external_checkout_id, row.id]),
      );
      const unresolvedCheckoutCount = checkoutRows.filter(
        (row) => !checkoutMap.has(row.external_checkout_id),
      ).length;
      if (unresolvedCheckoutCount) {
        blocks.abandoned_checkouts.failed += unresolvedCheckoutCount;
        blocks.abandoned_checkouts.error = "shopify_checkout_reference_incomplete";
        logger.error("Shopify checkouts were not all available for line-item sync", {
          connection_id: connectionId,
          store_id: storeId,
          checkouts_in_batch: checkoutRows.length,
          checkouts_resolved: checkoutMap.size,
          checkouts_missing: unresolvedCheckoutCount,
        });
      }

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
        connection.organization_id,
        "store_id",
        [storeId],
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
      });

      logger.info("Shopify abandoned checkouts bulk sync completed", {
        connection_id: connectionId,
        organization_id: connection.organization_id,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        checkouts_scanned: checkoutsScanned,
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
                    title summary status startsAt endsAt createdAt
                    usageLimit appliesOncePerCustomer asyncUsageCount
                    codes { edges { node { code } } }
                    context { __typename }
                    combinesWith { orderDiscounts productDiscounts shippingDiscounts }
                    customerGets {
                      appliesOnOneTimePurchase appliesOnSubscription
                      items { __typename }
                      value { __typename
                        ... on DiscountPercentage { percentage }
                        ... on DiscountAmount { amount { amount currencyCode } appliesOnEachItem }
                      }
                    }
                    minimumRequirement { __typename
                      ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
                      ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount currencyCode } }
                    }
                  }
                  ... on DiscountCodeBxgy {
                    title summary status startsAt endsAt createdAt
                    usageLimit appliesOncePerCustomer asyncUsageCount usesPerOrderLimit
                    codes { edges { node { code } } }
                    context { __typename }
                    combinesWith { orderDiscounts productDiscounts shippingDiscounts }
                    customerBuys { value { __typename ... on DiscountQuantity { quantity } } items { __typename } }
                    customerGets {
                      appliesOnOneTimePurchase appliesOnSubscription
                      items { __typename }
                      value { __typename ... on DiscountOnQuantity {
                        quantity { quantity }
                        effect { __typename
                          ... on DiscountPercentage { percentage }
                          ... on DiscountAmount { amount { amount currencyCode } appliesOnEachItem }
                        }
                      } }
                    }
                  }
                  ... on DiscountCodeFreeShipping {
                    title summary status startsAt endsAt createdAt
                    usageLimit appliesOncePerCustomer asyncUsageCount
                    codes { edges { node { code } } }
                    context { __typename }
                    combinesWith { orderDiscounts productDiscounts shippingDiscounts }
                    minimumRequirement { __typename
                      ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
                      ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount currencyCode } }
                    }
                  }
                  ... on DiscountAutomaticBasic {
                    title summary status startsAt endsAt createdAt asyncUsageCount
                    combinesWith { orderDiscounts productDiscounts shippingDiscounts }
                    customerGets {
                      appliesOnOneTimePurchase appliesOnSubscription
                      items { __typename }
                      value {
                        __typename
                        ... on DiscountPercentage { percentage }
                        ... on DiscountAmount { amount { amount currencyCode } appliesOnEachItem }
                      }
                    }
                    minimumRequirement { __typename
                      ... on DiscountMinimumQuantity { greaterThanOrEqualToQuantity }
                      ... on DiscountMinimumSubtotal { greaterThanOrEqualToSubtotal { amount currencyCode } }
                    }
                  }
                  ... on DiscountAutomaticBxgy {
                    title summary status startsAt endsAt createdAt asyncUsageCount usesPerOrderLimit
                    combinesWith { orderDiscounts productDiscounts shippingDiscounts }
                    customerBuys { value { __typename ... on DiscountQuantity { quantity } } items { __typename } }
                    customerGets { items { __typename }
                      value { __typename ... on DiscountOnQuantity {
                        quantity { quantity }
                        effect { __typename
                          ... on DiscountPercentage { percentage }
                          ... on DiscountAmount { amount { amount currencyCode } appliesOnEachItem }
                        }
                      } }
                    }
                  }
                  ... on DiscountAutomaticFreeShipping {
                    title summary status startsAt endsAt createdAt asyncUsageCount
                    combinesWith { orderDiscounts productDiscounts shippingDiscounts }
                  }
                  ... on DiscountCodeApp {
                    title status startsAt endsAt createdAt
                    codes { edges { node { code } } }
                  }
                  ... on DiscountAutomaticApp {
                    title status startsAt endsAt createdAt
                  }
                }
              }
            }
          }
        }`,
      );

      const discountUpsertFailureCount = blocks.discounts.failed;
      let discountRowsCount = 0;
      let discountsStoredCount = 0;
      const discountIdByCode = new Map<string, Set<string>>();
      await forEachBulkRootBatch(bulkResult.url, 50, async (rootBatch) => {
        const discountRows = rootBatch.map(({ root, childrenByParentId }) => {
          const node = root as BulkDiscountNodeLine;
          const discount = node.discount;
          const typeName = discount?.__typename ?? "";
          const codes = (childrenByParentId.get(node.id) ?? [])
            .map((child) => (child as BulkDiscountCodeLine).code)
            .filter((value): value is string => typeof value === "string" && value.length > 0);
          const code = codes[0] ?? null;

          const classified = classifyDiscount(
            typeName,
            discount?.customerGets?.value,
          );
          // Bulk Operations agota las conexiones nested y devuelve cada nodo
          // hijo como una línea JSONL; Shopify ignora pageInfo en estas queries.
          const codesCoverage = "complete";
          const configurationCoverage = typeName.includes("App")
            ? "app_managed"
            : discount?.summary
              ? "summary"
              : "partial";
          const ruleData = JSON.parse(
            JSON.stringify({
              summary: discount?.summary ?? null,
              context_type: discount?.context?.__typename ?? null,
              combines_with: discount?.combinesWith ?? null,
              minimum_requirement: discount?.minimumRequirement ?? null,
              customer_buys: discount?.customerBuys ?? null,
              customer_gets: discount?.customerGets ?? null,
            }),
          ) as Json;

          return {
            organization_id: connection.organization_id,
            store_id: storeId,
            external_discount_id: node.id,
            title: discount?.title ?? null,
            code,
            codes,
            codes_coverage: codesCoverage,
            configuration_coverage: configurationCoverage,
            summary: discount?.summary ?? null,
            rule_data: ruleData,
            status: discount?.status ?? null,
            discount_class: classified.discountClass,
            value_type: classified.valueType,
            value: classified.amount,
            // `asyncUsageCount` se actualiza de forma asincrona segun la
            // propia documentacion: sirve para ordenar promociones por uso,
            // no para cuadrar contabilidad al centimo.
            usage_count: discount?.asyncUsageCount ?? 0,
            usage_limit: discount?.usageLimit ?? null,
            uses_per_order_limit: discount?.usesPerOrderLimit ?? null,
            applies_once_per_customer:
              discount?.appliesOncePerCustomer ?? null,
            starts_at: discount?.startsAt ?? null,
            ends_at: discount?.endsAt ?? null,
            external_created_at: discount?.createdAt ?? null,
          };
        });
        discountRowsCount += discountRows.length;
        blocks.discounts.read += discountRows.length;
        await upsertBlockRows(
          supabase,
          blocks.discounts,
          "shopify_discounts",
          discountRows,
          "store_id,external_discount_id",
        );
        const storedDiscounts = await selectAll<{
          id: string;
          external_discount_id: string;
          code: string | null;
          codes: string[] | null;
        }>(
          supabase,
          "shopify_discounts",
          "id, external_discount_id, code, codes",
          "external_discount_id",
          discountRows.map((row) => row.external_discount_id),
          connection.organization_id,
          "store_id",
          [storeId],
        );
        discountsStoredCount += storedDiscounts.length;
        for (const stored of storedDiscounts) {
          for (const discountCode of new Set([
            ...(stored.codes ?? []),
            ...(stored.code ? [stored.code] : []),
          ])) {
            const discountIds = discountIdByCode.get(discountCode) ?? new Set<string>();
            discountIds.add(stored.id);
            discountIdByCode.set(discountCode, discountIds);
          }
        }
      });
      const discountCatalogComplete =
        blocks.discounts.failed === discountUpsertFailureCount &&
        discountsStoredCount === discountRowsCount;

      // Enganchar los descuentos ya aplicados en pedidos. El bloque de pedidos
      // guarda el texto del codigo porque es lo que sobrevive si la promocion
      // se borra; el enlace lo pone aqui, que es quien conoce los ids.
      let ambiguousCodeCount = 0;
      for (const [code, discountIds] of discountIdByCode) {
        if (discountIds.size !== 1) {
          ambiguousCodeCount += 1;
          continue;
        }
        const [discountId] = discountIds;
        if (!discountId) continue;
        const { error: linkError } = await supabase
          .from("shopify_order_discount_applications")
          .update({ discount_id: discountId })
          .eq("organization_id", connection.organization_id)
          .eq("store_id", storeId)
          .eq("code", code)
          .is("discount_id", null);
        if (linkError) {
          blocks.discounts.failed += 1;
          blocks.discounts.error = `shopify_order_discount_link_failed: ${linkError.message}`;
        }
      }

      for (const ruleSide of ["gets", "buys"] as const) {
        const snapshotAt = new Date().toISOString();
        let sideStatus: "complete" | "partial" | "failed" = "failed";
        let discountsScanned = 0;
        let targetsScanned = 0;
        let targetErrorCode: string | null = null;

        try {
          // buys y gets se consultan en bulk separados para conservar el lado
          // exacto de cada relacion cuando Shopify aplana las conexiones JSONL.
          const targetBulk = await runBulkOperation(
            shopDomain,
            accessToken,
            buildDiscountTargetBulkQuery(ruleSide),
          );
          let isPartial = !discountCatalogComplete;
          await forEachBulkRootBatch(targetBulk.url, 25, async (rootBatch) => {
            const targetDiscountNodes = rootBatch.map(({ root }) => root as BulkDiscountTargetNodeLine);
            discountsScanned += targetDiscountNodes.length;
            const localDiscountRefs = await selectAll<{ id: string; external_discount_id: string }>(
              supabase,
              "shopify_discounts",
              "id, external_discount_id",
              "external_discount_id",
              targetDiscountNodes.map((node) => node.id),
              connection.organization_id,
              "store_id",
              [storeId],
            );
            const discountIdByExternalId = new Map(
              localDiscountRefs.map((discount) => [discount.external_discount_id, discount.id]),
            );
            if (localDiscountRefs.length !== targetDiscountNodes.length) isPartial = true;
            const targetRows: Array<Record<string, unknown>> = [];

          for (const group of rootBatch) {
            const node = group.root as BulkDiscountTargetNodeLine;
            const discount = node.discount;
            const discountType = discount?.__typename ?? "";
            const items = ruleSide === "gets"
              ? discount?.customerGets?.items
              : discount?.customerBuys?.items;
            if (discountType.includes("App")) isPartial = true;
            // Los descuentos basic y free-shipping no exponen customerBuys;
            // su ausencia en ese lado es esperada, no falta de cobertura.
            if (discountType && !isKnownShopifyDiscountType(discountType)) isPartial = true;
            if (!items) continue;

            const localDiscountId = discountIdByExternalId.get(node.id);
            if (!localDiscountId) {
              isPartial = true;
              continue;
            }
            const itemType = items.__typename ?? "";
            if (itemType === "AllDiscountItems") {
              targetRows.push({
                organization_id: connection.organization_id,
                store_id: storeId,
                discount_id: localDiscountId,
                rule_side: ruleSide,
                target_type: "all",
                external_target_id: "all",
                target_title: "Todos los productos",
                parent_external_product_id: null,
                is_active: true,
                last_seen_at: snapshotAt,
                updated_at: snapshotAt,
              });
              continue;
            }

            for (const target of (group.childrenByParentId.get(node.id) ?? []) as BulkDiscountTargetLine[]) {
              const externalTargetId = target.id;
              if (!externalTargetId) {
                isPartial = true;
                continue;
              }
              const targetType = classifyDiscountTargetId(externalTargetId);
              if (!targetType) {
                isPartial = true;
                continue;
              }
              targetRows.push({
                organization_id: connection.organization_id,
                store_id: storeId,
                discount_id: localDiscountId,
                rule_side: ruleSide,
                target_type: targetType,
                external_target_id: externalTargetId,
                target_title: target.title ?? null,
                parent_external_product_id:
                  targetType === "variant" ? target.product?.id ?? null : null,
                is_active: true,
                last_seen_at: snapshotAt,
                updated_at: snapshotAt,
              });
            }
          }

          for (const batch of chunk(targetRows, UPSERT_BATCH_SIZE)) {
            const { error } = await supabase
              .from("shopify_discount_targets")
              .upsert(batch, {
                onConflict: "store_id,discount_id,rule_side,target_type,external_target_id",
              });
            if (error) throw new Error(`shopify_discount_targets_upsert_failed: ${error.message}`);
          }
          targetsScanned += targetRows.length;
          });
          if (discountsScanned !== discountRowsCount) isPartial = true;
          sideStatus = isPartial ? "partial" : "complete";

          // Una lectura parcial no retira objetivos anteriores: podrían faltar
          // páginas. Solo un snapshot completo puede dar de baja relaciones.
          if (sideStatus === "complete") {
            const { error } = await supabase
              .from("shopify_discount_targets")
              .update({ is_active: false })
              .eq("organization_id", connection.organization_id)
              .eq("store_id", storeId)
              .eq("rule_side", ruleSide)
              .lt("last_seen_at", snapshotAt);
            if (error) throw new Error(`shopify_discount_targets_retire_failed: ${error.message}`);
          }
        } catch (error) {
          sideStatus = "failed";
          targetErrorCode = error instanceof Error
            ? error.message.slice(0, 120)
            : "discount_targets_sync_failed";
          blocks.discounts.failed += 1;
          blocks.discounts.error = targetErrorCode;
        }

        const { error: coverageError } = await supabase
          .from("shopify_discount_target_sync_coverage")
          .upsert({
            organization_id: connection.organization_id,
            store_id: storeId,
            rule_side: ruleSide,
            status: sideStatus,
            discounts_scanned: discountsScanned,
            targets_scanned: targetsScanned,
            last_synced_at: snapshotAt,
            error_code: targetErrorCode,
            updated_at: snapshotAt,
          }, { onConflict: "store_id,rule_side" });
        if (coverageError) {
          blocks.discounts.failed += 1;
          blocks.discounts.error = `shopify_discount_target_coverage_upsert_failed: ${coverageError.message}`;
        }
      }

      logger.info("Shopify discounts bulk sync completed", {
        connection_id: connectionId,
        organization_id: connection.organization_id,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        discounts_written: blocks.discounts.written,
        codes_linked: discountIdByCode.size - ambiguousCodeCount,
        ambiguous_codes: ambiguousCodeCount,
        target_coverage: ["gets", "buys"],
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

      await forEachBulkResultBatch(bulkResult.url, UPSERT_BATCH_SIZE, async (batch) => {
        const eventRows = (batch as BulkMarketingEventLine[]).map((event) => ({
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
        }));
        blocks.marketing_events.read += eventRows.length;
        await upsertBlockRows(
          supabase,
          blocks.marketing_events,
          "shopify_marketing_events",
          eventRows,
          "store_id,external_event_id",
        );
      });

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

      const collectionSnapshotAt = new Date().toISOString();
      let collectionSnapshotComplete = true;
      let collectionMarkerAvailable = true;
      let collectionsScanned = 0;
      let membershipsObserved = 0;
      const initialCollectionFailures = blocks.collections.failed;
      const markerProbe = await supabase
        .from("shopify_product_collections")
        .select("last_seen_at")
        .limit(1);
      if (markerProbe.error && isMissingShopifyCollectionSyncMarker(markerProbe.error.message)) {
        collectionMarkerAvailable = false;
        collectionSnapshotComplete = false;
        blocks.collections.warning = "shopify_collection_sync_marker_migration_pending; stale_memberships_retained";
      } else if (markerProbe.error) {
        throw new Error(`shopify_collection_marker_read_failed: ${markerProbe.error.message}`);
      }
      let activeCollectionExternalId: string | null = null;
      let activeCollectionId: string | null = null;
      let activeCollectionProductCount = 0;
      try {
        await forEachBulkRootChildrenBatch(bulkResult.url, 500, async ({
          root,
          children,
          rootComplete,
        }) => {
          const collection = root as BulkCollectionLine;
          const isNewRoot = activeCollectionExternalId !== collection.id;
          if (isNewRoot) {
            activeCollectionExternalId = collection.id;
            activeCollectionId = null;
            activeCollectionProductCount = 0;
            const { data: existingCollection, error: existingCollectionError } = await supabase
              .from("shopify_collections")
              .select("products_count")
              .eq("organization_id", connection.organization_id)
              .eq("store_id", storeId)
              .eq("external_collection_id", collection.id)
              .maybeSingle();
            if (existingCollectionError) {
              throw new Error(`shopify_collection_reference_read_failed: ${existingCollectionError.message}`);
            }
            const collectionRows = [{
              organization_id: connection.organization_id,
              store_id: storeId,
              external_collection_id: collection.id,
              title: collection.title ?? "",
              handle: collection.handle ?? null,
              is_automated: Boolean(collection.ruleSet),
              // Keep the last known count until the streamed snapshot finishes.
              products_count: existingCollection?.products_count ?? 0,
              external_updated_at: collection.updatedAt ?? null,
            }];
            blocks.collections.read += 1;
            collectionsScanned += 1;
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
              [collection.id],
              connection.organization_id,
              "store_id",
              [storeId],
            );
            activeCollectionId = collectionRefs[0]?.id ?? null;
            if (!activeCollectionId) {
              collectionSnapshotComplete = false;
              blocks.collections.failed += 1;
              blocks.collections.error = "shopify_collection_reference_incomplete";
              logger.error("Shopify collection was not available for membership sync", {
                connection_id: connectionId,
                store_id: storeId,
              });
            }
          }

          activeCollectionProductCount += children.length;
          if (children.length && activeCollectionId) {
            const productRefs = await selectAll<{
              id: string;
              external_product_id: string;
            }>(
              supabase,
              "shopify_products",
              "id, external_product_id",
              "external_product_id",
              [...new Set(children.map((child) => child.id))],
              connection.organization_id,
              "store_id",
              [storeId],
            );
            const productMap = new Map(
              productRefs.map((row) => [row.external_product_id, row.id]),
            );
            const membershipRows: Array<Record<string, unknown>> = [];
            let unresolvedProductCount = 0;
            for (const child of children) {
              const productId = productMap.get(child.id);
              if (!productId) {
                unresolvedProductCount += 1;
                continue;
              }
              membershipRows.push({
                organization_id: connection.organization_id,
                collection_id: activeCollectionId,
                product_id: productId,
                last_seen_at: collectionSnapshotAt,
              });
            }
            if (unresolvedProductCount) {
              collectionSnapshotComplete = false;
              blocks.collections.failed += unresolvedProductCount;
              blocks.collections.error = "shopify_collection_product_reference_incomplete";
              logger.error("Shopify collection memberships could not all resolve to local products", {
                connection_id: connectionId,
                store_id: storeId,
                product_references_missing: unresolvedProductCount,
              });
            }

            blocks.collections.read += membershipRows.length;
            membershipsObserved += membershipRows.length;
            if (membershipRows.length) {
              let rows = collectionMarkerAvailable
                ? membershipRows
                : membershipRows.map(({ last_seen_at: _lastSeenAt, ...row }) => row);
              let { error } = await supabase
                .from("shopify_product_collections")
                .upsert(rows, { onConflict: "product_id,collection_id" });
              if (error && collectionMarkerAvailable && isMissingShopifyCollectionSyncMarker(error.message)) {
                collectionMarkerAvailable = false;
                collectionSnapshotComplete = false;
                rows = membershipRows.map(({ last_seen_at: _lastSeenAt, ...row }) => row);
                const retry = await supabase
                  .from("shopify_product_collections")
                  .upsert(rows, { onConflict: "product_id,collection_id" });
                error = retry.error;
                blocks.collections.warning = "shopify_collection_sync_marker_migration_pending; stale_memberships_retained";
              }
              if (error) {
                blocks.collections.failed += membershipRows.length;
                blocks.collections.error = `shopify_product_collections_upsert_failed: ${error.message}`;
                collectionSnapshotComplete = false;
                throw new Error(blocks.collections.error);
              }
              blocks.collections.written += membershipRows.length;
            }
          }

          if (rootComplete) {
            if (activeCollectionId) {
              const { error: countUpdateError } = await supabase
                .from("shopify_collections")
                .update({ products_count: activeCollectionProductCount })
                .eq("organization_id", connection.organization_id)
                .eq("store_id", storeId)
                .eq("id", activeCollectionId);
              if (countUpdateError) {
                collectionSnapshotComplete = false;
                throw new Error(`shopify_collection_count_update_failed: ${countUpdateError.message}`);
              }
            }
            activeCollectionExternalId = null;
            activeCollectionId = null;
            activeCollectionProductCount = 0;
          }
        });
      } catch (error) {
        collectionSnapshotComplete = false;
        throw error;
      }

      // Las ausencias solo se reconcilian despues de procesar todo el JSONL,
      // resolver cada referencia y guardar todos los lotes. Si la migracion
      // aun no esta aplicada, se conservan membresias antiguas y se informa.
      if (collectionSnapshotComplete && collectionMarkerAvailable &&
          blocks.collections.failed === initialCollectionFailures) {
        let collectionOffset = 0;
        while (true) {
          const { data: collectionPage, error: collectionsReadError } = await supabase
            .from("shopify_collections")
            .select("id")
            .eq("organization_id", connection.organization_id)
            .eq("store_id", storeId)
            .range(collectionOffset, collectionOffset + 999);
          if (collectionsReadError) throw new Error(`shopify_collection_reference_read_failed: ${collectionsReadError.message}`);
          const page = (collectionPage ?? []) as Array<{ id: string }>;
          const ids = page.map(({ id }) => id);
          if (ids.length) {
            const { error: staleDeleteError } = await supabase
              .from("shopify_product_collections")
              .delete()
              .eq("organization_id", connection.organization_id)
              .in("collection_id", ids)
              .neq("last_seen_at", collectionSnapshotAt);
            if (staleDeleteError) throw new Error(`shopify_collection_membership_retire_failed: ${staleDeleteError.message}`);
            const { error: nullDeleteError } = await supabase
              .from("shopify_product_collections")
              .delete()
              .eq("organization_id", connection.organization_id)
              .in("collection_id", ids)
              .is("last_seen_at", null);
            if (nullDeleteError) throw new Error(`shopify_collection_membership_retire_failed: ${nullDeleteError.message}`);
          }
          if (page.length < 1000) break;
          collectionOffset += page.length;
        }
      } else if (!collectionMarkerAvailable) {
        logger.info("Shopify collection membership reconciliation skipped; marker migration is pending", {
          connection_id: connectionId,
          store_id: storeId,
        });
      }

      logger.info("Shopify collections bulk sync completed", {
        connection_id: connectionId,
        organization_id: connection.organization_id,
        shop_domain: shopDomain,
        object_count: bulkResult.objectCount,
        collections_scanned: collectionsScanned,
        collections_written: blocks.collections.written,
        memberships: membershipsObserved,
        membership_reconciliation_complete: collectionSnapshotComplete && collectionMarkerAvailable,
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

    const { error: markErrorError } = await supabase
      .from("integration_connections")
      .update({
        status: "error",
        last_error_at: finishedAt,
        last_error_message: combinedError,
        ...(storeId ? { last_sync_at: finishedAt } : {}),
      })
      .eq("id", connectionId);
    if (markErrorError) throw new Error(`shopify_connection_mark_error_failed: ${markErrorError.message}`);

    logger.error("Shopify sync finished with block failures", {
      connection_id: connectionId,
      organization_id: connection.organization_id,
      shop_domain: shopDomain,
      failed_blocks: failedBlocks.map(([key]) => key),
      error_message: combinedError,
    });

    const retryableFailures = failedBlocks.filter(([, block]) =>
      !isShopifyAuthorizationFailure(
        explainShopifyError(block.error ?? "", connectionScopes),
      ),
    );
    if (fatalError || retryableFailures.length > 0) {
      throw new Error(
        fatalError
          ? `shopify_sync_failed: ${fatalError}`
          : `shopify_sync_partial_failure: ${combinedError}`,
      );
    }

    // An authorization failure needs the store owner to reconnect. Returning
    // lets BullMQ mark the job complete instead of retrying the same denial;
    // the failed block remains visible on the integration connection.
    return;
  }

  const { error: markConnectedError } = await supabase
    .from("integration_connections")
    .update({
      status: "connected",
      last_sync_at: finishedAt,
      last_error_message: null,
      last_error_at: null,
    })
    .eq("id", connectionId);
  if (markConnectedError) throw new Error(`shopify_connection_mark_connected_failed: ${markConnectedError.message}`);

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
