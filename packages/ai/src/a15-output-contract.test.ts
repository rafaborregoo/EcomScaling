import assert from "node:assert/strict";
import test from "node:test";
import { instagramImageAnalysisJsonSchema, instagramImageAnalysisSchema, toAnthropicCompatibleOutputSchema } from "./index.js";
test("A15 generation and validation share palette and text limits", () => {
  const properties = instagramImageAnalysisJsonSchema.properties!;
  for (const [name, limit, expected] of [["colors", "maxItems", 8], ["objects", "maxItems", 40], ["description", "maxLength", 4000], ["inferences", "maxItems", 12], ["design_findings", "maxItems", 12]] as const) {
    const rule = properties[name]; assert.ok(rule && typeof rule === "object"); assert.equal(rule[limit], expected);
  }
  assert.equal(instagramImageAnalysisSchema.shape.colors.safeParse(Array.from({ length: 9 }, () => ({ label: "test", hex: "#FFFFFF" }))).success, false);
  assert.equal(toAnthropicCompatibleOutputSchema(instagramImageAnalysisJsonSchema).$schema, undefined);
});
