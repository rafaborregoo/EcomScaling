import assert from "node:assert/strict";
import test from "node:test";
import {
  marketingBrandProfileInputSchema,
  resolveMarketingBrandProfile,
} from "./marketing-brand-profile.js";

test("combina la guia de tienda sobre la de organizacion y omite metadata privada", () => {
  const resolved = resolveMarketingBrandProfile(
    {
      brand_name: "Marca org",
      palette: { primary: "#111111" },
      tone_guidelines: "Cercano",
    },
    {
      palette: { primary: "#222222" },
      tone_guidelines: null,
    },
  );

  assert.equal(resolved.resolved_from, "store_and_organization");
  assert.deepEqual(resolved.profile, {
    brand_name: "Marca org",
    palette: { primary: "#222222" },
    tone_guidelines: "Cercano",
  });
  assert.ok(resolved.missing_fields.includes("legal_footer"));
});

test("preserva overrides vacios y devuelve perfil ausente de forma explicita", () => {
  const cleared = resolveMarketingBrandProfile(
    { preferred_vocabulary: ["premium"] },
    { preferred_vocabulary: [] },
  );
  assert.deepEqual(cleared.profile, { preferred_vocabulary: [] });
  assert.equal(cleared.resolved_from, "store_and_organization");

  assert.deepEqual(resolveMarketingBrandProfile(null, null), {
    profile: null,
    resolved_from: "none",
    missing_fields: [
      "brand_name", "logo_url", "palette", "available_fonts", "tone_guidelines",
      "preferred_vocabulary", "avoided_vocabulary", "required_texts",
      "claim_restrictions", "image_guidelines", "legal_footer",
    ],
  });
});

test("el formulario solo acepta campos acotados y colores HEX", () => {
  assert.deepEqual(marketingBrandProfileInputSchema.parse({ store_connection_id: null }), {
    store_connection_id: null,
  });
  assert.equal(marketingBrandProfileInputSchema.safeParse({
    palette: { primary: "#173D35" },
    required_texts: ["Unsubscribe"],
  }).success, true);
  assert.equal(marketingBrandProfileInputSchema.safeParse({
    palette: { primary: "url(javascript:alert(1))" },
  }).success, false);
  assert.equal(marketingBrandProfileInputSchema.safeParse({ logo_url: "javascript:alert(1)" }).success, false);
  assert.equal(marketingBrandProfileInputSchema.safeParse({ logo_url: "https://cdn.example.com/logo.png" }).success, true);
  assert.equal(marketingBrandProfileInputSchema.safeParse({
    playbook: "internal",
  }).success, false);
});
