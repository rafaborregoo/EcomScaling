import assert from "node:assert/strict";
import test from "node:test";
import { getToolContract } from "./tool-layer.js";

test("A09 can retrieve one knowledge document by UUID without model-controlled scope", () => {
  const contract = getToolContract("get_knowledge_document");
  assert.ok(contract);
  assert.equal(contract.definition.permission, "read");
  assert.equal(contract.definition.status, "implemented_partial");
  assert.equal(contract.inputSchema.safeParse({ document_id: "550e8400-e29b-41d4-a716-446655440000" }).success, true);
  assert.equal(contract.inputSchema.safeParse({ document_id: "550e8400-e29b-41d4-a716-446655440000", organization_id: "otra" }).success, false);
  assert.equal(contract.inputSchema.safeParse({ document_id: "no-es-uuid" }).success, false);
  assert.equal(contract.outputSchema.safeParse({
    data: { document: { id: "550e8400-e29b-41d4-a716-446655440000", organization_id: "550e8400-e29b-41d4-a716-446655440001", title: "Política", content: "contenido autorizado" } },
    provenance: { source: "get_knowledge_document", as_of: "2026-10-19T10:00:00.000Z", freshness_seconds: 0 },
  }).success, true);
});

test("A09 can deepen one visible specialist result inside the selected tenant and store", () => {
  const contract = getToolContract("get_specialist_run_detail");
  assert.ok(contract);
  assert.equal(contract.definition.permission, "read");
  assert.equal(contract.definition.status, "implemented_partial");
  assert.equal(contract.inputSchema.safeParse({ run_id: "550e8400-e29b-41d4-a716-446655440000" }).success, true);
  assert.equal(contract.inputSchema.safeParse({ run_id: "550e8400-e29b-41d4-a716-446655440000", store_id: "otra" }).success, false);
  assert.equal(contract.inputSchema.safeParse({ run_id: "no-es-uuid" }).success, false);
  assert.equal(contract.outputSchema.safeParse({
    data: {
      id: "550e8400-e29b-41d4-a716-446655440000",
      organization_id: "550e8400-e29b-41d4-a716-446655440001",
      store_id: null,
      status: "succeeded",
      finished_at: "2026-10-19T10:00:00.000Z",
      agent_versions: { version: "v1" },
      agent_outputs: [{ id: "550e8400-e29b-41d4-a716-446655440002", status: "approved" }],
    },
    provenance: { source: "get_specialist_run_detail", as_of: "2026-10-19T10:00:00.000Z", freshness_seconds: 0 },
  }).success, true);
});

test("A09 can inspect one campaign calendar item by UUID without model-supplied tenant or store", () => {
  const contract = getToolContract("get_campaign_item_detail");
  assert.ok(contract);
  assert.equal(contract.definition.permission, "read");
  assert.equal(contract.definition.status, "implemented_partial");
  assert.equal(contract.inputSchema.safeParse({ campaign_item_id: "550e8400-e29b-41d4-a716-446655440000" }).success, true);
  assert.equal(contract.inputSchema.safeParse({ campaign_item_id: "550e8400-e29b-41d4-a716-446655440000", store_id: "otra" }).success, false);
  assert.equal(contract.inputSchema.safeParse({ campaign_item_id: "no-es-uuid" }).success, false);
});

test("A09 can inspect one marketing draft only through the strict draft ID contract", () => {
  const contract = getToolContract("get_marketing_draft_detail");
  assert.ok(contract);
  assert.equal(contract.definition.permission, "read");
  assert.equal(contract.definition.status, "implemented_partial");
  assert.equal(contract.inputSchema.safeParse({ draft_id: "550e8400-e29b-41d4-a716-446655440000" }).success, true);
  assert.equal(contract.inputSchema.safeParse({ draft_id: "550e8400-e29b-41d4-a716-446655440000", organization_id: "otra" }).success, false);
  assert.equal(contract.inputSchema.safeParse({ draft_id: "no-es-uuid" }).success, false);
});

test("A09 can read one historical Camino version only through a strict plan ID", () => {
  const contract = getToolContract("get_strategic_plan_version");
  assert.ok(contract);
  assert.equal(contract.definition.permission, "read");
  assert.equal(contract.definition.status, "implemented_partial");
  assert.equal(contract.inputSchema.safeParse({ plan_id: "550e8400-e29b-41d4-a716-446655440000" }).success, true);
  assert.equal(contract.inputSchema.safeParse({ plan_id: "550e8400-e29b-41d4-a716-446655440000", organization_id: "otra" }).success, false);
  assert.equal(contract.inputSchema.safeParse({ plan_id: "no-es-uuid" }).success, false);
});

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

test("A22 puede comparar señal de devolución read-only y ocultar tasas no fiables", () => {
  const contract = getToolContract("shopify_return_delay_comparison");
  assert.ok(contract);
  assert.equal(contract.definition.permission, "read");
  assert.equal(contract.definition.status, "implemented_partial");
  assert.equal(contract.definition.connector, "shopify");
  assert.equal(contract.inputSchema.safeParse({}).success, true);
  assert.equal(contract.inputSchema.safeParse({ target_store_id: "otra-tienda" }).success, false);
  assert.equal(contract.outputSchema.safeParse({
    data: {
      comparison_status: "insufficient_return_status_coverage",
      mature_late_orders: 32,
      mature_ontime_orders: 30,
      late_return_status_coverage_pct: 93.8,
      late_return_signal_rate_pct: null,
      ontime_return_signal_rate_pct: null,
      difference_percentage_points: null,
      sample_reliable: false,
    },
    provenance: { source: "shopify_return_delay_comparison", as_of: "2026-09-28T10:00:00.000Z", freshness_seconds: 0 },
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
