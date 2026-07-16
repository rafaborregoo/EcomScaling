import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function assertCanManage(context: AuthContext, organizationId: string) {
  const membership = context.memberships.find((item) => item.organization_id === organizationId);

  if (!membership) {
    return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
  }

  if (context.profile.platform_role !== "platform_admin" && !["owner", "manager"].includes(membership.role)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_manage_denied",
      message: "Solo owner, manager o platform admin pueden gestionar costes.",
    };
  }

  return { ok: true as const };
}

export async function listProductCosts(env: ApiEnv, authorization: string, context: AuthContext, organizationId: string) {
  if (!context.memberships.some((membership) => membership.organization_id === organizationId)) {
    return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const { data, error } = await supabase
    .from("product_costs")
    .select(
      "id, inventory_item_id, unit_cost, currency_code, source, is_override, valid_from, valid_until, created_at, shopify_inventory_items(sku, shopify_variants(title, shopify_products(title)))",
    )
    .eq("organization_id", organizationId)
    .order("valid_from", { ascending: false })
    .limit(200);

  if (error) {
    return { ok: false as const, statusCode: 500, error: "product_costs_load_failed", detail: error.message };
  }

  return { ok: true as const, data: data ?? [] };
}

type UpsertCostInput = {
  sku?: string;
  inventoryItemId?: string;
  unitCost: number;
  currencyCode?: string;
  validFrom?: string;
};

export async function upsertProductCost(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: UpsertCostInput,
) {
  const authz = assertCanManage(context, organizationId);
  if (!authz.ok) {
    return authz;
  }

  if (!Number.isFinite(input.unitCost) || input.unitCost < 0) {
    return { ok: false as const, statusCode: 400, error: "invalid_unit_cost" };
  }

  if (!input.sku && !input.inventoryItemId) {
    return { ok: false as const, statusCode: 400, error: "missing_sku_or_inventory_item_id" };
  }

  const supabase = createServiceClient(env);

  let inventoryItemId = input.inventoryItemId ?? null;

  if (!inventoryItemId && input.sku) {
    const { data: inventoryItem, error: lookupError } = await supabase
      .from("shopify_inventory_items")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("sku", input.sku)
      .maybeSingle();

    if (lookupError) {
      return { ok: false as const, statusCode: 500, error: "sku_lookup_failed", detail: lookupError.message };
    }

    if (!inventoryItem) {
      return { ok: false as const, statusCode: 404, error: "sku_not_found" };
    }

    inventoryItemId = inventoryItem.id;
  }

  const { data, error } = await supabase
    .from("product_costs")
    .insert({
      organization_id: organizationId,
      inventory_item_id: inventoryItemId,
      unit_cost: input.unitCost,
      currency_code: input.currencyCode ?? "EUR",
      source: "manual",
      is_override: true,
      valid_from: input.validFrom ?? new Date().toISOString().slice(0, 10),
      created_by: context.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false as const, statusCode: 500, error: "product_cost_create_failed", detail: error?.message };
  }

  return { ok: true as const, data: { id: data.id } };
}
