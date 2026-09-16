/**
 * Stripe es la pasarela de cobro de la plataforma.
 *
 * Lo que entra por aqui no es una integracion mas de un cliente: es la fuente
 * de la que ADR-0023 hace derivar el rol. Una fila de `service_subscriptions`
 * decide si alguien entra como consultor o como cliente y cuantas tiendas
 * puede conectar, asi que el mapeo de abajo es la frontera entre "lo que
 * Stripe dice que ha pasado" y "lo que la plataforma cree que alguien ha
 * pagado".
 *
 * Cuatro decisiones que no son obvias:
 *
 * 1. **El catalogo de planes vive en Stripe, no en una tabla nuestra.** El
 *    `plan_code` y el limite de tiendas se leen de la metadata del PRECIO. No
 *    hay tabla de planes que mantener sincronizada -- y la que habria seria una
 *    copia que se separa del sitio donde de verdad se cobra.
 *
 * 2. **La metadata va en el PRECIO, no en el producto.** El webhook de
 *    suscripcion trae el precio entero dentro de cada item, pero del producto
 *    solo el id: si la metadata estuviera en el producto habria que pedirlo por
 *    API en cada evento para saber cuantas tiendas incluye.
 *
 * 3. **La atribucion va en la metadata de la SUSCRIPCION**, no en la de la
 *    sesion de checkout. La de la sesion solo llega en
 *    `checkout.session.completed`; la de la suscripcion viene en todos los
 *    `customer.subscription.*`, que son los que de verdad mueven el acceso.
 *
 * 4. **`ends_at` se deja nulo mientras la suscripcion esta viva.** Poner el fin
 *    del periodo de facturacion haria caducar el acceso de quien paga en cuanto
 *    pasara la renovacion, si el webhook tardase o se perdiera. Solo se rellena
 *    cuando Stripe dice que eso se acaba.
 */

/** Claves que la plataforma pone en la metadata de Stripe y espera de vuelta. */
export const STRIPE_USER_METADATA_KEY = "ecomscaling_user_id";
export const STRIPE_ORGANIZATION_METADATA_KEY = "ecomscaling_organization_id";
export const STRIPE_PLAN_CODE_METADATA_KEY = "ecomscaling_plan_code";
export const STRIPE_STORE_LIMIT_METADATA_KEY = "ecomscaling_store_limit";
export const STRIPE_CUSTOMER_TAX_ID_METADATA_KEY = "customer_tax_id";

/**
 * Un precio sin `ecomscaling_store_limit` no puede quedarse sin tope: NULL en
 * `service_subscriptions.store_limit` significa "sin limite" para
 * `assertStoreLimit`, y un error de dedo en el dashboard de Stripe regalaria
 * tiendas ilimitadas. Se entra con el tramo mas pequeno -- ha pagado, entra --
 * y subirlo es editar la metadata del precio.
 */
export const STRIPE_FALLBACK_STORE_LIMIT = 1;

export const STRIPE_SUBSCRIPTION_EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
] as const;

/**
 * Facturacion (VERI*FACTU): `invoice.paid` emite la factura,
 * `invoice.payment_failed` deja trazabilidad del intento fallido y
 * `charge.refunded` emite la rectificativa. Se escuchan aparte de los eventos
 * de suscripcion porque son otros objetos y otras consecuencias.
 */
export const STRIPE_INVOICE_EVENTS = [
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
] as const;

export const STRIPE_HANDLED_EVENTS = [
  ...STRIPE_SUBSCRIPTION_EVENTS,
  ...STRIPE_INVOICE_EVENTS,
] as const;

export type StripeWebhookEnvelope = {
  id: string;
  type: string;
  createdAt: string | null;
  object: Record<string, unknown>;
};

export type SubscriptionStatus =
  "pending" | "trial" | "active" | "paused" | "cancelled" | "expired";

export type StripeSubscription = {
  subscriptionId: string;
  stripeStatus: string;
  customerId: string | null;
  email: string | null;
  priceId: string | null;
  productId: string | null;
  planCode: string | null;
  storeLimit: number | null;
  subjectUserId: string | null;
  subjectOrganizationId: string | null;
  customerTaxId: string | null;
  startedAt: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  cancelAtPeriodEnd: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/** Stripe entrega todas las fechas como epoch en segundos. */
export function stripeTimestampToIso(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  return new Date(value * 1000).toISOString();
}

export function parseStripeWebhook(rawBody: string): StripeWebhookEnvelope {
  const value = asRecord(JSON.parse(rawBody));
  const id = value ? text(value.id) : null;
  const type = value ? text(value.type) : null;
  const object = value ? asRecord(asRecord(value.data)?.object) : null;

  if (!id || !type || !object) {
    throw new Error("stripe_webhook_payload_invalid");
  }

  return {
    id,
    type,
    createdAt: stripeTimestampToIso(value?.created),
    object,
  };
}

export function parseStripeSubscription(
  object: Record<string, unknown>,
): StripeSubscription {
  const subscriptionId = text(object.id);
  const stripeStatus = text(object.status);
  if (!subscriptionId || !stripeStatus) {
    throw new Error("stripe_subscription_payload_invalid");
  }

  const metadata = asRecord(object.metadata) ?? {};
  const items = asRecord(object.items);
  const firstItem = Array.isArray(items?.data)
    ? (asRecord(items.data[0]) ?? null)
    : null;
  const price = firstItem ? asRecord(firstItem.price) : null;
  const priceMetadata = (price ? asRecord(price.metadata) : null) ?? {};

  const storeLimitText = text(priceMetadata[STRIPE_STORE_LIMIT_METADATA_KEY]);
  const storeLimit = storeLimitText ? Number.parseInt(storeLimitText, 10) : NaN;

  // `current_period_end` vivia en la suscripcion; desde la version de API
  // `2025-03-31.basil` vive en cada item. Se miran los dos sitios porque el
  // payload que llega depende de la version con la que se creo el endpoint del
  // webhook, no de la que use este codigo.
  const currentPeriodEnd =
    stripeTimestampToIso(object.current_period_end) ??
    stripeTimestampToIso(firstItem?.current_period_end);

  const customer = asRecord(object.customer);
  const email = customer ? text(customer.email) : null;

  return {
    subscriptionId,
    stripeStatus,
    // `customer` llega como id salvo que se pida expandido.
    customerId: customer ? text(customer.id) : text(object.customer),
    email: email ? email.toLowerCase() : null,
    priceId: price ? text(price.id) : null,
    productId: price ? text(price.product) : null,
    planCode: text(priceMetadata[STRIPE_PLAN_CODE_METADATA_KEY]),
    storeLimit:
      Number.isSafeInteger(storeLimit) && storeLimit > 0 ? storeLimit : null,
    // La metadata del comprador la pusimos nosotros al crear el checkout: es la
    // unica atribucion exacta. La del precio no sirve, es comun a todos los que
    // lo compran.
    subjectUserId: text(metadata[STRIPE_USER_METADATA_KEY]),
    subjectOrganizationId: text(metadata[STRIPE_ORGANIZATION_METADATA_KEY]),
    customerTaxId: text(metadata[STRIPE_CUSTOMER_TAX_ID_METADATA_KEY]),
    startedAt: stripeTimestampToIso(object.start_date),
    currentPeriodEnd,
    canceledAt: stripeTimestampToIso(object.canceled_at),
    cancelAtPeriodEnd: object.cancel_at_period_end === true,
  };
}

/**
 * Traduce el estado de Stripe al enum de `service_subscriptions`.
 *
 * `past_due` se queda como vigente a proposito: Stripe sigue reintentando el
 * cobro, y cortarle el acceso al consultor por una tarjeta caducada antes de
 * que Stripe la de por perdida es castigar un problema que se arregla solo.
 * Cuando la da por perdida la pasa a `unpaid` o `canceled`, segun como este
 * configurado el ciclo de reintentos, y ahi si se corta.
 *
 * `incomplete` es la suscripcion cuyo primer pago aun no ha cuajado (3D
 * Secure): todavia no da acceso, pero tampoco es un fracaso. Si el pago nunca
 * llega, Stripe la pasa sola a `incomplete_expired`.
 */
export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case "trialing":
      return "trial";
    case "active":
    case "past_due":
      return "active";
    case "canceled":
      return "cancelled";
    case "incomplete_expired":
      return "expired";
    case "unpaid":
    case "paused":
      return "paused";
    case "incomplete":
    default:
      return "pending";
  }
}

export type StripeSubscriptionPatch = {
  plan_code: string;
  status: SubscriptionStatus;
  store_limit: number;
  starts_at: string | null;
  ends_at: string | null;
  cancelled_at: string | null;
  external_subscription_id: string;
};

export function mapStripeSubscriptionToPatch(
  subscription: StripeSubscription,
  now = new Date(),
): StripeSubscriptionPatch {
  const status = mapStripeStatus(subscription.stripeStatus);
  const alive = status === "active" || status === "trial";
  const ended = subscription.canceledAt ?? now.toISOString();

  return {
    // Sin `ecomscaling_plan_code` se guarda el id del precio: es feo pero
    // rastreable, y mejor que inventarse un codigo que luego nadie reconoce.
    plan_code: (
      subscription.planCode ??
      subscription.priceId ??
      "stripe"
    ).slice(0, 50),
    status,
    store_limit: subscription.storeLimit ?? STRIPE_FALLBACK_STORE_LIMIT,
    starts_at: subscription.startedAt,
    ends_at: alive
      ? subscription.cancelAtPeriodEnd
        ? subscription.currentPeriodEnd
        : null
      : ended,
    cancelled_at: status === "cancelled" ? ended : null,
    external_subscription_id: subscription.subscriptionId,
  };
}
