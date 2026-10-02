import assert from "node:assert/strict";
import { test } from "node:test";

import {
  analyzeText,
  contrastGrade,
  contrastRatio,
  emptyBrandProfile,
  isEmailSafeFont,
  mergeBrandProfile,
  missingFields,
  profileFromApi,
  toApiPayload,
  validateBrandProfile,
  type BrandProfile,
} from "./guia-brand-profile";

const org: BrandProfile = {
  ...emptyBrandProfile(),
  brand_name: "Casa Brava",
  palette: { primary: "#2F4A3A", background: "#F7F2EA" },
  preferred_vocabulary: ["lino lavado a la piedra", "hecho en Portugal"],
  avoided_vocabulary: ["chollo", "¡Corre!"],
  required_texts: ["Envío gratis desde 50 € en península."],
  claim_restrictions: ['No decir «antibacteriano»: no tenemos certificación.'],
  legal_footer: null,
};

test("mergeBrandProfile: un campo de tienda en null hereda de la organización", () => {
  const store: BrandProfile = { ...emptyBrandProfile(), brand_name: "Casa Brava Portugal" };
  const merged = mergeBrandProfile(org, store);
  assert.equal(merged.brand_name.value, "Casa Brava Portugal");
  assert.equal(merged.brand_name.inherited, false);
  assert.equal(merged.palette.value, org.palette);
  assert.equal(merged.palette.inherited, true);
});

test("mergeBrandProfile: [] en tienda es un vacío deliberado, no hereda", () => {
  const store: BrandProfile = { ...emptyBrandProfile(), preferred_vocabulary: [] };
  const merged = mergeBrandProfile(org, store);
  assert.deepEqual(merged.preferred_vocabulary.value, []);
  assert.equal(merged.preferred_vocabulary.inherited, false);
});

test("mergeBrandProfile sin tienda: todo viene de la organización y nada está heredado", () => {
  const merged = mergeBrandProfile(org, null);
  assert.equal(merged.brand_name.value, "Casa Brava");
  assert.equal(merged.brand_name.inherited, false);
});

test("missingFields detecta lo que falta tras la fusión", () => {
  const miss = missingFields(org, null);
  assert.ok(miss.includes("legal_footer"));
  assert.ok(!miss.includes("brand_name"));
});

test("validateBrandProfile rechaza lo mismo que el zod del API", () => {
  const bad: BrandProfile = {
    ...emptyBrandProfile(),
    logo_url: "http://no-https.example.com/logo.png",
    palette: { primary: "no-es-un-hex" },
    preferred_vocabulary: ["ok"],
  };
  const errors = validateBrandProfile(bad);
  assert.ok(errors.logo_url);
  assert.ok(errors.palette);
  assert.equal(errors.preferred_vocabulary, undefined);
});

test("contrastRatio: negro sobre blanco es 21:1 y entra en el grado ok", () => {
  const ratio = contrastRatio("#000000", "#ffffff");
  assert.ok(Math.abs(ratio - 21) < 0.01);
  assert.equal(contrastGrade(ratio), "ok");
  assert.equal(contrastGrade(2), "bad");
  assert.equal(contrastGrade(3.5), "warn");
});

test("isEmailSafeFont distingue fuentes de email de fuentes web", () => {
  assert.equal(isEmailSafeFont("Georgia"), true);
  assert.equal(isEmailSafeFont("Cormorant Garamond"), false);
});

test("analyzeText marca palabras evitadas, afirmaciones vetadas y textos obligatorios ausentes", () => {
  const guide = {
    preferred: org.preferred_vocabulary!,
    avoided: org.avoided_vocabulary!,
    claimRestrictions: org.claim_restrictions!,
    requiredTexts: org.required_texts!,
  };
  const result = analyzeText(
    "¡Corre! Mantel antibacteriano hecho en Portugal, lino lavado a la piedra.",
    guide,
  );
  assert.deepEqual(result.hitAvoided, ["¡Corre!"]);
  assert.equal(result.hitClaims.length, 1);
  assert.equal(result.hitClaims[0].phrase, "antibacteriano");
  assert.deepEqual(result.hitPreferred.sort(), ["hecho en Portugal", "lino lavado a la piedra"].sort());
  assert.deepEqual(result.missingRequired, ["Envío gratis desde 50 € en península."]);
});

test("analyzeText sin infracciones no marca nada y no exige lo que ya está", () => {
  const result = analyzeText("Envío gratis desde 50 € en península.", {
    preferred: [],
    avoided: [],
    claimRestrictions: [],
    requiredTexts: ["Envío gratis desde 50 € en península."],
  });
  assert.deepEqual(result.missingRequired, []);
  assert.equal(result.matches.length, 0);
});

test("toApiPayload: en marca general un campo vacío se manda como null (hereda-neutral); en tienda como vacío deliberado", () => {
  const blank = emptyBrandProfile();
  const orgPayload = toApiPayload(blank, { isStoreScope: false });
  assert.equal(orgPayload.brand_name, null);
  assert.equal(orgPayload.preferred_vocabulary, null);

  const storePayload = toApiPayload(blank, { isStoreScope: true });
  assert.equal(storePayload.brand_name, "");
  assert.deepEqual(storePayload.preferred_vocabulary, []);
});

test("toApiPayload recorta espacios y descarta elementos vacíos de las listas", () => {
  const profile: BrandProfile = {
    ...emptyBrandProfile(),
    preferred_vocabulary: [" sobremesa ", "", "  "],
  };
  const payload = toApiPayload(profile, { isStoreScope: false });
  assert.deepEqual(payload.preferred_vocabulary, ["sobremesa"]);
});

test("profileFromApi tolera un row nulo o con tipos inesperados sin reventar", () => {
  assert.deepEqual(profileFromApi(null), emptyBrandProfile());
  const parsed = profileFromApi({ brand_name: "X", palette: { primary: "#000000" }, available_fonts: [1, "Arial"] });
  assert.equal(parsed.brand_name, "X");
  assert.deepEqual(parsed.palette, { primary: "#000000" });
  assert.deepEqual(parsed.available_fonts, ["Arial"]);
});
