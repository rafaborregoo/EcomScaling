import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type Stripe from "stripe";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import {
  createStripeClient,
  stripeErrorDetail,
  stripeErrorStatus,
} from "./stripe-client.js";
import { stripeTimestampToIso } from "./stripe.js";

/**
 * Plan, cobro e historial de facturas de una organizacion, para su propietario.
 *
 * No hay tabla de facturas propia: Stripe es la fuente y esto solo la lee. El
 * cliente de Stripe se obtiene de la suscripcion (`external_subscription_id`),
 * asi que no hace falta guardar `customer_id` ni migrar nada.
 */

function requireOwnerOrPlatformAdmin(
  context: AuthContext,
  organizationId: string,
) {
  if (context.profile.platform_role === "platform_admin") {
    return { ok: true as const };
  }
  // La consultora también se factura: su propietario ve su plan y su portal
  // igual que el dueño de una tienda ve el suyo.
  const isOwner = context.memberships.some(
    (membership) =>
      membership.organization_id === organizationId &&
      membership.role === "owner" &&
      (membership.accessSource === "membership" ||
        membership.accessSource === "consulting_organization"),
  );
  if (isOwner) return { ok: true as const };
  return {
    ok: false as const,
    statusCode: 403,
    error: "owner_required",
    message: "Solo el propietario de la tienda puede ver la facturacion.",
  };
}

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });
}

type SubscriptionRow = {
  plan_code: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  external_subscription_id: string | null;
};

async function currentSubscription(env: LoadedApiEnv, organizationId: string) {
  const { data, error } = await createServiceClient(env)
    .from("service_subscriptions")
    .select("plan_code, status, starts_at, ends_at, external_subscription_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { subscription: (data as SubscriptionRow | null) ?? null, error };
}

function customerIdOf(subscription: Stripe.Subscription) {
  return typeof subscription.customer === "string"
    ? subscription.customer
    : subscription.customer.id;
}

export async function getOrganizationBilling(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireOwnerOrPlatformAdmin(context, organizationId);
  if (access.ok === false) return access;

  const { subscription, error } = await currentSubscription(env, organizationId);
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "subscription_load_failed",
      detail: error.message,
    };
  }

  const base = {
    plan_code: subscription?.plan_code ?? null,
    status: subscription?.status ?? null,
    stripe_connected: false,
    next_payment_at: null as string | null,
    amount: null as number | null,
    currency: null as string | null,
    interval: null as string | null,
    cancel_at_period_end: false,
    payment_method: null as { brand: string; last4: string } | null,
    invoices: [] as Array<{
      id: string;
      number: string | null;
      created_at: string | null;
      total: number;
      currency: string;
      status: string | null;
      hosted_invoice_url: string | null;
      pdf_url: string | null;
    }>,
  };

  // Sin Stripe configurado o sin suscripcion de Stripe (plan concedido a mano),
  // se devuelve lo que hay en BD: la pantalla ensena el plan y nada de cobro.
  if (!env.STRIPE_SECRET_KEY || !subscription?.external_subscription_id) {
    return { ok: true as const, data: base };
  }

  try {
    const stripe = createStripeClient(env);
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.external_subscription_id,
      { expand: ["default_payment_method"] },
    );
    const customer = customerIdOf(stripeSubscription);
    const invoices = await stripe.invoices.list({ customer, limit: 12 });

    const item = stripeSubscription.items.data[0];
    const periodEnd =
      stripeTimestampToIso(
        (stripeSubscription as { current_period_end?: unknown })
          .current_period_end,
      ) ??
      stripeTimestampToIso(
        (item as { current_period_end?: unknown } | undefined)
          ?.current_period_end,
      );
    const method = stripeSubscription.default_payment_method;
    const card =
      method && typeof method !== "string" && method.type === "card"
        ? method.card
        : null;

    return {
      ok: true as const,
      data: {
        ...base,
        stripe_connected: true,
        next_payment_at: periodEnd,
        amount:
          item?.price.unit_amount != null ? item.price.unit_amount / 100 : null,
        currency: item?.price.currency?.toUpperCase() ?? null,
        interval: item?.price.recurring?.interval ?? null,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        payment_method: card ? { brand: card.brand, last4: card.last4 } : null,
        invoices: invoices.data.map((invoice) => ({
          id: invoice.id ?? "",
          number: invoice.number,
          created_at: stripeTimestampToIso(invoice.created),
          total: invoice.total / 100,
          currency: invoice.currency.toUpperCase(),
          status: invoice.status,
          hosted_invoice_url: invoice.hosted_invoice_url ?? null,
          pdf_url: invoice.invoice_pdf ?? null,
        })),
      },
    };
  } catch (stripeError) {
    const status = stripeErrorStatus(stripeError);
    return {
      ok: false as const,
      statusCode: 502,
      error: "stripe_billing_failed",
      detail: `${status ? `HTTP ${status}: ` : ""}${stripeErrorDetail(stripeError)}`,
    };
  }
}

/** Sesion del portal de Stripe: tarjeta, datos fiscales, cancelar, facturas. */
export async function createBillingPortal(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireOwnerOrPlatformAdmin(context, organizationId);
  if (access.ok === false) return access;

  if (!env.STRIPE_SECRET_KEY) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "stripe_not_configured",
      message: "Los pagos todavia no estan configurados en este entorno.",
    };
  }

  const { subscription } = await currentSubscription(env, organizationId);
  if (!subscription?.external_subscription_id) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "no_stripe_subscription",
      message: "Esta organizacion no tiene una suscripcion de pago en Stripe.",
    };
  }

  try {
    const stripe = createStripeClient(env);
    const stripeSubscription = await stripe.subscriptions.retrieve(
      subscription.external_subscription_id,
    );
    const origin = (env.WEB_ORIGIN ?? "http://localhost:3001").replace(/\/$/, "");
    const session = await stripe.billingPortal.sessions.create({
      customer: customerIdOf(stripeSubscription),
      return_url: `${origin}/configuracion?section=plan`,
    });
    return { ok: true as const, data: { url: session.url } };
  } catch (stripeError) {
    const status = stripeErrorStatus(stripeError);
    return {
      ok: false as const,
      statusCode: 502,
      error: "stripe_portal_failed",
      detail: `${status ? `HTTP ${status}: ` : ""}${stripeErrorDetail(stripeError)}`,
    };
  }
}
