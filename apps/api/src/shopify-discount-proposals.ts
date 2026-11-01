import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { LoadedApiEnv } from "@e-nora/config";
import { membershipCoversStore, requireOperationalOrganization, type AuthContext } from "./auth-context.js";
import { getValidShopifyAccessToken } from "./shopify-token-store.js";
import { shopifyGraphql } from "./shopify-client.js";

type ApiEnv = LoadedApiEnv;
type DiscountKind = "percentage" | "fixed_amount";

export const shopifyDiscountDraftSchema = z.object({
  connection_id: z.string().uuid(),
  idempotency_key: z.string().uuid(),
  code: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/).transform((value) => value.toUpperCase()),
  title: z.string().trim().min(1).max(255),
  discount_type: z.enum(["percentage", "fixed_amount"]),
  value: z.number().finite().positive().max(100_000),
  starts_at: z.string().datetime({ offset: true }).optional(),
  ends_at: z.string().datetime({ offset: true }).optional(),
  usage_limit: z.number().int().positive().max(1_000_000).nullable().optional(),
  once_per_customer: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (value.discount_type === "percentage" && value.value > 100) {
    ctx.addIssue({ code: "custom", path: ["value"], message: "percentage_exceeds_100" });
  }
  if (value.ends_at && value.starts_at && Date.parse(value.ends_at) <= Date.parse(value.starts_at)) {
    ctx.addIssue({ code: "custom", path: ["ends_at"], message: "end_must_follow_start" });
  }
});

export type ShopifyDiscountDraft = z.infer<typeof shopifyDiscountDraftSchema>;

export const SHOPIFY_DISCOUNT_CREATE_MUTATION = `
  mutation EnoraCreateDiscountCode($discount: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $discount) {
      codeDiscountNode { id }
      userErrors { field message code }
    }
  }
`;

export const SHOPIFY_DISCOUNT_BY_CODE_QUERY = `
  query EnoraReadDiscountByCode($code: String!) {
    codeDiscountNodeByCode(code: $code) {
      id
      codeDiscount {
        __typename
        ... on DiscountCodeBasic {
          title
          startsAt
          tags
          codes(first: 5) { nodes { code } }
        }
      }
    }
  }
`;

type DiscountProposalRow = {
  id: string;
  organization_id: string;
  store_id: string;
  request: ShopifyDiscountDraft;
  status: "draft" | "applying" | "applied" | "failed" | "conflict" | "expired";
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  expires_at: string;
  shopify_discount_id: string | null;
  shopify_result: Record<string, unknown> | null;
  failure_code: string | null;
  created_at: string;
  updated_at: string;
};

type RemoteDiscount = {
  id: string;
  codeDiscount: {
    __typename: string;
    title?: string | null;
    startsAt?: string | null;
    tags?: string[] | null;
    codes?: { nodes?: Array<{ code?: string | null }> } | null;
  } | null;
};

type ShopifyGraphData<T> = { [key: string]: T };

function createServiceClient(env: ApiEnv) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("discount_proposal_service_role_unavailable");
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function writableMembership(context: AuthContext, organizationId: string, storeId?: string) {
  const membership = context.memberships.find((item) => item.organization_id === organizationId);
  if (!membership || membership.accessSource !== "membership") return null;
  if (!(membership.role === "owner" || membership.role === "manager")) return null;
  if (storeId && !membershipCoversStore(membership, storeId)) return null;
  return membership;
}

function publicProposal(row: DiscountProposalRow) {
  return {
    id: row.id,
    store_id: row.store_id,
    request: row.request,
    status: row.status,
    approved_at: row.approved_at,
    expires_at: row.expires_at,
    shopify_discount_id: row.shopify_discount_id,
    shopify_result: row.shopify_result,
    failure_code: row.failure_code,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function buildShopifyDiscountInput(proposalId: string, draft: ShopifyDiscountDraft) {
  const value = draft.discount_type === "percentage"
    ? { percentage: draft.value / 100 }
    : { discountAmount: { amount: String(draft.value), appliesOnEachItem: false } };
  return {
    title: draft.title,
    code: draft.code,
    startsAt: draft.starts_at ?? new Date().toISOString(),
    ...(draft.ends_at ? { endsAt: draft.ends_at } : {}),
    ...(draft.usage_limit ? { usageLimit: draft.usage_limit } : {}),
    appliesOncePerCustomer: draft.once_per_customer,
    context: { all: "ALL" },
    customerGets: { value, items: { all: true } },
    tags: [`enora-proposal:${proposalId}`],
  };
}

export function isRemoteDiscountForProposal(
  remote: RemoteDiscount | null | undefined,
  proposal: Pick<DiscountProposalRow, "id" | "request">,
) {
  if (!remote || remote.codeDiscount?.__typename !== "DiscountCodeBasic") return false;
  const marker = `enora-proposal:${proposal.id}`;
  const codes = remote.codeDiscount.codes?.nodes?.map((item) => item.code?.toUpperCase()) ?? [];
  return remote.codeDiscount.tags?.includes(marker) === true &&
    remote.codeDiscount.title === proposal.request.title &&
    codes.includes(proposal.request.code.toUpperCase());
}

async function loadScopedStore(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  storeId: string,
  requiredScopes: readonly string[] = [],
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (!access.ok) return access;
  const membership = writableMembership(context, organizationId, storeId);
  if (!membership) return { ok: false as const, statusCode: 403, error: "shopify_discount_write_access_denied" };
  const supabase = createServiceClient(env);
  const { data: store, error: storeError } = await supabase.from("shopify_stores")
    .select("id, organization_id, connection_id, is_active")
    .eq("id", storeId).eq("organization_id", organizationId).maybeSingle();
  if (storeError) return { ok: false as const, statusCode: 503, error: "shopify_discount_store_load_failed" };
  if (!store || store.is_active !== true || !store.connection_id) {
    return { ok: false as const, statusCode: 404, error: "shopify_discount_store_not_found" };
  }
  const { data: connection, error: connectionError } = await supabase.from("integration_connections")
    .select("id, provider, provider_account_id, scopes, status")
    .eq("id", store.connection_id).eq("organization_id", organizationId).eq("provider", "shopify").maybeSingle();
  if (connectionError) return { ok: false as const, statusCode: 503, error: "shopify_discount_connection_load_failed" };
  if (!connection || ["disconnected", "revoked", "error"].includes(connection.status)) {
    return { ok: false as const, statusCode: 409, error: "shopify_discount_connection_unavailable" };
  }
  const scopes = Array.isArray(connection.scopes) ? connection.scopes : [];
  const missing = requiredScopes.filter((scope) => !scopes.includes(scope));
  if (missing.length) {
    return { ok: false as const, statusCode: 409, error: "shopify_discount_scopes_missing", missing_scopes: missing };
  }
  const domain = typeof connection.provider_account_id === "string" ? connection.provider_account_id.toLowerCase() : "";
  if (!/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/.test(domain)) {
    return { ok: false as const, statusCode: 409, error: "shopify_discount_shop_domain_invalid" };
  }
  return { ok: true as const, supabase, store, connection, domain };
}

async function loadScopedConnection(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId: string,
  requiredScopes: readonly string[] = [],
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (!access.ok) return access;
  if (!z.string().uuid().safeParse(connectionId).success) {
    return { ok: false as const, statusCode: 400, error: "shopify_discount_connection_id_invalid" };
  }
  if (!writableMembership(context, organizationId)) {
    return { ok: false as const, statusCode: 403, error: "shopify_discount_write_access_denied" };
  }
  const supabase = createServiceClient(env);
  const { data: store, error } = await supabase.from("shopify_stores")
    .select("id").eq("organization_id", organizationId).eq("connection_id", connectionId).eq("is_active", true).maybeSingle();
  if (error) return { ok: false as const, statusCode: 503, error: "shopify_discount_store_load_failed" };
  if (!store) return { ok: false as const, statusCode: 404, error: "shopify_discount_store_not_found" };
  return loadScopedStore(env, context, organizationId, store.id, requiredScopes);
}

async function findRemoteByCode(domain: string, token: string, code: string) {
  const data = await shopifyGraphql<ShopifyGraphData<RemoteDiscount | null>>(
    domain,
    token,
    SHOPIFY_DISCOUNT_BY_CODE_QUERY,
    { code },
  );
  return data.codeDiscountNodeByCode ?? null;
}

async function settleAppliedProposal(
  supabase: ReturnType<typeof createServiceClient>,
  proposal: DiscountProposalRow,
  remote: RemoteDiscount,
) {
  const result = {
    id: remote.id,
    title: remote.codeDiscount?.title ?? proposal.request.title,
    code: proposal.request.code,
    starts_at: remote.codeDiscount?.startsAt ?? proposal.request.starts_at ?? null,
  };
  const { data, error } = await supabase.from("shopify_discount_proposals")
    .update({ status: "applied", shopify_discount_id: remote.id, shopify_result: result, failure_code: null, updated_at: new Date().toISOString() })
    .eq("id", proposal.id).eq("organization_id", proposal.organization_id)
    .select("*").single();
  if (error || !data) throw new Error("shopify_discount_proposal_settle_failed");
  return publicProposal(data as DiscountProposalRow);
}

export async function createShopifyDiscountProposal(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId: string,
  raw: unknown,
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (!access.ok) return access;
  const parsed = shopifyDiscountDraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, statusCode: 400, error: "shopify_discount_draft_invalid", issues: parsed.error.issues.map(({ path, message }) => ({ path, message })) };
  if (!writableMembership(context, organizationId)) {
    return { ok: false as const, statusCode: 403, error: "shopify_discount_write_access_denied" };
  }
  const scope = await loadScopedConnection(env, context, organizationId, connectionId);
  if (!scope.ok) return scope;
  const storeId = scope.store.id;
  const { data: existing, error: existingError } = await scope.supabase.from("shopify_discount_proposals")
    .select("*").eq("store_id", storeId).eq("idempotency_key", parsed.data.idempotency_key).maybeSingle();
  if (existingError) return { ok: false as const, statusCode: 503, error: "shopify_discount_proposal_load_failed" };
  if (existing) {
    const row = existing as DiscountProposalRow;
    if (stableJson(row.request) !== stableJson(parsed.data)) {
      return { ok: false as const, statusCode: 409, error: "shopify_discount_idempotency_conflict" };
    }
    return { ok: true as const, data: publicProposal(row), reused: true };
  }
  const { data, error } = await scope.supabase.from("shopify_discount_proposals")
    .insert({
      organization_id: organizationId,
      store_id: storeId,
      idempotency_key: parsed.data.idempotency_key,
      request: parsed.data,
      created_by: context.user.id,
    })
    .select("*").single();
  if (error) {
    const codeConflict = error.code === "23505" && error.message.includes("live_code");
    return { ok: false as const, statusCode: codeConflict ? 409 : 503, error: codeConflict ? "shopify_discount_code_already_proposed" : "shopify_discount_proposal_create_failed" };
  }
  return { ok: true as const, data: publicProposal(data as DiscountProposalRow), reused: false };
}

export async function listShopifyDiscountProposals(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  connectionId: string,
) {
  const scope = await loadScopedConnection(env, context, organizationId, connectionId);
  if (!scope.ok) return scope;
  const storeId = scope.store.id;
  const { data, error } = await scope.supabase.from("shopify_discount_proposals")
    .select("*").eq("organization_id", organizationId).eq("store_id", storeId)
    .order("created_at", { ascending: false }).limit(50);
  if (error) return { ok: false as const, statusCode: 503, error: "shopify_discount_proposals_load_failed" };
  const now = Date.now();
  const updates = (data ?? []).filter((row) => row.status === "draft" && Date.parse(row.expires_at) <= now).map((row) => row.id);
  if (updates.length) {
    await scope.supabase.from("shopify_discount_proposals").update({ status: "expired", updated_at: new Date(now).toISOString() })
      .in("id", updates).eq("organization_id", organizationId).eq("store_id", storeId).eq("status", "draft");
  }
  const expiredIds = new Set(updates);
  return { ok: true as const, data: { proposals: (data ?? []).map((row) => publicProposal({
    ...(row as DiscountProposalRow),
    status: expiredIds.has(row.id) ? "expired" : row.status,
  })) } };
}

export async function approveAndApplyShopifyDiscountProposal(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  proposalId: string,
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (!access.ok) return access;
  if (!writableMembership(context, organizationId)) {
    return { ok: false as const, statusCode: 403, error: "shopify_discount_write_access_denied" };
  }
  if (!z.string().uuid().safeParse(proposalId).success) return { ok: false as const, statusCode: 404, error: "shopify_discount_proposal_not_found" };
  const supabase = createServiceClient(env);
  const { data: loaded, error: loadError } = await supabase.from("shopify_discount_proposals")
    .select("*").eq("id", proposalId).eq("organization_id", organizationId).maybeSingle();
  if (loadError) return { ok: false as const, statusCode: 503, error: "shopify_discount_proposal_load_failed" };
  if (!loaded) return { ok: false as const, statusCode: 404, error: "shopify_discount_proposal_not_found" };
  let proposal = loaded as DiscountProposalRow;
  const scope = await loadScopedStore(env, context, organizationId, proposal.store_id, ["read_discounts", "write_discounts"]);
  if (!scope.ok) return scope;
  if (proposal.status === "applied") return { ok: true as const, data: publicProposal(proposal), reused: true };
  if (["failed", "conflict", "expired"].includes(proposal.status)) {
    return { ok: false as const, statusCode: 409, error: `shopify_discount_proposal_${proposal.status}` };
  }
  const ownsApplyClaim = proposal.status === "draft";
  if (ownsApplyClaim) {
    if (Date.parse(proposal.expires_at) <= Date.now()) {
      await scope.supabase.from("shopify_discount_proposals").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", proposal.id).eq("status", "draft");
      return { ok: false as const, statusCode: 409, error: "shopify_discount_proposal_expired" };
    }
    const { data: claimed, error: claimError } = await scope.supabase.from("shopify_discount_proposals")
      .update({ status: "applying", approved_by: context.user.id, approved_at: new Date().toISOString(), updated_at: new Date().toISOString(), failure_code: null })
      .eq("id", proposal.id).eq("organization_id", organizationId).eq("status", "draft")
      .select("*").maybeSingle();
    if (claimError) return { ok: false as const, statusCode: 503, error: "shopify_discount_proposal_claim_failed" };
    if (!claimed) return { ok: false as const, statusCode: 409, error: "shopify_discount_proposal_apply_in_progress" };
    proposal = claimed as DiscountProposalRow;
  }

  const token = await getValidShopifyAccessToken(env, scope.connection.id);
  let remote: RemoteDiscount | null = null;
  try {
    remote = await findRemoteByCode(scope.domain, token, proposal.request.code);
    if (remote) {
      if (isRemoteDiscountForProposal(remote, proposal)) {
        return { ok: true as const, data: await settleAppliedProposal(scope.supabase, proposal, remote), reused: true };
      }
      await scope.supabase.from("shopify_discount_proposals").update({ status: "conflict", failure_code: "discount_code_already_exists", updated_at: new Date().toISOString() }).eq("id", proposal.id).eq("status", "applying");
      return { ok: false as const, statusCode: 409, error: "shopify_discount_code_already_exists" };
    }
    if (!ownsApplyClaim) {
      return { ok: false as const, statusCode: 409, error: "shopify_discount_proposal_apply_in_progress" };
    }

    const payload = await shopifyGraphql<{
      discountCodeBasicCreate: {
        codeDiscountNode: { id: string } | null;
        userErrors: Array<{ field?: string[] | null; message: string; code?: string | null }>;
      };
    }>(scope.domain, token, SHOPIFY_DISCOUNT_CREATE_MUTATION, {
      discount: buildShopifyDiscountInput(proposal.id, proposal.request),
    });
    const created = payload.discountCodeBasicCreate;
    if (created.userErrors?.length || !created.codeDiscountNode?.id) {
      const recovery = await findRemoteByCode(scope.domain, token, proposal.request.code).catch(() => null);
      if (recovery && isRemoteDiscountForProposal(recovery, proposal)) {
        return { ok: true as const, data: await settleAppliedProposal(scope.supabase, proposal, recovery), reused: true };
      }
      const code = created.userErrors?.some((item) => item.code === "TAKEN") ? "discount_code_already_exists" : "shopify_discount_rejected";
      await scope.supabase.from("shopify_discount_proposals").update({ status: code === "discount_code_already_exists" ? "conflict" : "failed", failure_code: code, updated_at: new Date().toISOString() }).eq("id", proposal.id).eq("status", "applying");
      return { ok: false as const, statusCode: 422, error: code };
    }

    await scope.supabase.from("shopify_discount_proposals").update({ shopify_discount_id: created.codeDiscountNode.id, updated_at: new Date().toISOString() }).eq("id", proposal.id).eq("status", "applying");
    remote = await findRemoteByCode(scope.domain, token, proposal.request.code);
    if (!remote || remote.id !== created.codeDiscountNode.id || !isRemoteDiscountForProposal(remote, proposal)) {
      return { ok: false as const, statusCode: 503, error: "shopify_discount_created_verification_pending" };
    }
    return { ok: true as const, data: await settleAppliedProposal(scope.supabase, proposal, remote), reused: false };
  } catch {
    // A timed-out create can still have reached Shopify. The proposal marker is
    // checked before any retry so an ambiguous response never creates a second code.
    const recovery = await findRemoteByCode(scope.domain, token, proposal.request.code).catch(() => null);
    if (recovery && isRemoteDiscountForProposal(recovery, proposal)) {
      return { ok: true as const, data: await settleAppliedProposal(scope.supabase, proposal, recovery), reused: true };
    }
    await scope.supabase.from("shopify_discount_proposals").update({ failure_code: "shopify_discount_apply_unverified", updated_at: new Date().toISOString() }).eq("id", proposal.id).eq("status", "applying");
    return { ok: false as const, statusCode: 503, error: "shopify_discount_apply_unverified" };
  }
}
