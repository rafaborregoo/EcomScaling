import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { verifyShopifyWebhookHmac } from "./shopify-webhooks.js";
import { applyRefundAggregatesToOrderItems } from "./shopify-refund-aggregates.js";
import { isMissingShopifyNetMetricsSchema } from "./shopify-order-line-net.js";
import { isMissingShopifyFinancialBasisSchema, shopifyOrderFinancialBasis, withoutShopifyFinancialBasis } from "./shopify-order-financial-basis.js";
import {
  isMissingShopifyProductMetadataSchema,
  normalizeShopifyProductTags,
} from "./shopify-product-metadata.js";
import {
  recordShopifyOrderTracking,
  recordShopifyRefundTracking,
} from "./klaviyo-tracking.js";
import { getValidShopifyAccessToken } from "./shopify-token-store.js";
import { shopifyGraphql } from "./shopify-client.js";
import { invalidateIntegrationData } from "./integration-data-cache.js";
import { wakeShopifyWebhooks } from "./shopify-webhook-queue.js";

type ApiEnv = LoadedApiEnv;
const logger = createLogger("shopify-webhook-handler");

type SyncBlockKey = "catalog" | "inventory" | "orders" | "refunds";

const SHOPIFY_RETURN_REASONS = new Set([
  "COLOR", "DEFECTIVE", "NOT_AS_DESCRIBED", "OTHER", "SIZE_TOO_LARGE",
  "SIZE_TOO_SMALL", "STYLE", "UNKNOWN", "UNWANTED", "WRONG_ITEM",
]);

export function normalizeShopifyReturnReason(value: unknown) {
  return typeof value === "string" && SHOPIFY_RETURN_REASONS.has(value)
    ? value
    : null;
}

function shopifyNumericId(value: unknown, resource: string) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return `gid://shopify/${resource}/${value}`;
  }
  if (typeof value !== "string") return null;
  if (new RegExp(`^gid://shopify/${resource}/\\d+$`).test(value)) return value;
  return /^\d+$/.test(value) ? `gid://shopify/${resource}/${value}` : null;
}

export function mapShopifyFulfillmentLineItems(
  fulfillments: Array<{ id: string; fulfillmentLineItems: { nodes: Array<{ id: string }> } }>,
  localFulfillmentIds: Map<string, string>,
) {
  const result = new Map<string, string>();
  for (const fulfillment of fulfillments) {
    const localFulfillmentId = localFulfillmentIds.get(fulfillment.id);
    if (!localFulfillmentId) continue;
    for (const line of fulfillment.fulfillmentLineItems.nodes) {
      result.set(line.id, localFulfillmentId);
    }
  }
  return result;
}

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

function isShopifyProductMediaSchemaMissing(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (error.code === "PGRST204" && message.includes("shopify_product_media")) ||
    message.includes("shopify_product_media") &&
      (message.includes("does not exist") || message.includes("schema cache"))
  );
}

function isShopifyDiscountApplicationsSchemaMissing(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  return error.code === "42P01" || error.code === "PGRST205" ||
    (error.code === "PGRST204" && message.includes("shopify_order_discount_applications")) ||
    ((error.code === "42703" || error.code === "PGRST204") &&
      /store_id|amount_coverage/.test(message));
}

async function syncOrderDiscountApplications(
  supabase: SupabaseClient,
  ctx: ConnectionContext,
  orderId: string,
  payload: Record<string, unknown>,
) {
  if (!Array.isArray(payload.discount_applications)) return;

  if (!Array.isArray(payload.line_items) || !Array.isArray(payload.shipping_lines)) {
    logger.info("Shopify discount applications skipped because order lines were absent", {
      connection_id: ctx.connectionId,
      organization_id: ctx.organizationId,
      store_id: ctx.storeId,
      order_id: orderId,
    });
    return;
  }

  const lineItems = payload.line_items as Array<Record<string, unknown>>;
  const shippingLines = payload.shipping_lines as Array<Record<string, unknown>>;
  const allocationArrays = [...lineItems, ...shippingLines].map((line) =>
    line.discount_allocations,
  );
  if (allocationArrays.some((allocations) => !Array.isArray(allocations))) {
    // Preserve previously captured exact allocations when the webhook payload
    // is partial; a missing array is not evidence that a discount was unused.
    logger.info("Shopify discount applications skipped because allocations were absent", {
      connection_id: ctx.connectionId,
      organization_id: ctx.organizationId,
      store_id: ctx.storeId,
      order_id: orderId,
    });
    return;
  }

  const applicationValues = payload.discount_applications as Array<unknown>;
  const amountsByIndex = new Map<number, number>();
  let allocationsComplete = true;
  for (const allocationArray of allocationArrays as Array<unknown[]>) {
    for (const value of allocationArray) {
      if (!value || typeof value !== "object") {
        allocationsComplete = false;
        continue;
      }
      const allocation = value as Record<string, unknown>;
      const index = allocation.discount_application_index;
      const amountSet = allocation.amount_set as RestMoneySet;
      const amount = amountSet?.shop_money?.amount ?? allocation.amount as string | number | null | undefined;
      const numericAmount = typeof amount === "number"
        ? amount
        : typeof amount === "string" && amount.trim()
          ? Number(amount)
          : Number.NaN;
      if (
        typeof index !== "number" || !Number.isSafeInteger(index) ||
        index < 0 || index >= applicationValues.length ||
        !Number.isFinite(numericAmount)
      ) {
        allocationsComplete = false;
        continue;
      }
      amountsByIndex.set(index, (amountsByIndex.get(index) ?? 0) + numericAmount);
    }
  }

  const rows = applicationValues.map((value, position) => {
    const application = value && typeof value === "object"
      ? value as Record<string, unknown>
      : {};
    return {
      organization_id: ctx.organizationId,
      store_id: ctx.storeId,
      order_id: orderId,
      code: typeof application.code === "string" ? application.code : null,
      title: typeof application.title === "string" ? application.title : null,
      allocation_method: typeof application.allocation_method === "string"
        ? application.allocation_method
        : null,
      target_type: typeof application.target_type === "string"
        ? application.target_type
        : null,
      amount: amountsByIndex.get(position) ?? 0,
      amount_coverage: allocationsComplete ? "complete" : "partial",
      source_updated_at: (payload.updated_at as string | undefined) ?? null,
      position,
    };
  });

  if (rows.length) {
    const { error } = await supabase
      .from("shopify_order_discount_applications")
      .upsert(rows, { onConflict: "order_id,position" });
    if (error) {
      if (isShopifyDiscountApplicationsSchemaMissing(error)) {
        logger.info("Shopify discount application migration is pending; kept prior application data", {
          connection_id: ctx.connectionId,
          organization_id: ctx.organizationId,
          store_id: ctx.storeId,
        });
        return;
      }
      throw new Error(`shopify_webhook_discount_applications_upsert_failed: ${error.message}`);
    }
  }

  const { data: existing, error: readError } = await supabase
    .from("shopify_order_discount_applications")
    .select("id, position")
    .eq("organization_id", ctx.organizationId)
    .eq("store_id", ctx.storeId)
    .eq("order_id", orderId);
  if (readError) {
    if (isShopifyDiscountApplicationsSchemaMissing(readError)) {
      logger.info("Shopify discount application scope migration is pending", {
        connection_id: ctx.connectionId,
        organization_id: ctx.organizationId,
        store_id: ctx.storeId,
      });
      return;
    }
    throw new Error(`shopify_webhook_discount_applications_read_failed: ${readError.message}`);
  }

  const activePositions = new Set(rows.map((row) => row.position));
  const staleIds = (existing ?? [])
    .filter((row) => !activePositions.has(row.position))
    .map((row) => row.id);
  if (!staleIds.length) return;

  const { error: deleteError } = await supabase
    .from("shopify_order_discount_applications")
    .delete()
    .eq("organization_id", ctx.organizationId)
    .eq("store_id", ctx.storeId)
    .eq("order_id", orderId)
    .in("id", staleIds)
    .or(`source_updated_at.is.null,source_updated_at.lte.${payload.updated_at ?? new Date(0).toISOString()}`);
  if (deleteError && !isShopifyDiscountApplicationsSchemaMissing(deleteError)) {
    throw new Error(`shopify_webhook_discount_applications_retire_failed: ${deleteError.message}`);
  }
}

/**
 * Lo devuelto de un pedido, sumado desde los `refund_line_items` que trae el
 * propio payload REST. Mismo criterio que el sync bulk (subtotal + impuesto),
 * para que las dos vias de ingesta no discrepen.
 */
function sumRefunds(value: unknown) {
  if (!Array.isArray(value)) {
    return 0;
  }
  return (value as Array<Record<string, unknown>>).reduce((total, refund) => {
    const lines = Array.isArray(refund.refund_line_items)
      ? (refund.refund_line_items as Array<Record<string, unknown>>)
      : [];
    return (
      total +
      lines.reduce(
        (sum, item) =>
          sum +
          normalizeMoney(item.subtotal as string | undefined) +
          normalizeMoney(item.total_tax as string | undefined),
        0,
      )
    );
  }, 0);
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
  const { error } = await supabase.from("integration_sync_runs").insert({
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
  if (error) throw new Error(`shopify_webhook_receipt_failed: ${error.message}`);
}

type ConnectionContext = {
  connectionId: string;
  organizationId: string;
  storeId: string;
  shopDomain: string;
};

/**
 * Una conexion marcada para borrado o ya desinstalada no debe seguir
 * ingiriendo: Shopify sigue enviando webhooks hasta que la app se desinstala,
 * y sin este filtro los datos se repoblaban solos despues de pedir el borrado.
 */
export function acceptsWebhookIngest(status: string | null | undefined) {
  return status === "connected" || status === "error" || status === "syncing";
}

async function resolveConnectionContext(
  supabase: SupabaseClient,
  shopDomain: string,
): Promise<ConnectionContext | null> {
  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, status, provider_account_id")
    .eq("provider", "shopify")
    .eq("provider_account_id", shopDomain)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connectionError) throw new Error(`shopify_webhook_connection_lookup_failed: ${connectionError.message}`);

  if (!connection || !acceptsWebhookIngest(connection.status)) {
    return null;
  }

  const { data: store, error: storeError } = await supabase
    .from("shopify_stores")
    .select("id")
    .eq("connection_id", connection.id)
    .maybeSingle();

  if (storeError) throw new Error(`shopify_webhook_store_lookup_failed: ${storeError.message}`);
  if (!store) throw new Error("shopify_webhook_store_initializing");

  if (!connection.provider_account_id) return null;
  return {
    connectionId: connection.id,
    organizationId: connection.organization_id,
    storeId: store.id,
    shopDomain: connection.provider_account_id,
  };
}

async function processProductUpdate(
  supabase: SupabaseClient,
  ctx: ConnectionContext,
  payload: Record<string, unknown>,
) {
  const externalProductId =
    typeof payload.admin_graphql_api_id === "string"
      ? payload.admin_graphql_api_id
      : gid("Product", payload.id);

  const descriptionHtml = typeof payload.body_html === "string" ? payload.body_html : undefined;
  const tags = typeof payload.tags === "string" || Array.isArray(payload.tags)
    ? normalizeShopifyProductTags(payload.tags)
    : undefined;
  const productRowPayload = {
        organization_id: ctx.organizationId,
        store_id: ctx.storeId,
        external_product_id: externalProductId,
        title: typeof payload.title === "string" ? payload.title : "Sin titulo",
        handle: (payload.handle as string | undefined) ?? null,
        vendor: (payload.vendor as string | undefined) ?? null,
        product_type: (payload.product_type as string | undefined) ?? null,
        ...(descriptionHtml !== undefined ? { description_html: descriptionHtml } : {}),
        ...(tags !== undefined ? { tags } : {}),
        ...(descriptionHtml !== undefined || tags !== undefined ? { metadata_coverage: "partial" } : {}),
        status: (payload.status as string | undefined) ?? null,
        published_at: (payload.published_at as string | undefined) ?? null,
        external_created_at: (payload.created_at as string | undefined) ?? null,
        external_updated_at: (payload.updated_at as string | undefined) ?? null,
  };
  let { data: productRow, error: productError } = await supabase
    .from("shopify_products")
    .upsert(productRowPayload, { onConflict: "store_id,external_product_id" })
    .select("id")
    .single();

  if (productError && isMissingShopifyProductMetadataSchema(productError)) {
    const {
      description_html: _descriptionHtml,
      tags: _tags,
      metadata_coverage: _metadataCoverage,
      ...legacyPayload
    } = productRowPayload;
    const retry = await supabase
      .from("shopify_products")
      .upsert(legacyPayload, { onConflict: "store_id,external_product_id" })
      .select("id")
      .single();
    productRow = retry.data;
    productError = retry.error;
    if (!productError) {
      logger.info("Shopify product metadata migration is pending; stored core webhook fields", {
        connection_id: ctx.connectionId,
        organization_id: ctx.organizationId,
      });
    }
  }

  if (productError || !productRow) {
    throw new Error(
      productError?.message ?? "shopify_webhook_product_upsert_failed",
    );
  }

  const variants = Array.isArray(payload.variants)
    ? (payload.variants as Array<Record<string, unknown>>)
    : [];
  const optionNamesByPosition = new Map<number, string>();
  if (Array.isArray(payload.options)) {
    for (const option of payload.options as Array<Record<string, unknown>>) {
      const position = typeof option.position === "number" ? option.position : null;
      const name = typeof option.name === "string" ? option.name.trim() : "";
      if (position !== null && position >= 1 && position <= 3 && name) {
        optionNamesByPosition.set(position, name);
      }
    }
  }

  if (!variants.length) {
    return;
  }

  const variantRows = variants.map((variant) => ({
    organization_id: ctx.organizationId,
    store_id: ctx.storeId,
    product_id: productRow.id,
    external_variant_id:
      typeof variant.admin_graphql_api_id === "string"
        ? variant.admin_graphql_api_id
        : gid("ProductVariant", variant.id),
    title: (variant.title as string | undefined) ?? null,
    selected_options: [1, 2, 3].flatMap((position) => {
      const name = optionNamesByPosition.get(position);
      const value = variant[`option${position}`];
      return name && typeof value === "string" && value.trim() && !(name === "Title" && value === "Default Title")
        ? [{ name, value: value.trim() }]
        : [];
    }),
    barcode: (variant.barcode as string | undefined) ?? null,
    ...(Object.hasOwn(variant, "image_id")
      ? { external_image_id: shopifyNumericId(variant.image_id, "MediaImage") }
      : {}),
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

  // Shopify sends the current product image set in product webhooks. Only
  // reconcile when the field is present; partial payloads must not clear a
  // gallery that was previously synchronized.
  if (Array.isArray(payload.images)) {
    const syncedAt = new Date().toISOString();
    const imageRows = payload.images
      .map((value, index) => {
        const image = value as Record<string, unknown>;
        const externalMediaId = shopifyNumericId(
          image.admin_graphql_api_id ?? image.id,
          "MediaImage",
        );
        const sourceUrl = typeof image.src === "string" ? image.src.trim() : "";
        if (!externalMediaId || !sourceUrl) return null;
        return {
          organization_id: ctx.organizationId,
          store_id: ctx.storeId,
          product_id: productRow.id,
          external_media_id: externalMediaId,
          media_content_type: "IMAGE",
          source_url: sourceUrl,
          alt_text: typeof image.alt === "string" && image.alt.trim() ? image.alt.trim() : null,
          width: typeof image.width === "number" ? image.width : null,
          height: typeof image.height === "number" ? image.height : null,
          position: typeof image.position === "number" && image.position > 0 ? image.position - 1 : index,
          is_active: true,
          last_seen_at: syncedAt,
          updated_at: syncedAt,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    let mediaSchemaAvailable = true;
    if (imageRows.length) {
      const { error: imageUpsertError } = await supabase
        .from("shopify_product_media")
        .upsert(imageRows, { onConflict: "product_id,external_media_id" });
      if (imageUpsertError && isShopifyProductMediaSchemaMissing(imageUpsertError)) {
        mediaSchemaAvailable = false;
      } else if (imageUpsertError) {
        throw new Error(imageUpsertError.message);
      }
    }

    if (mediaSchemaAvailable) {
      const { data: existingImages, error: existingImagesError } = await supabase
        .from("shopify_product_media")
        .select("id, external_media_id")
        .eq("organization_id", ctx.organizationId)
        .eq("store_id", ctx.storeId)
        .eq("product_id", productRow.id);
      if (existingImagesError && isShopifyProductMediaSchemaMissing(existingImagesError)) {
        mediaSchemaAvailable = false;
      } else if (existingImagesError) {
        throw new Error(existingImagesError.message);
      } else {
        const activeImageIds = new Set(imageRows.map((row) => row.external_media_id));
        const staleIds = (existingImages ?? [])
          .filter((image) => !activeImageIds.has(image.external_media_id))
          .map((image) => image.id);
        if (staleIds.length) {
          const { error: retireError } = await supabase
            .from("shopify_product_media")
            .update({ is_active: false, updated_at: syncedAt })
            .eq("organization_id", ctx.organizationId)
            .eq("store_id", ctx.storeId)
            .eq("product_id", productRow.id)
            .in("id", staleIds);
          if (retireError && !isShopifyProductMediaSchemaMissing(retireError)) {
            throw new Error(retireError.message);
          }
          if (retireError) mediaSchemaAvailable = false;
        }
      }
    }
    if (!mediaSchemaAvailable) {
      logger.info("Shopify product media migration is pending; product webhook stored without gallery fields", {
        connection_id: ctx.connectionId,
        organization_id: ctx.organizationId,
        store_id: ctx.storeId,
      });
    }
  }
}

async function processProductDelete(
  supabase: SupabaseClient,
  ctx: ConnectionContext,
  payload: Record<string, unknown>,
) {
  const externalProductId = shopifyNumericId(
    payload.admin_graphql_api_id ?? payload.id,
    "Product",
  );
  if (!externalProductId) throw new Error("shopify_product_delete_missing_id");

  const { data: product, error: productError } = await supabase
    .from("shopify_products")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("store_id", ctx.storeId)
    .eq("external_product_id", externalProductId)
    .maybeSingle();
  if (productError) throw new Error(productError.message);
  if (!product) return;

  const deletedAt = new Date().toISOString();
  const { error: updateProductError } = await supabase
    .from("shopify_products")
    .update({ status: "DELETED", external_updated_at: deletedAt })
    .eq("organization_id", ctx.organizationId)
    .eq("store_id", ctx.storeId)
    .eq("id", product.id);
  if (updateProductError) throw new Error(updateProductError.message);

  const { error: variantError } = await supabase
    .from("shopify_variants")
    .update({ is_active: false })
    .eq("organization_id", ctx.organizationId)
    .eq("store_id", ctx.storeId)
    .eq("product_id", product.id);
  if (variantError) throw new Error(variantError.message);

  const productVariants: Array<{ id: string }> = [];
  for (let page = 0; ; page += 1) {
    const { data, error: variantReadError } = await supabase
      .from("shopify_variants")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("store_id", ctx.storeId)
      .eq("product_id", product.id)
      .order("id", { ascending: true })
      .range(page * 500, page * 500 + 499);
    if (variantReadError) throw new Error(variantReadError.message);
    const rows = (data ?? []) as typeof productVariants;
    productVariants.push(...rows);
    if (rows.length < 500) break;
  }
  const variantIds = productVariants.map((variant) => variant.id);
  for (let offset = 0; offset < variantIds.length; offset += 100) {
    const variantIdBatch = variantIds.slice(offset, offset + 100);
    const { error: parentBundleError } = await supabase
      .from("shopify_product_bundle_components")
      .update({ is_active: false, updated_at: deletedAt })
      .eq("organization_id", ctx.organizationId)
      .eq("store_id", ctx.storeId)
      .in("parent_variant_id", variantIdBatch);
    if (parentBundleError) throw new Error(parentBundleError.message);

    const { error: componentBundleError } = await supabase
      .from("shopify_product_bundle_components")
      .update({ is_active: false, updated_at: deletedAt })
      .eq("organization_id", ctx.organizationId)
      .eq("store_id", ctx.storeId)
      .in("component_variant_id", variantIdBatch);
    if (componentBundleError) throw new Error(componentBundleError.message);
  }

  const { error: mediaError } = await supabase
    .from("shopify_product_media")
    .update({ is_active: false, updated_at: deletedAt })
    .eq("organization_id", ctx.organizationId)
    .eq("store_id", ctx.storeId)
    .eq("product_id", product.id);
  if (mediaError && !isShopifyProductMediaSchemaMissing(mediaError)) {
    throw new Error(mediaError.message);
  }
}

async function processInventoryLevelUpdate(
  supabase: SupabaseClient,
  ctx: ConnectionContext,
  payload: Record<string, unknown>,
) {
  const externalInventoryItemId = gid(
    "InventoryItem",
    payload.inventory_item_id,
  );
  const externalLocationId = gid("Location", payload.location_id);

  const { data: inventoryItem, error: inventoryItemError } = await supabase
    .from("shopify_inventory_items")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("store_id", ctx.storeId)
    .eq("external_inventory_item_id", externalInventoryItemId)
    .maybeSingle();
  if (inventoryItemError) throw new Error(inventoryItemError.message);

  const { data: location, error: locationError } = await supabase
    .from("shopify_locations")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("store_id", ctx.storeId)
    .eq("external_location_id", externalLocationId)
    .maybeSingle();
  if (locationError) throw new Error(locationError.message);

  if (!inventoryItem || !location) {
    logger.info(
      "Shopify inventory webhook skipped - item or location not synced yet",
      {
        connection_id: ctx.connectionId,
        organization_id: ctx.organizationId,
        external_inventory_item_id: externalInventoryItemId,
        external_location_id: externalLocationId,
      },
    );
    throw new Error("shopify_inventory_references_pending");
  }

  const available =
    typeof payload.available === "number" ? payload.available : null;

  const { error } = await supabase
    .from("shopify_inventory_current_state")
    .upsert(
      {
        organization_id: ctx.organizationId,
        inventory_item_id: inventoryItem.id,
        location_id: location.id,
        external_inventory_level_id: null,
        available_quantity: available,
        quantities_data: { available },
        source_updated_at: (payload.updated_at as string | undefined) ?? null,
        is_active: true,
        updated_at:
          (payload.updated_at as string | undefined) ??
          new Date().toISOString(),
      },
      { onConflict: "inventory_item_id,location_id" },
    );

  if (error) {
    throw new Error(error.message);
  }
}

async function processOrderCreateOrUpdate(
  supabase: SupabaseClient,
  ctx: ConnectionContext,
  payload: Record<string, unknown>,
) {
  const externalOrderId =
    typeof payload.admin_graphql_api_id === "string"
      ? payload.admin_graphql_api_id
      : gid("Order", payload.id);
  const customer = payload.customer as
    Record<string, unknown> | null | undefined;
  const customerGid =
    customer && typeof customer.admin_graphql_api_id === "string"
      ? customer.admin_graphql_api_id
      : customer?.id
        ? gid("Customer", customer.id)
        : null;

  const orderWrite = {
        organization_id: ctx.organizationId,
        store_id: ctx.storeId,
        external_order_id: externalOrderId,
        order_name: (payload.name as string | undefined) ?? null,
        customer_reference_hash: customerGid ? sha256(customerGid) : null,
        financial_status:
          (payload.financial_status as string | undefined) ?? null,
        fulfillment_status:
          (payload.fulfillment_status as string | undefined) ?? null,
        source_name: (payload.source_name as string | undefined) ?? null,
        currency_code: (payload.currency as string | undefined) ?? null,
        presentment_currency_code:
          (payload.presentment_currency as string | undefined) ??
          (payload.currency as string | undefined) ??
          null,
        gross_sales: normalizeMoney(
          payload.subtotal_price as string | undefined,
        ),
        discounts: normalizeMoney(
          payload.total_discounts as string | undefined,
        ),
        current_subtotal_price: normalizeMoney(
          payload.subtotal_price as string | undefined,
        ),
        current_shipping_price: normalizeMoney(
          (payload.total_shipping_price_set as RestMoneySet)?.shop_money
            ?.amount,
        ),
        current_total_tax: normalizeMoney(
          (payload.current_total_tax ?? payload.total_tax) as string | undefined,
        ),
        current_total_price: normalizeMoney(
          (payload.current_total_price ?? payload.total_price) as string | undefined,
        ),
        refunds: sumRefunds(payload.refunds),
        ...shopifyOrderFinancialBasis(payload.total_price, payload.current_total_price ?? payload.total_price, sumRefunds(payload.refunds)),
        total_items: Array.isArray(payload.line_items)
          ? (payload.line_items as Array<Record<string, unknown>>).reduce(
              (total, item) =>
                total + (typeof item.quantity === "number" ? item.quantity : 0),
              0,
            )
          : 0,
        is_test_order: Boolean(payload.test),
        external_created_at: (payload.created_at as string | undefined) ?? null,
        processed_at: (payload.processed_at as string | undefined) ?? null,
        external_updated_at: (payload.updated_at as string | undefined) ?? null,
        cancelled_at: (payload.cancelled_at as string | undefined) ?? null,
        cancel_reason: (payload.cancel_reason as string | undefined) ?? null,
      };
  let orderResult = await supabase.from("shopify_order_facts")
    .upsert(orderWrite, { onConflict: "store_id,external_order_id" })
    .select("id, external_updated_at").single();
  if (orderResult.error && isMissingShopifyFinancialBasisSchema(orderResult.error.message)) {
    orderResult = await supabase.from("shopify_order_facts")
      .upsert(withoutShopifyFinancialBasis(orderWrite), { onConflict: "store_id,external_order_id" })
      .select("id, external_updated_at").single();
  }
  const { data: orderRow, error: orderError } = orderResult;

  if (orderError || !orderRow) {
    throw new Error(
      orderError?.message ?? "shopify_webhook_order_upsert_failed",
    );
  }

  // The database guard may return the newer stored row instead of this older payload.
  if (payload.updated_at && orderRow.external_updated_at &&
      Date.parse(orderRow.external_updated_at) > Date.parse(String(payload.updated_at))) return;

  await recordShopifyOrderTracking(supabase, {
    organizationId: ctx.organizationId,
    storeId: ctx.storeId,
    payload,
  });

  const lineItems = Array.isArray(payload.line_items)
    ? (payload.line_items as Array<Record<string, unknown>>)
    : [];

  await syncOrderDiscountApplications(supabase, ctx, orderRow.id, payload);

  if (!lineItems.length) {
    return;
  }

  const variantGids = [
    ...new Set(
      lineItems
        .map((item) =>
          item.variant_id != null
            ? gid("ProductVariant", item.variant_id)
            : null,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: variantRefs, error: variantRefsError } = variantGids.length
    ? await supabase
        .from("shopify_variants")
        .select("id, external_variant_id, product_id")
        .eq("organization_id", ctx.organizationId)
        .eq("store_id", ctx.storeId)
        .in("external_variant_id", variantGids)
      : {
        data: [] as Array<{
          id: string;
          external_variant_id: string;
          product_id: string;
        }>,
        error: null,
      };
  if (variantRefsError) throw new Error(variantRefsError.message);
  const variantMap = new Map(
    (variantRefs ?? []).map((variant) => [
      variant.external_variant_id,
      variant,
    ]),
  );

  const lineItemRows = lineItems.map((item) => {
    const matchedVariant =
      item.variant_id != null
        ? variantMap.get(gid("ProductVariant", item.variant_id))
        : null;

    const quantityOriginal = (item.quantity as number | undefined) ?? 0;
    const quantityCurrent =
      (item.current_quantity as number | undefined) ?? quantityOriginal;
    const originalLineTotal =
      normalizeMoney(item.price as string | undefined) * quantityOriginal;
    const discountTotal = normalizeMoney(item.total_discount as string | undefined);
    const currentRatio = quantityOriginal > 0
      ? Math.min(1, Math.max(0, quantityCurrent / quantityOriginal))
      : 0;

    return {
      organization_id: ctx.organizationId,
      order_id: orderRow.id,
      product_id: matchedVariant?.product_id ?? null,
      variant_id: matchedVariant?.id ?? null,
      external_line_item_id:
        typeof item.admin_graphql_api_id === "string"
          ? item.admin_graphql_api_id
          : gid("LineItem", item.id),
      source_updated_at: (payload.updated_at as string | undefined) ?? null,
      title: (item.title as string | undefined) ?? "Sin titulo",
      sku_snapshot: (item.sku as string | undefined) ?? null,
      vendor_snapshot: (item.vendor as string | undefined) ?? null,
      quantity_original: quantityOriginal,
      quantity_current: quantityCurrent,
      unit_price: normalizeMoney(item.price as string | undefined),
      original_line_total: originalLineTotal,
      discount_total: discountTotal,
      current_line_total: originalLineTotal,
      net_quantity: quantityCurrent,
      net_revenue: Math.max(0, (originalLineTotal - discountTotal) * currentRatio),
      net_metrics_source: "shopify_rest_estimate",
    };
  });

  let { error: lineItemError } = await supabase
    .from("shopify_order_items")
    .upsert(lineItemRows, { onConflict: "order_id,external_line_item_id" });

  if (lineItemError && isMissingShopifyNetMetricsSchema(lineItemError.message)) {
    const legacyLineItemRows = lineItemRows.map((row) => {
      const {
        net_quantity: _netQuantity,
        net_revenue: _netRevenue,
        net_metrics_source: _netMetricsSource,
        ...legacyRow
      } = row;
      return legacyRow;
    });
    const retry = await supabase
      .from("shopify_order_items")
      .upsert(legacyLineItemRows, { onConflict: "order_id,external_line_item_id" });
    lineItemError = retry.error;
    if (!lineItemError) {
      logger.info("Shopify line net metrics migration is pending; stored legacy webhook order-line fields", {
        connection_id: ctx.connectionId,
        organization_id: ctx.organizationId,
      });
    }
  }

  if (lineItemError) {
    throw new Error(lineItemError.message);
  }

  const { data: syncedOrderItems, error: syncedOrderItemsError } = await supabase
    .from("shopify_order_items")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("order_id", orderRow.id);
  if (syncedOrderItemsError) throw new Error(syncedOrderItemsError.message);
  await applyRefundAggregatesToOrderItems(
    supabase,
    (syncedOrderItems ?? []).map((item) => item.id),
  );
}

async function processRefundCreate(
  supabase: SupabaseClient,
  ctx: ConnectionContext,
  payload: Record<string, unknown>,
) {
  const externalOrderId = gid("Order", payload.order_id);

  const { data: order, error: orderLookupError } = await supabase
    .from("shopify_order_facts")
    .select("id, currency_code, current_total_price")
    .eq("organization_id", ctx.organizationId)
    .eq("store_id", ctx.storeId)
    .eq("external_order_id", externalOrderId)
    .maybeSingle();
  if (orderLookupError) {
    throw new Error(`shopify_webhook_refund_order_lookup_failed: ${orderLookupError.message}`);
  }

  if (!order) {
    logger.info("Shopify refund webhook deferred - order not synced yet", {
      connection_id: ctx.connectionId,
      organization_id: ctx.organizationId,
      external_order_id: externalOrderId,
    });
    throw new Error("shopify_webhook_refund_order_not_synced");
  }

  const externalRefundId =
    typeof payload.admin_graphql_api_id === "string"
      ? payload.admin_graphql_api_id
      : gid("Refund", payload.id);
  const refundLineItems = Array.isArray(payload.refund_line_items)
    ? (payload.refund_line_items as Array<Record<string, unknown>>)
    : [];

  const totalRefunded = refundLineItems.reduce(
    (total, item) =>
      total +
      normalizeMoney(item.subtotal as string | undefined) +
      normalizeMoney(item.total_tax as string | undefined),
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
        external_created_at:
          (payload.created_at as string | undefined) ??
          new Date().toISOString(),
      },
      { onConflict: "order_id,external_refund_id" },
    )
    .select("id")
    .single();

  if (refundError || !refundRow) {
    throw new Error(
      refundError?.message ?? "shopify_webhook_refund_upsert_failed",
    );
  }

  await recordShopifyRefundTracking(supabase, {
    organizationId: ctx.organizationId,
    storeId: ctx.storeId,
    payload,
  });

  // Una devolucion baja el ingreso del pedido. Sin esto la fila de
  // `shopify_order_facts` se queda con el importe bruto y el check
  // `order_facts_net_sales_coherente` rechazaria cualquier escritura
  // posterior, que es justamente como se nota que falta.
  const { data: refundsDelPedido, error: refundsReadError } = await supabase
    .from("shopify_refunds")
    .select("total_refunded")
    .eq("organization_id", ctx.organizationId)
    .eq("order_id", order.id);
  if (refundsReadError) {
    throw new Error(`shopify_webhook_refunds_read_failed: ${refundsReadError.message}`);
  }
  const totalDevuelto = (refundsDelPedido ?? []).reduce(
    (total, row) => total + normalizeMoney(row.total_refunded),
    0,
  );
  const { error: netError } = await supabase
    .from("shopify_order_facts")
    .update({
      refunds: totalDevuelto,
    })
    .eq("organization_id", ctx.organizationId)
    .eq("store_id", ctx.storeId)
    .eq("id", order.id);
  if (netError) {
    throw new Error(netError.message);
  }

  if (!refundLineItems.length) {
    return;
  }

  const { data: orderItemRefs, error: orderItemRefsError } = await supabase
    .from("shopify_order_items")
    .select("id, external_line_item_id")
    .eq("organization_id", ctx.organizationId)
    .eq("order_id", order.id);
  if (orderItemRefsError) {
    throw new Error(`shopify_webhook_refund_order_items_read_failed: ${orderItemRefsError.message}`);
  }
  const orderItemMap = new Map(
    (orderItemRefs ?? []).map((item) => [item.external_line_item_id, item.id]),
  );

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
        external_refund_line_item_id:
          typeof item.id === "number" || typeof item.id === "string"
            ? gid("RefundLineItem", item.id)
            : null,
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
    .upsert(refundItemRows, {
      onConflict: "refund_id,external_refund_line_item_id",
    });

  if (refundItemError) {
    throw new Error(refundItemError.message);
  }

  await applyRefundAggregatesToOrderItems(
    supabase,
    refundItemRows.map((row) => row.order_item_id as string),
  );
}

async function processShopifyReturn(
  supabase: SupabaseClient,
  ctx: ConnectionContext,
  payload: Record<string, unknown>,
  env: ApiEnv,
) {
  const returnGid = shopifyNumericId(
    payload.admin_graphql_api_id ?? payload.id,
    "Return",
  );
  if (!returnGid) throw new Error("shopify_return_webhook_missing_id");

  const accessToken = await getValidShopifyAccessToken(env, ctx.connectionId);
  const result = await shopifyGraphql<{
    return: {
      id: string;
      status: string | null;
      createdAt: string | null;
      closedAt: string | null;
      order: {
        id: string;
        fulfillments: {
          nodes: Array<{
            id: string;
            fulfillmentLineItems: { nodes: Array<{ id: string }> };
          }>;
        };
      } | null;
      returnLineItems: {
        nodes: Array<{
          id: string;
          quantity: number;
          returnReason: string | null;
          returnReasonDefinition: { handle: string } | null;
          fulfillmentLineItem: { id: string; lineItem: { id: string } } | null;
        }>;
        pageInfo: { hasNextPage: boolean };
      };
    } | null;
  }>(
    ctx.shopDomain,
    accessToken,
    `query A22Return($id: ID!) {
      return(id: $id) {
        id status createdAt closedAt
        order {
          id
          fulfillments(first: 20) {
            nodes { id fulfillmentLineItems(first: 100) { nodes { id } } }
          }
        }
        returnLineItems(first: 250) {
          nodes {
            id quantity returnReason
            returnReasonDefinition { handle }
            fulfillmentLineItem { id lineItem { id } }
          }
          pageInfo { hasNextPage }
        }
      }
    }`,
    { id: returnGid },
  );

  const returned = result.return;
  const orderGid = returned?.order?.id;
  if (!returned || !orderGid) throw new Error("shopify_return_or_order_not_found");
  if (returned.returnLineItems.pageInfo.hasNextPage) {
    throw new Error("shopify_return_line_items_exceed_page_limit");
  }

  const { data: order, error: orderError } = await supabase
    .from("shopify_order_facts")
    .select("id")
    .eq("organization_id", ctx.organizationId)
    .eq("store_id", ctx.storeId)
    .eq("external_order_id", orderGid)
    .maybeSingle();
  if (orderError || !order) {
    throw new Error(orderError?.message ?? "shopify_return_order_not_synced");
  }

  const { data: returnRow, error: returnError } = await supabase
    .from("shopify_returns")
    .upsert({
      organization_id: ctx.organizationId,
      store_id: ctx.storeId,
      order_id: order.id,
      external_return_id: returned.id,
      status: returned.status,
      total_quantity: returned.returnLineItems.nodes.reduce((sum, item) => sum + Math.max(0, item.quantity), 0),
      external_created_at: returned.createdAt,
      closed_at: returned.closedAt,
    }, { onConflict: "store_id,external_return_id" })
    .select("id")
    .single();
  if (returnError || !returnRow) {
    throw new Error(returnError?.message ?? "shopify_return_upsert_failed");
  }

  const { data: orderItemRefs, error: orderItemRefsError } = await supabase
    .from("shopify_order_items")
    .select("id, external_line_item_id")
    .eq("organization_id", ctx.organizationId)
    .eq("order_id", order.id);
  if (orderItemRefsError) {
    throw new Error(`shopify_return_order_items_read_failed: ${orderItemRefsError.message}`);
  }
  const orderItemIdByExternalId = new Map(
    (orderItemRefs ?? []).map((item) => [item.external_line_item_id, item.id]),
  );

  const fulfillmentExternalIds: string[] = [];
  for (const fulfillment of returned.order?.fulfillments.nodes ?? []) {
    fulfillmentExternalIds.push(fulfillment.id);
  }
  const { data: fulfillments, error: fulfillmentError } = fulfillmentExternalIds.length
    ? await supabase.from("shopify_fulfillments").select("id, external_fulfillment_id")
        .eq("organization_id", ctx.organizationId).eq("store_id", ctx.storeId)
        .in("external_fulfillment_id", fulfillmentExternalIds)
    : { data: [], error: null };
  if (fulfillmentError) throw new Error(fulfillmentError.message);
  const localFulfillmentIds = new Map((fulfillments ?? []).map((item) => [item.external_fulfillment_id, item.id]));
  const fulfillmentLineToLocalFulfillment = mapShopifyFulfillmentLineItems(
    returned.order?.fulfillments.nodes ?? [],
    localFulfillmentIds,
  );

  const lines = returned.returnLineItems.nodes.map((item) => {
    const fulfillmentLineItemId = item.fulfillmentLineItem?.id ?? null;
    const externalLineItemId = item.fulfillmentLineItem?.lineItem.id ?? null;
    const reason = normalizeShopifyReturnReason(item.returnReason);
    return {
      organization_id: ctx.organizationId,
      return_id: returnRow.id,
      order_item_id: externalLineItemId
        ? orderItemIdByExternalId.get(externalLineItemId) ?? null
        : null,
      external_return_line_item_id: item.id,
      external_fulfillment_line_item_id: fulfillmentLineItemId,
      fulfillment_id: fulfillmentLineItemId ? fulfillmentLineToLocalFulfillment.get(fulfillmentLineItemId) ?? null : null,
      quantity: Math.max(0, item.quantity),
      return_reason: reason,
      // customerNote/returnReasonNote deliberately are not requested or stored.
    };
  });

  const { data: existingLines, error: existingLinesError } = await supabase
    .from("shopify_return_line_items")
    .select("id, external_return_line_item_id")
    .eq("organization_id", ctx.organizationId)
    .eq("return_id", returnRow.id);
  if (existingLinesError) {
    throw new Error(`shopify_return_lines_read_failed: ${existingLinesError.message}`);
  }

  if (lines.length) {
    const { error: linesError } = await supabase.from("shopify_return_line_items")
      .upsert(lines, { onConflict: "return_id,external_return_line_item_id" });
    if (linesError) throw new Error(linesError.message);
  }

  const activeReturnLineIds = new Set(lines.map((line) => line.external_return_line_item_id));
  const staleReturnLineIds = (existingLines ?? [])
    .filter((line) => !activeReturnLineIds.has(line.external_return_line_item_id))
    .map((line) => line.id);
  if (staleReturnLineIds.length) {
    const { error: retireError } = await supabase
      .from("shopify_return_line_items")
      .delete()
      .eq("organization_id", ctx.organizationId)
      .eq("return_id", returnRow.id)
      .in("id", staleReturnLineIds);
    if (retireError) throw new Error(`shopify_return_lines_retire_failed: ${retireError.message}`);
  }

  const unlinkedLines = lines.filter((line) => !line.order_item_id).length;
  if (unlinkedLines) {
    logger.info("Shopify return lines were stored without product attribution", {
      connection_id: ctx.connectionId,
      organization_id: ctx.organizationId,
      store_id: ctx.storeId,
      return_id: returnRow.id,
      unlinked_lines: unlinkedLines,
      return_lines: lines.length,
    });
  }
}

export function safeWebhookPayload(topic: string, payload: Record<string, unknown>) {
  if (!topic.startsWith("returns/")) return payload;
  // Return webhook bodies may contain customer-entered notes. Persist only the
  // global ID needed to re-fetch the object through the scoped Admin API token.
  return {
    ...(typeof payload.id === "number" || typeof payload.id === "string" ? { id: payload.id } : {}),
    ...(typeof payload.admin_graphql_api_id === "string" ? { admin_graphql_api_id: payload.admin_graphql_api_id } : {}),
  };
}

const TOPIC_HANDLERS: Record<
  string,
  {
    scope: SyncBlockKey;
    handle: (
      supabase: SupabaseClient,
      ctx: ConnectionContext,
      payload: Record<string, unknown>,
      env: ApiEnv,
    ) => Promise<void>;
  }
> = {
  "orders/create": { scope: "orders", handle: processOrderCreateOrUpdate },
  "orders/updated": { scope: "orders", handle: processOrderCreateOrUpdate },
  "refunds/create": { scope: "refunds", handle: processRefundCreate },
  "returns/request": { scope: "orders", handle: processShopifyReturn },
  "returns/approve": { scope: "orders", handle: processShopifyReturn },
  "returns/process": { scope: "orders", handle: processShopifyReturn },
  "returns/close": { scope: "orders", handle: processShopifyReturn },
  "returns/update": { scope: "orders", handle: processShopifyReturn },
  "returns/cancel": { scope: "orders", handle: processShopifyReturn },
  "returns/decline": { scope: "orders", handle: processShopifyReturn },
  "returns/reopen": { scope: "orders", handle: processShopifyReturn },
  "products/create": { scope: "catalog", handle: processProductUpdate },
  "products/update": { scope: "catalog", handle: processProductUpdate },
  "products/delete": { scope: "catalog", handle: processProductDelete },
  "inventory_levels/update": {
    scope: "inventory",
    handle: processInventoryLevelUpdate,
  },
};

// R-010/INT-01: webhooks de ciclo de vida y privacidad. No encajan en
// SyncBlockKey (no son un bloque de sync) asi que se despachan aparte, antes
// de TOPIC_HANDLERS. Deliberadamente conservadores: reconocen y dejan
// evidencia en `private.webhook_events`, pero NO borran en cascada todo el
// historico de una tienda de forma automatica -- eso es el mismo riesgo de
// borrado irreversible ya documentado (ver RIESGOS.md, Q-009) y requiere
// decision de producto de Rafa, no una decision tomada dentro de un webhook.
async function processAppUninstalled(
  supabase: SupabaseClient,
  ctx: ConnectionContext,
) {
  await supabase
    .from("integration_connections")
    .update({ status: "disconnected" })
    .eq("id", ctx.connectionId)
    .eq("organization_id", ctx.organizationId)
    .eq("provider", "shopify");
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
    .eq("organization_id", ctx.organizationId)
    .eq("store_id", ctx.storeId)
    .eq("external_customer_id", externalCustomerId);
}

async function processShopRedact(
  supabase: SupabaseClient,
  ctx: ConnectionContext,
) {
  // Shopify llama esto ~48h despues de la desinstalacion. No hacemos borrado
  // en cascada automatico del historico (pedidos/metricas/costes) -- ver nota
  // de la funcion de arriba. Solo garantizamos que la conexion quede marcada
  // como no operativa; el borrado real de datos sigue el mismo flujo manual
  // que ya existe en el CRUD de Consultoria (con sus mismas salvaguardas).
  await supabase
    .from("integration_connections")
    .update({ status: "disconnected" })
    .eq("id", ctx.connectionId)
    .eq("organization_id", ctx.organizationId)
    .eq("provider", "shopify");
}

const COMPLIANCE_TOPIC_HANDLERS: Record<
  string,
  (
    supabase: SupabaseClient,
    ctx: ConnectionContext,
    payload: Record<string, unknown>,
  ) => Promise<void>
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

export type WebhookResult = {
  statusCode: number;
  body: Record<string, unknown>;
};

/** Shopify should send JSON, but malformed signed payloads must be rejected
 * deterministically instead of escaping as an unhandled server exception. */
export function parseShopifyWebhookPayload(
  rawBody: Buffer,
): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(rawBody.toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function handleShopifyWebhookRequest(
  env: ApiEnv,
  headers: Record<string, string | string[] | undefined>,
  rawBody: Buffer,
): Promise<WebhookResult> {
  const hmacHeader =
    typeof headers["x-shopify-hmac-sha256"] === "string"
      ? headers["x-shopify-hmac-sha256"]
      : undefined;
  const shopDomain =
    typeof headers["x-shopify-shop-domain"] === "string"
      ? headers["x-shopify-shop-domain"]
      : undefined;
  const topic =
    typeof headers["x-shopify-topic"] === "string"
      ? headers["x-shopify-topic"]
      : undefined;
  const webhookId =
    typeof headers["x-shopify-webhook-id"] === "string"
      ? headers["x-shopify-webhook-id"]
      : undefined;

  // La app publica y la de distribucion personalizada firman con secrets distintos
  // (mismo problema que el callback OAuth, ver shopify.ts). Mientras la tienda este
  // instalada via la app custom (caso actual, ver ADR), verificar solo contra
  // SHOPIFY_API_SECRET (el de la app publica) rechaza el 100% de los webhooks reales
  // con HMAC valido -- se prueban ambos secrets configurados, igual que en el OAuth.
  const candidateSecrets = [
    env.SHOPIFY_API_SECRET,
    env.SHOPIFY_CUSTOM_API_SECRET,
  ].filter((secret): secret is string => Boolean(secret));

  if (
    !candidateSecrets.some((secret) =>
      verifyShopifyWebhookHmac(rawBody, hmacHeader, secret),
    )
  ) {
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

  const supabase = createServiceClient(env);
  let ctx: ConnectionContext | null;
  try {
    ctx = await resolveConnectionContext(supabase, shopDomain);
  } catch (error) {
    logger.error("Shopify webhook context temporarily unavailable", { shop_domain: shopDomain, error: error instanceof Error ? error.message : String(error) });
    return { statusCode: 503, body: { error: "shopify_webhook_context_unavailable" } };
  }

  if (!ctx) {
    logger.info("Shopify webhook received for unknown connection", {
      shop_domain: shopDomain,
      topic,
    });
    return { statusCode: 200, body: { status: "ignored_unknown_connection" } };
  }

  const payload = parseShopifyWebhookPayload(rawBody);
  if (!payload) {
    return { statusCode: 400, body: { error: "invalid_json_payload" } };
  }
  const persistedPayload = safeWebhookPayload(topic, payload);

  const fingerprint = sha256(rawBody.toString("utf8"));

  const { error: eventInsertError } = await supabase
    .schema("private")
    .from("webhook_events")
    .insert({
      connection_id: ctx.connectionId,
      organization_id: ctx.organizationId,
      provider: "shopify",
      topic,
      external_event_id: webhookId ?? null,
      fingerprint,
      signature_valid: true,
      status: "queued",
      payload: persistedPayload,
      headers: {
        "x-shopify-shop-domain": shopDomain,
        "x-shopify-topic": topic,
        "x-shopify-webhook-id": webhookId ?? null,
      },
    });

  if (eventInsertError) {
    if (eventInsertError.code === "23505") {
      // Un webhook concurrente ya reclamado debe ser idempotente, pero un
      // evento que fallo necesita poder reintentarse: Shopify reenvia el
      // mismo webhook usando el mismo id/fingerprint. Sin esta rama, la
      // unicidad convertia cualquier fallo transitorio en un falso 200 y el
      // pedido/inventario quedaba sin aplicar para siempre.
      const { data: existingEvent, error: existingEventError } = await supabase
        .schema("private")
        .from("webhook_events")
        .select("id, status, received_at, retry_count")
        .eq("provider", "shopify")
        .eq("connection_id", ctx.connectionId)
        .eq("fingerprint", fingerprint)
        .maybeSingle();

      if (existingEventError || !existingEvent) {
        logger.error("Shopify webhook duplicate lookup failed", {
          shop_domain: shopDomain,
          organization_id: ctx.organizationId,
          topic,
          error:
            existingEventError?.message ??
            "event_not_found_after_unique_conflict",
        });
        return {
          statusCode: 500,
          body: { error: "webhook_duplicate_lookup_failed" },
        };
      }

      const receivedAt = new Date(existingEvent.received_at).getTime();
      const staleReceived =
        existingEvent.status === "received" &&
        Number.isFinite(receivedAt) &&
        Date.now() - receivedAt >= 15 * 60 * 1000;
      const retryable =
        staleReceived ||
        (existingEvent.status === "failed" &&
          Number(existingEvent.retry_count ?? 0) < WEBHOOK_DRAIN_MAX_ATTEMPTS);

      if (!retryable) {
        if (existingEvent.status === "queued") void wakeShopifyWebhooks(env).catch(() => {});
        return { statusCode: 200, body: { status: "duplicate" } };
      }

      const expectedStatus = existingEvent.status;
      const { data: claimedEvent, error: claimError } = await supabase
        .schema("private")
        .from("webhook_events")
        .update({ status: "queued", processed_at: null, error_message: null, next_retry_at: null })
        .eq("id", existingEvent.id)
        .eq("status", expectedStatus)
        .select("id")
        .maybeSingle();

      // Otro reintento pudo reclamarlo entre el lookup y el update.
      if (claimError) {
        logger.error("Shopify webhook retry claim failed", {
          shop_domain: shopDomain,
          organization_id: ctx.organizationId,
          topic,
          error: claimError.message,
        });
        return {
          statusCode: 500,
          body: { error: "webhook_retry_claim_failed" },
        };
      }

      if (!claimedEvent) {
        return { statusCode: 200, body: { status: "duplicate" } };
      }
    } else {
      logger.error("Shopify webhook event insert failed", {
        shop_domain: shopDomain,
        organization_id: ctx.organizationId,
        topic,
        error: eventInsertError.message,
      });
      return {
        statusCode: 500,
        body: { error: "webhook_event_insert_failed" },
      };
    }
  }

  try { await wakeShopifyWebhooks(env); } catch (error) {
    logger.error("Shopify webhook wakeup failed; durable inbox will be swept", { error: error instanceof Error ? error.message : String(error) });
  }
  return { statusCode: 200, body: { status: "queued" } };
}

/**
 * Procesa eventos persistidos en tandas acotadas. La API solo valida y encola;
 * este drenaje usa una cola independiente de las importaciones largas.
 */
export const WEBHOOK_DRAIN_MAX_ATTEMPTS = 16;

export function shopifyWebhookRetryAt(attempt: number, now = Date.now()) {
  return new Date(now + Math.min(3_600_000, 5_000 * 2 ** Math.max(0, attempt - 1))).toISOString();
}

export async function drainFailedShopifyWebhooks(env: ApiEnv, limit = 100) {
  const supabase = createServiceClient(env);
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const leaseBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const batchLimit = Math.max(1, Math.min(100, Math.floor(limit) || 1));
  const summary = { candidates: 0, processed: 0, failed: 0, skipped: 0 };

  const { error: recoverError } = await supabase
    .schema("private")
    .from("webhook_events")
    .update({ status: "queued", claimed_at: null, next_retry_at: null })
    .eq("provider", "shopify")
    .eq("status", "processing")
    .lt("claimed_at", leaseBefore);
  if (recoverError) throw new Error(`webhook_drain_recover_failed: ${recoverError.message}`);

  const { data: events, error } = await supabase
    .schema("private")
    .from("webhook_events")
    .select("id, connection_id, topic, status, payload, retry_count")
    .eq("provider", "shopify")
    .lt("retry_count", WEBHOOK_DRAIN_MAX_ATTEMPTS)
    .or(`and(status.in.(queued,failed),or(next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()})),and(status.eq.received,received_at.lt.${staleBefore})`)
    .order("received_at", { ascending: true })
    .limit(batchLimit);
  if (error) throw new Error(`webhook_drain_load_failed: ${error.message}`);

  for (const event of events ?? []) {
    summary.candidates += 1;
    // Reclamo CAS antes de cualquier efecto; los reintentos concurrentes no
    // pueden aplicar dos veces un mismo evento.
    const attempts = Number(event.retry_count ?? 0) + 1;
    const { data: claimed, error: claimError } = await supabase
      .schema("private")
      .from("webhook_events")
      .update({ status: "processing", claimed_at: new Date().toISOString(), retry_count: attempts })
      .eq("id", event.id as string)
      .eq("status", event.status as string)
      .eq("retry_count", event.retry_count as number)
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(`webhook_drain_claim_failed: ${claimError.message}`);
    if (!claimed) {
      summary.skipped += 1;
      continue;
    }

    const entry = TOPIC_HANDLERS[event.topic as string];
    const complianceHandler = COMPLIANCE_TOPIC_HANDLERS[event.topic as string];
    const handle = entry?.handle ?? complianceHandler;
    try {
      const ctx = event.connection_id
        ? await resolveConnectionContextById(supabase, event.connection_id as string, Boolean(complianceHandler))
        : null;
      if (!handle || !ctx) {
      await supabase
        .schema("private")
        .from("webhook_events")
        .update({
          status: "ignored_duplicate",
          processed_at: new Date().toISOString(),
          error_message: !handle ? "shopify_webhook_handler_unavailable" : "shopify_connection_inactive",
        })
        .eq("id", event.id as string)
        .eq("status", "processing");
      summary.skipped += 1;
        continue;
      }
      await handle(supabase, ctx, event.payload as Record<string, unknown>, env);
      await invalidateIntegrationData(env.REDIS_URL, ctx.organizationId);
      if (entry?.scope) {
        await recordBlockRun(supabase, ctx.connectionId, ctx.organizationId, entry.scope, "succeeded");
      }
      const { error: finishError } = await supabase
        .schema("private")
        .from("webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString(), claimed_at: null, error_message: null, next_retry_at: null })
        .eq("id", event.id as string)
        .eq("status", "processing");
      if (finishError) throw new Error(`shopify_webhook_finish_failed: ${finishError.message}`);
      summary.processed += 1;
    } catch (processError) {
      const message = processError instanceof Error ? processError.message : "webhook_retry_failed";
      const { error: failureError } = await supabase
        .schema("private")
        .from("webhook_events")
        .update({ status: "failed", processed_at: new Date().toISOString(), claimed_at: null, error_message: message, next_retry_at: shopifyWebhookRetryAt(attempts) })
        .eq("id", event.id as string)
        .eq("status", "processing");
      summary.failed += 1;
      if (failureError) throw new Error(`shopify_webhook_failure_store_failed: ${failureError.message}`);
      logger.error("Shopify webhook retry failed", {
        connection_id: event.connection_id,
        topic: event.topic,
        attempt: attempts,
        error: message,
      });
    }
  }

  return summary;
}

async function resolveConnectionContextById(
  supabase: SupabaseClient,
  connectionId: string,
  allowInactive = false,
): Promise<ConnectionContext | null> {
  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, organization_id, status, provider_account_id")
    .eq("id", connectionId)
    .maybeSingle();
  if (connectionError) throw new Error(`shopify_webhook_connection_lookup_failed: ${connectionError.message}`);
  if (!connection || (!allowInactive && !acceptsWebhookIngest(connection.status))) return null;
  const { data: store, error: storeError } = await supabase
    .from("shopify_stores")
    .select("id")
    .eq("connection_id", connection.id)
    .maybeSingle();
  if (storeError) throw new Error(`shopify_webhook_store_lookup_failed: ${storeError.message}`);
  if (!store || !connection.provider_account_id) throw new Error("shopify_webhook_store_initializing");
  return { connectionId: connection.id, organizationId: connection.organization_id, storeId: store.id, shopDomain: connection.provider_account_id };
}
