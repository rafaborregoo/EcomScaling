import test from "node:test";
import assert from "node:assert/strict";
import { isUsableMarketingEmailTemplateRequest } from "./marketing-template-selection.js";

test("solo reconoce borradores propios ya identificados como plantilla de email", () => {
  assert.equal(isUsableMarketingEmailTemplateRequest({ channel: "email_klaviyo", source: "klaviyo_import" }), true);
  assert.equal(isUsableMarketingEmailTemplateRequest({ channel: "email_klaviyo", design: { blocks: [] } }), true);
  assert.equal(isUsableMarketingEmailTemplateRequest({ channel: "meta_ads", source: "klaviyo_import" }), false);
  assert.equal(isUsableMarketingEmailTemplateRequest({ channel: "email_klaviyo", source: "unknown" }), false);
  assert.equal(isUsableMarketingEmailTemplateRequest(null), false);
});
