import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateSupervisionBlocks } from "@ecomscaling/contracts";
import {
  capabilitiesFromRegistry,
  executionSnapshotFromSources,
  type SupervisionSources,
} from "./execution-supervision-engine.js";

const AS_OF = "2026-09-24T10:00:00.000Z";

const sources = (over: Partial<SupervisionSources> = {}): SupervisionSources => ({
  plan: {
    id: "plan-1",
    recommendation_id: "rec-1",
    plan_status: "READY_WITH_APPROVAL",
    plan_version: 2,
    evaluated_at: AS_OF,
    input_envelope: {
      environment: "PRODUCTION",
      actions: [
        { id: "action-1", title: "Leer", target: "product-9", change: "read_before_write", current_state: "A", desired_state: "A", reversible: true, requires_approval: false },
        { id: "action-2", title: "Preparar", target: "product-9", change: "prepare_reversible_change", current_state: "A", desired_state: "B", reversible: true, requires_approval: true },
      ],
      success_criteria: ["sube el CTR"],
      stop_criteria: ["guardrail violated"],
      postconditions: ["titulo B"],
      temporal_controls: { observation_window: "14 dias" },
      budgets: { max_actions: 2, max_retries: 1 },
    },
    result: { source_refs: ["execution_plan_runs"] },
  },
  readiness: { readiness_decision: "READY", result: { stale: false, revalidate_required: false }, evaluated_at: AS_OF },
  envelope: { envelope_zone: "INSIDE", result: { violations: [], remaining_capacity: { actions: 2, magnitude: 2 } } },
  approval: { disposition: "APPROVAL_REQUIRED", approval_state: "APPROVED", autonomy_level: "APPROVAL_GATED", result: { approval_freshness: "CURRENT", revocation_status: "ACTIVE", escalation_target: "consultor" } },
  lifecycle: null,
  transitions: [],
  closure: null,
  otherPlans: [{ id: "plan-9", recommendation_id: "rec-9", input_envelope: { actions: [{ id: "x", target: "product-9", change: "prepare_reversible_change" }] } }],
  otherLifecycles: [{ intervention_id: "plan-9", state: "RUNNING" }],
  connectedProviders: ["shopify", "meta_ads"],
  ...over,
});

test("la foto lee las columnas reales de cada tabla, sin inventar lo que falta", () => {
  const s = executionSnapshotFromSources("org-1", sources(), AS_OF);
  assert.equal(s.plan?.version, 2);
  assert.equal(s.plan?.environment, "PRODUCTION");
  assert.equal(s.plan?.actions.length, 2);
  assert.equal(s.plan?.observation_window, "14 dias");
  assert.equal(s.envelope?.remaining_actions, 2);
  assert.equal(s.approval?.approval_freshness, "CURRENT");
  assert.deepEqual(s.other_interventions[0], { plan_id: "plan-9", targets: ["product-9"], state: "RUNNING" });
});

test("una accion que no dice si es reversible no se asume reversible", () => {
  const base = sources();
  const envelope = { ...(base.plan!.input_envelope as object), actions: [{ id: "a", change: "prepare_reversible_change", target: "t" }] };
  const s = executionSnapshotFromSources("org-1", sources({ plan: { ...base.plan!, input_envelope: envelope } }), AS_OF);
  assert.equal(s.plan?.actions[0]?.reversible, false);
});

test("las capacidades salen del registro real: escrituras planeadas, conectores normalizados", () => {
  const caps = capabilitiesFromRegistry(["meta_ads"]);
  assert.ok(caps.some((c) => c.permission === "write"));
  assert.ok(caps.filter((c) => c.permission === "write").every((c) => c.status === "planned"));
  assert.equal(caps.find((c) => c.name === "meta_pause_ad")?.connector_connected, true);
  assert.equal(caps.find((c) => c.name === "shopify_update_product")?.connector_connected, false);
});

test("de extremo a extremo: con otra intervencion escribiendo el mismo producto, 8.14 pone en cola", () => {
  const results = evaluateSupervisionBlocks(executionSnapshotFromSources("org-1", sources(), AS_OF));
  assert.equal(results.find((r) => r.block === "8.14")?.block_decision, "QUEUE");
  assert.equal(results.find((r) => r.block === "8.06")?.block_decision, "PREPARE_ONLY");
  assert.ok(results.every((r) => r.execution_authorized === false));
});
