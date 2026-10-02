/**
 * El webhook de Stripe es lo que decide si alguien entra como consultor, como
 * cliente, o no entra. Lo que se prueba aqui es la frontera: que un payload de
 * Stripe se convierta en la fila de `service_subscriptions` correcta, y que
 * los casos raros (tarjeta que falla, cancelacion a fin de mes, precio sin
 * metadata) no den acceso de mas ni corten acceso pagado.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  mapStripeStatus,
  mapStripeSubscriptionToPatch,
  parseStripeSubscription,
  parseStripeWebhook,
  stripeInvoiceUsesPrice,
  STRIPE_FALLBACK_STORE_LIMIT,
  STRIPE_CHECKOUT_EVENTS,
  STRIPE_HANDLED_EVENTS,
  stripeTimestampToIso,
} from "./stripe.js";
import {
  parseStripeSignatureHeader,
  verifyStripeWebhookSignature,
} from "./stripe-webhook.js";
import { createHmac } from "node:crypto";
import { stripeForm } from "./stripe-checkout.js";

const SUSCRIPCION = {
  id: "sub_1234",
  status: "active",
  customer: "cus_9999",
  cancel_at_period_end: false,
  start_date: 1_757_930_400,
  current_period_end: 1_760_522_400,
  canceled_at: null,
  metadata: { ecomscaling_organization_id: "org-uuid" },
  items: {
    data: [
      {
        current_period_end: 1_760_522_400,
        price: {
          id: "price_abc",
          product: "prod_abc",
          metadata: {
            ecomscaling_plan_code: "starter",
            ecomscaling_store_limit: "3",
          },
        },
      },
    ],
  },
};

function evento(object: unknown, type = "customer.subscription.updated") {
  return JSON.stringify({
    id: "evt_1",
    type,
    created: 1_757_930_400,
    data: { object },
  });
}

test("el sobre del evento saca el objeto de data.object", () => {
  const envelope = parseStripeWebhook(evento(SUSCRIPCION));
  assert.equal(envelope.id, "evt_1");
  assert.equal(envelope.type, "customer.subscription.updated");
  assert.equal(envelope.createdAt, "2025-09-15T10:00:00.000Z");
  assert.equal(envelope.object.id, "sub_1234");
});

test("un payload sin data.object se rechaza en vez de dar una fila vacia", () => {
  assert.throws(
    () => parseStripeWebhook(JSON.stringify({ id: "evt_1", type: "x" })),
    /stripe_webhook_payload_invalid/,
  );
});

test("el webhook registra tambien los fallos de pago", () => {
  assert.equal(STRIPE_HANDLED_EVENTS.includes("invoice.payment_failed"), true);
});

test("el webhook conserva snapshots de Checkout completado y pagos asincronos", () => {
  assert.equal(
    STRIPE_CHECKOUT_EVENTS.includes("checkout.session.completed"),
    true,
  );
  assert.equal(
    STRIPE_CHECKOUT_EVENTS.includes("checkout.session.async_payment_succeeded"),
    true,
  );
  assert.equal(
    STRIPE_HANDLED_EVENTS.includes("checkout.session.completed"),
    true,
  );
});

test("Managed Payments reconoce referencias de precio en formatos de factura Stripe", () => {
  assert.equal(
    stripeInvoiceUsesPrice(
      { lines: { data: [{ price: "price_mp" }] } },
      "price_mp",
    ),
    true,
  );
  assert.equal(
    stripeInvoiceUsesPrice(
      {
        lines: {
          data: [{ pricing: { price_details: { price: { id: "price_mp" } } } }],
        },
      },
      "price_mp",
    ),
    true,
  );
  assert.equal(
    stripeInvoiceUsesPrice({ lines: { data: [] } }, "price_mp"),
    false,
  );
});

test("el plan y el limite salen de la metadata del PRECIO", () => {
  // Del producto solo llega el id en el webhook: si la metadata viviera alli
  // habria que pedirlo por API en cada evento.
  const parsed = parseStripeSubscription(SUSCRIPCION);
  assert.equal(parsed.planCode, "starter");
  assert.equal(parsed.storeLimit, 3);
  assert.equal(parsed.priceId, "price_abc");
  assert.equal(parsed.productId, "prod_abc");
});

test("la atribucion sale de la metadata de la suscripcion", () => {
  const parsed = parseStripeSubscription(SUSCRIPCION);
  assert.equal(parsed.subjectOrganizationId, "org-uuid");
  assert.equal(parsed.subjectUserId, null);
});

test("current_period_end se lee tambien del item (API basil en adelante)", () => {
  const sinEnLaRaiz = { ...SUSCRIPCION, current_period_end: null };
  const parsed = parseStripeSubscription(sinEnLaRaiz);
  assert.equal(parsed.currentPeriodEnd, "2025-10-15T10:00:00.000Z");
});

test("past_due sigue dando acceso: Stripe aun esta reintentando el cobro", () => {
  assert.equal(mapStripeStatus("past_due"), "active");
  assert.equal(mapStripeStatus("trialing"), "trial");
  assert.equal(mapStripeStatus("active"), "active");
});

test("unpaid y paused pausan; canceled cancela; incomplete_expired caduca", () => {
  assert.equal(mapStripeStatus("unpaid"), "paused");
  assert.equal(mapStripeStatus("paused"), "paused");
  assert.equal(mapStripeStatus("canceled"), "cancelled");
  assert.equal(mapStripeStatus("incomplete_expired"), "expired");
});

test("incomplete y lo desconocido no dan acceso", () => {
  assert.equal(mapStripeStatus("incomplete"), "pending");
  assert.equal(mapStripeStatus("algo_que_stripe_invente"), "pending");
});

test("una suscripcion viva no lleva fecha de fin", () => {
  // Poner el fin del periodo caducaria el acceso de quien paga si el webhook
  // de la renovacion tarda o se pierde.
  const patch = mapStripeSubscriptionToPatch(
    parseStripeSubscription(SUSCRIPCION),
  );
  assert.equal(patch.status, "active");
  assert.equal(patch.ends_at, null);
  assert.equal(patch.cancelled_at, null);
  assert.equal(patch.store_limit, 3);
  assert.equal(patch.plan_code, "starter");
  assert.equal(patch.external_subscription_id, "sub_1234");
});

test("cancelada a fin de periodo conserva el acceso hasta esa fecha", () => {
  const patch = mapStripeSubscriptionToPatch(
    parseStripeSubscription({ ...SUSCRIPCION, cancel_at_period_end: true }),
  );
  assert.equal(patch.status, "active");
  assert.equal(patch.ends_at, "2025-10-15T10:00:00.000Z");
});

test("un precio sin metadata entra con el tramo mas pequeno, no sin tope", () => {
  // NULL en store_limit significa "sin limite" para assertStoreLimit: un error
  // de dedo en el dashboard regalaria tiendas ilimitadas.
  const sinMetadata = {
    ...SUSCRIPCION,
    items: {
      data: [{ price: { id: "price_x", product: "prod_x", metadata: {} } }],
    },
  };
  const patch = mapStripeSubscriptionToPatch(
    parseStripeSubscription(sinMetadata),
  );
  assert.equal(patch.store_limit, STRIPE_FALLBACK_STORE_LIMIT);
  assert.equal(patch.plan_code, "price_x");
});

test("las fechas de Stripe son epoch en segundos", () => {
  assert.equal(stripeTimestampToIso(1_757_930_400), "2025-09-15T10:00:00.000Z");
  assert.equal(stripeTimestampToIso(null), null);
  assert.equal(stripeTimestampToIso(0), null);
  assert.equal(stripeTimestampToIso("1757930400"), null);
});

// --- firma ----------------------------------------------------------------

const SECRETO = "whsec_prueba_de_firma";

function firmar(body: string, t: number, secret = SECRETO) {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

test("la cabecera se parsea con varias firmas (rotacion de secreto)", () => {
  const parsed = parseStripeSignatureHeader("t=123,v1=aaa,v1=bbb");
  assert.deepEqual(parsed, { timestamp: 123, signatures: ["aaa", "bbb"] });
});

test("una firma valida dentro de la ventana pasa", () => {
  const body = evento(SUSCRIPCION);
  const t = 1_757_930_400;
  assert.equal(
    verifyStripeWebhookSignature(
      SECRETO,
      { "stripe-signature": firmar(body, t) },
      body,
      t,
    ),
    true,
  );
});

test("el secreto se usa en texto plano, con su prefijo whsec_", () => {
  // Standard Webhooks (Fathom, Whop) decodifica el secreto de base64 tras el
  // prefijo. Stripe NO. Los dos prefijos se llaman igual: esta prueba es lo
  // que delata a quien reutilice el verificador de al lado.
  const body = evento(SUSCRIPCION);
  const t = 1_757_930_400;
  const conBase64 = createHmac(
    "sha256",
    Buffer.from("prueba_de_firma", "base64"),
  )
    .update(`${t}.${body}`)
    .digest("hex");
  assert.equal(
    verifyStripeWebhookSignature(
      SECRETO,
      { "stripe-signature": `t=${t},v1=${conBase64}` },
      body,
      t,
    ),
    false,
  );
});

test("un evento reenviado fuera de la ventana no pasa", () => {
  const body = evento(SUSCRIPCION);
  const t = 1_757_930_400;
  const header = firmar(body, t);
  assert.equal(
    verifyStripeWebhookSignature(
      SECRETO,
      { "stripe-signature": header },
      body,
      t + 301,
    ),
    false,
  );
  assert.equal(
    verifyStripeWebhookSignature(
      SECRETO,
      { "stripe-signature": header },
      body,
      t + 299,
    ),
    true,
  );
});

test("cambiar un byte del cuerpo invalida la firma", () => {
  const body = evento(SUSCRIPCION);
  const t = 1_757_930_400;
  assert.equal(
    verifyStripeWebhookSignature(
      SECRETO,
      { "stripe-signature": firmar(body, t) },
      body.replace("sub_1234", "sub_9999"),
      t,
    ),
    false,
  );
});

test("sin secreto o sin cabecera no se verifica nada", () => {
  const body = evento(SUSCRIPCION);
  const t = 1_757_930_400;
  assert.equal(
    verifyStripeWebhookSignature(
      "",
      { "stripe-signature": firmar(body, t) },
      body,
      t,
    ),
    false,
  );
  assert.equal(verifyStripeWebhookSignature(SECRETO, {}, body, t), false);
  assert.equal(
    verifyStripeWebhookSignature(
      SECRETO,
      { "stripe-signature": "basura" },
      body,
      t,
    ),
    false,
  );
});

// --- codificacion de la peticion -------------------------------------------

test("los parametros anidados se codifican con corchetes, no como JSON", async (t) => {
  const { stripeForm } = await import("./stripe-checkout.js");
  const form = stripeForm({
    mode: "subscription",
    line_items: [{ price: "price_abc", quantity: 1 }],
    subscription_data: { metadata: { ecomscaling_user_id: "u-1" } },
    tax_id_collection: { enabled: true },
  });

  assert.equal(form.get("mode"), "subscription");
  assert.equal(form.get("line_items[0][price]"), "price_abc");
  assert.equal(form.get("line_items[0][quantity]"), "1");
  assert.equal(
    form.get("subscription_data[metadata][ecomscaling_user_id]"),
    "u-1",
  );
  assert.equal(form.get("tax_id_collection[enabled]"), "true");
});

test("los valores nulos no se mandan en vez de mandarse como 'null'", () => {
  // Stripe interpreta la cadena "null" como un valor, no como ausencia.
  const form = stripeForm({ a: null, b: undefined, c: "" });
  assert.equal(form.has("a"), false);
  assert.equal(form.has("b"), false);
  assert.equal(form.get("c"), "");
});
