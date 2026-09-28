import assert from "node:assert/strict";
import test from "node:test";
import { getToolContract } from "./tool-layer.js";

test("A21 tiene contratos estrictos para embudo y margen Shopify", () => {
  for (const name of ["shopify_funnel_health", "shopify_margin_health"]) {
    const contract = getToolContract(name);
    assert.ok(contract, `falta contrato de ${name}`);
    assert.equal(contract.definition.permission, "read");
    assert.equal(contract.inputSchema.safeParse({}).success, true);
    assert.equal(contract.inputSchema.safeParse({ target_store_id: "inventado" }).success, false);
    assert.equal(contract.outputSchema.safeParse({
      data: { resumen: [] },
      provenance: { source: name, as_of: "2026-09-27T10:00:00.000Z", freshness_seconds: 1 },
    }).success, true);
    assert.equal(contract.outputSchema.safeParse({
      data: { availability: "unknown_sync_freshness" },
      provenance: { source: name, as_of: "2026-09-27T10:00:00.000Z", freshness_seconds: null },
    }).success, true);
  }
});

test("A11 puede consultar la guía de marca sin elegir un scope desde el modelo", () => {
  const contract = getToolContract("get_brand_profile");
  assert.ok(contract);
  assert.equal(contract.definition.permission, "read");
  assert.equal(contract.definition.status, "implemented_partial");
  assert.equal(contract.inputSchema.safeParse({}).success, true);
  assert.equal(contract.inputSchema.safeParse({ store_id: "inventado" }).success, false);
  assert.equal(contract.outputSchema.safeParse({
    data: {
      profile: { brand_name: "Marca" },
      resolved_from: "organization",
      missing_fields: [],
      store_id: null,
    },
    provenance: { source: "get_brand_profile", as_of: "2026-09-27T10:00:00.000Z", freshness_seconds: 1 },
  }).success, true);
});

test("A22 entrega diagnostics read-only sin aceptar scope inventado desde el modelo", () => {
  const contract = getToolContract("shopify_delivery_diagnostics");
  assert.ok(contract);
  assert.equal(contract.definition.permission, "read");
  assert.equal(contract.definition.status, "implemented_partial");
  assert.equal(contract.definition.connector, "shopify");
  assert.equal(contract.inputSchema.safeParse({}).success, true);
  assert.equal(contract.inputSchema.safeParse({ target_store_id: "otro-store" }).success, false);
  assert.equal(contract.outputSchema.safeParse({
    data: { rows: [{ tracking_company: "carrier-a", destination_country_code: "ES", sample_reliable: false, event_coverage_pct: null, customs_hold_fulfillments: 0, pickup_event_coverage: "unavailable_or_not_yet_synced" }] },
    provenance: { source: "shopify_delivery_diagnostics", as_of: "2026-09-27T10:00:00.000Z", freshness_seconds: 1 },
  }).success, true);
});

test("A22 consulta incidencias logísticas abiertas sin scope controlado por el modelo", () => {
  const contract = getToolContract("shopify_open_delivery_exceptions");
  assert.ok(contract);
  assert.equal(contract.definition.permission, "read");
  assert.equal(contract.definition.status, "implemented_partial");
  assert.equal(contract.definition.connector, "shopify");
  assert.equal(contract.inputSchema.safeParse({}).success, true);
  assert.equal(contract.inputSchema.safeParse({ target_store_id: "otra-tienda" }).success, false);
  assert.equal(contract.outputSchema.safeParse({
    data: { excepciones_abiertas: [{ shipment_ref: "a1b2c3d4e5", exception_type: "eta_overdue", age_hours: 30, likely_area: "unknown", next_action_code: "investigate_overdue_shipment" }] },
    provenance: { source: "shopify_open_delivery_exceptions", as_of: "2026-09-28T10:00:00.000Z", freshness_seconds: 0 },
  }).success, true);
});

test("A20 puede consultar recompra agregada con muestra y sin scope controlado por el modelo", () => {
  const contract = getToolContract("shopify_product_repurchase_health");
  assert.ok(contract);
  assert.equal(contract.definition.permission, "read");
  assert.equal(contract.definition.status, "implemented_partial");
  assert.equal(contract.definition.connector, "shopify");
  assert.equal(contract.inputSchema.safeParse({}).success, true);
  assert.equal(contract.inputSchema.safeParse({ target_store_id: "otra-tienda" }).success, false);
  assert.equal(contract.outputSchema.safeParse({
    data: { availability: "available", products: [{ eligible_customers: 40, repeat_customers_90d: 12 }] },
    provenance: { source: "shopify_product_repurchase_health", as_of: "2026-09-28T10:00:00.000Z", freshness_seconds: 0 },
  }).success, true);
});
