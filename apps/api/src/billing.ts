import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { recordAuditLog } from "./audit-log.js";
import type { AuthContext } from "./auth-context.js";
import {
  STRIPE_PLAN_CODE_METADATA_KEY,
  STRIPE_MEMBER_LIMIT_METADATA_KEY,
  STRIPE_STORE_LIMIT_METADATA_KEY,
} from "./stripe.js";
import {
  createStripeClient,
  stripeErrorDetail,
  stripeErrorStatus,
} from "./stripe-client.js";
import { getPlatformExpenseSummary } from "./platform-finance.js";

/**
 * Planes y suscripciones vistos desde la plataforma.
 *
 * Hay dos maneras de tener plan y conviene no mezclarlas:
 *
 * - **Pagando.** Stripe cobra y el webhook escribe la fila
 *   (`apps/api/src/stripe-webhook-handler.ts`). Lleva
 *   `external_subscription_id`.
 * - **Concedido.** Un platform admin se lo da a alguien sin cobrarle: un socio,
 *   una prueba, una compensacion. No lleva `external_subscription_id`, que es
 *   justo lo que lo distingue de lo anterior.
 *
 * Y sobre quien cuelga la fila no es un detalle: una suscripcion **a nombre de
 * una persona** la convierte en consultora (ADR-0023), mientras que una **a
 * nombre de una organizacion** solo fija el limite de tiendas de ese cliente.
 * Conceder mal el sujeto no es un plan equivocado, es un rol equivocado.
 */

type BillingEnv = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_API_VERSION?: string;
};

type StripeInvoiceRecord = Record<string, unknown>;

export type StripeInvoiceLedger = {
  feeAmountMinor: number | null;
  refundedAmountMinor: number;
};

export type FinancialPayment = {
  id: string;
  status: string | null;
  substatus: string | null;
  currency: string | null;
  gross_amount: number | null;
  amount_after_fees: number | null;
  fee_amount: number | null;
  refunded_amount: number;
  net_amount: number | null;
  paid_at: string | null;
  created_at: string | null;
  billing_reason: string | null;
  plan_id: string | null;
  plan_name: string | null;
  plan_code: string | null;
  product_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  /** Suscripcion a la que pertenece el cobro (`sub_...` en Stripe). */
  subscription_id: string | null;
};

export type FinancialCurrencyTotals = {
  currency: string;
  gross_amount: number;
  fee_amount: number | null;
  refunded_amount: number;
  net_amount: number | null;
  successful_payments: number;
};

export type FinancialPlanTotals = {
  id: string;
  name: string;
  currency: string | null;
  gross_amount: number;
  refunded_amount: number;
  net_amount: number | null;
  payments: number;
};

export type FinancialDashboardData = {
  window_days: number;
  window_start: string;
  window_end: string;
  currency: string | null;
  totals: {
    gross_amount: number | null;
    fee_amount: number | null;
    refunded_amount: number | null;
    net_amount: number | null;
    successful_payments: number;
    failed_payments: number;
    pending_payments: number;
  };
  by_currency: FinancialCurrencyTotals[];
  subscriptions: {
    active: number;
    trial: number;
    paid: number;
    granted: number;
  };
  timeline: Array<{
    period: string;
    gross_amount: number;
    refunded_amount: number;
    net_amount: number | null;
    payments: number;
  }>;
  by_plan: FinancialPlanTotals[];
  payments: FinancialPayment[];
};

type TimelinePoint = FinancialDashboardData["timeline"][number];

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isoDate(value: unknown): string | null {
  const raw = textValue(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function paymentIsSuccessful(payment: FinancialPayment) {
  return payment.substatus === "succeeded" || payment.status === "paid";
}

function paymentIsFailed(payment: FinancialPayment) {
  return ["failed", "blocked", "uncollectible", "void", "canceled"].includes(
    payment.substatus ?? "",
  );
}

function paymentIsPending(payment: FinancialPayment) {
  return ["pending", "open", "authorized"].includes(
    payment.substatus ?? payment.status ?? "",
  );
}

/**
 * Una factura de Stripe en la forma neutra del dashboard.
 *
 * Se listan FACTURAS y no cargos porque la factura es la que sabe de que plan
 * es el cobro (lleva las lineas con su precio y su metadata); el cargo solo
 * sabe el importe. Las comisiones, que si viven en el cargo, se leen de su
 * `balance_transaction` expandida.
 *
 * Stripe da los importes en la unidad minima de la moneda: 20000 son 200,00
 * EUR. Se dividen entre 100 aqui y no en cada pantalla, que es como se acaba
 * teniendo un sitio que enseña 20.000 EUR.
 */
export function normalizeStripeInvoice(
  raw: StripeInvoiceRecord,
  ledger?: StripeInvoiceLedger,
): FinancialPayment {
  // `charge` y `line.price` son la forma historica. Se mantienen como
  // fallback para eventos creados con una version antigua de la API.
  const charge = asRecord(raw.charge);
  const balanceTransaction = charge
    ? asRecord(charge.balance_transaction)
    : null;
  const lines = asRecord(raw.lines);
  const firstLine = Array.isArray(lines?.data)
    ? (asRecord(lines.data[0]) ?? null)
    : null;
  const pricing = firstLine ? asRecord(firstLine.pricing) : null;
  const priceDetails = pricing ? asRecord(pricing.price_details) : null;
  const modernPrice = priceDetails
    ? (asRecord(priceDetails.price) ?? null)
    : null;
  const price = modernPrice ?? (firstLine ? asRecord(firstLine.price) : null);
  const priceMetadata = asRecord(price?.metadata);
  const product = price ? asRecord(price.product) : null;
  const parent = asRecord(raw.parent);
  const subscriptionDetails = parent
    ? asRecord(parent.subscription_details)
    : null;

  const minor = (value: unknown) => {
    const parsed = numberValue(value);
    return parsed === null ? null : parsed / 100;
  };

  const grossAmount = minor(
    raw.status === "paid" ? (raw.amount_paid ?? raw.total) : raw.total,
  );
  const feeAmount = ledger
    ? minor(ledger.feeAmountMinor)
    : balanceTransaction
      ? minor(balanceTransaction.fee)
      : null;
  const refundedAmount = ledger
    ? (minor(ledger.refundedAmountMinor) ?? 0)
    : (minor(charge?.amount_refunded) ?? 0);
  const amountAfterFees =
    grossAmount === null || feeAmount === null ? null : grossAmount - feeAmount;
  const netAmount =
    amountAfterFees === null ? null : amountAfterFees - refundedAmount;

  return {
    id: textValue(raw.id) ?? "unknown",
    status: textValue(raw.status),
    // El dashboard distingue cobrado / fallido / pendiente por `substatus`.
    // Stripe no tiene esa doble capa: se deriva del estado de la factura.
    substatus:
      raw.status === "paid"
        ? "succeeded"
        : raw.status === "open" && (numberValue(raw.attempt_count) ?? 0) > 0
          ? "failed"
          : raw.status === "uncollectible"
            ? "uncollectible"
            : raw.status === "void"
              ? "void"
              : raw.status === "open"
                ? "open"
                : textValue(raw.status),
    currency: textValue(raw.currency)?.toUpperCase() ?? null,
    gross_amount: grossAmount,
    amount_after_fees: amountAfterFees,
    fee_amount: feeAmount,
    refunded_amount: refundedAmount,
    net_amount: netAmount,
    paid_at: stripeEpochToIso(asRecord(raw.status_transitions)?.paid_at),
    created_at: stripeEpochToIso(raw.created),
    billing_reason: textValue(raw.billing_reason),
    plan_id:
      textValue(price?.id) ??
      textValue(priceDetails?.price) ??
      textValue(firstLine?.price),
    plan_name:
      textValue(price?.nickname) ??
      textValue(product?.name) ??
      textValue(firstLine?.description),
    plan_code: textValue(priceMetadata?.[STRIPE_PLAN_CODE_METADATA_KEY]),
    product_name: textValue(product?.name),
    customer_name: textValue(raw.customer_name),
    customer_email: textValue(raw.customer_email)?.toLowerCase() ?? null,
    subscription_id:
      textValue(asRecord(subscriptionDetails?.subscription)?.id) ??
      textValue(subscriptionDetails?.subscription) ??
      textValue(asRecord(firstLine?.subscription)?.id) ??
      textValue(firstLine?.subscription) ??
      textValue(asRecord(raw.subscription)?.id) ??
      textValue(raw.subscription),
  };
}

/** Stripe da las fechas como epoch en segundos, no como ISO. */
function stripeEpochToIso(value: unknown): string | null {
  const seconds = numberValue(value);
  if (seconds === null || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function addNullable(left: number | null, right: number | null) {
  return left === null || right === null ? null : left + right;
}

export function summarizePayments(
  payments: FinancialPayment[],
  options: { days: number; now?: Date },
): Pick<
  FinancialDashboardData,
  "currency" | "totals" | "by_currency" | "timeline" | "by_plan"
> {
  const now = options.now ?? new Date();
  const successful = payments.filter(paymentIsSuccessful);
  const currencies = [
    ...new Set(successful.map((payment) => payment.currency).filter(Boolean)),
  ] as string[];
  const currency = currencies.length === 1 ? (currencies[0] ?? null) : null;
  const byCurrency = new Map<string, FinancialCurrencyTotals>();

  for (const payment of successful) {
    if (!payment.currency || payment.gross_amount === null) continue;
    const current = byCurrency.get(payment.currency) ?? {
      currency: payment.currency,
      gross_amount: 0,
      fee_amount: 0,
      refunded_amount: 0,
      net_amount: 0,
      successful_payments: 0,
    };
    current.gross_amount += payment.gross_amount;
    current.fee_amount = addNullable(current.fee_amount, payment.fee_amount);
    current.refunded_amount += payment.refunded_amount;
    current.net_amount = addNullable(current.net_amount, payment.net_amount);
    current.successful_payments += 1;
    byCurrency.set(payment.currency, current);
  }

  const totals = {
    gross_amount:
      currency && successful.length
        ? successful.reduce(
            (sum, payment) => sum + (payment.gross_amount ?? 0),
            0,
          )
        : null,
    fee_amount:
      currency && successful.length
        ? successful.reduce<number | null>(
            (sum, payment) => addNullable(sum, payment.fee_amount),
            0,
          )
        : null,
    refunded_amount:
      currency && successful.length
        ? successful.reduce((sum, payment) => sum + payment.refunded_amount, 0)
        : null,
    net_amount:
      currency && successful.length
        ? successful.reduce<number | null>(
            (sum, payment) => addNullable(sum, payment.net_amount),
            0,
          )
        : null,
    successful_payments: successful.length,
    failed_payments: payments.filter(paymentIsFailed).length,
    pending_payments: payments.filter(paymentIsPending).length,
  };

  const timelineMap = new Map<string, TimelinePoint>();
  const planMap = new Map<string, FinancialPlanTotals>();
  for (const payment of successful) {
    const date = payment.paid_at ?? payment.created_at;
    const period = date ? date.slice(0, 10) : null;
    if (period) {
      const point = timelineMap.get(period) ?? {
        period,
        gross_amount: 0,
        refunded_amount: 0,
        net_amount: 0,
        payments: 0,
      };
      point.gross_amount += payment.gross_amount ?? 0;
      point.refunded_amount += payment.refunded_amount;
      point.net_amount = addNullable(point.net_amount, payment.net_amount);
      point.payments += 1;
      timelineMap.set(period, point);
    }

    const planId = payment.plan_id ?? payment.plan_code ?? "unknown";
    const plan = planMap.get(planId) ?? {
      id: planId,
      name:
        payment.plan_name ??
        payment.plan_code ??
        payment.product_name ??
        "Plan sin nombre",
      currency: payment.currency,
      gross_amount: 0,
      refunded_amount: 0,
      net_amount: 0,
      payments: 0,
    };
    plan.gross_amount += payment.gross_amount ?? 0;
    plan.refunded_amount += payment.refunded_amount;
    plan.net_amount = addNullable(plan.net_amount, payment.net_amount);
    plan.payments += 1;
    planMap.set(planId, plan);
  }

  const start = new Date(now.getTime() - options.days * 24 * 60 * 60 * 1000);
  for (
    let cursor = new Date(start);
    cursor <= now;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const period = cursor.toISOString().slice(0, 10);
    if (!timelineMap.has(period)) {
      timelineMap.set(period, {
        period,
        gross_amount: 0,
        refunded_amount: 0,
        net_amount: currency ? 0 : null,
        payments: 0,
      });
    }
  }

  return {
    currency,
    totals,
    by_currency: [...byCurrency.values()].sort(
      (a, b) => b.gross_amount - a.gross_amount,
    ),
    timeline: currency
      ? [...timelineMap.values()].sort((a, b) =>
          a.period.localeCompare(b.period),
        )
      : [],
    by_plan: currency
      ? [...planMap.values()].sort((a, b) => b.gross_amount - a.gross_amount)
      : [],
  };
}

export function buildStripeInvoicesUrl(
  from: string,
  to: string,
  startingAfter: string | null,
) {
  const params = new URLSearchParams({ limit: "100" });
  // Stripe filtra por epoch en segundos, no por ISO.
  params.set("created[gte]", String(Math.floor(Date.parse(from) / 1000)));
  params.set("created[lte]", String(Math.floor(Date.parse(to) / 1000)));
  // Desde la API 2026 el precio vive bajo `pricing.price_details`; la factura
  // ya no expone un `charge` directo. Las comisiones se obtienen mediante
  // Invoice Payments en `listStripeInvoices`.
  params.append("expand[]", "data.lines.data.pricing.price_details.price");
  if (startingAfter) params.set("starting_after", startingAfter);
  return `https://api.stripe.com/v1/invoices?${params}`;
}

async function listStripeInvoices(
  env: BillingEnv,
  from: string,
  to: string,
): Promise<
  | { ok: true; payments: FinancialPayment[]; truncated: boolean }
  | { ok: false; statusCode: number; error: string; detail?: string }
> {
  if (!env.STRIPE_SECRET_KEY) {
    return {
      ok: false,
      statusCode: 503,
      error: "stripe_not_configured",
      detail: "STRIPE_SECRET_KEY es necesaria para el dashboard financiero.",
    };
  }

  const stripe = createStripeClient(env);
  const fromEpoch = Math.floor(Date.parse(from) / 1000);
  const toEpoch = Math.floor(Date.parse(to) / 1000);
  const invoices: StripeInvoiceRecord[] = [];
  const ledgers = new Map<string, StripeInvoiceLedger>();
  let truncated = false;

  const ledgerFor = (invoiceId: string) => {
    const current = ledgers.get(invoiceId) ?? {
      feeAmountMinor: null,
      refundedAmountMinor: 0,
    };
    ledgers.set(invoiceId, current);
    return current;
  };

  const addCharge = (invoiceId: string, charge: Record<string, unknown>) => {
    const ledger = ledgerFor(invoiceId);
    const refunded = numberValue(charge.amount_refunded);
    if (refunded !== null) ledger.refundedAmountMinor += refunded;

    const balanceTransaction = asRecord(charge.balance_transaction);
    const fee = numberValue(balanceTransaction?.fee);
    if (fee !== null) {
      ledger.feeAmountMinor = (ledger.feeAmountMinor ?? 0) + fee;
    }

    return textValue(charge.balance_transaction);
  };

  const inBatches = async <T>(
    items: T[],
    worker: (item: T) => Promise<void>,
  ) => {
    for (let index = 0; index < items.length; index += 20) {
      await Promise.all(items.slice(index, index + 20).map(worker));
    }
  };

  try {
    for await (const invoice of stripe.invoices.list({
      limit: 100,
      created: { gte: fromEpoch, lte: toEpoch },
      expand: ["data.lines.data.pricing.price_details.price"],
    })) {
      invoices.push(invoice as unknown as StripeInvoiceRecord);
      if (invoices.length >= 2_000) {
        truncated = true;
        break;
      }
    }

    if (invoices.length === 0) {
      return { ok: true, payments: [], truncated };
    }

    const invoiceIds = new Set(
      invoices.map((invoice) => textValue(invoice.id)).filter(Boolean),
    );
    const unresolvedCharges: Array<{ invoiceId: string; chargeId: string }> =
      [];
    const unresolvedBalanceTransactions: Array<{
      invoiceId: string;
      balanceTransactionId: string;
    }> = [];

    let invoicePaymentCount = 0;
    for await (const invoicePayment of stripe.invoicePayments.list({
      limit: 100,
      created: { gte: fromEpoch, lte: toEpoch },
      status: "paid",
      expand: [
        "data.payment.payment_intent.latest_charge",
        "data.payment.charge",
      ],
    })) {
      invoicePaymentCount += 1;
      const rawPayment = invoicePayment as unknown as Record<string, unknown>;
      const invoiceId =
        textValue(asRecord(rawPayment.invoice)?.id) ??
        textValue(rawPayment.invoice);
      if (!invoiceId || !invoiceIds.has(invoiceId)) continue;

      const payment = asRecord(rawPayment.payment);
      const paymentIntent = asRecord(payment?.payment_intent);
      const chargeValue =
        payment?.charge ?? paymentIntent?.latest_charge ?? null;
      const charge = asRecord(chargeValue);
      if (charge) {
        const balanceTransactionId = addCharge(invoiceId, charge);
        if (balanceTransactionId) {
          unresolvedBalanceTransactions.push({
            invoiceId,
            balanceTransactionId,
          });
        }
      } else {
        const chargeId = textValue(chargeValue);
        if (chargeId) unresolvedCharges.push({ invoiceId, chargeId });
      }

      if (invoicePaymentCount >= 2_000) {
        truncated = true;
        break;
      }
    }

    await inBatches(unresolvedCharges, async ({ invoiceId, chargeId }) => {
      const charge = await stripe.charges.retrieve(chargeId, {
        expand: ["balance_transaction"],
      });
      const balanceTransactionId = addCharge(
        invoiceId,
        charge as unknown as Record<string, unknown>,
      );
      if (balanceTransactionId) {
        unresolvedBalanceTransactions.push({
          invoiceId,
          balanceTransactionId,
        });
      }
    });

    await inBatches(
      unresolvedBalanceTransactions,
      async ({ invoiceId, balanceTransactionId }) => {
        const balanceTransaction =
          await stripe.balanceTransactions.retrieve(balanceTransactionId);
        const ledger = ledgerFor(invoiceId);
        ledger.feeAmountMinor =
          (ledger.feeAmountMinor ?? 0) + balanceTransaction.fee;
      },
    );
  } catch (error) {
    const status = stripeErrorStatus(error);
    return {
      ok: false,
      statusCode: 502,
      error:
        status === 401
          ? "stripe_api_key_invalid"
          : status === 403
            ? "stripe_financial_permissions_required"
            : "stripe_financial_data_failed",
      detail: `${status ? `HTTP ${status}: ` : ""}${stripeErrorDetail(error)}`,
    };
  }

  const payments = invoices
    .map((invoice) => {
      const id = textValue(invoice.id);
      return normalizeStripeInvoice(invoice, id ? ledgers.get(id) : undefined);
    })
    .filter((payment) => payment.id !== "unknown");

  return { ok: true, payments, truncated };
}

export async function getPlatformFinancialDashboard(
  env: BillingEnv,
  context: AuthContext,
  requestedDays = 30,
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const days = [7, 30, 90, 365].includes(requestedDays) ? requestedDays : 30;
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const paymentResult = await listStripeInvoices(
    env,
    start.toISOString(),
    now.toISOString(),
  );
  if (paymentResult.ok === false) return paymentResult;

  const expenseResult = await getPlatformExpenseSummary(
    env,
    start.toISOString(),
    now.toISOString(),
  );
  if (expenseResult.ok === false) return expenseResult;

  const supabase = createServiceClient(env);
  const subscriptionResults = await Promise.all([
    supabase
      .from("service_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("service_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "trial"),
    supabase
      .from("service_subscriptions")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "trial"])
      .not("external_subscription_id", "is", null),
    supabase
      .from("service_subscriptions")
      .select("id", { count: "exact", head: true })
      .in("status", ["active", "trial"])
      .is("external_subscription_id", null),
  ]);
  if (subscriptionResults.some((result) => result.error)) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "subscriptions_load_failed",
      detail: subscriptionResults.find((result) => result.error)?.error
        ?.message,
    };
  }
  const [
    { count: activeCount },
    { count: trialCount },
    { count: paidCount },
    { count: grantedCount },
  ] = subscriptionResults;

  const summarized = summarizePayments(paymentResult.payments, {
    days,
    now,
  });
  const operatingCurrency =
    summarized.currency ?? expenseResult.data.currency ?? null;
  const netRevenue =
    summarized.totals.net_amount ??
    (summarized.totals.successful_payments === 0 ? 0 : null);
  const expensesShareCurrency =
    expenseResult.data.by_currency.length === 0 ||
    (summarized.totals.successful_payments === 0 &&
      expenseResult.data.by_currency.length === 1) ||
    (expenseResult.data.by_currency.length === 1 &&
      expenseResult.data.currency === summarized.currency);
  return {
    ok: true as const,
    data: {
      window_days: days,
      window_start: start.toISOString(),
      window_end: now.toISOString(),
      ...summarized,
      expenses: expenseResult.data,
      operating_currency: operatingCurrency,
      operating_profit:
        operatingCurrency && expensesShareCurrency && netRevenue !== null
          ? Math.round((netRevenue - (expenseResult.data.total ?? 0)) * 100) /
            100
          : null,
      truncated: paymentResult.truncated,
      subscriptions: {
        active: activeCount ?? 0,
        trial: trialCount ?? 0,
        paid: paidCount ?? 0,
        granted: grantedCount ?? 0,
      },
      payments: paymentResult.payments.slice(0, 100),
    },
  };
}

function createServiceClient(env: BillingEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function requirePlatformAdmin(context: AuthContext) {
  if (context.profile.platform_role !== "platform_admin") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
      message: "Solo un administrador de la plataforma puede gestionar planes.",
    };
  }
  return { ok: true as const };
}

const CURRENT_STATUSES = ["trial", "active"] as const;

export type GrantInput = {
  subject_type?: string | undefined;
  subject_id?: string | undefined;
  plan_code?: string | undefined;
  store_limit?: number | string | null | undefined;
  member_limit?: number | string | null | undefined;
  ends_at?: string | null | undefined;
};

export type GrantPatch = {
  subject: { user_id: string } | { organization_id: string };
  plan_code: string;
  store_limit: number | null;
  member_limit: number | null;
  status: "active";
  starts_at: string;
  ends_at: string | null;
};

/**
 * Valida la concesion antes de tocar nada. Separado del IO porque es donde
 * estan las decisiones que importan y se prueban solas.
 *
 * `store_limit` nulo significa **sin limite** en `assertStoreLimit`, asi que hay
 * que pedirlo explicitamente: omitir el campo por descuido no puede acabar en
 * tiendas ilimitadas.
 */
export function buildGrantPatch(
  input: GrantInput,
  now = new Date(),
):
  | { ok: true; patch: GrantPatch }
  | { ok: false; error: string; message: string } {
  const subjectId = input.subject_id?.trim();
  if (!subjectId) {
    return {
      ok: false,
      error: "subject_id_required",
      message: "Falta a quien se le concede el plan.",
    };
  }

  if (input.subject_type !== "user" && input.subject_type !== "organization") {
    return {
      ok: false,
      error: "subject_type_invalid",
      message:
        "El plan se concede a una persona (user) o a un cliente (organization).",
    };
  }

  const planCode = input.plan_code?.trim();
  if (!planCode || planCode.length > 50) {
    return {
      ok: false,
      error: "plan_code_invalid",
      message:
        "El código de plan es obligatorio y no puede pasar de 50 caracteres.",
    };
  }

  let storeLimit: number | null;
  if (input.store_limit === null) {
    storeLimit = null;
  } else if (input.store_limit === undefined) {
    return {
      ok: false,
      error: "store_limit_required",
      message:
        "Indica cuántas tiendas incluye el plan, o null explícito para dejarlo sin límite.",
    };
  } else {
    const parsed =
      typeof input.store_limit === "number"
        ? input.store_limit
        : Number.parseInt(input.store_limit, 10);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      return {
        ok: false,
        error: "store_limit_invalid",
        message:
          "El límite de tiendas tiene que ser un entero positivo o null.",
      };
    }
    storeLimit = parsed;
  }

  let endsAt: string | null = null;
  let memberLimit: number | null;
  if (input.member_limit === null || input.member_limit === undefined) {
    memberLimit = null;
  } else {
    const parsed =
      typeof input.member_limit === "number"
        ? input.member_limit
        : Number.parseInt(input.member_limit, 10);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      return {
        ok: false,
        error: "member_limit_invalid",
        message: "El límite de usuarios tiene que ser un entero positivo o null.",
      };
    }
    memberLimit = parsed;
  }

  if (input.ends_at) {
    const parsed = new Date(input.ends_at);
    if (Number.isNaN(parsed.getTime())) {
      return {
        ok: false,
        error: "ends_at_invalid",
        message: "La fecha de fin no es válida.",
      };
    }
    if (parsed.getTime() <= now.getTime()) {
      return {
        ok: false,
        error: "ends_at_in_past",
        message: "Un plan que caduca en el pasado no da acceso a nada.",
      };
    }
    endsAt = parsed.toISOString();
  }

  return {
    ok: true,
    patch: {
      subject:
        input.subject_type === "user"
          ? { user_id: subjectId }
          : { organization_id: subjectId },
      plan_code: planCode,
      store_limit: storeLimit,
      member_limit: memberLimit,
      status: "active",
      starts_at: now.toISOString(),
      ends_at: endsAt,
    },
  };
}

export type GrantFields = Omit<GrantPatch, "subject">;

/**
 * Las mismas reglas de una concesion, pero sin saber todavia a quien se le
 * concede.
 *
 * Existe para el alta desde el panel de admin: ahi el plan se decide en el
 * mismo formulario que crea la organizacion, asi que hay que poder validarlo
 * ANTES de crear nada -- descubrir que el limite de tiendas estaba mal escrito
 * despues de haber creado organizacion, usuario de Auth e invitacion deja un
 * alta a medias que hay que limpiar a mano.
 *
 * Delega en `buildGrantPatch` a proposito: que la regla de "el limite de
 * tiendas se pide explicito" o la de "no vale una caducidad pasada" vivan en
 * un solo sitio es justo lo que evita que las dos puertas se separen.
 */
export function buildGrantFields(
  input: Omit<GrantInput, "subject_type" | "subject_id">,
  now = new Date(),
): { ok: true; fields: GrantFields } | { ok: false; error: string; message: string } {
  const built = buildGrantPatch(
    {
      ...input,
      subject_type: "organization",
      // El sujeto real se conoce despues; aqui solo hace falta que pase la
      // validacion de "hay sujeto", y el valor se descarta.
      subject_id: "pendiente",
    },
    now,
  );
  if (built.ok === false) return built;

  const { subject: _descartado, ...fields } = built.patch;
  return { ok: true, fields };
}

/**
 * El catalogo, tal y como esta en Stripe. No hay copia local que mantener.
 *
 * Se listan PRECIOS, no productos: el precio es lo que se compra, lo que lleva
 * la metadata del plan (`ecomscaling_plan_code`, `ecomscaling_store_limit`) y
 * `ecomscaling_member_limit` y lo que viaja entero dentro del webhook de
 * suscripcion. El producto solo
 * aporta el nombre, y por eso se pide expandido.
 *
 * `active=true` deja fuera los precios archivados: un precio viejo sigue
 * cobrando a quien ya lo tiene, pero no debe poder comprarse otra vez.
 */
export async function listPlans(env: BillingEnv) {
  if (!env.STRIPE_SECRET_KEY) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "stripe_not_configured",
    };
  }

  const stripe = createStripeClient(env);
  let prices: Array<Record<string, any>>;
  try {
    prices = [];
    for await (const price of stripe.prices.list({
      active: true,
      limit: 100,
      expand: ["data.product"],
    })) {
      prices.push(price as unknown as Record<string, any>);
      if (prices.length >= 2_000) break;
    }
  } catch (error) {
    const status = stripeErrorStatus(error);
    return {
      ok: false as const,
      statusCode: 502,
      error:
        status === 401
          ? "stripe_api_key_invalid"
          : status === 403
            ? "stripe_prices_permission_required"
            : "stripe_plans_failed",
      detail: `${status ? `HTTP ${status}: ` : ""}${stripeErrorDetail(error)}`,
    };
  }

  const plans = prices
    .filter((price) => price?.type === "recurring" && price?.product?.active)
    .map((price) => {
      const metadata = (price.metadata ?? {}) as Record<string, unknown>;
      const limitText = metadata[STRIPE_STORE_LIMIT_METADATA_KEY];
      const limit =
        typeof limitText === "string" ? Number.parseInt(limitText, 10) : NaN;
      const memberLimitText = metadata[STRIPE_MEMBER_LIMIT_METADATA_KEY];
      const parsedMemberLimit =
        typeof memberLimitText === "string"
          ? Number.parseInt(memberLimitText, 10)
          : NaN;
      const currency = ((price.currency ?? "eur") as string).toUpperCase();
      // Stripe da los importes en la unidad minima de la moneda: 20000 son
      // 200,00 EUR. Dividir entre 100 a ciegas rompe en las monedas sin
      // decimales (JPY), pero el catalogo es en euros y meter aqui la tabla de
      // exponentes por moneda seria una tabla que nadie mantiene.
      const amount =
        typeof price.unit_amount === "number" ? price.unit_amount / 100 : null;
      const interval = price.recurring?.interval as string | undefined;
      const intervalCount = (price.recurring?.interval_count ?? 1) as number;

      return {
        id: price.id as string,
        title: (price.nickname ?? price.product?.name ?? "Plan") as string,
        description: (price.product?.description ?? null) as string | null,
        formatted_price:
          amount === null
            ? null
            : new Intl.NumberFormat("es-ES", {
                style: "currency",
                currency,
              }).format(amount),
        renewal_price: amount,
        currency,
        billing_period_days:
          interval === "day"
            ? intervalCount
            : interval === "week"
              ? intervalCount * 7
              : interval === "month"
                ? intervalCount * 30
                : interval === "year"
                  ? intervalCount * 365
                  : null,
        trial_period_days: (price.recurring?.trial_period_days ?? null) as
          number | null,
        plan_code: (metadata[STRIPE_PLAN_CODE_METADATA_KEY] ?? null) as
          string | null,
        store_limit: Number.isSafeInteger(limit) && limit > 0 ? limit : null,
        member_limit:
          Number.isSafeInteger(parsedMemberLimit) && parsedMemberLimit > 0
            ? parsedMemberLimit
            : null,
        // Stripe no da un enlace de compra por precio: el checkout se abre
        // desde la app (`stripe-checkout.ts`), que es lo que permite atribuir
        // la compra a quien la inicia.
        purchase_url: null as string | null,
      };
    });

  return { ok: true as const, data: { plans } };
}

/** Todas las suscripciones con el nombre de a quien pertenecen. Admin. */
export async function listPlatformSubscriptions(
  env: BillingEnv,
  context: AuthContext,
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: rows, error } = await supabase
    .from("service_subscriptions")
    .select(
      "id, user_id, organization_id, plan_code, status, store_limit, member_limit, starts_at, ends_at, external_subscription_id, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "subscriptions_load_failed",
      detail: error.message,
    };
  }

  // Dos consultas y un mapa en vez de un embed de PostgREST: `user_id` y
  // `organization_id` apuntan a tablas distintas y el embed por FK habria que
  // desambiguarlo por nombre de constraint, que es justo lo que se rompe al
  // renombrar una.
  const userIds = [
    ...new Set((rows ?? []).map((r) => r.user_id).filter(Boolean)),
  ];
  const orgIds = [
    ...new Set((rows ?? []).map((r) => r.organization_id).filter(Boolean)),
  ];

  const [{ data: profiles }, { data: organizations }] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({
          data: [] as { id: string; full_name: string | null }[],
        }),
    orgIds.length
      ? supabase
          .from("organizations")
          .select("id, display_name")
          .in("id", orgIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
  ]);

  const nombrePorUsuario = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name]),
  );
  const nombrePorOrg = new Map(
    (organizations ?? []).map((o) => [o.id, o.display_name]),
  );

  return {
    ok: true as const,
    data: {
      subscriptions: (rows ?? []).map((row) => ({
        ...row,
        subject_type: row.user_id
          ? ("user" as const)
          : ("organization" as const),
        subject_name: row.user_id
          ? (nombrePorUsuario.get(row.user_id) ?? null)
          : (nombrePorOrg.get(row.organization_id as string) ?? null),
        source: row.external_subscription_id
          ? ("stripe" as const)
          : ("concedido" as const),
      })),
    },
  };
}

/** Concede un plan sin cobrar. Admin. */
export async function grantSubscription(
  env: BillingEnv,
  context: AuthContext,
  input: GrantInput,
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const built = buildGrantPatch(input);
  if (built.ok === false) {
    return {
      ok: false as const,
      statusCode: 400,
      error: built.error,
      message: built.message,
    };
  }
  const { patch } = built;

  const supabase = createServiceClient(env);

  const subjectId =
    "user_id" in patch.subject
      ? patch.subject.user_id
      : patch.subject.organization_id;
  const esUsuario = "user_id" in patch.subject;
  const { data: sujeto } = esUsuario
    ? await supabase
        .from("profiles")
        .select("id")
        .eq("id", subjectId)
        .maybeSingle()
    : await supabase
        .from("organizations")
        .select("id")
        .eq("id", subjectId)
        .maybeSingle();
  if (!sujeto) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "subject_not_found",
      message: esUsuario
        ? "Esa persona no tiene cuenta en la plataforma."
        : "Ese cliente no existe.",
    };
  }

  const columna = esUsuario ? "user_id" : "organization_id";
  const { data: vigentes, error: vigentesError } = await supabase
    .from("service_subscriptions")
    .select("id, plan_code, external_subscription_id")
    .eq(columna, subjectId)
    .in("status", CURRENT_STATUSES);
  if (vigentesError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "subscriptions_load_failed",
      detail: vigentesError.message,
    };
  }

  // Si ya paga por Stripe, conceder encima desincroniza el cobro: Stripe le sigue
  // cobrando y aqui pondria "concedido". Peor aun, el siguiente webhook de esa
  // membresia intentaria reactivar su fila y chocaria con el indice de un plan
  // vigente por sujeto, dejando el webhook en fallo. Se cancela en Stripe primero.
  const dePago = (vigentes ?? []).find((fila) => fila.external_subscription_id);
  if (dePago) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "subscription_paid_exists",
      message: `Ya tiene un plan de pago activo en Stripe (${dePago.external_subscription_id}). Cancélalo allí antes de conceder otro.`,
    };
  }

  const ahora = new Date().toISOString();
  for (const fila of vigentes ?? []) {
    const { error } = await supabase
      .from("service_subscriptions")
      .update({ status: "expired", ends_at: ahora })
      .eq("id", fila.id);
    if (error) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "previous_subscription_expire_failed",
        detail: error.message,
      };
    }
  }

  const { data: creada, error: insertError } = await supabase
    .from("service_subscriptions")
    .insert({
      ...patch.subject,
      plan_code: patch.plan_code,
      status: patch.status,
      store_limit: patch.store_limit,
      member_limit: patch.member_limit,
      starts_at: patch.starts_at,
      ends_at: patch.ends_at,
      metadata: { granted_by: context.user.id, granted_at: patch.starts_at },
    })
    .select("id, plan_code, status, store_limit, member_limit, starts_at, ends_at")
    .maybeSingle();
  if (insertError || !creada) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "subscription_grant_failed",
      detail: insertError?.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId: esUsuario ? null : subjectId,
    actorUserId: context.user.id,
    action: "admin.grant_subscription",
    entityType: "service_subscription",
    entityId: creada.id,
    newData: {
      subject_type: input.subject_type,
      subject_id: subjectId,
      ...creada,
    },
  });

  return { ok: true as const, data: creada };
}

/** Retira un plan concedido. Admin. */
export async function revokeSubscription(
  env: BillingEnv,
  context: AuthContext,
  subscriptionId: string,
) {
  const access = requirePlatformAdmin(context);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const { data: fila } = await supabase
    .from("service_subscriptions")
    .select(
      "id, user_id, organization_id, plan_code, status, external_subscription_id",
    )
    .eq("id", subscriptionId)
    .maybeSingle();
  if (!fila) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "subscription_not_found",
    };
  }

  // Retirar aqui una de Stripe solo la borraria de nuestra vista: el cobro sigue
  // vivo alla y el siguiente webhook la resucitaria.
  if (fila.external_subscription_id) {
    return {
      ok: false as const,
      statusCode: 409,
      error: "subscription_is_paid",
      message:
        "Este plan lo gestiona Stripe. Cancélalo allí y el cambio llega solo.",
    };
  }

  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("service_subscriptions")
    .update({ status: "expired", ends_at: ahora })
    .eq("id", subscriptionId);
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "subscription_revoke_failed",
      detail: error.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId: fila.organization_id,
    actorUserId: context.user.id,
    action: "admin.revoke_subscription",
    entityType: "service_subscription",
    entityId: subscriptionId,
    oldData: fila,
  });

  return { ok: true as const, data: { id: subscriptionId, status: "expired" } };
}
