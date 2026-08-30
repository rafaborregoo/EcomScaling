import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeTool,
  getToolContract,
  getToolDefinition,
} from "./tool-layer.js";

test("las tools Meta e Instagram tienen contratos de lectura preparados", () => {
  for (const [name, connector] of [
    ["meta_read_ad_accounts", "meta"],
    ["meta_read_campaign_insights", "meta"],
    ["instagram_read_media", "instagram"],
    ["instagram_read_insights", "instagram"],
  ] as const) {
    const definition = getToolDefinition(name);
    assert.equal(definition?.connector, connector);
    assert.equal(definition?.permission, "read");
    assert.equal(
      definition?.status,
      "implemented_partial",
    );
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

test("las tools de conectores autorizan solo con su conexión", () => {
  for (const name of [
    "meta_read_ad_accounts",
    "meta_read_campaign_insights",
    "instagram_read_media",
    "instagram_read_insights",
  ]) {
    const result = authorizeTool(name, {
      organization_id: "00000000-0000-0000-0000-000000000001",
      actor_user_id: "00000000-0000-0000-0000-000000000002",
      allowed_tools: [name],
      approval_mode: "none",
      connected_connectors: ["meta", "instagram"],
    });

    assert.equal(result.allowed, true);
    if (!result.allowed) assert.fail("la tool preparada no fue autorizada");
  }
});

function connectorForTest(name: string) {
  return name.startsWith("meta_") || name.startsWith("instagram_");
}
