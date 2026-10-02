import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEmail(value: unknown): string | null {
  const email = text(value)?.toLowerCase() ?? null;
  return email && email.includes("@") ? email : null;
}

function normalizePhone(value: unknown): string | null {
  const phone = text(value)?.replace(/[^+\d]/g, "") ?? null;
  return phone && phone.replace(/\D/g, "").length >= 7 ? phone : null;
}

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function object(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function shopifyGid(resource: "Product" | "ProductVariant", value: unknown) {
  if (typeof value === "string" && value.startsWith(`gid://shopify/${resource}/`)) {
    return value;
  }
  const numericId = typeof value === "number"
    ? Number.isSafeInteger(value) && value > 0 ? String(value) : null
    : typeof value === "string" && /^\d+$/.test(value.trim()) ? value.trim() : null;
  return numericId ? `gid://shopify/${resource}/${numericId}` : null;
}

function safeLineItems(payload: JsonRecord) {
  return Array.isArray(payload.line_items)
    ? payload.line_items.slice(0, 100).map((item) => {
        const row = object(item);
        return {
          product_id: shopifyGid("Product", row.product_id),
          variant_id: shopifyGid("ProductVariant", row.variant_id),
          title: row.title ?? null,
          sku: row.sku ?? null,
          quantity: row.quantity ?? 0,
          price: row.price ?? null,
        };
      })
    : [];
}

function customerFrom(payload: JsonRecord): JsonRecord {
  return object(payload.customer);
}

async function accountIdForStore(
  supabase: SupabaseClient,
  organizationId: string,
  storeId: string,
): Promise<{ accountId: string | null; reason?: string }> {
  const { data, error } = await supabase
    .from("klaviyo_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("store_id", storeId)
    .limit(2);
  if (error) {
    const missingStoreScope = error.message.includes("store_id") && (
      error.message.includes("does not exist") ||
      error.message.includes("schema cache") ||
      error.message.includes("could not find")
    );
    if (missingStoreScope) {
      return { accountId: null, reason: "klaviyo_store_scope_pending" };
    }
    throw new Error(`klaviyo_store_account_lookup_failed:${error.message}`);
  }
  if (!data?.length) return { accountId: null, reason: "klaviyo_store_not_linked" };
  if (data.length > 1) return { accountId: null, reason: "klaviyo_store_account_ambiguous" };
  return { accountId: (data[0]?.id as string | undefined) ?? null };
}

async function upsertProfile(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    accountId: string;
    customer: JsonRecord;
  },
): Promise<string | null> {
  const email = normalizeEmail(input.customer.email);
  const phone = normalizePhone(input.customer.phone);
  const shopifyCustomerId = input.customer.admin_graphql_api_id
    ? text(input.customer.admin_graphql_api_id)
    : input.customer.id != null
      ? `gid://shopify/Customer/${input.customer.id}`
      : null;
  if (!email && !phone && !shopifyCustomerId) return null;

  const row = {
    organization_id: input.organizationId,
    account_id: input.accountId,
    shopify_customer_id: shopifyCustomerId,
    email: text(input.customer.email),
    email_normalized: email,
    phone: text(input.customer.phone),
    phone_normalized: phone,
    first_name: text(input.customer.first_name),
    last_name: text(input.customer.last_name),
    raw_data: {
      source: "shopify",
      customer_id: input.customer.id ?? null,
      updated_at: input.customer.updated_at ?? null,
    },
    last_seen_at: new Date().toISOString(),
  };

  const lookup = email
    ? supabase
        .from("klaviyo_tracking_profiles")
        .select("id")
        .eq("account_id", input.accountId)
        .eq("email_normalized", email)
        .maybeSingle()
    : shopifyCustomerId
      ? supabase
          .from("klaviyo_tracking_profiles")
          .select("id")
          .eq("account_id", input.accountId)
          .eq("shopify_customer_id", shopifyCustomerId)
          .maybeSingle()
      : supabase
          .from("klaviyo_tracking_profiles")
          .select("id")
          .eq("account_id", input.accountId)
          .eq("phone_normalized", phone)
          .maybeSingle();
  const { data: existing } = await lookup;

  if (existing?.id) {
    const { error } = await supabase
      .from("klaviyo_tracking_profiles")
      .update(row)
      .eq("id", existing.id);
    if (error)
      throw new Error(
        `klaviyo_tracking_profile_update_failed:${error.message}`,
      );
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from("klaviyo_tracking_profiles")
    .insert({ ...row, first_seen_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return null;
    throw new Error(`klaviyo_tracking_profile_insert_failed:${error.message}`);
  }
  return data?.id as string;
}

async function recordConsent(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    accountId: string;
    profileId: string;
    customer: JsonRecord;
    occurredAt: string;
    sourceEventId: string;
  },
) {
  const emailConsent = object(input.customer.email_marketing_consent);
  const smsConsent = object(input.customer.sms_marketing_consent);
  const rows = [
    { channel: "email", consent: emailConsent },
    { channel: "sms", consent: smsConsent },
  ]
    .map(({ channel, consent }) => {
      const status = text(consent.state);
      return status
        ? {
            organization_id: input.organizationId,
            account_id: input.accountId,
            profile_id: input.profileId,
            channel,
            status,
            source: "shopify_webhook",
            occurred_at: input.occurredAt,
            raw_data: { source_event_id: input.sourceEventId, consent },
          }
        : null;
    })
    .filter((row): row is Exclude<typeof row, null> => row !== null);
  if (!rows.length) return;
  const { error } = await supabase
    .from("klaviyo_tracking_consents")
    .upsert(rows, { onConflict: "profile_id,channel,occurred_at,source" });
  if (error)
    throw new Error(`klaviyo_tracking_consent_failed:${error.message}`);
}

export async function recordShopifyOrderTracking(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    storeId: string;
    payload: JsonRecord;
  },
) {
  const account = await accountIdForStore(
    supabase,
    input.organizationId,
    input.storeId,
  );
  const accountId = account.accountId;
  if (!accountId) {
    console.info("Shopify order tracking skipped because its Klaviyo store link is unavailable", {
      organization_id: input.organizationId,
      store_id: input.storeId,
      reason: account.reason ?? "klaviyo_not_connected",
    });
    return { recorded: false, reason: account.reason ?? "klaviyo_not_connected" } as const;
  }

  const customer = customerFrom(input.payload);
  const profileId = await upsertProfile(supabase, {
    organizationId: input.organizationId,
    accountId,
    customer,
  });
  const sourceEventId =
    text(input.payload.admin_graphql_api_id) ??
    (input.payload.id != null ? `shopify-order-${input.payload.id}` : null);
  if (!sourceEventId)
    return { recorded: false, reason: "order_id_missing" } as const;
  const occurredAt =
    text(input.payload.processed_at) ??
    text(input.payload.created_at) ??
    new Date().toISOString();
  const cancelled = Boolean(input.payload.cancelled_at);
  const eventName = cancelled ? "Cancelled Order" : "Placed Order";
  const currency = text(input.payload.currency)?.toUpperCase();
  const value = Number(input.payload.total_price);
  const properties = {
    order_id: sourceEventId,
    order_name: text(input.payload.name),
    financial_status: text(input.payload.financial_status),
    fulfillment_status: text(input.payload.fulfillment_status),
    source_name: text(input.payload.source_name),
    item_count: Array.isArray(input.payload.line_items)
      ? input.payload.line_items.length
      : 0,
    line_items: safeLineItems(input.payload),
  };
  const { error } = await supabase.from("klaviyo_tracking_events").upsert(
    {
      organization_id: input.organizationId,
      account_id: accountId,
      profile_id: profileId,
      event_name: eventName,
      source: "shopify_webhook",
      source_event_id: sourceEventId,
      dedupe_key: hash(`shopify:${sourceEventId}:${eventName}`),
      occurred_at: occurredAt,
      value: Number.isFinite(value) ? value : null,
      currency_code: currency,
      properties,
      raw_data: { source: "shopify", order_id: sourceEventId },
    },
    { onConflict: "account_id,dedupe_key" },
  );
  if (error) throw new Error(`klaviyo_tracking_event_failed:${error.message}`);
  if (profileId) {
    await recordConsent(supabase, {
      organizationId: input.organizationId,
      accountId,
      profileId,
      customer,
      occurredAt,
      sourceEventId,
    });
  }
  return { recorded: true, eventName, profileId } as const;
}

export async function recordShopifyRefundTracking(
  supabase: SupabaseClient,
  input: { organizationId: string; storeId: string; payload: JsonRecord },
) {
  const account = await accountIdForStore(
    supabase,
    input.organizationId,
    input.storeId,
  );
  const accountId = account.accountId;
  if (!accountId) {
    console.info("Shopify refund tracking skipped because its Klaviyo store link is unavailable", {
      organization_id: input.organizationId,
      store_id: input.storeId,
      reason: account.reason ?? "klaviyo_not_connected",
    });
    return { recorded: false, reason: account.reason ?? "klaviyo_not_connected" } as const;
  }
  const sourceEventId =
    text(input.payload.admin_graphql_api_id) ??
    (input.payload.id != null ? `shopify-refund-${input.payload.id}` : null);
  if (!sourceEventId)
    return { recorded: false, reason: "refund_id_missing" } as const;
  const refundItems = Array.isArray(input.payload.refund_line_items)
    ? input.payload.refund_line_items
    : [];
  const value = refundItems.reduce((total, item) => {
    const row = object(item);
    return total + (Number(row.subtotal) || 0) + (Number(row.total_tax) || 0);
  }, 0);
  const { error } = await supabase.from("klaviyo_tracking_events").upsert(
    {
      organization_id: input.organizationId,
      account_id: accountId,
      event_name: "Refunded Order",
      source: "shopify_webhook",
      source_event_id: sourceEventId,
      dedupe_key: hash(`shopify:${sourceEventId}:Refunded Order`),
      occurred_at: text(input.payload.created_at) ?? new Date().toISOString(),
      value,
      currency_code: null,
      properties: {
        order_id: input.payload.order_id ?? null,
        refund_items: refundItems.slice(0, 100),
      },
      raw_data: { source: "shopify", refund_id: sourceEventId },
    },
    { onConflict: "account_id,dedupe_key" },
  );
  if (error)
    throw new Error(`klaviyo_tracking_refund_event_failed:${error.message}`);
  return { recorded: true, eventName: "Refunded Order" } as const;
}
