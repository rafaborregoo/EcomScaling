import assert from "node:assert/strict";
import { createHash as nodeCreateHash } from "node:crypto";
import test from "node:test";
import { JUDGE_RUBRIC_VERSION } from "@e-nora/ai";
import { AGENT_EVAL_AGENT_CODES, caminoPlanJsonSchema, caminoWeeklyReviewJsonSchema } from "@e-nora/ai";
import { buildAgentReleaseFixtureLiveEvalCases, validateAgentReleaseEvalFixture, agentReleaseEvalFixtureSchema } from "./agent-release-eval-fixture.js";
import { buildAgentReleaseCandidateContext, buildAgentReleaseCandidateProvider, candidateOutputContract } from "./agent-release-candidate-eval.js";
import { a19ReviewFixtureContextSchema } from "./agent-release-eval-fixture.js";
import { createAgentReleaseToolReplay } from "./agent-release-tool-replay.js";

function fixture(agentCode: string, visual = false) {
  const content = { revenue: 1200, currency: "EUR" };
  const input = {
    schema_version: "agent-release-replay-v1",
    agent_code: agentCode,
    dataset_version: "release-replay-v1",
    rubric_version: JUDGE_RUBRIC_VERSION,
    split: "development",
    provenance: "synthetic",
    privacy_reviewed: false,
    scenario: "Escenario sintÃ©tico de evaluaciÃ³n.",
    input: { objective: "Analiza Ãºnicamente las fuentes congeladas.", parameters: agentCode === "a19_arquitecto_camino"
      ? { horizon_months: 3, reference_date: "2026-10-10" }
      : agentCode === "a19_revision_camino" ? { a19_review_context: a19ReviewContext() } : {} },
    scope: {
      organization_ref: "00000000-0000-4000-8000-000000000001", store_ref: "00000000-0000-4000-8000-000000000002", timezone: "Europe/Madrid",
      period_start: "2026-01-01", period_end: "2026-01-30",
    },
    sources: (agentCode === "a19_revision_camino"
      ? ["shopify.current", "shopify.previous", "integrations.coverage"]
      : ["shopify.summary"]).map((key) => ({
        key, status: "available", content, content_sha256: "", as_of: "2026-01-30T10:00:00Z",
      })),
    tool_replay: [],
    visual_artifacts: (visual || ["a15_analista_imagenes", "a16_texto_sobre_imagen", "a23_creatividad_meta", "a26_contenido_email"].includes(agentCode))
      ? (agentCode === "a16_texto_sobre_imagen"
        ? [visualArtifact("input", "a16_render_capture", 1), visualArtifact("render", "a16_render_capture", 2), visualArtifact("neighbor", "a16_render_capture", 3)]
        : agentCode === "a26_contenido_email"
          ? [visualArtifact("render", "a26_email_render_capture"), visualArtifact("render", "a26_email_render_capture", 2)]
          : [visualArtifact("input", agentCode === "a15_analista_imagenes" ? "instagram_image_bank" : agentCode === "a23_creatividad_meta" ? "meta_creative_image" : "a16_render_capture")]) : [],
    constraints: { expected_abstention: true, required_output_paths: [], forbidden_output_paths: [] },
  };
  for (const source of input.sources) source.content_sha256 = hash(content);
  const parsed = validateAgentReleaseEvalFixture(input);
  if (!parsed.ok) throw new Error(`fixture_invalid:${parsed.detail}`);
  return buildAgentReleaseFixtureLiveEvalCases([{ id: "case-1", fixture: parsed.fixture }])[0]!;
}

function a19ReviewContext() {
  return {
    schema_version: "a19-weekly-review-fixture-v1",
    plan_status: "approved",
    plan_version: 4,
    plan_started_at: "2026-01-01T00:00:00Z",
    approved_plan: {
      plan_name: "Camino de prueba", horizon_months: 3, diagnosis: "Ventas base observadas.",
      phases: [], sources: [], confidence: "medium", warnings: [],
    },
    review_window: { start: "2026-01-08T00:00:00Z", end: "2026-01-11T00:00:00Z" },
    goal_progress: { status: "on_track", observed_value: 1200, comparison_value: 1100, explanation: "Evolución compatible con el objetivo." },
    progress_snapshot: {
      tasks: [{ id: "task-1", title: "Revisar embudo", status: "in_progress", due_at: null, updated_at: "2026-01-10T10:00:00Z", evidence: "Tarea abierta." }],
      milestone_statuses: [{ id: "milestone-1", name: "Medición", status: "in_progress", evidence: "Seguimiento activo." }],
    },
    metric_source_keys: {
      current_window: ["shopify.current"],
      comparison_window: ["shopify.previous"],
      integration_coverage: "integrations.coverage",
    },
    previous_review: null,
  };
}

function hash(value: unknown): string {
  const stable = canonicalJson(value);
  return nodeCreateHash("sha256").update(stable).digest("hex");
}

const validPngBase64 = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
function visualArtifact(role: "input" | "render" | "reference" | "neighbor", entity_type = "a16_render_capture", variant = 1) {
  const bytes = Buffer.from(validPngBase64, "base64");
  return {
    artifact_id: ["cd9da9f3-c120-4f88-8e7b-d10a24010afe", "0d2c2d34-4a42-4c99-b56a-e9bb2c65d9e0", "2d2c2d34-4a42-4c99-b56a-e9bb2c65d9e0", "3d2c2d34-4a42-4c99-b56a-e9bb2c65d9e0"][variant - 1],
    entity_type, organization_id: "00000000-0000-4000-8000-000000000001", store_id: "00000000-0000-4000-8000-000000000002",
    period_start: "2026-01-01", period_end: "2026-01-30", related_entity_id: entity_type === "meta_creative_image" ? "00000000-0000-4000-8000-000000000003" : null, ad_id: entity_type === "meta_creative_image" ? "00000000-0000-4000-8000-000000000004" : null,
    media_type: "image/png", sha256: nodeCreateHash("sha256").update(bytes).digest("hex"), bytes_base64: bytes.toString("base64"), role,
    ...(entity_type === "a26_email_render_capture" ? { viewport: variant === 1 ? "desktop" : "mobile" } : {}),
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}


function fakeSupabase(version: Record<string, unknown>) {
  const calls = new Map<string, number>();
  const supabase = {
    from(table: string) {
      return {
        select() { return this; },
        eq() { return this; },
        async maybeSingle() {
          const count = (calls.get(table) ?? 0) + 1;
          calls.set(table, count);
          if (table === "agent_versions") return { data: version, error: null };
          if (table === "prompt_versions") return { data: { content: "Prompt fijado para la prueba." }, error: null };
          throw new Error(`unexpected_table:${table}`);
        },
      };
    },
    async rpc(name: string) {
      assert.equal(name, "capture_agent_version_release_manifest");
      return { data: { manifest_sha256: "b".repeat(64) }, error: null };
    },
  };
  return { supabase: supabase as any, calls };
}

function candidateVersion(code: string, outputSchemaVersion = "v1") {
  return {
    id: "candidate-version-1", version: "v9", model: "gpt-6-luna", prompt_code: `${code}_system`,
    prompt_version: "v9", allowed_tools: [], output_schema_version: outputSchemaVersion,
    agent_definitions: { code },
  };
}

test("every active catalog profile has a valid candidate fixture and output contract", () => {
  assert.equal(AGENT_EVAL_AGENT_CODES.length, 27);
  for (const code of AGENT_EVAL_AGENT_CODES) {
    let testCase: ReturnType<typeof fixture>;
    try { testCase = fixture(code); }
    catch (error) { assert.fail(`${code}: fixture must validate (${error instanceof Error ? error.message : "unknown"})`); }
    const parsedFixture = agentReleaseEvalFixtureSchema.safeParse(testCase.fixture);
    assert.equal(parsedFixture.success, true, `${code}: fixture must validate`);
    assert.ok(candidateOutputContract(code, parsedFixture.data!), `${code}: candidate output contract must resolve`);
    assert.ok(buildAgentReleaseCandidateContext(parsedFixture.data!).length > 0, `${code}: candidate context must be constructible`);
  }
});

test("provider fails closed when the exact candidate output schema is unsupported", async () => {
  const code = "a19_arquitecto_camino";
  const { supabase } = fakeSupabase(candidateVersion(code, "v3"));
  const { provider } = await buildAgentReleaseCandidateProvider({ OPENAI_API_KEY: "test" } as any, supabase, "candidate-version-1");
  const result = await provider(fixture(code), undefined, {
    agentVersionId: "candidate-version-1", agentCode: code, candidateFingerprint: "b".repeat(64),
  });
  assert.equal(result.candidateJudgment?.status, "no_evaluable");
  assert.match(result.candidateJudgment?.summary ?? "", /output_schema_unsupported:v3/);
});

test("provider refuses to execute a candidate if its pinned manifest changed", async () => {
  const code = "a05_estrategia_campanas";
  const { supabase, calls } = fakeSupabase(candidateVersion(code));
  const { provider } = await buildAgentReleaseCandidateProvider({ OPENAI_API_KEY: "test" } as any, supabase, "candidate-version-1");
  await assert.rejects(provider(fixture(code), undefined, {
    agentVersionId: "candidate-version-1", agentCode: code, candidateFingerprint: "a".repeat(64),
  }), /agent_release_candidate_changed_before_execution/);
  assert.equal(calls.get("agent_versions"), 1, "does not reload or execute after the fingerprint mismatch");
});

test("A19 architect uses the Camino output contract and a fixture-pinned horizon", () => {
  const caseFixture = fixture("a19_arquitecto_camino").fixture! as any;
  const contract = candidateOutputContract("a19_arquitecto_camino", caseFixture as any);
  assert.ok(contract);
  assert.equal(contract.jsonSchema, caminoPlanJsonSchema);
  assert.equal(candidateOutputContract("a19_arquitecto_camino", {
    ...caseFixture,
    input: { ...caseFixture.input, parameters: {} },
  } as any), null, "A19 must not run without frozen horizon and reference date");
});

test("A19 weekly review uses the real schema with frozen plan, progress and metric evidence", () => {
  const code = "a19_revision_camino";
  const validFixture = fixture(code).fixture! as any;
  assert.equal(a19ReviewFixtureContextSchema.safeParse(validFixture.input.parameters.a19_review_context).success, true);
  const contract = candidateOutputContract(code, validFixture);
  assert.ok(contract);
  assert.equal(contract.jsonSchema, caminoWeeklyReviewJsonSchema);
  assert.ok(buildAgentReleaseCandidateContext(validFixture).some((block) => block.label.includes("Camino activo aprobado")));
  const validReview = {
    plan_version: 4, period_start: "2026-01-08T00:00:00Z", period_end: "2026-01-11T00:00:00Z",
    executive_summary: "El Camino mantiene su progreso medido.",
    goal_progress: { status: "on_track", observed_value: 1200, comparison_value: 1100, explanation: "Ritmo observado.",
      metric_label: "Ventas netas", unit: "money", baseline_value: 1000, expected_value: 1150, target_value: 1500,
      measurement_period: "rolling_7_days", measurement_window_days: 3 },
    progress: [], risks: [], learnings: [], next_actions: [], change_proposals: [], confidence: "medium", warnings: [],
  };
  assert.equal(contract.schema.safeParse(validReview).success, true, "candidate output must validate against the real A19 review schema");
  assert.equal(contract.schema.safeParse({ ...validReview, goal_progress: undefined }).success, false);

  const missingMetrics = structuredClone(validFixture);
  missingMetrics.input.parameters.a19_review_context.metric_source_keys.comparison_window = [];
  assert.equal(candidateOutputContract(code, missingMetrics), null, "no runner contract is available without frozen metric sources");
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(missingMetrics).success, false);

  const missingPlan = structuredClone(validFixture);
  delete missingPlan.input.parameters.a19_review_context.approved_plan;
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(missingPlan).success, false, "a missing approved plan cannot enter a release suite");
});

test("visual fixtures require hash-verified bytes and role coverage for each visual agent", () => {
  const base = fixture("a15_analista_imagenes").fixture! as any;
  const missing = structuredClone(base);
  missing.visual_artifacts = [visualArtifact("input", "instagram_image_bank")];
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(missing).success, true);
  const badHash = structuredClone(missing);
  badHash.visual_artifacts[0].sha256 = "a".repeat(64);
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(badHash).success, false);
  const a16 = { ...missing, agent_code: "a16_texto_sobre_imagen", visual_artifacts: [visualArtifact("input"), visualArtifact("render")] };
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(a16).success, false, "A16 requires input, rendered output, and neighboring reference");
  const a16Complete = { ...missing, agent_code: "a16_texto_sobre_imagen", visual_artifacts: [visualArtifact("input"), visualArtifact("render", "a16_render_capture", 2), visualArtifact("neighbor", "a16_render_capture", 3)] };
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(a16Complete).success, true, "A16 accepts the full frozen visual set");
  const a23 = { ...missing, agent_code: "a23_creatividad_meta", visual_artifacts: [visualArtifact("input", "meta_creative_image")] };
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(a23).success, true, "A23 accepts a scoped Meta creative bound to an ad and period");
  const a26 = { ...missing, agent_code: "a26_contenido_email", visual_artifacts: [visualArtifact("render", "a26_email_render_capture")] };
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(a26).success, false, "A26 requires desktop and mobile render captures");
  const a26Complete = { ...missing, agent_code: "a26_contenido_email", visual_artifacts: [visualArtifact("render", "a26_email_render_capture"), visualArtifact("render", "a26_email_render_capture", 2)] };
  assert.equal(agentReleaseEvalFixtureSchema.safeParse(a26Complete).success, true, "A26 accepts both distinct viewport captures");
});

test("candidate context excludes replay, constraints, and visual references; replay results require exact calls", async () => {
  const code = "a05_estrategia_campanas";
  const original = fixture(code).fixture!;
  const replayResult = { secret_result_marker: "REPLAY_ONLY_RESULT" };
  const fixtureWithReplay = agentReleaseEvalFixtureSchema.parse({
    ...original,
    tool_replay: [{
      sequence: 0,
      tool_name: "shopify_sales",
      arguments: { period: "30d" },
      result: replayResult,
      result_sha256: hash(replayResult),
      side_effect_free: true,
      is_error: false,
    }],
    constraints: { expected_abstention: true, required_output_paths: ["$.calendar"], forbidden_output_paths: ["$.email_draft"] },
    visual_artifacts: [],
  });

  const contextText = JSON.stringify(buildAgentReleaseCandidateContext(fixtureWithReplay));
  assert.equal(contextText.includes("REPLAY_ONLY_RESULT"), false);
  assert.equal(contextText.includes("required_output_paths"), false);
  assert.equal(contextText.includes("visual_artifacts"), false);
  assert.equal(contextText.includes("shopify.summary"), true, "candidate still receives frozen source evidence");

  const broker = createAgentReleaseToolReplay({ allowedToolNames: ["shopify_sales"], replays: fixtureWithReplay.tool_replay });
  const tool = broker.tools[0]!;
  await assert.rejects(tool.execute({ period: "7d" }), /arguments_mismatch/);
  assert.equal(broker.getSummary().complete, false);
  const result = await tool.execute({ period: "30d" });
  assert.deepEqual(result, replayResult);
  assert.equal(broker.getSummary().complete, false, "a prior mismatch keeps the replay non-certifying");
});
