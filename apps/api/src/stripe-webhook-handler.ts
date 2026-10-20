import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  verifyStripeWebhookSignature,
  type StripeWebhookHeaders,
} from "./stripe-webhook.js";
import {
  STRIPE_HANDLED_EVENTS,
  STRIPE_SUBSCRIPTION_EVENTS,
  mapStripeSubscriptionToPatch,
  parseStripeSubscription,
  parseStripeWebhook,
  stripeInvoiceUsesPrice,
  type StripeSubscription,
} from "./stripe.js";
import {
  createInvoiceForStripePayment,
  createRectifyingInvoiceForStripeRefund,
  retryInvoiceEmailForStripePayment,
} from "./invoicing.js";

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as never },
  });
}

function stripeObjectId(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const id = (value as Record<string, unknown>).id;
  return typeof id === "string" ? id : null;
}

type ServiceClient = ReturnType<typeof createServiceClient>;

type StripeWebhookDependencies = {
  createServiceClient?: (env: LoadedApiEnv) => ServiceClient;
  createInvoiceForStripePayment?: typeof createInvoiceForStripePayment;
  retryInvoiceEmailForStripePayment?: typeof retryInvoiceEmailForStripePayment;
  createRectifyingInvoiceForStripeRefund?: typeof createRectifyingInvoiceForStripeRefund;
};

type Subject =
  | { user_id: string; organization_id?: undefined }
  | { organization_id: string; user_id?: undefined };

/**
 * A quien se le apunta lo que acaba de pagar.
 *
 * Por orden de fiabilidad: la metadata que la plataforma metio en la
 * suscripcion al crear el checkout (exacta, la pusimos nosotros) y, si la
 * compra empezo en un Payment Link suelto sin pasar por la app, el correo del
 * comprador.
 *
 * Si no se resuelve NO se inventa nada. Una suscripcion colgada de la cuenta
 * equivocada da acceso a la cartera de otro; el evento se marca como fallido,
 * queda con su payload en `private.webhook_events` y se arregla a mano.
 */
async function resolveSubject(
  supabase: ServiceClient,
  subscription: StripeSubscription,
): Promise<{ subject: Subject } | { error: string }> {
  if (subscription.subjectUserId) {
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", subscription.subjectUserId)
      .maybeSingle();
    if (data) return { subject: { user_id: data.id } };
    return {
      error: `stripe_user_metadata_desconocido:${subscription.subjectUserId}`,
    };
  }

  if (subscription.subjectOrganizationId) {
    const { data } = await supabase
      .from("organizations")
      .select("id")
      .eq("id", subscription.subjectOrganizationId)
      .maybeSingle();
    if (data) return { subject: { organization_id: data.id } };
    return {
      error: `stripe_organization_metadata_desconocida:${subscription.subjectOrganizationId}`,
    };
  }

  if (subscription.email) {
    const { data, error } = await supabase
      .schema("private")
      .rpc("user_id_by_email", { target_email: subscription.email });
    if (error)
      return { error: `stripe_lookup_por_correo_fallido:${error.message}` };
    if (data) return { subject: { user_id: data as string } };
    return { error: `stripe_correo_sin_cuenta:${subscription.email}` };
  }

  return { error: "stripe_suscripcion_sin_atribucion" };
}

/**
 * Escribe la suscripcion en `service_subscriptions`. Idempotente por
 * `external_subscription_id`: Stripe reintenta, y reintentar tiene que dar el
 * mismo estado, no una fila mas.
 */
export async function applyStripeSubscription(
  supabase: ServiceClient,
  subscription: StripeSubscription,
): Promise<
  { ok: true; subscriptionId: string } | { ok: false; error: string }
> {
  const patch = mapStripeSubscriptionToPatch(subscription);
  const metadata = {
    stripe: {
      subscription_id: subscription.subscriptionId,
      status: subscription.stripeStatus,
      price_id: subscription.priceId,
      product_id: subscription.productId,
      customer_id: subscription.customerId,
      customer_tax_id: subscription.customerTaxId,
    },
  };

  const { data: existing, error: existingError } = await supabase
    .from("service_subscriptions")
    .select("id")
    .eq("external_subscription_id", subscription.subscriptionId)
    .maybeSingle();
  if (existingError) {
    return {
      ok: false,
      error: `stripe_subscription_lookup_failed:${existingError.message}`,
    };
  }

  if (existing) {
    const { error } = await supabase
      .from("service_subscriptions")
      .update({ ...patch, metadata })
      .eq("id", existing.id);
    if (error) {
      return {
        ok: false,
        error: `stripe_subscription_update_failed:${error.message}`,
      };
    }
    return { ok: true, subscriptionId: existing.id };
  }

  const resolved = await resolveSubject(supabase, subscription);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  // Un plan sustituye al anterior. Sin esto chocaria con los indices de "un
  // plan vigente por sujeto" -- y peor que el choque seria no tenerlos: dos
  // planes activos y el limite de tiendas saliendo del que lea primero quien
  // pregunte.
  if (patch.status === "active" || patch.status === "trial") {
    const previous = supabase
      .from("service_subscriptions")
      .update({ status: "expired", ends_at: new Date().toISOString() })
      .in("status", ["trial", "active"]);
    const { error } = await (resolved.subject.user_id
      ? previous.eq("user_id", resolved.subject.user_id)
      : previous.eq("organization_id", resolved.subject.organization_id));
    if (error) {
      return {
        ok: false,
        error: `stripe_subscription_expire_previous_failed:${error.message}`,
      };
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("service_subscriptions")
    .insert({ ...resolved.subject, ...patch, metadata })
    .select("id")
    .maybeSingle();
  if (insertError || !inserted) {
    return {
      ok: false,
      error: `stripe_subscription_insert_failed:${insertError?.message ?? "sin_fila"}`,
    };
  }

  return { ok: true, subscriptionId: inserted.id };
}

export async function handleStripeWebhookRequest(
  env: LoadedApiEnv,
  headers: StripeWebhookHeaders,
  rawBody: Buffer,
  dependencies: StripeWebhookDependencies = {},
) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return {
      statusCode: 503,
      body: { error: "stripe_webhook_not_configured" },
    };
  }

  const body = rawBody.toString("utf8");
  if (!verifyStripeWebhookSignature(env.STRIPE_WEBHOOK_SECRET, headers, body)) {
    return {
      statusCode: 401,
      body: { error: "stripe_webhook_signature_invalid" },
    };
  }

  let envelope;
  try {
    envelope = parseStripeWebhook(body);
  } catch (error) {
    return {
      statusCode: 400,
      body: {
        error:
          error instanceof Error
            ? error.message
            : "stripe_webhook_payload_invalid",
      },
    };
  }

  // Stripe deja suscribirse a ~250 tipos de evento, y conviene poder activar de
  // mas en el dashboard sin que la API los rechace: un 4xx haria que Stripe
  // reintente durante tres dias algo que nunca vamos a procesar, y acabaria
  // desactivando el endpoint por fallos acumulados.
  if (!(STRIPE_HANDLED_EVENTS as readonly string[]).includes(envelope.type)) {
    return {
      statusCode: 200,
      body: { status: "ignored", type: envelope.type },
    };
  }

  const supabase = (dependencies.createServiceClient ?? createServiceClient)(env);
  const { data: event, error: insertError } = await supabase
    .schema("private")
    .from("webhook_events")
    .insert({
      provider: "stripe",
      topic: envelope.type,
      external_event_id: envelope.id,
      fingerprint: crypto.createHash("sha256").update(rawBody).digest("hex"),
      signature_valid: true,
      status: "received",
      payload: envelope.object,
      headers,
    })
    .select("id")
    .maybeSingle();
  let eventId = event?.id ?? "";

  if (insertError) {
    const { data: duplicate, error: duplicateError } = await supabase
      .schema("private")
      .from("webhook_events")
      .select("id, status")
      .eq("provider", "stripe")
      .eq("external_event_id", envelope.id)
      .maybeSingle();
    if (duplicateError) {
      return {
        statusCode: 503,
        body: { error: "stripe_webhook_persist_failed" },
      };
    }
    if (duplicate) {
      if (duplicate.status === "failed") {
        // Stripe conserva el mismo event ID cuando reintenta. Reclamar el
        // registro fallido de forma condicional permite reejecutar los casos
        // transitorios sin duplicar el trabajo si llegan dos reintentos juntos.
        const { data: claimed, error: claimError } = await supabase
          .schema("private")
          .from("webhook_events")
          .update({ status: "received", processed_at: null, error_message: null })
          .eq("id", duplicate.id)
          .eq("status", "failed")
          .select("id")
          .maybeSingle();
        if (claimError) {
          return {
            statusCode: 503,
            body: { error: "stripe_webhook_retry_claim_failed" },
          };
        }
        if (claimed) eventId = claimed.id;
        else {
          return {
            statusCode: 200,
            body: { status: "duplicate", event_id: duplicate.id },
          };
        }
      } else {
        if (envelope.type === "invoice.paid" && duplicate.status === "processed") {
          const email = await (dependencies.retryInvoiceEmailForStripePayment ?? retryInvoiceEmailForStripePayment)(
            env,
            typeof envelope.object.id === "string" ? envelope.object.id : "",
          );
          return {
            statusCode: 200,
            body: { status: "duplicate", event_id: duplicate.id, email },
          };
        }
        if (duplicate.status === "received" || duplicate.status === "processing") {
          return {
            statusCode: 503,
            body: { error: "stripe_webhook_event_in_progress" },
          };
        }
        return {
          statusCode: 200,
          body: { status: "duplicate", event_id: duplicate.id },
        };
      }
    } else {
      return {
        statusCode: 503,
        body: { error: "stripe_webhook_persist_failed" },
      };
    }
  }

  let applied:
    | { ok: true; result: Record<string, unknown> }
    | { ok: false; error: string; retryable?: boolean };

  if (
    (STRIPE_SUBSCRIPTION_EVENTS as readonly string[]).includes(envelope.type)
  ) {
    let subscription: StripeSubscription;
    try {
      subscription = parseStripeSubscription(envelope.object);
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : "stripe_subscription_payload_invalid";
      await supabase
        .schema("private")
        .from("webhook_events")
        .update({
          status: "failed",
          processed_at: new Date().toISOString(),
          error_message: detail,
        })
        .eq("id", eventId);
      return { statusCode: 400, body: { error: detail } };
    }

    // Se procesa en linea y no en cola: es un upsert y el acceso depende de
    // esta fila. Encolarlo dejaria al usuario sin acceso hasta otra pasada.
    const result = await applyStripeSubscription(supabase, subscription);
    applied = result.ok
      ? { ok: true, result: { subscription_id: result.subscriptionId } }
      : result;
  } else if (envelope.type === "invoice.paid") {
    if (
      stripeInvoiceUsesPrice(
        envelope.object,
        env.STRIPE_MANAGED_PAYMENTS_PRICE_ID,
      )
    ) {
      // Stripe actua como merchant of record y emite el documento fiscal de
      // Managed Payments. No duplicar ese documento desde VERI*FACTU.
      applied = {
        ok: true,
        result: {
          invoice_id:
            typeof envelope.object.id === "string" ? envelope.object.id : null,
          managed_payments: true,
          verifactu_invoice_skipped: true,
        },
      };
    } else {
      const invoiceResult = await (dependencies.createInvoiceForStripePayment ?? createInvoiceForStripePayment)(
        env,
        envelope.object,
        envelope.id,
      );
      applied = invoiceResult.ok
        ? {
            ok: true,
            result: invoiceResult as unknown as Record<string, unknown>,
          }
        : { ...invoiceResult, retryable: invoiceResult.statusCode === 503 };
    }
  } else if (envelope.type === "invoice.payment_failed") {
    // No se emite factura ni se corta el acceso en el primer fallo. Stripe
    // puede seguir reintentando y `customer.subscription.updated` decide el
    // acceso cuando el estado pase finalmente a unpaid/paused.
    applied = {
      ok: true,
      result: {
        invoice_id:
          typeof envelope.object.id === "string" ? envelope.object.id : null,
        payment_failed: true,
        attempt_count:
          typeof envelope.object.attempt_count === "number"
            ? envelope.object.attempt_count
            : null,
      },
    };
  } else if (
    envelope.type === "checkout.session.completed" ||
    envelope.type === "checkout.session.async_payment_succeeded"
  ) {
    const status =
      typeof envelope.object.payment_status === "string"
        ? envelope.object.payment_status
        : "unknown";
    applied = {
      ok: true,
      result: {
        checkout_session_id:
          typeof envelope.object.id === "string" ? envelope.object.id : null,
        mode:
          typeof envelope.object.mode === "string"
            ? envelope.object.mode
            : null,
        payment_status: status,
        subscription_id: stripeObjectId(envelope.object.subscription),
        managed_payments:
          (
            envelope.object.managed_payments as
              { enabled?: unknown } | undefined
          )?.enabled === true,
      },
    };
  } else {
    const invoiceId = stripeObjectId(envelope.object.invoice);
    const { data: invoiceEvent } = invoiceId
      ? await supabase
          .schema("private")
          .from("webhook_events")
          .select("payload")
          .eq("provider", "stripe")
          .eq("topic", "invoice.paid")
          .contains("payload", { id: invoiceId })
          .maybeSingle()
      : { data: null };
    if (
      invoiceEvent?.payload &&
      stripeInvoiceUsesPrice(
        invoiceEvent.payload as Record<string, unknown>,
        env.STRIPE_MANAGED_PAYMENTS_PRICE_ID,
      )
    ) {
      // Stripe emite el reembolso de Managed Payments; no hay una factura
      // VERI*FACTU de E-NORA que rectificar para este cobro.
      applied = {
        ok: true,
        result: {
          refund_id: stripeObjectId(envelope.object.id),
          invoice_id: invoiceId,
          managed_payments: true,
          verifactu_rectification_skipped: true,
        },
      };
    } else {
      const refundResult = await (dependencies.createRectifyingInvoiceForStripeRefund ?? createRectifyingInvoiceForStripeRefund)(
        env,
        envelope.object,
        envelope.id,
      );
      applied = refundResult.ok
        ? {
            ok: true,
            result: refundResult as unknown as Record<string, unknown>,
          }
        : { ...refundResult, retryable: refundResult.statusCode === 503 };
    }
  }

  await supabase
    .schema("private")
    .from("webhook_events")
    .update({
      status: applied.ok ? "processed" : "failed",
      processed_at: new Date().toISOString(),
      error_message: applied.ok ? null : applied.error.slice(0, 500),
    })
    .eq("id", eventId);

  if (!applied.ok) {
    // 200 cuando el fallo es de datos (una metadata que apunta a una
    // organizacion que no existe): reintentarlo da exactamente el mismo
    // resultado, y devolver 5xx solo conseguiria que Stripe acabe desactivando
    // el endpoint por fallos acumulados. Queda en `webhook_events` con su
    // payload para arreglarlo a mano.
    //
    // 503 solo cuando el fallo es de configuracion transitoria (el emisor de
    // VERI*FACTU aun no esta dado de alta): ahi si merece la pena que Stripe
    // reintente, porque el mismo evento funcionara cuando se configure.
    return {
      statusCode: applied.retryable ? 503 : 200,
      body: { status: "failed", error: applied.error },
    };
  }

  return {
    statusCode: 200,
    body: { status: "processed", ...applied.result },
  };
}
