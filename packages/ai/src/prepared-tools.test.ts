import assert from "node:assert/strict";
import test from "node:test";
import { getToolContract, getToolDefinition } from "./tool-layer.js";

test("las tools de Meta/Instagram de AI-22 tienen contrato pero no se activan antes del proveedor", () => {
  for (const [name, connector] of [
    ["meta_read_ad_accounts", "meta"],
    ["meta_read_campaign_insights", "meta"],
    ["instagram_read_media", "instagram"],
    ["instagram_read_insights", "instagram"],
  ] as const) {
    const definition = getToolDefinition(name);
    assert.equal(definition?.connector, connector);
    assert.equal(definition?.permission, "read");
    assert.equal(definition?.status, "planned");
    assert.ok(getToolContract(name));
  }
});

test("los contratos preparados exigen un input acotado y fechado", () => {
  const contract = getToolContract("meta_read_campaign_insights");
  assert.ok(contract);
  assert.equal(
    contract.inputSchema.safeParse({ period_start: "2026-08-01", period_end: "2026-08-31" }).success,
    true,
  );
  assert.equal(contract.inputSchema.safeParse({ period_start: "not-a-date" }).success, false);
  assert.equal(contract.inputSchema.safeParse({ unexpected: true }).success, false);
});
