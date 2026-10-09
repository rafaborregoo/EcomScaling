import assert from "node:assert/strict";
import { test } from "node:test";
import { commercialCalendar } from "./commercial-calendar.js";

test("un Camino de 3 meses desde el 6 oct 2026 ve Halloween, Black Friday, Navidad y Reyes con su preparacion", () => {
  const events = commercialCalendar(new Date("2026-10-06T09:00:00Z"), 92, "tienda de nieve y esquí");
  const byKey = Object.fromEntries(events.map((event) => [event.key, event]));
  assert.equal(byKey.black_friday?.date, "2026-11-27");
  assert.equal(byKey.cyber_monday?.date, "2026-11-30");
  assert.equal(byKey.black_friday?.prep_start, "2026-10-09");
  assert.equal(byKey.halloween?.date, "2026-10-31");
  assert.equal(byKey.navidad?.date, "2026-12-25");
  assert.equal(byKey.reyes?.date, "2027-01-06");
  assert.equal(byKey.temporada_nieve?.scope, "category");
  assert.equal(byKey.temporada_nieve?.prep_start, "2026-10-06");
  assert.equal(byKey.halloween?.late_start, false);
  assert.equal(commercialCalendar(new Date("2026-11-10T00:00:00Z"), 30).find((event) => event.key === "black_friday")?.late_start, true);
  assert.equal(byKey.san_valentin, undefined);
  assert.deepEqual(events.map((event) => event.date), [...events.map((event) => event.date)].sort());
});

test("Black Friday cae el viernes tras el cuarto jueves aunque noviembre empiece en viernes", () => {
  const events = commercialCalendar(new Date("2024-10-01T00:00:00Z"), 70);
  assert.equal(events.find((event) => event.key === "black_friday")?.date, "2024-11-29");
});

test("las temporadas de categoria solo aparecen si el contexto las menciona", () => {
  const events = commercialCalendar(new Date("2026-10-06T00:00:00Z"), 92, "ropa de bebé");
  assert.equal(events.some((event) => event.scope === "category"), false);
});

test("el Día de la Madre cambia por mercado y se detecta el mercado del contexto", async () => {
  const { detectMarkets } = await import("./commercial-calendar.js");
  assert.deepEqual(detectMarkets("vendemos en España y Portugal"), ["ES", "PT"]);
  assert.deepEqual(detectMarkets("tienda online"), ["ES"]);
  const fr = commercialCalendar(new Date("2027-04-15T00:00:00Z"), 60, "envíos a Francia");
  assert.equal(fr.find((event) => event.key === "dia_madre")?.date, "2027-05-30");
  const mx = commercialCalendar(new Date("2026-10-01T00:00:00Z"), 60, "tienda en México");
  assert.ok(mx.some((event) => event.key === "buen_fin"));
  assert.equal(mx.some((event) => event.key === "singles_day"), false);
});

test("categorias nuevas: juguete y moda", () => {
  const toys = commercialCalendar(new Date("2026-09-01T00:00:00Z"), 120, "juguetes educativos");
  assert.ok(toys.some((event) => event.key === "campana_juguete"));
  const fashion = commercialCalendar(new Date("2026-08-01T00:00:00Z"), 60, "moda mujer");
  assert.ok(fashion.some((event) => event.key === "moda_otono"));
});

test("fecha limite de pedido por transportista con los p90 de la tienda", async () => {
  const { carrierLeadTimes, shippingCutoffs } = await import("./commercial-calendar.js");
  const leads = carrierLeadTimes([
    { tracking_company: "SEUR", fulfillments: 300, delivered: 280, p90_hours_to_fulfillment_created: 36, p90_days_from_fulfillment_created_to_delivery: 2.4 },
    { tracking_company: "SEUR", fulfillments: 40, delivered: 30, p90_hours_to_fulfillment_created: 80, p90_days_from_fulfillment_created_to_delivery: 6 },
    { tracking_company: "Correos", fulfillments: 5, delivered: 5, p90_hours_to_fulfillment_created: 10, p90_days_from_fulfillment_created_to_delivery: 1 },
  ]);
  assert.deepEqual(leads.map((lead) => [lead.carrier, lead.handling_days_p90, lead.transit_days_p90]), [["SEUR", 1.5, 2.4]]);
  const events = commercialCalendar(new Date("2026-10-06T00:00:00Z"), 92);
  const cutoffs = shippingCutoffs(events, leads);
  const xmas = cutoffs.find((cutoff) => cutoff.event === "Navidad");
  assert.equal(xmas?.deliver_by, "2026-12-24");
  // 1,5 + 2,4 + 1 de margen = 4,9 -> 5 días antes
  assert.equal(xmas?.by_carrier[0]?.last_order_day, "2026-12-19");
  assert.equal(shippingCutoffs(events, []).find((cutoff) => cutoff.event === "Navidad")?.standard_last_order_day, "2026-12-19");
});
