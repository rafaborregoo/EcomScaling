import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PURCHASE_ACTION_TYPE,
  rankPurchaseActionTypes,
} from "./meta.js";

test("el default de compra es el que el anunciante ve en Ads Manager", () => {
  assert.equal(DEFAULT_PURCHASE_ACTION_TYPE, "omni_purchase");
});

test("los action_type de compra se ofrecen primero, el resto alfabetico", () => {
  const observed = [
    { action_type: "link_click", total: 900 },
    { action_type: "omni_purchase", total: 12 },
    { action_type: "page_engagement", total: 400 },
    { action_type: "offsite_conversion.fb_pixel_purchase", total: 11 },
    { action_type: "landing_page_view", total: 700 },
  ];

  assert.deepEqual(
    rankPurchaseActionTypes(observed).map((row) => row.action_type),
    [
      "offsite_conversion.fb_pixel_purchase",
      "omni_purchase",
      "landing_page_view",
      "link_click",
      "page_engagement",
    ],
  );
});

test("ordenar no muta la lista original ni pierde filas", () => {
  const observed = [
    { action_type: "link_click", total: 1 },
    { action_type: "purchase", total: 2 },
  ];
  const ranked = rankPurchaseActionTypes(observed);

  assert.equal(observed[0]?.action_type, "link_click");
  assert.equal(ranked.length, observed.length);
});

test("una cuenta sin action_type observados no inventa opciones", () => {
  assert.deepEqual(rankPurchaseActionTypes([]), []);
});
