import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAgentEvidenceContract, evaluateEvidenceConsistency } from "./evidence-evals.js";

const source = { reference: "shopify:orders:2026-08-24", organizationId: "org-1" };
const base = {
  answer: "Las ventas netas fueron estables.",
  findings: [],
  recommendations: [],
  sources: [{ kind: "metric", reference: source.reference, period: "2026-08-24" }],
  proposed_writes: [],
  approval_required: false,
  confidence: "high",
  warnings: [],
};

test("evidence eval acepta una salida grounded y tenant-bound", () => {
  const result = evaluateAgentEvidenceContract(base, {
    organizationId: "org-1",
    availableSources: [source],
  });
  assert.deepEqual(result, { ok: true, groundedness: "verified", failures: [] });
});

test("evidence eval exige abstencion cuando faltan datos", () => {
  const result = evaluateAgentEvidenceContract({
    ...base,
    answer: "No hay datos suficientes para concluir.",
    sources: [],
    confidence: "low",
    warnings: ["Falta conectar Meta Ads."],
  }, { organizationId: "org-1", availableSources: [] });
  assert.equal(result.ok, true);
  assert.equal(result.groundedness, "insufficient_evidence");
});

test("evidence eval rechaza confianza alta sin fuentes y fuga cross-tenant", () => {
  const result = evaluateAgentEvidenceContract({
    ...base,
    sources: [{ kind: "metric", reference: "other-org:orders", period: null }],
  }, {
    organizationId: "org-1",
    availableSources: [{ reference: "other-org:orders", organizationId: "org-2" }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("source_cross_tenant:other-org:orders"));
});

test("evidence eval rechaza respuesta sin evidencia que no se abstiene", () => {
  const result = evaluateAgentEvidenceContract({ ...base, sources: [], confidence: "medium" }, {
    organizationId: "org-1",
    availableSources: [],
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("missing_evidence_not_abstained"));
});

test("consistency eval acepta una afirmacion alineada con el hecho estructurado", () => {
  const result = evaluateEvidenceConsistency([
    { reference: "shopify:orders", organizationId: "org-1", field: "net_sales", value: 1250 },
  ], [
    { reference: "shopify:orders", organizationId: "org-1", field: "net_sales", value: 1250 },
  ]);
  assert.deepEqual(result, { ok: true, contradictions: [] });
});

test("consistency eval detecta contradiccion RAG/SQL y evita cross-tenant fallback", () => {
  const result = evaluateEvidenceConsistency([
    { reference: "shopify:orders", organizationId: "org-1", field: "net_sales", value: 999 },
    { reference: "shopify:orders", organizationId: "org-2", field: "net_sales", value: 1250 },
  ], [
    { reference: "shopify:orders", organizationId: "org-1", field: "net_sales", value: 1250 },
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(result.contradictions, [
    "fact_contradiction:shopify:orders:net_sales",
    "fact_missing:shopify:orders:net_sales",
  ]);
});
