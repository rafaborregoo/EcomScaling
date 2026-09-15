/**
 * La atribucion de los pedidos que entran por webhook.
 *
 * El fallo que persiguen estos tests es el que se descubrio en produccion: **un
 * pedido pierde su origen segun por donde entro**. Y el segundo, mas sutil, que
 * aparece al arreglarlo: confundir "no lo preguntamos" con "no habia nada".
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  chunk,
  hasAttribution,
  journeyWindowStart,
  mapOrderJourney,
  ORDER_JOURNEY_QUERY,
  PEDIDOS_POR_LOTE,
  type JourneyNode,
} from "./shopify-order-journey.js";

const CHECKED = "2026-09-15T10:00:00.000Z";

const conJourney: JourneyNode = {
  id: "gid://shopify/Order/1",
  customerJourneySummary: {
    customerOrderIndex: 1,
    daysToConversion: 3,
    firstVisit: {
      occurredAt: "2026-09-10T08:00:00.000Z",
      landingPage: "https://tienda.com/a",
      referrerUrl: "https://google.com",
      source: "google",
      sourceType: "SEO",
      utmParameters: { source: "google", medium: "organic", campaign: null },
    },
    lastVisit: { source: "direct", sourceType: "DIRECT" },
  },
};

test("se sella la comprobacion aunque Shopify no devuelva nada", () => {
  // Es el nucleo del diseno. Un pedido sin origen puede ser una visita directa,
  // y eso es un dato. Si no se sellara, el backfill volveria a preguntar por el
  // eternamente y nadie podria distinguir un hueco de un directo.
  const vacio: JourneyNode = { id: "gid://shopify/Order/2" };
  const fila = mapOrderJourney(vacio, CHECKED);

  assert.equal(fila.journey_checked_at, CHECKED);
  assert.equal(fila.first_visit_source_type, null);
  assert.equal(fila.customer_order_index, null);
});

test("sin indice de pedido, `is_first_customer_order` queda en null y no en false", () => {
  // `false` significa "cliente que repite", que es una afirmacion. No saberlo
  // no es saber que no. Es el mismo criterio que el motor de madurez.
  const vacio: JourneyNode = { id: "gid://shopify/Order/3" };
  assert.equal(mapOrderJourney(vacio, CHECKED).is_first_customer_order, null);

  assert.equal(mapOrderJourney(conJourney, CHECKED).is_first_customer_order, true);
  assert.equal(
    mapOrderJourney(
      { id: "x", customerJourneySummary: { customerOrderIndex: 4 } },
      CHECKED,
    ).is_first_customer_order,
    false,
  );
});

test("escribe exactamente las mismas columnas que la ruta masiva", () => {
  // Dos caminos que escriben la misma fila tienen que escribirla igual, o la
  // atribucion de un pedido volveria a depender de por donde entro -- que es el
  // problema que esto arregla.
  const columnas = Object.keys(mapOrderJourney(conJourney, CHECKED)).sort();
  assert.deepEqual(columnas, [
    "customer_order_index",
    "days_to_conversion",
    "first_visit_at",
    "first_visit_landing_page",
    "first_visit_referrer_url",
    "first_visit_source",
    "first_visit_source_type",
    "first_visit_utm_campaign",
    "first_visit_utm_medium",
    "first_visit_utm_source",
    "is_first_customer_order",
    "journey_checked_at",
    "last_visit_source",
    "last_visit_source_type",
  ]);
});

test("la primera visita y la ultima no se mezclan", () => {
  // El error clasico de atribucion: la campana que lo trajo no suele ser la que
  // lo cerro, y guardarlas en el mismo campo borra esa diferencia.
  const fila = mapOrderJourney(conJourney, CHECKED);
  assert.equal(fila.first_visit_source_type, "SEO");
  assert.equal(fila.last_visit_source_type, "DIRECT");
  assert.equal(fila.first_visit_utm_medium, "organic");
  assert.equal(fila.first_visit_utm_campaign, null);
});

test("solo cuenta como atribucion lo que trae tipo de origen", () => {
  assert.equal(hasAttribution(conJourney), true);
  assert.equal(hasAttribution({ id: "x" }), false);
  assert.equal(
    hasAttribution({ id: "x", customerJourneySummary: { customerOrderIndex: 2 } }),
    false,
    "saber que es su segundo pedido no dice de donde vino",
  );
});

test("la ventana no pregunta por pedidos que Shopify ya no recuerda", () => {
  const ahora = new Date("2026-09-15T00:00:00.000Z");
  assert.equal(journeyWindowStart(ahora, 60), "2026-07-17T00:00:00.000Z");
  assert.equal(journeyWindowStart(ahora, 1), "2026-09-14T00:00:00.000Z");
});

test("los lotes respetan el tamano y no pierden pedidos", () => {
  const ids = Array.from({ length: 125 }, (_, i) => `gid-${i}`);
  const lotes = chunk(ids, PEDIDOS_POR_LOTE);
  assert.equal(lotes.length, 3);
  assert.equal(lotes.flat().length, 125);
  assert.ok(lotes.every((l) => l.length <= PEDIDOS_POR_LOTE));
  assert.deepEqual(chunk([], 50), []);
});

test("la query pide el journey y nada mas", () => {
  // Pedir de mas en una consulta por pedido es gastar rate limit en datos que
  // la importacion masiva ya trae.
  assert.match(ORDER_JOURNEY_QUERY, /customerJourneySummary/);
  assert.match(ORDER_JOURNEY_QUERY, /nodes\(ids: \$ids\)/);
  assert.ok(!/lineItems|transactions|refunds/.test(ORDER_JOURNEY_QUERY));
});
