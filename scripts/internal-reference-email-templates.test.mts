import { test } from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { internalReferenceEmailTemplates } from "./fixtures/internal-reference-email-templates.js";
import { internalMailingPlaybookDraftSchema } from "../apps/api/src/marketing-playbook.js";
import { renderInternalEmailTemplate } from "../packages/contracts/src/internal-email-template.js";

test("all thirteen references render with declared, usable slots and existing fictional assets", async () => {
  assert.equal(internalReferenceEmailTemplates.length, 13);
  assert.equal(new Set(internalReferenceEmailTemplates.map((preset) => preset.template.key)).size, 13);
  for (const preset of internalReferenceEmailTemplates) {
    const html = renderInternalEmailTemplate(preset.html, preset.template);
    assert.equal(/\{\{[a-z]/.test(html), false, preset.title);
    assert.equal(/<script|onerror=|onclick=/i.test(html), false);
    for (const field of preset.template.variables) {
      assert.ok(preset.html.includes(`{{${field.key}}}`), `${preset.title}: unused ${field.key}`);
      if (field.kind === "image" && field.example.startsWith("/marketing-demo/")) await access(`apps/web/public${field.example}`);
    }
    internalMailingPlaybookDraftSchema.parse({ kind: "example", title: preset.title, objective: preset.objective, content: { template: preset.template, raw_html: preset.html, sequence_arc: preset.structure, ...preset.context }, evidence: { label: "inspiration" }, source: { type: "internal", rights_confirmed: true } });
  }
});

test("new evidence and technical references explicitly reserve proof instead of copying claims", () => {
  const templates = new Map(internalReferenceEmailTemplates.map((preset) => [preset.template.key, preset]));
  const reassurance = templates.get("orbita-reassurance-evidence")!;
  for (const field of reassurance.template.variables.filter((field) => /^fact_(one|two|three)$/.test(field.key))) assert.equal(field.example, "POR VALIDAR");
  assert.ok(reassurance.context?.risks.includes("Falsa prueba social"));
  assert.match(templates.get("orbita-product-anatomy")!.context!.when_not_to_use, /ingeniería real/);
  const longform = templates.get("orbita-longform-discovery")!;
  assert.match(longform.template.variables.find((field) => field.key === "review_text")!.example, /no una opinión de un comprador/);
});
