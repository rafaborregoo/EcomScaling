import assert from "node:assert/strict";
import test from "node:test";
import { buildCopilotEvidenceReference } from "./copilot-evidence.js";

test("a chart action carries its ISO day, period, store and filters", () => {
  const ref = buildCopilotEvidenceReference({
    route: "/meta", title: "Meta Ads", focusLabel: "Inversión diaria",
    connectionId: "6c3cc58b-2a3e-475f-ae64-ae7f61b131a7",
    searchParams: new URLSearchParams("days=30&tab=overview"),
    target: {
      kind: "chart_point", metric: { key: "meta_spend", date: "2026-10-07" },
      period: { start: "2026-09-08", end: "2026-10-08" },
    },
  });
  assert.equal(ref.source, "meta");
  assert.deepEqual(ref.metric, { key: "meta_spend", date: "2026-10-07" });
  assert.equal(ref.connection_id, "6c3cc58b-2a3e-475f-ae64-ae7f61b131a7");
  assert.deepEqual(ref.filters, { days: "30", tab: "overview" });
  assert.equal("value" in ref, false);
});

test("detail buttons identify the entity without using its display name", () => {
  const ref = buildCopilotEvidenceReference({
    route: "/shopify/productos/gid%3A%2F%2Fshopify%2FProduct%2F42",
    title: "Producto", searchParams: new URLSearchParams(),
  });
  assert.equal(ref.kind, "entity");
  assert.deepEqual(ref.entity, { type: "shopify_product", id: "gid://shopify/Product/42" });
});
