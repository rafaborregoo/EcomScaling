import assert from "node:assert/strict";
import test from "node:test";
import { addDays, ruleState, ruleSuggestions, SOON_DAYS } from "./rule-state";

const today = "2026-10-02";

test("estado de una regla: desactivada, caducada, pronto o vigente", () => {
  assert.equal(ruleState({ status: "inactive", valid_until: null }, today), "off");
  assert.equal(ruleState({ status: "inactive", valid_until: "2020-01-01" }, today), "off");
  assert.equal(ruleState({ status: "active", valid_until: null }, today), "live");
  assert.equal(ruleState({ status: "active", valid_until: "2026-10-01" }, today), "expired");
  assert.equal(ruleState({ status: "active", valid_until: today }, today), "soon");
  assert.equal(ruleState({ status: "active", valid_until: addDays(today, SOON_DAYS) }, today), "soon");
  assert.equal(ruleState({ status: "active", valid_until: addDays(today, SOON_DAYS + 1) }, today), "live");
});

test("addDays suma días en calendario", () => {
  assert.equal(addDays("2026-10-02", 30), "2026-11-01");
  assert.equal(addDays("2026-12-20", 30), "2027-01-19");
});

test("sugerencias: solo lo respondido, sin repetir y respetando el límite", () => {
  const answers = { margen_minimo: "35 %", envio_gratis_desde: "60 €", lineas_rojas_marca: "x".repeat(500) };
  const all = ruleSuggestions(answers, [], 400);
  assert.deepEqual(all.map((item) => item.key), ["margen_minimo", "envio_gratis_desde"]);
  assert.match(all[0]!.text, /35 %/);

  const withExisting = ruleSuggestions(answers, [all[0]!.text], 400);
  assert.deepEqual(withExisting.map((item) => item.key), ["envio_gratis_desde"]);

  assert.deepEqual(ruleSuggestions({ margen_minimo: "sin dato" }, [], 400), []);
});
