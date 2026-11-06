import test from "node:test";
import assert from "node:assert/strict";
import { instagramPostJsonSchema, metaAdsJsonSchema, toAnthropicCompatibleOutputSchema } from "./index.js";

test("los límites de los campos sociales rechazados por Zod se comunican al modelo", () => {
  assert.equal(metaAdsJsonSchema.properties.tone.maxLength, 120);
  assert.equal(metaAdsJsonSchema.properties.call_to_action.maxLength, 80);
  assert.equal(instagramPostJsonSchema.properties.tone.maxLength, 120);
  assert.equal(instagramPostJsonSchema.properties.call_to_action.maxLength, 80);
  assert.equal(instagramPostJsonSchema.properties.creative_brief.maxLength, 2000);
  const converted = toAnthropicCompatibleOutputSchema(instagramPostJsonSchema) as { properties: Record<string, { description?: string }> };
  assert.match(converted.properties.creative_brief!.description ?? "", /at most 2000 characters/);
  assert.match(converted.properties.call_to_action!.description ?? "", /at most 80 characters/);
});
