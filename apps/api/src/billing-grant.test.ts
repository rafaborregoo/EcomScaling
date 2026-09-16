/**
 * Conceder un plan a mano es la puerta de atras del cobro: no pasa por Stripe y
 * la pone un platform admin. Por eso la validacion importa mas de lo normal --
 * de esta fila salen el rol de quien la recibe (ADR-0023) y su tope de tiendas.
 *
 * Los dos casos que de verdad duelen:
 *  - omitir el limite de tiendas NO puede significar "sin limite": NULL es
 *    justo lo que `assertStoreLimit` interpreta como barra libre.
 *  - el sujeto decide el rol, asi que no vale un valor por defecto.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { buildGrantFields, buildGrantPatch } from "./billing.js";

const AHORA = new Date("2026-09-16T10:00:00.000Z");
const BASE = {
  subject_type: "user",
  subject_id: "11111111-1111-1111-1111-111111111111",
  plan_code: "consultor",
  store_limit: 3,
} as const;

test("un plan a nombre de una persona cuelga de user_id", () => {
  const resultado = buildGrantPatch({ ...BASE }, AHORA);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  assert.deepEqual(resultado.patch.subject, { user_id: BASE.subject_id });
  assert.equal(resultado.patch.status, "active");
  assert.equal(resultado.patch.ends_at, null);
});

test("a nombre de un cliente cuelga de organization_id", () => {
  const resultado = buildGrantPatch(
    { ...BASE, subject_type: "organization" },
    AHORA,
  );
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  assert.deepEqual(resultado.patch.subject, {
    organization_id: BASE.subject_id,
  });
});

test("sin sujeto explicito no se concede: el sujeto decide el rol", () => {
  const sinTipo = buildGrantPatch({ ...BASE, subject_type: undefined }, AHORA);
  assert.equal(sinTipo.ok, false);
  if (sinTipo.ok) return;
  assert.equal(sinTipo.error, "subject_type_invalid");
});

test("omitir el limite de tiendas NO da barra libre", () => {
  const resultado = buildGrantPatch({ ...BASE, store_limit: undefined }, AHORA);
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;
  assert.equal(resultado.error, "store_limit_required");
});

test("sin limite se pide con null explicito", () => {
  const resultado = buildGrantPatch({ ...BASE, store_limit: null }, AHORA);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  assert.equal(resultado.patch.store_limit, null);
});

test("el limite tiene que ser un entero positivo", () => {
  for (const valor of [0, -1, 1.5, "muchas"]) {
    const resultado = buildGrantPatch({ ...BASE, store_limit: valor }, AHORA);
    assert.equal(resultado.ok, false, `${valor} deberia rechazarse`);
  }
  const texto = buildGrantPatch({ ...BASE, store_limit: "4" }, AHORA);
  assert.equal(texto.ok, true);
  if (!texto.ok) return;
  assert.equal(texto.patch.store_limit, 4);
});

test("una caducidad en el pasado se rechaza en vez de conceder nada", () => {
  const resultado = buildGrantPatch(
    { ...BASE, ends_at: "2026-09-15T10:00:00.000Z" },
    AHORA,
  );
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;
  assert.equal(resultado.error, "ends_at_in_past");
});

test("una caducidad futura se normaliza a ISO", () => {
  const resultado = buildGrantPatch({ ...BASE, ends_at: "2026-12-31" }, AHORA);
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  assert.equal(resultado.patch.ends_at, "2026-12-31T00:00:00.000Z");
});

// El alta desde /admin decide el plan en el mismo formulario que crea al
// consultor o al cliente, asi que valida los campos sin conocer todavia al
// sujeto. Lo que se comprueba aqui es que esa puerta no sea mas laxa que la
// otra: mismo rechazo del limite omitido, misma normalizacion.
test("el alta valida el plan sin saber aun a quien se le concede", () => {
  const resultado = buildGrantFields(
    { plan_code: "consultant", store_limit: "2" },
    AHORA,
  );
  assert.equal(resultado.ok, true);
  if (!resultado.ok) return;
  assert.equal(resultado.fields.plan_code, "consultant");
  assert.equal(resultado.fields.store_limit, 2);
  assert.equal(resultado.fields.status, "active");
  assert.equal(resultado.fields.ends_at, null);
  assert.ok(!("subject" in resultado.fields));
});

test("omitir el limite de tiendas tampoco cuela al dar de alta", () => {
  const resultado = buildGrantFields({ plan_code: "consultant" }, AHORA);
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;
  assert.equal(resultado.error, "store_limit_required");
});

test("sin codigo de plan no hay alta con plan concedido", () => {
  const resultado = buildGrantFields({ store_limit: 1 }, AHORA);
  assert.equal(resultado.ok, false);
  if (resultado.ok) return;
  assert.equal(resultado.error, "plan_code_invalid");
});
