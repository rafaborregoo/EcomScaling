/**
 * El 10% del cliente vinculado.
 *
 * §30 del modelo pide que el descuento se DERIVE de la vinculacion y no se
 * guarde como un numero. Lo que se prueba aqui es la consecuencia practica:
 * que el checkout lo lleve solo cuando hay vinculacion viva, y que quitarlo
 * sea una llamada con el cuerpo exacto que Stripe entiende -- mandar el campo
 * sin valor deja el descuento puesto, que es un fallo que no se ve hasta que
 * alguien cuadra las cuentas.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  CUPON_VINCULADO,
  descuentosDeCheckout,
  quitarDescuentoDeStripe,
} from "./vinculacion.js";

test("con vinculacion viva el checkout lleva el cupon", () => {
  assert.deepEqual(descuentosDeCheckout({ vinculada: true }), {
    discounts: [{ coupon: CUPON_VINCULADO }],
  });
});

test("sin vinculacion no se manda nada, ni un descuento del 0%", () => {
  // `discounts: []` no es lo mismo que no mandarlo: Stripe lo acepta pero
  // bloquea `allow_promotion_codes` en la misma sesion.
  assert.deepEqual(descuentosDeCheckout({ vinculada: false }), {});
});

test("quitar el descuento envia una lista vacia al SDK", async () => {
  let capturado: { id: string; params: { discounts: [] } } | null = null;
  const resultado = await quitarDescuentoDeStripe(
    { STRIPE_SECRET_KEY: "rk_test", STRIPE_API_VERSION: "2026-08-26.dahlia" },
    "sub_123",
    {
      subscriptions: {
        async update(id, params) {
          capturado = { id, params };
          return {};
        },
      },
    },
  );

  assert.equal(resultado.ok, true);
  assert.equal(capturado!.id, "sub_123");
  assert.deepEqual(capturado!.params, { discounts: [] });
});

test("sin clave no se finge que se retiro el descuento", async () => {
  const resultado = await quitarDescuentoDeStripe({}, "sub_123");
  assert.equal(resultado.ok, false);
  assert.equal(
    resultado.ok === false ? resultado.detail : null,
    "stripe_not_configured",
  );
});

test("un error de Stripe se devuelve, no se traga", async () => {
  const resultado = await quitarDescuentoDeStripe(
    { STRIPE_SECRET_KEY: "rk_test" },
    "sub_no_existe",
    {
      subscriptions: {
        async update() {
          throw new Error("No such subscription");
        },
      },
    },
  );
  assert.equal(resultado.ok, false);
  assert.equal(
    resultado.ok === false ? resultado.detail : null,
    "No such subscription",
  );
});
