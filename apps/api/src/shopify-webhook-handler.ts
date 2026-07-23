import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { verifyShopifyWebhookHmac } from "./shopify-webhooks.js";
import { applyRefundAggregatesToOrderItems } from "./shopify-refund-aggregates.js";

type ApiEnv = LoadedApiEnv;
const logger = createLogger("shopify-webhook-handler");

type SyncBlockKey = "catalog" | "inventory" | "orders" | "refunds";

type RestMoneySet = { shop_money?: { amount?: string | null } | null } | null;

function createServiceClient(env: ApiEnv) {
  const realtimeTransport = WebSocket as any;

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: realtimeTransport },
  });
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function gid(resource: string, numericId: unknown) {
  return `gid://shopify/${resource}/${numericId}`;
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

async function recordBlockRun(
  supabase: SupabaseClient,
  connectionId: string,
  organizationId: string,
  scope: SyncBlockKey,
  status: "succeeded" | "failed",
  errorMessage?: string,
) {
  const now = new Date().toISOString();
  await supabase.from("integration_sync_runs").insert({
    connection_id: connectionId,
    organization_id: organizationId,
    provider: "shopify",
    sync_type: "webhook",
    sync_scope: scope,
    status,
    idempotency_key: `webhook:${scope}:${connectionId}:${now}:${crypto.randomUUID()}`,
    started_at: now,
    finished_at: now,
    records_read: 1,
    records_written: status === "succeeded" ? 1 : 0,
    records_failed: status === "failed" ? 1 : 0,
    ...(errorMessage ? { error_message: errorMessage } : {}),
  });
}

type ConnectionContext = {
  connectionId: string;
  organizationId: string;
  storeId: string;
};

async function resolveConnectionContext(
  supabase: SupabaseClient,
  shopDomain: string,
): Promise<ConnectionContext | null> {
  const { data: connection } = await supabase
    .from("integration_connections")
    .select("id, organization_id")
    .eq("provider", "shopify")
    .eq("provider_account_id", shopDomain)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!connection) {
    return null;
  }

  const { data: store } = await supabase
    .from("shopify_stores")
    .select("id")
    .eq("connection_id", connection.id)
    .maybeSingle();

  if (!store) {
    return null;
  }

  return { connectionId: connection.id, organizationId: connection.organization_id, storeId: store.id };
}

async function processProductUpdate(supabase: SupabaseClient, ctx: ConnectionContext, payload: Record<string, unknown>) {
  const externalProductId = typeof payload.admin_graphql_api_id === "string" ? payload.admin_graphql_api_id : gid("Product", payload.id);

  const { data: productRow, error: productError } = await supabase
    .from("shopify_products")
    .upsert(
      {
        organization_id: ctx.organizationId,
        store_id: ctx.storeId,
        external_product_id: externalProductId,
        title: typeof payload.title === "string" ? payload.title : "Sin titulo",
        handle: (payload.handle as string | undefined) ?? null,
        vendor: (payload.vendor as string | undefined) ?? null,
        product_type: (payload.product_type as string | undefined) ?? null,
        status: (payload.status as string | undefined) ?? null,
        published_at: (payload.published_at as string | undefined) ?? null,
        external_created_at: (payload.created_at as string | undefined) ?? null,
        external_updated_at: (payload.updated_at as string | undefined) ?? null,
      },
      { onConflict: "store_id,external_product_id" },
    )
    .select("id")
    .single();

  if (productError || !productRow) {
    throw new Error(productError?.message ?? "shopify_webhook_product_upsert_failed");
  }

  const variants = Array.isArray(payload.variants) ? (payload.variants as Array<Record<string, unknown>>) : [];

  if (!variants.length) {
    return;
  }

  const variantRows = variants.map((variant) => ({
    organization_id: ctx.organizationId,
    product_id: productRow.id,
    external_variant_id:
      typeof variant.admin_graphql_api_id === "string" ? variant.admin_graphql_api_id : gid("ProductVariant", variant.id),
    title: (variant.title as string | undefined) ?? null,
    barcode: (variant.barcode as string | undefined) ?? null,
    current_price: (variant.price as string | undefined) ?? null,
    compare_at_price: (variant.compare_at_price as string | undefined) ?? null,
    position: (variant.position as number | undefined) ?? null,
    taxable: (variant.taxable as boolean | undefined) ?? null,
    inventory_policy: (variant.inventory_policy as string | undefined) ?? null,
    is_active: true,
    external_created_at: (variant.created_at as string | undefined) ?? null,
    external_updated_at: (variant.updated_at as string | undefined) ?? null,
  }));

  const { error: variantError } = await supabase
    .from("shopify_variants")
    .upsert(variantRows, { onConflict: "product_id,external_variant_id" });

  if (variantError) {
    throw new Error(variantError.message);
  }
}

async function processInventoryLevelUpdate(supabase: SupabaseClient, ctx: ConnectionContext, payload: Record<string, unknown>) {
  const externalInventoryItemId = gid("InventoryItem", payload.inventory_item_id);
  const externalLocationId = gid("Location", payload.location_id);

  const { data: inventoryItem } = await supabase
    .from("shopify_inventory_items")
    .select("id")
    .eq("external_inventory_item_id", externalInventoryItemId)
    .maybeSingle();

  const { data: location } = await supabase
    .from("shopify_locations")
    .select("id")
    .eq("store_id", ctx.storeId)
    .eq("external_location_id", externalLocationId)
    .maybeSingle();

  if (!inventoryItem || !location) {
    logger.info("Shopify inventory webhook skipped - item or location not synced yet", {
      connection_id: ctx.connectionId,
      organization_id: ctx.organizationId,
      external_inventory_item_id: externalInventoryItemId,
      external_location_id: externalLocationId,
    });
    return;
  }

  const available = typeof payload.available === "number" ? payload.available : null;

  const { error } = await supabase.from("shopify_inventory_current_state").upsert(
    {
      organization_id: ctx.organizationId,
      inventory_item_id: inventoryItem.id,
      location_id: location.id,
      external_inventory_level_id: null,
      available_quantity: available,
      quantities_data: { available },
      is_active: true,
      updated_at: (payload.updated_at as string | undefined) ?? new Date().toISOString(),
    },
    { onConflict: "inventory_item_id,location_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function processOrderCreateOrUpdate(supabase: SupabaseClient, ctx: ConnectionContext, payload: Record<string, unknown>) {
  const externalOrderId = typeof payload.admin_graphql_api_id === "string" ? payload.admin_graphql_api_id : gid("Order", payload.id);
  const customer = payload.customer as Record<string, unknown> | null | undefined;
  const customerGid =
    customer && typeof customer.admin_graphql_api_id === "string"
      ? customer.admin_graphql_api_id
      : customer?.id
        ? gid("Customer", customer.id)
        : null;

  const { data: orderRow, error: orderError } = await supabase
    .from("shopify_order_facts")
    .upsert(
      {
        organization_id: ctx.organizationId,
        store_id: ctx.storeId,
        external_order_id: externalOrderId,
        order_name: (payload.name as string | undefined) ?? null,
        customer_reference_hash: customerGid ? sha256(customerGid) : null,
        financial_status: (payload.financial_status as string | undefined) ?? null,
        fulfillment_status: (payload.fulfillment_status as string | undefined) ?? null,
        source_name: (payload.source_name as string | undefined) ?? null,
        currency_code: (payload.currency as string | undefined) ?? null,
        presentment_currency_code: (payload.presentment_currency as string | undefined) ?? (payload.currency as string | undefined) ?? null,
        gross_sales: normalizeMoney(payload.subtotal_price as string | undefined),
        discounts: normalizeMoney(payload.total_discounts as string | undefined),
        current_subtotal_price: normalizeMoney(payload.subtotal_price as string | undefined),
        current_shipping_price: normalizeMoney((payload.total_shipping_price_set as RestMoneySet)?.shop_money?.amount),
        current_total_tax: normalizeMoney(payload.total_tax as string | undefined),
        current_total_price: normalizeMoney(payload.total_price as string | undefined),
        total_items: Array.isArray(payload.line_items)
          ? (payload.line_items as Array<Record<string, unknown>>).reduce(
              (total, item) => total + (typeof item.quantity === "number" ? item.quantity : 0),
              0,
            )
          : 0,
        is_test_order: Boolean(payload.test),
        external_created_at: (payload.created_at as string | undefined) ?? null,
        processed_at: (payload.processed_at as string | undefined) ?? null,
        external_updated_at: (payload.updated_at as string | undefined) ?? null,
        cancelled_at: (payload.cancelled_at as string | undefined) ?? null,
        cancel_reason: (payload.cancel_reason as string | undefined) ?? null,
      },
      { onConflict: "store_id,external_order_id" },
    )
    .select("id")
    .single();

  if (orderError || !orderRow) {
    throw new Error(orderError?.message ?? "shopify_webhook_order_upsert_failed");
  }

  const lineItems = Array.isArray(payload.line_items) ? (payload.line_items as Array<Record<string, unknown>>) : [];

  if (!lineItems.length) {
    return;
  }

  const variantGids = [...new Set(lineItems.map((item) => (item.variant_id != null ? gid("ProductVariant", item.variant_id) : null)).filter((id): id is string => Boolean(id)))];

  const { data: variantRefs } = variantGids.length
    ? await supabase.from("shopify_variants").select("id, external_variant_id, product_id").in("external_variant_id", variantGids)
    : { data: [] as Array<{ id: string; external_variant_id: string; product_id: string }> };
  const variantMap = new Map((variantRefs ?? []).map((variant) => [variant.external_variant_id, variant]));

  const lineItemRows = lineItems.map((item) => {
    const matchedVariant = item.variant_id != null ? variantMap.get(gid("ProductVariant", item.variant_id)) : null;

    return {
      organization_id: ctx.organizationId,
      order_id: orderRow.id,
      product_id: matchedVariant?.product_id ?? null,
      variant_id: matchedVariant?.id ?? null,
      external_line_item_id: typeof item.admin_graphql_api_id === "string" ? item.admin_graphql_api_id : gid("LineItem", item.id),
      title: (item.title as string | undefined) ?? "Sin titulo",
      sku_snapshot: (item.sku as string | undefined) ?? null,
      vendor_snapshot: (item.vendor as string | undefined) ?? null,
      quantity_original: (item.quantity as number | undefined) ?? 0,
      quantity_current: (item.current_quantity as number | undefined) ?? (item.quantity as number | undefined) ?? 0,
      unit_price: normalizeMoney(item.price as string | undefined),
      original_line_total: normalizeMoney(item.price as string | undefined) * ((item.quantity as number | undefined) ?? 0),
      discount_total: normalizeMoney(item.total_discount as string | undefined),
      current_line_total: normalizeMoney(item.price as string | undefined) * ((item.quantity as number | undefined) ?? 0),
    };
  });

  const { error: lineItemError } = await supabase
    .from("shopify_order_items")
    .upsert(lineItemRows, { onConflict: "order_id,external_line_item_id" });

  if (lineItemError) {
    throw new Error(lineItemError.message);
  }
}

async function processRefundCreate(supabase: SupabaseClient, ctx: ConnectionContext, payload: Record<string, unknown>) {
  const externalOrderId = gid("Order", payload.order_id);

  const { data: order } = await supabase
    .from("shopify_order_facts")
    .select("id, currency_code")
    .eq("store_id", ctx.storeId)
    .eq("external_order_id", externalOrderId)
    .maybeSingle();

  if (!order) {
    logger.info("Shopify refund webhook skipped - order not synced yet", {
      connection_id: ctx.connectionId,
      organization_id: ctx.organizationId,
      external_order_id: externalOrderId,
    });
    return;
  }

  const externalRefundId = typeof payload.admin_graphql_api_id === "string" ? payload.admin_graphql_api_id : gid("Refund", payload.id);
  const refundLineItems = Array.isArray(payload.refund_line_items)
    ? (payload.refund_line_items as Array<Record<string, unknown>>)
    : [];

  const totalRefunded = refundLineItems.reduce(
    (total, item) => total + normalizeMoney(item.subtotal as string | undefined) + normalizeMoney(item.total_tax as string | undefined),
    0,
  );

  const { data: refundRow, error: refundError } = await supabase
    .from("shopify_refunds")
    .upsert(
      {
        organization_id: ctx.organizationId,
        order_id: order.id,
        external_refund_id: externalRefundId,
        total_refunded: totalRefunded,
        currency_code: order.currency_code ?? null,
        external_created_at: (payload.created_at as string | undefined) ?? new Date().toISOString(),
      },
      { onConflict: "order_id,external_refund_id" },
    )
    .select("id")
    .single();

  if (refundError || !refundRow) {
    throw new Error(refundError?.message ?? "shopify_webhook_refund_upsert_failed");
  }

  if (!refundLineItems.length) {
    return;
  }

  const { data: orderItemRefs } = await supabase
    .from("shopify_order_items")
    .select("id, external_line_item_id")
    .eq("order_id", order.id);
  const orderItemMap = new Map((orderItemRefs ?? []).map((item) => [item.external_line_item_id, item.id]));

  const refundItemRows = refundLineItems
    .map((item) => {
      const externalLineItemId = gid("LineItem", item.line_item_id);
      const orderItemId = orderItemMap.get(externalLineItemId);
      if (!orderItemId) {
        return null;
      }
      return {
        organization_id: ctx.organizationId,
        refund_id: refundRow.id,
        order_item_id: orderItemId,
        location_id: null,
        external_refund_line_item_id: typeof item.id === "number" || typeof item.id === "string" ? gid("RefundLineItem", item.id) : null,
        quantity: (item.quantity as number | undefined) ?? 0,
        subtotal: normalizeMoney(item.subtotal as string | undefined),
        total_tax: normalizeMoney(item.total_tax as string | undefined),
        restock_type: (item.restock_type as string | undefined) ?? null,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  if (!refundItemRows.length) {
    return;
  }

  const { error: refundItemError } = await supabase
    .from("shopify_refund_items")
    .upsert(refundItemRows, { onConflict: "refund_id,external_refund_line_item_id" });

  if (refundItemError) {
    throw new Error(refundItemError.message);
  }

  await applyRefundAggregatesToOrderItems(
    supabase,
    refundItemRows.map((row) => row.order_item_id as string),
  );
}

const TOPIC_HANDLERS: Record<
  string,
  { scope: SyncBlockKey; handle: (supabase: SupabaseClient, ctx: ConnectionContext, payload: Record<string, unknown>) => Promise<void> }
> = {
  "orders/create": { scope: "orders", handle: processOrderCreateOrUpdate },
  "orders/updated": { scope: "orders", handle: processOrderCreateOrUpdate },
  "refunds/create": { scope: "refunds", handle: processRefundCreate },
  "products/update": { scope: "catalog", handle: processProductUpdate },
  "inventory_levels/update": { scope: "inventory", handle: processInventoryLevelUpdate },
};

// R-010/INT-01: webhooks de ciclo de vida y privacidad. No encajan en
// SyncBlockKey (no son un bloque de sync) asi que se despachan aparte, antes
// de TOPIC_HANDLERS. Deliberadamente conservadores: reconocen y dejan
// evidencia en `private.webhook_events`, pero NO borran en cascada todo el
// historico de una tienda de forma automatica -- eso es el mismo riesgo de
// borrado irreversible ya documentado (ver RIESGOS.md, Q-009) y requiere
// decision de producto de Rafa, no una decision tomada dentro de un webhook.
async function processAppUninstalled(supabase: SupabaseClient, ctx: ConnectionContext) {
  await supabase
    .from("integration_connections")
    .update({ status: "disconnected" })
    .eq("id", ctx.connectionId);
}

async function processCustomersRedact(
  supabase: SupabaseClient,
  ctx: ConnectionContext,
  payload: Record<string, unknown>,
) {
  const customer = payload.customer as { id?: number | string } | undefined;
  const externalCustomerId = customer?.id != null ? String(customer.id) : null;

  if (!externalCustomerId) {
    return;
  }

  // No guardamos email/nombre/telefono de clientes (solo un hash de
  // referencia y el id externo, ver DB-05/INT-01) -- borrar la fila entera
  // es la erradicacion completa que nos corresponde para este cliente.
  await supabase
    .from("shopify_customers")
    .delete()
    .eq("store_id", ctx.storeId)
    .eq("external_customer_id", externalCustomerId);
}

async function processShopRedact(supabase: SupabaseClient, ctx: ConnectionContext) {
  // Shopify llama esto ~48h despues de la desinstalacion. No hacemos borrado
  // en cascada automatico del historico (pedidos/metricas/costes) -- ver nota
  // de la funcion de arriba. Solo garantizamos que la conexion quede marcada
  // como no operativa; el borrado real de datos sigue el mismo flujo manual
  // que ya existe en el CRUD de Consultoria (con sus mismas salvaguardas).
  await supabase
    .from("integration_connections")
    .update({ status: "disconnected" })
    .eq("id", ctx.connectionId);
}

const COMPLIANCE_TOPIC_HANDLERS: Record<
  string,
  (supabase: SupabaseClient, ctx: ConnectionContext, payload: Record<string, unknown>) => Promise<void>
> = {
  "app/uninstalled": processAppUninstalled,
  "customers/redact": processCustomersRedact,
  "shop/redact": processShopRedact,
  // customers/data_request: sin email/nombre/telefono almacenados, no hay
  // exportacion automatica que generar -- se deja constancia en
  // webhook_events (via el flujo comun de abajo) para responder manualmente
  // si Shopify o el titular de los datos lo piden.
  "customers/data_request": async () => {},
};

export type WebhookResult = { statusCode: number; body: Record<string, unknown> };

export async function handleShopifyWebhookRequest(
  env: ApiEnv,
  headers: Record<string, string | string[] | undefined>,
  rawBody: Buffer,
): Promise<WebhookResult> {
  const hmacHeader = typeof headers["x-shopify-hmac-sha256"] === "string" ? headers["x-shopify-hmac-sha256"] : undefined;
  const shopDomain = typeof headers["x-shopify-shop-domain"] === "string" ? headers["x-shopify-shop-domain"] : undefined;
  const topic = typeof headers["x-shopify-topic"] === "string" ? headers["x-shopify-topic"] : undefined;
  const webhookId = typeof headers["x-shopify-webhook-id"] === "string" ? headers["x-shopify-webhook-id"] : undefined;

  // La app publica y la de distribucion personalizada firman con secrets distintos
  // (mismo problema que el callback OAuth, ver shopify.ts). Mientras la tienda este
  // instalada via la app custom (caso actual, ver ADR), verificar solo contra
  // SHOPIFY_API_SECRET (el de la app publica) rechaza el 100% de los webhooks reales
  // con HMAC valido -- se prueban ambos secrets configurados, igual que en el OAuth.
  const candidateSecrets = [env.SHOPIFY_API_SECRET, env.SHOPIFY_CUSTOM_API_SECRET].filter(
    (secret): secret is string => Boolean(secret),
  );

  if (!candidateSecrets.some((secret) => verifyShopifyWebhookHmac(rawBody, hmacHeader, secret))) {
    return { statusCode: 401, body: { error: "invalid_hmac" } };
  }

  if (!shopDomain || !topic) {
    return { statusCode: 400, body: { error: "missing_shopify_headers" } };
  }

  const syncHandlerEntry = TOPIC_HANDLERS[topic];
  const complianceHandler = COMPLIANCE_TOPIC_HANDLERS[topic];

  if (!syncHandlerEntry && !complianceHandler) {
    return { statusCode: 200, body: { status: "ignored_unknown_topic" } };
  }

  const handle = syncHandlerEntry?.handle ?? complianceHandler;
  const scope = syncHandlerEntry?.scope;

  const supabase = createServiceClient(env);
  const ctx = await resolveConnectionContext(supabase, shopDomain);

  if (!ctx) {
    logger.info("Shopify webhook received for unknown connection", { shop_domain: shopDomain, topic });
    return { statusCode: 200, body: { status: "ignored_unknown_connection" } };
  }

  const fingerprint = sha256(rawBody.toString("utf8"));

  const { error: eventInsertError } = await supabase.schema("private").from("webhook_events").insert({
    connection_id: ctx.connectionId,
    organization_id: ctx.organizationId,
    provider: "shopify",
    topic,
    external_event_id: webhookId ?? null,
    fingerprint,
    signature_valid: true,
    status: "received",
    payload: JSON.parse(rawBody.toString("utf8")),
    headers: {
      "x-shopify-shop-domain": shopDomain,
      "x-shopify-topic": topic,
      "x-shopify-webhook-id": webhookId ?? null,
    },
  });

  if (eventInsertError) {
    if (eventInsertError.code === "23505") {
      return { statusCode: 200, body: { status: "duplicate" } };
    }
    logger.error("Shopify webhook event insert failed", {
      shop_domain: shopDomain,
      organization_id: ctx.organizationId,
      topic,
      error: eventInsertError.message,
    });
    return { statusCode: 500, body: { error: "webhook_event_insert_failed" } };
  }

  const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;

  try {
    await handle!(supabase, ctx, payload);

    await supabase
      .schema("private")
      .from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("fingerprint", fingerprint)
      .eq("provider", "shopify");

    if (scope) {
      await recordBlockRun(supabase, ctx.connectionId, ctx.organizationId, scope, "succeeded");
    }

    return { statusCode: 200, body: { status: "processed" } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "shopify_webhook_processing_failed";

    await supabase
      .schema("private")
      .from("webhook_events")
      .update({ status: "failed", processed_at: new Date().toISOString(), error_message: message })
      .eq("fingerprint", fingerprint)
      .eq("provider", "shopify");

    if (scope) {
      await recordBlockRun(supabase, ctx.connectionId, ctx.organizationId, scope, "failed", message);
    }

    logger.error("Shopify webhook processing failed", {
      shop_domain: shopDomain,
      organization_id: ctx.organizationId,
      topic,
      error: message,
    });

    return { statusCode: 500, body: { error: "webhook_processing_failed" } };
  }
}
