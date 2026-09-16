import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { AuthContext } from "./auth-context.js";

type FinanceEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

export const PLATFORM_EXPENSE_CATEGORIES = [
  "software",
  "hosting",
  "ai",
  "accounting",
  "marketing",
  "banking",
  "contractors",
  "insurance",
  "taxes",
  "office",
  "travel",
  "other",
] as const;

export type PlatformExpenseCategory =
  (typeof PLATFORM_EXPENSE_CATEGORIES)[number];
export type PlatformExpensePeriod = "one_time" | "monthly" | "yearly";

export type PlatformExpense = {
  id: string;
  name: string;
  vendor: string | null;
  category: PlatformExpenseCategory;
  amount: number;
  tax_amount: number;
  currency_code: string;
  billing_period: PlatformExpensePeriod;
  starts_on: string;
  ends_on: string | null;
  deductible: boolean;
  notes: string | null;
  document_url: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type PlatformExpenseInput = {
  name?: unknown;
  vendor?: unknown;
  category?: unknown;
  amount?: unknown;
  tax_amount?: unknown;
  currency_code?: unknown;
  billing_period?: unknown;
  starts_on?: unknown;
  ends_on?: unknown;
  deductible?: unknown;
  notes?: unknown;
  document_url?: unknown;
};

function createServiceClient(env: FinanceEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function requirePlatformAdmin(context: AuthContext) {
  return context.profile.platform_role === "platform_admin"
    ? { ok: true as const }
    : { ok: false as const, statusCode: 403, error: "platform_admin_required" };
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isoDate(value: unknown) {
  const raw = text(value);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : raw;
}

function parseExpenseInput(input: PlatformExpenseInput) {
  const name = text(input.name);
  const amount = numeric(input.amount);
  const taxAmount =
    input.tax_amount === undefined ? 0 : numeric(input.tax_amount);
  const category = text(input.category) ?? "other";
  const period = text(input.billing_period) ?? "one_time";
  const startsOn =
    isoDate(input.starts_on) ?? new Date().toISOString().slice(0, 10);
  const endsOn =
    input.ends_on === null || input.ends_on === ""
      ? null
      : isoDate(input.ends_on);
  const currency = (text(input.currency_code) ?? "EUR").toUpperCase();

  if (!name)
    return {
      ok: false as const,
      statusCode: 400,
      error: "expense_name_required",
    };
  if (amount === null || amount <= 0)
    return {
      ok: false as const,
      statusCode: 400,
      error: "expense_amount_invalid",
    };
  if (taxAmount === null || taxAmount < 0 || taxAmount > amount)
    return {
      ok: false as const,
      statusCode: 400,
      error: "expense_tax_invalid",
    };
  if (!(PLATFORM_EXPENSE_CATEGORIES as readonly string[]).includes(category))
    return {
      ok: false as const,
      statusCode: 400,
      error: "expense_category_invalid",
    };
  if (!["one_time", "monthly", "yearly"].includes(period))
    return {
      ok: false as const,
      statusCode: 400,
      error: "expense_period_invalid",
    };
  if (!/^[A-Z]{3}$/.test(currency))
    return {
      ok: false as const,
      statusCode: 400,
      error: "expense_currency_invalid",
    };
  if (
    input.ends_on !== undefined &&
    input.ends_on !== null &&
    input.ends_on !== "" &&
    !endsOn
  )
    return {
      ok: false as const,
      statusCode: 400,
      error: "expense_end_date_invalid",
    };
  if (endsOn && endsOn < startsOn)
    return {
      ok: false as const,
      statusCode: 400,
      error: "expense_dates_invalid",
    };

  return {
    ok: true as const,
    patch: {
      name: name.slice(0, 160),
      vendor: text(input.vendor)?.slice(0, 160) ?? null,
      category: category as PlatformExpenseCategory,
      amount,
      tax_amount: taxAmount,
      currency_code: currency,
      billing_period: period as PlatformExpensePeriod,
      starts_on: startsOn,
      ends_on: endsOn,
      deductible: input.deductible !== false,
      notes: text(input.notes),
      document_url: text(input.document_url),
    },
  };
}

function utcDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`);
}

function addClamped(date: Date, months: number, years: number) {
  const targetYear = date.getUTCFullYear() + years;
  const targetMonth = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay)));
}

export function expenseOccurrences(
  expense: Pick<PlatformExpense, "billing_period" | "starts_on" | "ends_on">,
  from: string,
  to: string,
) {
  const rangeStart = utcDate(from);
  const rangeEnd = utcDate(to);
  const end = expense.ends_on
    ? new Date(Math.min(rangeEnd.getTime(), utcDate(expense.ends_on).getTime()))
    : rangeEnd;
  let cursor = utcDate(expense.starts_on);
  if (cursor > end) return 0;

  if (expense.billing_period === "one_time") {
    return cursor >= rangeStart && cursor <= rangeEnd ? 1 : 0;
  }

  let count = 0;
  for (let step = 0; step < 2400 && cursor <= end; step += 1) {
    if (cursor >= rangeStart) count += 1;
    cursor =
      expense.billing_period === "monthly"
        ? addClamped(utcDate(expense.starts_on), step + 1, 0)
        : addClamped(utcDate(expense.starts_on), 0, step + 1);
  }
  return count;
}

export function summarizePlatformExpenses(
  expenses: PlatformExpense[],
  from: string,
  to: string,
) {
  const byCurrency = new Map<
    string,
    {
      currency: string;
      amount: number;
      tax_amount: number;
      occurrences: number;
    }
  >();
  const byCategory = new Map<
    string,
    { category: string; currency: string; amount: number; occurrences: number }
  >();

  for (const expense of expenses.filter((row) => row.status === "active")) {
    const occurrences = expenseOccurrences(expense, from, to);
    if (!occurrences) continue;
    const amount = Math.round(expense.amount * occurrences * 100) / 100;
    const taxAmount = Math.round(expense.tax_amount * occurrences * 100) / 100;
    const currency = byCurrency.get(expense.currency_code) ?? {
      currency: expense.currency_code,
      amount: 0,
      tax_amount: 0,
      occurrences: 0,
    };
    currency.amount += amount;
    currency.tax_amount += taxAmount;
    currency.occurrences += occurrences;
    byCurrency.set(expense.currency_code, currency);

    const key = `${expense.category}:${expense.currency_code}`;
    const category = byCategory.get(key) ?? {
      category: expense.category,
      currency: expense.currency_code,
      amount: 0,
      occurrences: 0,
    };
    category.amount += amount;
    category.occurrences += occurrences;
    byCategory.set(key, category);
  }

  const currencies = [...byCurrency.values()];
  return {
    currency:
      currencies.length === 1 ? (currencies[0]?.currency ?? null) : null,
    total:
      currencies.length === 1
        ? Math.round((currencies[0]?.amount ?? 0) * 100) / 100
        : null,
    tax_total:
      currencies.length === 1
        ? Math.round((currencies[0]?.tax_amount ?? 0) * 100) / 100
        : null,
    by_currency: currencies,
    by_category: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
    active_recurring: expenses.filter(
      (row) => row.status === "active" && row.billing_period !== "one_time",
    ).length,
  };
}

async function loadExpenses(env: FinanceEnv) {
  const supabase = createServiceClient(env);
  return supabase
    .schema("private")
    .from("platform_expenses")
    .select("*")
    .order("status", { ascending: true })
    .order("starts_on", { ascending: false });
}

export async function getPlatformExpenseSummary(
  env: FinanceEnv,
  from: string,
  to: string,
) {
  const { data, error } = await loadExpenses(env);
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "platform_expenses_load_failed",
      detail: error.message,
    };
  return {
    ok: true as const,
    data: summarizePlatformExpenses(
      (data ?? []) as PlatformExpense[],
      from,
      to,
    ),
  };
}

export async function listPlatformExpenses(
  env: FinanceEnv,
  context: AuthContext,
  requestedDays = 30,
) {
  const access = requirePlatformAdmin(context);
  if (!access.ok) return access;
  const days = [7, 30, 90, 365].includes(requestedDays) ? requestedDays : 30;
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const { data, error } = await loadExpenses(env);
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "platform_expenses_load_failed",
      detail: error.message,
    };
  const expenses = (data ?? []) as PlatformExpense[];
  return {
    ok: true as const,
    data: {
      expenses,
      summary: summarizePlatformExpenses(
        expenses,
        from.toISOString(),
        to.toISOString(),
      ),
      window_days: days,
    },
  };
}

export async function createPlatformExpense(
  env: FinanceEnv,
  context: AuthContext,
  input: PlatformExpenseInput,
) {
  const access = requirePlatformAdmin(context);
  if (!access.ok) return access;
  const parsed = parseExpenseInput(input);
  if (!parsed.ok) return parsed;
  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .schema("private")
    .from("platform_expenses")
    .insert({
      ...parsed.patch,
      created_by: context.user.id,
      updated_by: context.user.id,
    })
    .select("*")
    .single();
  if (error || !data)
    return {
      ok: false as const,
      statusCode: 500,
      error: "platform_expense_create_failed",
      detail: error?.message,
    };
  return { ok: true as const, data: data as PlatformExpense };
}

export async function updatePlatformExpense(
  env: FinanceEnv,
  context: AuthContext,
  expenseId: string,
  input: PlatformExpenseInput,
) {
  const access = requirePlatformAdmin(context);
  if (!access.ok) return access;
  const parsed = parseExpenseInput(input);
  if (!parsed.ok) return parsed;
  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .schema("private")
    .from("platform_expenses")
    .update({ ...parsed.patch, updated_by: context.user.id })
    .eq("id", expenseId)
    .select("*")
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "platform_expense_update_failed",
      detail: error.message,
    };
  if (!data)
    return {
      ok: false as const,
      statusCode: 404,
      error: "platform_expense_not_found",
    };
  return { ok: true as const, data: data as PlatformExpense };
}

export async function archivePlatformExpense(
  env: FinanceEnv,
  context: AuthContext,
  expenseId: string,
) {
  const access = requirePlatformAdmin(context);
  if (!access.ok) return access;
  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .schema("private")
    .from("platform_expenses")
    .update({ status: "archived", updated_by: context.user.id })
    .eq("id", expenseId)
    .select("id")
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "platform_expense_archive_failed",
      detail: error.message,
    };
  if (!data)
    return {
      ok: false as const,
      statusCode: 404,
      error: "platform_expense_not_found",
    };
  return { ok: true as const, data: { archived: true } };
}
