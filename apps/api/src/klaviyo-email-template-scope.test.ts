import test from "node:test";
import assert from "node:assert/strict";
import { getKlaviyoEmailTemplateBody, indexKlaviyoEmailTemplateBodies } from "./klaviyo-email-template-scope.js";

test("template IDs coincidentes se resuelven por cuenta y no cruzan contenido", () => {
  const bodies = indexKlaviyoEmailTemplateBodies([
    { account_id: "account-a", external_template_id: "template-1", html_content: "A store HTML" },
    { account_id: "account-b", external_template_id: "template-1", html_content: "B store HTML" },
    { account_id: null, external_template_id: "template-1", html_content: "unscoped" },
  ]);

  assert.equal(getKlaviyoEmailTemplateBody(bodies, { account_id: "account-a", external_template_id: "template-1" }), "A store HTML");
  assert.equal(getKlaviyoEmailTemplateBody(bodies, { account_id: "account-b", external_template_id: "template-1" }), "B store HTML");
  assert.equal(getKlaviyoEmailTemplateBody(bodies, { account_id: null, external_template_id: "template-1" }), undefined);
  assert.equal(bodies.size, 2);
});
