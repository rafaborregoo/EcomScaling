import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentOutputEnvelope, shouldRequireHumanApproval } from "./ai-runtime.js";

test("la envolvente IA conserva alcance, fuentes y propuestas sin inventar referencias", () => {
  const envelope = buildAgentOutputEnvelope({
    runId: "run-1",
    agentCode: "a02_monitor_negocio",
    organizationId: "org-1",
    storeId: "store-1",
    generatedAt: "2026-07-22T12:00:00.000Z",
    completedAt: "2026-07-22T12:00:02.000Z",
    fromCache: false,
    content: {
      answer: "Diagnostico con evidencia.",
      sources: [
        { kind: "metric", reference: "Ventas Shopify", period: null },
        { kind: "document", period: null },
      ],
      proposed_writes: [
        { kind: "task", title: "Revisar margen", description: "Validar costes.", priority: "high" },
      ],
      confidence: "high",
      warnings: [],
    },
    outputStatus: "pending_approval",
  });

  assert.equal(envelope.scope.organizationId, "org-1");
  assert.equal(envelope.scope.storeId, "store-1");
  assert.equal(envelope.sources.length, 1);
  assert.equal(envelope.sources[0]?.label, "Ventas Shopify");
  assert.equal(envelope.proposals[0]?.status, "pending_approval");
  assert.equal(envelope.proposals[0]?.idempotencyKey, "run-1:proposal:0");
  assert.equal(envelope.quality.groundedness, "partially_supported");
});

test("una propuesta materializable exige aprobacion aunque la version diga none", () => {
  assert.equal(shouldRequireHumanApproval("none", { answer: "solo lectura" }), false);
  assert.equal(shouldRequireHumanApproval("none", { proposed_writes: [{ kind: "task" }] }), true);
  assert.equal(shouldRequireHumanApproval("none", { proposed_tasks: [{ title: "Revisar" }] }), true);
  assert.equal(shouldRequireHumanApproval("required_before_publish", { answer: "ok" }), true);
});

test("la envolvente permite exponer la frescura calculada por la cache", () => {
  const envelope = buildAgentOutputEnvelope({
    runId: "run-stale",
    agentCode: "a02_monitor_negocio",
    organizationId: "org-1",
    generatedAt: "2026-10-01T12:00:00.000Z",
    fromCache: true,
    content: { warnings: [], sources: [] },
    freshness: {
      status: "stale",
      reason: "ttl_expired",
      validUntil: "2026-10-02T12:00:00.000Z",
    },
  });
  assert.deepEqual(envelope.freshness, {
    status: "stale",
    reason: "ttl_expired",
    validUntil: "2026-10-02T12:00:00.000Z",
  });
});
