import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  type AuthContext,
  createUserScopedClient,
  isOperationalOrganizationError,
  requireOperationalOrganization,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";

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
  const operational = requireOperationalOrganization(context, organizationId);
  if (isOperationalOrganizationError(operational)) return operational;
  const { membership } = operational;

  // El consultor entra aqui (decision de Rafa, 2026-09-06): asesora sobre el
  // margen, asi que no poder fijar costes por pedido, gastos fijos y envios le
  // dejaba dependiendo del cliente para que sus propios numeros fueran ciertos.
  // Su membresia es virtual y solo existe para las organizaciones que tiene
  // asignadas (`consultant_assignments` activas), asi que
  // `requireOperationalOrganization` de arriba ya acota el alcance.
  if (
    !["platform_admin", "consultant"].includes(context.profile.platform_role) &&
    !["owner", "manager"].includes(membership.role)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_manage_denied",
      message:
        "Solo owner, manager, consultor o platform admin pueden gestionar la configuracion financiera.",
    };
  }

  return { ok: true as const };
}

function isValidPct(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export async function getFinancialConfig(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
  if (
    !context.memberships.some(
      (membership) => membership.organization_id === organizationId,
    )
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_denied",
    };
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const [settingsResult, expensesResult, shippingResult, targetsResult] =
    await Promise.all([
      supabase
        .from("organization_financial_settings")
        .select(
          "id, currency_code, payment_fee_pct, payment_fee_fixed, default_shipping_cost, vat_pct, notes, updated_at",
        )
        .eq("organization_id", organizationId)
        .maybeSingle(),
      supabase
        .from("fixed_expenses")
        .select(
          "id, name, category, amount, currency_code, billing_period, valid_from, valid_until, is_active",
        )
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("amount", { ascending: false })
        .limit(200),
      supabase
        .from("shipping_cost_rules")
        .select(
          "id, name, country_code, cost_per_order, currency_code, min_order_total, max_order_total, valid_from, valid_until, is_active",
        )
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("organization_metric_targets")
        .select("id, metric_key, target_value, period, valid_from, valid_until")
        .eq("organization_id", organizationId)
        .order("valid_from", { ascending: false })
        .limit(200),
    ]);

  const firstError =
    settingsResult.error ??
    expensesResult.error ??
    shippingResult.error ??
    targetsResult.error;

  if (firstError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "financial_config_load_failed",
      detail: firstError.message,
    };
  }

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      settings: settingsResult.data ?? null,
      fixed_expenses: expensesResult.data ?? [],
      shipping_cost_rules: shippingResult.data ?? [],
      metric_targets: targetsResult.data ?? [],
    },
  };
}

type SettingsInput = {
  currencyCode?: string;
  paymentFeePct?: number;
  paymentFeeFixed?: number;
  defaultShippingCost?: number;
  vatPct?: number;
  notes?: string | null;
};

export async function upsertFinancialSettings(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: SettingsInput,
) {
  const authz = assertCanManage(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  if (input.paymentFeePct !== undefined && !isValidPct(input.paymentFeePct)) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_payment_fee_pct",
    };
  }

  if (input.vatPct !== undefined && !isValidPct(input.vatPct)) {
    return { ok: false as const, statusCode: 400, error: "invalid_vat_pct" };
  }

  if (
    input.paymentFeeFixed !== undefined &&
    !isValidAmount(input.paymentFeeFixed)
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_payment_fee_fixed",
    };
  }

  if (
    input.defaultShippingCost !== undefined &&
    !isValidAmount(input.defaultShippingCost)
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_default_shipping_cost",
    };
  }

  if (
    input.currencyCode !== undefined &&
    !/^[A-Z]{3}$/.test(input.currencyCode)
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_currency_code",
    };
  }

  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .from("organization_financial_settings")
    .upsert(
      {
        organization_id: organizationId,
        ...(input.currencyCode !== undefined
          ? { currency_code: input.currencyCode }
          : {}),
        ...(input.paymentFeePct !== undefined
          ? { payment_fee_pct: input.paymentFeePct }
          : {}),
        ...(input.paymentFeeFixed !== undefined
          ? { payment_fee_fixed: input.paymentFeeFixed }
          : {}),
        ...(input.defaultShippingCost !== undefined
          ? { default_shipping_cost: input.defaultShippingCost }
          : {}),
        ...(input.vatPct !== undefined ? { vat_pct: input.vatPct } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        updated_by: context.user.id,
      },
      { onConflict: "organization_id" },
    )
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "financial_settings_save_failed",
      detail: error?.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "financial_config.upsert_settings",
    entityType: "organization_financial_settings",
    entityId: data.id,
    newData: input,
  });

  return { ok: true as const, data: { id: data.id } };
}

type FixedExpenseInput = {
  name?: string;
  category?: string | null;
  amount?: number;
  currencyCode?: string;
  billingPeriod?: string;
  validFrom?: string;
  validUntil?: string | null;
};

export async function createFixedExpense(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: FixedExpenseInput,
) {
  const authz = assertCanManage(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  if (
    !input.name ||
    typeof input.name !== "string" ||
    input.name.trim().length === 0
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "missing_expense_name",
    };
  }

  if (!isValidAmount(input.amount)) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_expense_amount",
    };
  }

  if (
    input.billingPeriod !== undefined &&
    !["monthly", "yearly"].includes(input.billingPeriod)
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_billing_period",
    };
  }

  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .from("fixed_expenses")
    .insert({
      organization_id: organizationId,
      name: input.name.trim().slice(0, 160),
      category: input.category ?? null,
      amount: input.amount,
      currency_code: input.currencyCode ?? "EUR",
      billing_period: input.billingPeriod ?? "monthly",
      valid_from: input.validFrom ?? new Date().toISOString().slice(0, 10),
      valid_until: input.validUntil ?? null,
      created_by: context.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "fixed_expense_create_failed",
      detail: error?.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "financial_config.create_fixed_expense",
    entityType: "fixed_expense",
    entityId: data.id,
    newData: input,
  });

  return { ok: true as const, data: { id: data.id } };
}

export async function deactivateFixedExpense(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  expenseId: string,
) {
  const authz = assertCanManage(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .from("fixed_expenses")
    .update({ is_active: false })
    .eq("id", expenseId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "fixed_expense_deactivate_failed",
      detail: error.message,
    };
  }

  if (!data) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "fixed_expense_not_found",
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "financial_config.deactivate_fixed_expense",
    entityType: "fixed_expense",
    entityId: data.id,
  });

  return { ok: true as const, data: { id: data.id } };
}

type ShippingRuleInput = {
  name?: string;
  countryCode?: string | null;
  costPerOrder?: number;
  currencyCode?: string;
  minOrderTotal?: number;
  maxOrderTotal?: number | null;
};

export async function createShippingRule(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: ShippingRuleInput,
) {
  const authz = assertCanManage(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  if (
    !input.name ||
    typeof input.name !== "string" ||
    input.name.trim().length === 0
  ) {
    return { ok: false as const, statusCode: 400, error: "missing_rule_name" };
  }

  if (!isValidAmount(input.costPerOrder)) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_cost_per_order",
    };
  }

  if (input.countryCode != null && !/^[A-Z]{2}$/.test(input.countryCode)) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_country_code",
    };
  }

  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .from("shipping_cost_rules")
    .insert({
      organization_id: organizationId,
      name: input.name.trim().slice(0, 160),
      country_code: input.countryCode ?? null,
      cost_per_order: input.costPerOrder,
      currency_code: input.currencyCode ?? "EUR",
      min_order_total: input.minOrderTotal ?? 0,
      max_order_total: input.maxOrderTotal ?? null,
      created_by: context.user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "shipping_rule_create_failed",
      detail: error?.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "financial_config.create_shipping_rule",
    entityType: "shipping_cost_rule",
    entityId: data.id,
    newData: input,
  });

  return { ok: true as const, data: { id: data.id } };
}

export async function deactivateShippingRule(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  ruleId: string,
) {
  const authz = assertCanManage(context, organizationId);
  if (authz.ok === false) {
    return authz;
  }

  const supabase = createServiceClient(env);

  const { data, error } = await supabase
    .from("shipping_cost_rules")
    .update({ is_active: false })
    .eq("id", ruleId)
    .eq("organization_id", organizationId)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "shipping_rule_deactivate_failed",
      detail: error.message,
    };
  }

  if (!data) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "shipping_rule_not_found",
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "financial_config.deactivate_shipping_rule",
    entityType: "shipping_cost_rule",
    entityId: data.id,
  });

  return { ok: true as const, data: { id: data.id } };
}
