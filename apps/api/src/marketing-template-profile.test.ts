import assert from "node:assert/strict";
import test from "node:test";
import { buildMarketingTemplateProfile } from "./marketing-template-profile.js";

test("el perfil de plantilla conserva señales visuales y de persuasión", () => {
  const profile = buildMarketingTemplateProfile({
    html: `
      <div style="background:#ffffff;color:#112233;font-size:16px;font-weight:400">
        <h1 style="font-size:28px;font-weight:700">Oferta exclusiva</h1>
        <a href="https://example.com" style="background:#112233">Comprar ahora</a>
      </div>`,
    blocks: [{ type: "text" }, { type: "button" }],
    plainText: "Clientes satisfechos. Últimos días.",
  });

  assert.equal(profile.version, 1);
  assert.equal(profile.structure.types.text, 1);
  assert.equal(profile.structure.types.button, 1);
  assert.deepEqual(profile.typography.font_sizes_px, [16, 28]);
  assert.ok(profile.palette.some((color) => color.hex === "#112233"));
  assert.equal(profile.calls_to_action[0]?.label, "Comprar ahora");
  assert.ok(profile.persuasion.includes("urgencia"));
  assert.ok(profile.persuasion.includes("prueba_social"));
});

test("el fingerprint no cambia si se analiza dos veces el mismo HTML", () => {
  const input = { html: "<p style=\"color:#aabbcc\">Hola</p>" };
  assert.equal(
    buildMarketingTemplateProfile(input).fingerprint,
    buildMarketingTemplateProfile(input).fingerprint,
  );
});
