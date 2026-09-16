/**
 * Whop es la pasarela de cobro de la plataforma.
 *
 * Lo que entra por aqui no es una integracion mas de un cliente: es la fuente
 * de la que ADR-0023 hace derivar el rol. Una fila de `service_subscriptions`
 * decide si alguien entra como consultor o como cliente y cuantas tiendas puede
 * conectar, asi que el mapeo de abajo es la frontera entre "lo que Whop dice
 * que ha pasado" y "lo que la plataforma cree que alguien ha pagado".
 *
 * Dos decisiones que no son obvias:
 *
 * 1. **El catalogo de planes vive en Whop, no en una tabla nuestra.** El
 *    `plan_code` y el limite de tiendas se leen de la metadata del plan en el
 *    dashboard de Whop. No hay tabla de planes que mantener sincronizada -- y
 *    la que habria seria una copia que se separa del sitio donde de verdad se
 *    cobra.
 *
 * 2. **`ends_at` se deja nulo mientras la suscripcion esta viva.** Poner el fin
 *    del periodo de facturacion haria caducar el acceso de quien paga en cuanto
 *    pasara la renovacion, si el webhook de renovacion tardase o se perdiera.
 *    Solo se rellena cuando Whop dice que eso se acaba: al cancelar a fin de
 *    periodo, o al desactivar.
 */

/** Claves que la plataforma pone en la metadata de Whop y espera de vuelta. */
export const WHOP_USER_METADATA_KEY = "ecomscaling_user_id";
export const WHOP_ORGANIZATION_METADATA_KEY = "ecomscaling_organization_id";
export const WHOP_PLAN_CODE_METADATA_KEY = "ecomscaling_plan_code";
export const WHOP_STORE_LIMIT_METADATA_KEY = "ecomscaling_store_limit";

/**
 * Un plan sin `ecomscaling_store_limit` no puede quedarse sin tope: NULL en
 * `service_subscriptions.store_limit` significa "sin limite" para
 * `assertStoreLimit`, y un error de dedo en el dashboard de Whop regalaria
 * tiendas ilimitadas. Se entra con el tramo mas pequeno -- ha pagado, entra --
 * y subirlo es editar la metadata del plan.
 * ponytail: tope conservador; si aparecen planes sin metadata de forma
 * habitual, el sitio de arreglarlo es el dashboard, no una tabla de planes aqui.
 */
export const WHOP_FALLBACK_STORE_LIMIT = 1;

/**
 * Solo los eventos de membresia. Los de pago (`payment.succeeded`) cuentan la
 * misma historia un paso antes y llevarian a escribir dos veces lo mismo; la
 * membresia es la que sabe si el acceso sigue vivo.
 */
export const WHOP_HANDLED_EVENTS = [
  "membership.activated",
  "membership.deactivated",
  "membership.cancel_at_period_end_changed",
] as const;

export type WhopWebhookEnvelope = {
  id: string;
  type: string;
  timestamp: string | null;
  data: Record<string, unknown>;
};

export type SubscriptionStatus =
  "pending" | "trial" | "active" | "paused" | "cancelled" | "expired";

export type WhopMembership = {
  membershipId: string;
  whopStatus: string;
  whopUserId: string | null;
  email: string | null;
  planId: string | null;
  productId: string | null;
  planCode: string | null;
  storeLimit: number | null;
  subjectUserId: string | null;
  subjectOrganizationId: string | null;
  createdAt: string | null;
  renewalPeriodEnd: string | null;
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

/**
 * Whop entrega unas fechas como ISO y otras como epoch en segundos (a veces en
 * string). Se normaliza aqui y no en cada llamada para que no acabe alguna
 * guardada en 1970.
 */
export function whopTimestampToIso(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const seconds = Number.parseInt(raw, 10);
    if (!Number.isSafeInteger(seconds) || seconds <= 0) return null;
    return new Date(seconds * 1000).toISOString();
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function parseWhopWebhook(rawBody: string): WhopWebhookEnvelope {
  const value = asRecord(JSON.parse(rawBody));
  const id = value ? text(value.id) : null;
  const type = value ? text(value.type) : null;
  const data = value ? asRecord(value.data) : null;

  if (!id || !type || !data) {
    throw new Error("whop_webhook_payload_invalid");
  }

  return { id, type, timestamp: text(value?.timestamp), data };
}

export function parseWhopMembership(
  data: Record<string, unknown>,
): WhopMembership {
  const membershipId = text(data.id);
  const whopStatus = text(data.status);
  if (!membershipId || !whopStatus) {
    throw new Error("whop_membership_payload_invalid");
  }

  const user = asRecord(data.user);
  const plan = asRecord(data.plan);
  const product = asRecord(data.product);
  const membershipMetadata = asRecord(data.metadata) ?? {};
  const planMetadata = (plan ? asRecord(plan.metadata) : null) ?? {};

  const storeLimitText = text(planMetadata[WHOP_STORE_LIMIT_METADATA_KEY]);
  const storeLimit = storeLimitText ? Number.parseInt(storeLimitText, 10) : NaN;
  const email = user ? text(user.email) : null;

  return {
    membershipId,
    whopStatus,
    whopUserId: user ? text(user.id) : null,
    email: email ? email.toLowerCase() : null,
    planId: plan ? text(plan.id) : null,
    productId: product ? text(product.id) : null,
    planCode: text(planMetadata[WHOP_PLAN_CODE_METADATA_KEY]),
    storeLimit:
      Number.isSafeInteger(storeLimit) && storeLimit > 0 ? storeLimit : null,
    // La metadata del comprador viene de la checkout configuration que creamos
    // nosotros: es la unica atribucion exacta. La del plan no sirve, es comun a
    // todos los que lo compran.
    subjectUserId: text(membershipMetadata[WHOP_USER_METADATA_KEY]),
    subjectOrganizationId: text(
      membershipMetadata[WHOP_ORGANIZATION_METADATA_KEY],
    ),
    createdAt: whopTimestampToIso(data.created_at),
    renewalPeriodEnd: whopTimestampToIso(data.renewal_period_end),
    canceledAt: whopTimestampToIso(data.canceled_at),
    cancelAtPeriodEnd: data.cancel_at_period_end === true,
  };
}

/**
 * Traduce el estado de Whop al enum de `service_subscriptions`.
 *
 * `past_due` se queda como vigente a proposito: Whop sigue considerando viva la
 * membresia mientras reintenta el cobro, y cortarle el acceso al consultor por
 * una tarjeta caducada antes de que Whop la de por perdida es castigar un
 * problema que se arregla solo. Cuando la da por perdida manda
 * `membership.deactivated`, y ahi si se corta.
 */
export function mapWhopStatus(whopStatus: string): SubscriptionStatus {
  switch (whopStatus) {
    case "trialing":
      return "trial";
    case "active":
    case "past_due":
    case "canceling":
      return "active";
    case "canceled":
      return "cancelled";
    case "expired":
    case "completed":
      return "expired";
    case "unresolved":
      return "paused";
    case "drafted":
    default:
      return "pending";
  }
}

export type WhopSubscriptionPatch = {
  plan_code: string;
  status: SubscriptionStatus;
  store_limit: number;
  starts_at: string | null;
  ends_at: string | null;
  cancelled_at: string | null;
  external_subscription_id: string;
};

export function mapWhopMembershipToSubscription(
  membership: WhopMembership,
  now = new Date(),
): WhopSubscriptionPatch {
  const status = mapWhopStatus(membership.whopStatus);
  const alive = status === "active" || status === "trial";
  const ended = membership.canceledAt ?? now.toISOString();

  return {
    // Sin `ecomscaling_plan_code` se guarda el id del plan de Whop: es feo pero
    // rastreable, y mejor que inventarse un codigo que luego nadie reconoce.
    plan_code: (membership.planCode ?? membership.planId ?? "whop").slice(
      0,
      50,
    ),
    status,
    store_limit: membership.storeLimit ?? WHOP_FALLBACK_STORE_LIMIT,
    starts_at: membership.createdAt,
    ends_at: alive
      ? membership.cancelAtPeriodEnd
        ? membership.renewalPeriodEnd
        : null
      : ended,
    cancelled_at: status === "cancelled" ? ended : null,
    external_subscription_id: membership.membershipId,
  };
}
