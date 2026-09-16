/**
 * Lo que se prueba aqui es la traduccion de un cobro a una fila de
 * `service_subscriptions`. Desde ADR-0023 esa fila es la que decide si alguien
 * entra como consultor y cuantas tiendas puede conectar, asi que equivocarse en
 * el mapeo no es un bug de formato: es dar o quitar acceso.
 *
 * Los tres casos que importan:
 *  - una membresia viva NO lleva fecha de fin (si no, caduca sola en la
 *    renovacion si el webhook se retrasa),
 *  - una cancelada a fin de periodo SI la lleva (caduca sola, sin depender de
 *    que llegue otro webhook),
 *  - un plan sin limite de tiendas en su metadata no se queda sin limite.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  WHOP_FALLBACK_STORE_LIMIT,
  mapWhopMembershipToSubscription,
  mapWhopStatus,
  parseWhopMembership,
  parseWhopWebhook,
} from "./whop.js";

const AHORA = new Date("2026-09-16T10:00:00.000Z");

function membresia(overrides: Record<string, unknown> = {}) {
  return {
    id: "mem_123",
    status: "active",
    created_at: "1757930400",
    renewal_period_end: "1760522400",
    canceled_at: null,
    cancel_at_period_end: false,
    user: { id: "user_whop", email: "Socia@Ejemplo.com", name: "Socia" },
    plan: {
      id: "plan_abc",
      metadata: {
        ecomscaling_plan_code: "consultor",
        ecomscaling_store_limit: "3",
      },
    },
    product: { id: "prod_abc" },
    metadata: { ecomscaling_user_id: "11111111-1111-1111-1111-111111111111" },
    ...overrides,
  };
}

test("el sobre del webhook exige id, tipo y datos", () => {
  assert.throws(() =>
    parseWhopWebhook(JSON.stringify({ type: "membership.activated" })),
  );
  const sobre = parseWhopWebhook(
    JSON.stringify({
      id: "msg_1",
      type: "membership.activated",
      data: { id: "mem_1" },
    }),
  );
  assert.equal(sobre.id, "msg_1");
  assert.equal(sobre.type, "membership.activated");
});

test("se leen el plan, el sujeto y las fechas epoch de Whop", () => {
  const parsed = parseWhopMembership(membresia());
  assert.equal(parsed.planCode, "consultor");
  assert.equal(parsed.storeLimit, 3);
  assert.equal(parsed.subjectUserId, "11111111-1111-1111-1111-111111111111");
  // El correo se normaliza: la atribucion por correo compara en minusculas.
  assert.equal(parsed.email, "socia@ejemplo.com");
  assert.equal(parsed.createdAt, "2025-09-15T10:00:00.000Z");
});

test("una membresia viva no lleva fecha de fin", () => {
  const fila = mapWhopMembershipToSubscription(
    parseWhopMembership(membresia()),
    AHORA,
  );
  assert.equal(fila.status, "active");
  assert.equal(fila.ends_at, null);
  assert.equal(fila.store_limit, 3);
  assert.equal(fila.external_subscription_id, "mem_123");
});

test("cancelada a fin de periodo sigue activa pero caduca sola", () => {
  const fila = mapWhopMembershipToSubscription(
    parseWhopMembership(
      membresia({ status: "canceling", cancel_at_period_end: true }),
    ),
    AHORA,
  );
  assert.equal(fila.status, "active");
  assert.equal(fila.ends_at, "2025-10-15T10:00:00.000Z");
});

test("una tarjeta que falla no le quita el acceso a quien paga", () => {
  assert.equal(mapWhopStatus("past_due"), "active");
  assert.equal(mapWhopStatus("trialing"), "trial");
});

test("al desactivarse la membresia el plan caduca", () => {
  const fila = mapWhopMembershipToSubscription(
    parseWhopMembership(
      membresia({
        status: "expired",
        canceled_at: "1758016800",
        cancel_at_period_end: true,
      }),
    ),
    AHORA,
  );
  assert.equal(fila.status, "expired");
  assert.equal(fila.ends_at, "2025-09-16T10:00:00.000Z");
});

test("sin limite de tiendas en el plan NO se entra sin limite", () => {
  const fila = mapWhopMembershipToSubscription(
    parseWhopMembership(membresia({ plan: { id: "plan_abc", metadata: {} } })),
    AHORA,
  );
  assert.equal(fila.store_limit, WHOP_FALLBACK_STORE_LIMIT);
  // Sin codigo propio se guarda el id del plan de Whop, nunca uno inventado.
  assert.equal(fila.plan_code, "plan_abc");
});
