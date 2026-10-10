import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { agentReleaseEvalFixtureSchema, buildAgentReleaseFixtureLiveEvalCases, validateAgentReleaseEvalFixture } from "./agent-release-eval-fixture.js";
import { runAgentReleaseFixtureEvaluation } from "./agent-release-eval-fixtures.js";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function hash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function fixture(overrides: Record<string, unknown> = {}) {
  const source = { sales: 1200, currency: "EUR" };
  const toolResult = { rows: [{ sales: 1200 }] };
  return {
    schema_version: "agent-release-replay-v1",
    agent_code: "a05_estrategia_campanas",
    dataset_version: "release-replay-v1",
    rubric_version: "judge-rubrics-v1",
    split: "development",
    provenance: "synthetic",
    privacy_reviewed: false,
    scenario: "Planifica una campaña con datos comerciales suficientes.",
    input: { objective: "Propón una secuencia de campaña.", parameters: { horizon_days: 30 } },
    scope: {
      organization_ref: "fixture-org-1", store_ref: "fixture-store-1", timezone: "Europe/Madrid",
      period_start: "2026-01-01", period_end: "2026-01-30",
    },
    sources: [
      { key: "shopify.sales", status: "available", content: source, content_sha256: hash(source), as_of: "2026-01-30T10:00:00Z" },
      { key: "campaigns.previous", status: "empty", content_sha256: null, as_of: "2026-01-30T10:00:00Z" },
    ],
    tool_replay: [
      { sequence: 0, tool_name: "shopify_sales", arguments: { period: "30d" }, result: toolResult, result_sha256: hash(toolResult), side_effect_free: true, is_error: false },
    ],
    visual_artifacts: [],
    constraints: { expected_abstention: false, required_output_paths: ["$.calendar"], forbidden_output_paths: ["$.email_draft"] },
    ...overrides,
  };
}

test("fixture reproducible admite contexto explícito y herramientas solo replay/read-only", () => {
  const checked = validateAgentReleaseEvalFixture(fixture());
  assert.equal(checked.ok, true);
  if (checked.ok) assert.match(checked.contentSha256, /^[0-9a-f]{64}$/);
});

test("el mismo contenido conserva hash si cambia el orden de claves JSON", () => {
  const first = fixture();
  const second = fixture({ input: { parameters: { horizon_days: 30 }, objective: "Propón una secuencia de campaña." } });
  const a = validateAgentReleaseEvalFixture(first);
  const b = validateAgentReleaseEvalFixture(second);
  assert.equal(a.ok && b.ok ? a.contentSha256 : null, a.ok && b.ok ? b.contentSha256 : undefined);
});

test("synthetic no puede entrar en calibration/release y producción exige revisión de privacidad", () => {
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(fixture({ split: "release" })).success, false);
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(fixture({
    provenance: "anonymized_production", split: "release", privacy_reviewed: false,
  })).success, false);
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(fixture({
    provenance: "anonymized_production", split: "release", privacy_reviewed: true,
  })).success, true);
});

test("rechaza hash manipulado, fuente vacía con contenido y replay con side effect", () => {
  const badHash = fixture({ sources: [{ key: "shopify.sales", status: "available", content: { sales: 1200 }, content_sha256: "f".repeat(64), as_of: null }] });
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(badHash).success, false);
  const contradictoryEmpty = fixture({ sources: [{ key: "shopify.sales", status: "empty", content: { sales: 0 }, content_sha256: hash({ sales: 0 }), as_of: null }] });
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(contradictoryEmpty).success, false);
  const sideEffect = fixture({ tool_replay: [{ sequence: 0, tool_name: "send_email", arguments: {}, result: { sent: true }, result_sha256: hash({ sent: true }), side_effect_free: false, is_error: false }] });
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(sideEffect).success, false);
  const sequenceGap = fixture({ tool_replay: [{ ...fixture().tool_replay[0]!, sequence: 1 }] });
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(sequenceGap).success, false);
});

test("no acepta datos personales probables en fixtures de replay", () => {
  const result = validateAgentReleaseEvalFixture(fixture({ input: { objective: "Contacta en demo@example.com", parameters: {} } }));
  assert.equal(result.ok, false);
});

test("convierte fixture validado a caso live con split, evidencia y constraints congelados", () => {
  const checked = validateAgentReleaseEvalFixture(fixture());
  assert.equal(checked.ok, true);
  if (!checked.ok) return;
  const [testCase] = buildAgentReleaseFixtureLiveEvalCases([{ id: "fixture-row", fixture: checked.fixture }]);
  assert.equal(testCase?.id, "fixture-row");
  assert.equal(testCase?.datasetSplit, "smoke");
  assert.equal(testCase?.expectedAbstention, false);
  assert.deepEqual(testCase?.outputConstraints, {
    requiredPaths: ["$.calendar"], forbiddenPaths: ["$.email_draft"],
  });
  assert.deepEqual(testCase?.evidenceContext.availableSources, [
    { reference: "shopify.sales", organizationId: "fixture-org-1" },
  ]);
  assert.equal((testCase?.fixture?.tool_replay as unknown[]).length, 1);
});

test("servicio ejecuta solo IDs elegidos y mantiene la suite incompleta sin el umbral adjudicado", async () => {
  const raw = fixture();
  let selected: string[] = [];
  let persisted: any;
  const supabase = {
    from: (table: string) => {
      assert.equal(table, "agent_release_eval_cases");
      return { select: () => ({ in: async (_column: string, ids: string[]) => {
        selected = ids;
        return { data: [{ id: "fixture-1", agent_code: raw.agent_code, dataset_version: raw.dataset_version,
          rubric_version: raw.rubric_version, fixture: raw }], error: null };
      } }) };
    },
    rpc: async (name: string, args: { p_payload?: any }) => {
      if (name === "capture_agent_version_release_manifest") return { data: { manifest_sha256: "a".repeat(64) }, error: null };
      persisted = args.p_payload;
      return { data: "eval-1", error: null };
    },
  } as any;
  const result = await runAgentReleaseFixtureEvaluation(supabase, {
    candidateVersionId: "candidate-1", candidateAgentCode: "a05_estrategia_campanas", fixtureIds: ["fixture-1"],
    provider: async () => ({ output: { calendar: [] }, latencyMs: 1, costUsd: 0, traceId: "fixture-run" }),
  });
  assert.deepEqual(selected, ["fixture-1"]);
  assert.equal(result.payload.evaluation.evidence.gold_cases, 0);
  assert.equal(result.payload.evaluation.evidence.holdout_cases, 0);
  assert.equal(result.payload.evaluation.evidence.release_eligible, false);
  assert.equal(persisted.evaluation.status, "incomplete");
});

test("el holdout release se reclama antes de ejecutar y no se puede reutilizar", async () => {
  const raw = fixture({
    split: "release",
    provenance: "anonymized_production",
    privacy_reviewed: true,
  });
  let claimed = false;
  let providerCalls = 0;
  const supabase = {
    from: (table: string) => {
      assert.equal(table, "agent_release_eval_cases");
      return { select: () => ({ in: async () => ({
        data: [{ id: "release-fixture-1", agent_code: raw.agent_code, dataset_version: raw.dataset_version,
          rubric_version: raw.rubric_version, fixture: raw }], error: null,
      }) }) };
    },
    rpc: async (name: string) => {
      if (name === "claim_agent_release_eval_holdout") {
        if (claimed) return { data: null, error: { code: "23505", message: "duplicate key" } };
        claimed = true;
        return { data: 1, error: null };
      }
      if (name === "capture_agent_version_release_manifest") return { data: { manifest_sha256: "a".repeat(64) }, error: null };
      return { data: "eval-1", error: null };
    },
  } as any;
  const input = {
    candidateVersionId: "candidate-1", candidateAgentCode: "a05_estrategia_campanas", fixtureIds: ["release-fixture-1"],
    provider: async () => {
      providerCalls += 1;
      return { output: { calendar: [] }, latencyMs: 1, costUsd: 0, traceId: "fixture-run" };
    },
  };

  await runAgentReleaseFixtureEvaluation(supabase, input);
  assert.equal(providerCalls, 1);
  await assert.rejects(runAgentReleaseFixtureEvaluation(supabase, input), /agent_release_eval_holdout_already_consumed/);
  assert.equal(providerCalls, 1, "la segunda ejecución debe fallar antes de llamar al candidato");
});
