import assert from "node:assert/strict";
import test from "node:test";
import { a02EvidenceText, projectA02Reading, type A02Diagnostic } from "./a02-reading.js";

const now = Date.parse("2026-11-06T12:00:00Z");
const base: A02Diagnostic = { generated_at: "2026-11-06T10:00:00Z", output: { confidence: "high", headline: "Crece el negocio", sections: [{ key: "stock", label: "Stock", findings: [{ title: "Queda poco stock", severity: "high", area: "stock" }], recommendations: [] }], findings: [{ title: "Queda poco stock", severity: "high", area: "stock" }] } };
test("A02 distingue lectura pendiente, error y sección sin cobertura", () => {
  assert.equal(projectA02Reading({ spot: "home", error: "Pendiente", errorCode: "agent_diagnostic_pending" }).state, "pending");
  assert.equal(projectA02Reading({ spot: "home", error: "Red" }).state, "unavailable");
  assert.equal(projectA02Reading({ spot: "integrations", diagnostic: base, now }).state, "not_covered");
});
test("una sección vacía solo significa que no se señalaron hallazgos", () => {
  const diagnostic = { ...base, output: { confidence: "high", sections: [{ key: "integraciones", label: "Conexiones", findings: [] }] } };
  const reading = projectA02Reading({ spot: "integrations", diagnostic, now });
  assert.equal(reading.state, "empty");
  assert.match(reading.summary, /no ha señalado hallazgos/);
  assert.equal(projectA02Reading({ spot: "integrations", diagnostic: { ...diagnostic, output: { ...diagnostic.output, confidence: "low" } }, now }).state, "limited");
});
test("A02 filtra por área y no duplica la forma histórica de findings", () => {
  assert.equal(projectA02Reading({ spot: "home", diagnostic: base, now }).findings.length, 1);
  assert.equal(projectA02Reading({ spot: "meta", diagnostic: base, now }).findings.length, 0);
});
test("los resultados de laboratorio y las lecturas privadas no exponen contenido", () => {
  const lab = projectA02Reading({ spot: "home", diagnostic: { ...base, output: { ...base.output, warnings: ["Ejecutado mediante Codex CLI"] } }, now });
  assert.equal(lab.state, "laboratory");
  assert.deepEqual(lab.findings, []);
  const preview = projectA02Reading({ spot: "home", diagnostic: { ...base, preview: { transport: "codex_cli", environment: "test" }, output: { ...base.output, warnings: ["Codex CLI"] } }, now });
  assert.equal(preview.state, "ready");
  assert.equal(preview.findings.length, 1);
  assert.doesNotMatch(lab.summary, /Crece el negocio/);
  assert.equal(projectA02Reading({ spot: "home", error: "Prueba", errorCode: "agent_diagnostic_test_only" }).state, "laboratory");
  assert.equal(projectA02Reading({ spot: "home", diagnostic: { ...base, result_scope: "panel" }, now }).state, "unavailable");
});
test("la evidencia histórica conserva periodo y fuente", () => {
  assert.equal(a02EvidenceText({ label: "Ventas", value: "100 €", period: "Octubre", source: "Shopify" }), "Ventas: 100 € · Octubre · Shopify");
});
test("una lectura caducada conserva el detalle bajo un estado anterior explícito", () => {
  const reading = projectA02Reading({ spot: "home", diagnostic: { ...base, envelope: { freshness: { validUntil: "2026-11-05T00:00:00Z" } } }, now });
  assert.equal(reading.state, "stale");
  assert.equal(reading.findings.length, 1);
  assert.doesNotMatch(reading.summary, /Crece el negocio/);
});
test("un canal con lectura general usa su sección y conserva la procedencia", () => {
  const reading = projectA02Reading({ spot: "shopify", diagnostic: { ...base, requested_scope: "shopify", result_scope: "overview" }, now });
  assert.equal(reading.generalFallback, true);
  assert.equal(reading.summary, "Queda poco stock");
});
test("la antigüedad no invalida una lectura que el servidor conserva por falta de actividad", () => {
  const reading = projectA02Reading({ spot: "home", diagnostic: { ...base, envelope: { freshness: { status: "fresh", reason: "no_activity_since", validUntil: "2026-11-05T00:00:00Z" } } }, now });
  assert.equal(reading.state, "ready");
});
test("un output incompleto y la falta de cobertura nunca se presentan como ausencia de problemas", () => {
  assert.equal(projectA02Reading({ spot: "home", diagnostic: { ...base, output: {} }, now }).state, "unavailable");
  const diagnostic = { ...base, output: { confidence: "high", sections: [{ key: "integraciones", label: "Conexiones", findings: [] }] }, envelope: { quality: { dataCompleteness: "partial" } } };
  assert.equal(projectA02Reading({ spot: "integrations", diagnostic, now }).state, "limited");
});
