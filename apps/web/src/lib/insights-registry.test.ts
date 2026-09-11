import assert from "node:assert/strict";
import test from "node:test";
import {
  insightAnchorId,
  insightSpotFor,
  insightSpotsFor,
  totalInsightCount,
} from "./insights-registry";

const consultor = { organizationId: "org-1", isConsultant: true };

test("un hallazgo es de UNA tienda, no de la aplicacion", () => {
  const tiendaA = insightSpotsFor({ ...consultor, connectionId: "store-a" });
  assert.equal(tiendaA.length, 1);
  assert.equal(tiendaA[0].storeId, "store-a");

  // Otra tienda no hereda los hallazgos de la primera.
  const tiendaB = insightSpotsFor({ ...consultor, connectionId: "store-b" });
  assert.equal(tiendaB[0].storeId, "store-b");
  assert.notEqual(tiendaA[0].storeId, tiendaB[0].storeId);
});

test('"Todas las tiendas" no ensena hallazgos de tienda', () => {
  assert.deepEqual(insightSpotsFor({ ...consultor, connectionId: "" }), []);
});

test("consultor en vista general no suma la cartera entera", () => {
  const spots = insightSpotsFor({
    organizationId: "",
    connectionId: "store-a",
    isConsultant: true,
  });
  assert.deepEqual(spots, []);
  assert.equal(totalInsightCount(spots), 0);
});

test("el cliente no ve lo que es de pantalla de consultor", () => {
  const spots = insightSpotsFor({
    organizationId: "org-1",
    connectionId: "store-a",
    isConsultant: false,
  });
  assert.deepEqual(spots, []);
});

test("la card y el nav leen el mismo sitio", () => {
  const scope = { ...consultor, connectionId: "store-a" };
  const spot = insightSpotFor(scope, "roas");
  assert.ok(spot);
  assert.deepEqual(spot.insights, insightSpotsFor(scope)[0].insights);
  // El ancla del nav es la del id: si dejan de coincidir, el enlace no ancla.
  assert.equal(insightAnchorId(spot.id), "insight-roas");
  assert.ok(spot.href.endsWith(`#${insightAnchorId(spot.id)}`));
});
