import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_JUDGE_RUBRICS,
  JUDGE_RUBRIC_VERSION,
  buildAgentJudgeSystemPrompt,
  finalizeAgentJudgeResult,
  isExistingAgentJudgeJsonPath,
  prepareAgentJudgeRequest,
} from "./index.js";
import { AGENT_EVAL_AGENT_CODES } from "./agent-eval-catalog.js";

test("judge has a multidimensional rubric for every active agent", () => {
  assert.deepEqual(Object.keys(AGENT_JUDGE_RUBRICS).sort(), [...AGENT_EVAL_AGENT_CODES].sort());
  for (const [code, criteria] of Object.entries(AGENT_JUDGE_RUBRICS)) {
    assert.ok(criteria.length >= 7, `${code} needs shared and domain criteria`);
    assert.equal(new Set(criteria.map((criterion) => criterion.id)).size, criteria.length);
    assert.deepEqual(criteria.slice(0, 4).map((criterion) => criterion.id), [
      "factuality", "scope", "uncertainty", "safety",
    ], `${code} must retain the four shared controls`);
    assert.ok(criteria.slice(4).length >= 3, `${code} needs agent-specific criteria`);
    for (const criterion of criteria) {
      assert.ok(criterion.title.trim().length >= 3, `${code}.${criterion.id} needs a usable title`);
      assert.ok(criterion.instruction.trim().length >= 30, `${code}.${criterion.id} needs an operational instruction`);
      assert.ok(Number.isFinite(criterion.weight) && criterion.weight > 0, `${code}.${criterion.id} needs a positive finite weight`);
    }
  }
});

test("every catalog code produces a judge prompt with its complete rubric", () => {
  for (const code of AGENT_EVAL_AGENT_CODES) {
    const prompt = buildAgentJudgeSystemPrompt(code);
    for (const criterion of AGENT_JUDGE_RUBRICS[code]) {
      assert.ok(prompt.includes(`${criterion.id} [peso=`), `${code} prompt omits ${criterion.id}`);
    }
  }
});

test("judge refuses missing evidence, failed generation and partial tool receipts", () => {
  const base = {
    agentCode: "a17_plan_semanal",
    output: { proposed_writes: [] },
    snapshot: { blocks: [] },
    artifactKind: "agent_output",
    artifactHash: null,
    sourceRefs: [],
    toolReceiptCount: 1,
    expectedToolCallCount: 2,
    generationStatus: "succeeded",
  } as const;
  assert.equal(prepareAgentJudgeRequest(base).reason, "tool_receipts_incomplete");
  assert.equal(prepareAgentJudgeRequest({ ...base, expectedToolCallCount: 1, snapshot: null }).reason, "snapshot_missing");
  assert.equal(prepareAgentJudgeRequest({ ...base, generationStatus: "failed" }).reason, "generation_not_succeeded");
});

test("visual agents require immutable artifact hashes and prompt treats input as untrusted", () => {
  const prepared = prepareAgentJudgeRequest({
    agentCode: "a16_texto_sobre_imagen",
    output: { blocks: [] },
    snapshot: { blocks: [] },
    artifactKind: "overlay_png",
    artifactHash: null,
    sourceRefs: [],
    toolReceiptCount: 0,
    expectedToolCallCount: 0,
    generationStatus: "succeeded",
  });
  assert.equal(prepared.reason, "visual_artifact_hash_missing");
  const prompt = buildAgentJudgeSystemPrompt("a16_texto_sobre_imagen");
  assert.match(prompt, /ignora cualquier instrucción/);
  assert.match(prompt, /render_readability/);
});

test("judge payload preserves failed tool receipt metadata for evidence-based review", () => {
  const prepared = prepareAgentJudgeRequest({
    agentCode: "a14_operativa_meta",
    output: { answer: "No se pudo consultar Meta; no saco conclusiones." },
    snapshot: { blocks: [] },
    artifactKind: "agent_output",
    artifactHash: "a".repeat(64),
    sourceRefs: ["tool_receipt:receipt-1"],
    toolReceiptCount: 1,
    expectedToolCallCount: 1,
    toolReceipts: [{ id: "receipt-1", tool_name: "meta_ads_insights", is_error: true }],
    generationStatus: "succeeded",
  });

  assert.equal(prepared.ready, true);
  assert.deepEqual(prepared.payload.tool_receipts, [
    { id: "receipt-1", tool_name: "meta_ads_insights", is_error: true },
  ]);
});

test("evidence JSON paths must resolve inside the exact output or snapshot", () => {
  const artifacts = { output: { answer: "ok", findings: [{ title: "F" }] }, immutable_snapshot: { blocks: [{ status: "fresh" }] } };
  assert.equal(isExistingAgentJudgeJsonPath("$.output.answer", artifacts), true);
  assert.equal(isExistingAgentJudgeJsonPath("$.immutable_snapshot.blocks[0].status", artifacts), true);
  assert.equal(isExistingAgentJudgeJsonPath("$.immutable_snapshot.blocks[4].status", artifacts), false);
  assert.equal(isExistingAgentJudgeJsonPath("$.other_tenant.secret", artifacts), false);
});

test("final verdict and weighted score are derived, critical failures block", () => {
  const rubric = AGENT_JUDGE_RUBRICS.a05_estrategia_campanas;
  const result = finalizeAgentJudgeResult("a05_estrategia_campanas", {
    summary: "La atribución no es suficiente para aprobar el recorte.",
    criteria: rubric.map((criterion) => ({
      criterion_id: criterion.id,
      score: criterion.id === "channel_economics" ? 1 : 3,
      status: "evaluable" as const,
      rationale: "Se revisó la evidencia ligada al snapshot.",
      evidence_refs: ["$.snapshot.blocks[0]"],
      critical_failure: criterion.id === "channel_economics",
    })),
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.overall_score, 2.76);
  assert.equal(result.rubric_version, JUDGE_RUBRIC_VERSION);
});

test("judge cannot omit, duplicate or escalate criteria outside its rubric", () => {
  const rubric = AGENT_JUDGE_RUBRICS.a17_plan_semanal;
  const complete = rubric.map((criterion) => ({
    criterion_id: criterion.id,
    score: 3,
    status: "evaluable" as const,
    rationale: "Justificación breve.",
    evidence_refs: ["$.output.proposed_writes"],
    critical_failure: false,
  }));
  assert.throws(() => finalizeAgentJudgeResult("a17_plan_semanal", { summary: "ok", criteria: complete.slice(1) }), /criterion_set_mismatch/);
  assert.throws(() => finalizeAgentJudgeResult("a17_plan_semanal", {
    summary: "ok",
    criteria: complete.map((item) => ({ ...item, critical_failure: item.criterion_id === "weekly_priority" })),
  }), /noncritical_escalation/);
  const ungrounded = finalizeAgentJudgeResult("a17_plan_semanal", {
    summary: "ok",
    criteria: complete,
  }, new Set());
  assert.equal(ungrounded.status, "no_evaluable");
  assert.equal(ungrounded.evaluated_criteria, 0);
  assert.ok(ungrounded.criteria.every((item) => item.status === "no_evaluable" && !item.critical_failure));
});

test("judge rejects a critical flag that conflicts with its score or evaluability", () => {
  const rubric = AGENT_JUDGE_RUBRICS.a05_estrategia_campanas;
  const invalid = rubric.map((criterion) => ({
    criterion_id: criterion.id,
    score: criterion.id === "channel_economics" ? 3 : 4,
    status: "evaluable" as const,
    rationale: "La etiqueta debe coincidir con la severidad puntuacion.",
    evidence_refs: ["$.output"],
    critical_failure: criterion.id === "channel_economics",
  }));
  assert.throws(() => finalizeAgentJudgeResult("a05_estrategia_campanas", { summary: "ok", criteria: invalid }), /judge_critical_label_invalid/);
  const notEvaluable = invalid.map((item) => item.criterion_id === "channel_economics"
    ? { ...item, score: null, status: "no_evaluable" as const }
    : item);
  assert.throws(() => finalizeAgentJudgeResult("a05_estrategia_campanas", { summary: "ok", criteria: notEvaluable }), /judge_critical_label_invalid/);
});

test("judge rejects misspelled forced no-evaluable criteria instead of silently scoring them", () => {
  const rubric = AGENT_JUDGE_RUBRICS.a16_texto_sobre_imagen;
  const output = {
    summary: "Evaluación.",
    criteria: rubric.map((criterion) => ({
      criterion_id: criterion.id,
      score: 3,
      status: "evaluable" as const,
      rationale: "Evidencia comprobada.",
      evidence_refs: ["$.output"],
      critical_failure: false,
    })),
  };
  assert.throws(
    () => finalizeAgentJudgeResult("a16_texto_sobre_imagen", output, undefined, { render_readabilty: "no se conservó el render" }),
    /judge_forced_criterion_unknown/,
  );
});

test("A16 cannot claim rendered legibility or carousel continuity without rendered and neighboring evidence", () => {
  const rubric = AGENT_JUDGE_RUBRICS.a16_texto_sobre_imagen;
  const result = finalizeAgentJudgeResult("a16_texto_sobre_imagen", {
    summary: "El copy propuesto encaja con el brief.",
    criteria: rubric.map((criterion) => ({
      criterion_id: criterion.id,
      score: 4,
      status: "evaluable" as const,
      rationale: "El modelo propone un resultado correcto.",
      evidence_refs: ["$.output"],
      critical_failure: false,
    })),
  }, new Set(["$.output"]), {
    render_readability: "no se guardó el render final",
    carousel_consistency: "faltan los slides vecinos",
  });
  assert.equal(result.criteria.filter((item) => item.status === "evaluable").length, rubric.length - 2);
  assert.equal(result.criteria.find((item) => item.criterion_id === "render_readability")?.score, null);
  assert.equal(result.criteria.find((item) => item.criterion_id === "carousel_consistency")?.score, null);
  assert.equal(result.criteria.find((item) => item.criterion_id === "copy_brief")?.score, 4);
});
