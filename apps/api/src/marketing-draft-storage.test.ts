import assert from "node:assert/strict";
import test from "node:test";
import { marketingDraftStorageFields } from "./marketing-draft-storage.js";

test("los metadatos válidos del modelo caben en las columnas y se conserva el original", () => {
  const source = {
    preheader: "Carrusel. ".repeat(100),
    purpose: "Anuncio. ".repeat(100),
    tone: "Cercano y sobrio. ".repeat(15),
  };
  const result = marketingDraftStorageFields(source);
  assert.equal(result.preheader.length, 255);
  assert.equal(result.purpose.length, 500);
  assert.equal(result.tone.length, 120);
  assert.deepEqual(result.overflow, source);
  assert.equal(result.warnings.length, 3);
  assert.equal(source.preheader.length, 1000);
});

test("un borrador que cabe no cambia ni añade advertencias", () => {
  const source = { preheader: "Hola", purpose: "Presentar", tone: "Cercano" };
  assert.deepEqual(marketingDraftStorageFields(source), {
    ...source,
    overflow: {},
    warnings: [],
  });
});
