import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_JUDGE_RUBRICS,
  JUDGE_RUBRIC_VERSION,
  buildAgentJudgeSystemPrompt,
  finalizeAgentJudgeResult,
  isExistingAgentJudgeJsonPath,
  medianAgentJudgeModelOutput,
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
    assert.match(prompt, /rutas exactas que empiecen por \$\.output o \$\.immutable_snapshot/);
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

test("A23 can judge metric-backed criteria without images while visual review stays unevaluable", () => {
  const prepared = prepareAgentJudgeRequest({
    agentCode: "a23_creatividad_meta",
    output: { findings: [{ ad_id: "ad-1", decision: "observe" }] },
    snapshot: { blocks: [{ label: "Cobertura de evidencia visual A23", data: { images_attached: 0 } }] },
    artifactKind: "agent_output",
    artifactHash: "c".repeat(64),
    sourceRefs: [],
    toolReceiptCount: 0,
    expectedToolCallCount: 0,
    generationStatus: "succeeded",
    visualEvidenceAvailable: false,
  });

  assert.equal(prepared.ready, true);
  const result = finalizeAgentJudgeResult("a23_creatividad_meta", {
    summary: "La decisión se puede revisar con métricas; no hay evidencia visual.",
    criteria: AGENT_JUDGE_RUBRICS.a23_creatividad_meta.map((criterion) => ({
      criterion_id: criterion.id,
      score: criterion.id === "visual_evidence" ? null : 4,
      status: criterion.id === "visual_evidence" ? "no_evaluable" as const : "evaluable" as const,
      rationale: "Criterio revisado con la evidencia disponible.",
      evidence_refs: criterion.id === "visual_evidence" ? [] : ["$.output.findings[0]"],
      critical_failure: false,
    })),
  }, undefined, {
    visual_evidence: "el snapshot no contiene bytes visuales adjuntos",
  });

  assert.equal(result.status, "review");
  assert.equal(result.evaluated_criteria, AGENT_JUDGE_RUBRICS.a23_creatividad_meta.length - 1);
  assert.equal(result.overall_score, 4);
  assert.equal(result.criteria.find((criterion) => criterion.criterion_id === "visual_evidence")?.status, "no_evaluable");
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

test("judge payload includes bounded analytics evidence and server scope on its immutable tool receipt", () => {
  const evidence = {
    runtime_scope: { organization_id: "org-1", store_id: "store-1" },
    result: { data: { orders: 91 }, provenance: { source: "shopify_funnel_health" } },
  };
  const prepared = prepareAgentJudgeRequest({
    agentCode: "a21_adquisicion_shopify",
    output: { answer: "Shopify registra 91 pedidos." },
    snapshot: { blocks: [] },
    artifactKind: "agent_output",
    artifactHash: "b".repeat(64),
    sourceRefs: ["tool_receipt:receipt-2"],
    toolReceiptCount: 1,
    expectedToolCallCount: 1,
    toolReceipts: [{ id: "receipt-2", tool_name: "shopify_funnel_health", is_error: false, evidence }],
    generationStatus: "succeeded",
  });

  assert.deepEqual(prepared.payload.tool_receipts, [
    { id: "receipt-2", tool_name: "shopify_funnel_health", is_error: false, evidence },
  ]);
  assert.match(buildAgentJudgeSystemPrompt("a21_adquisicion_shopify"), /Un recibo sin evidence solo demuestra/);
  assert.match(buildAgentJudgeSystemPrompt("a21_adquisicion_shopify"), /runtime_scope lo genera el servidor/);
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

test("judge summary is derived from adjudicated criteria, not a contradictory model summary", () => {
  const rubric = AGENT_JUDGE_RUBRICS.a23_creatividad_meta;
  const result = finalizeAgentJudgeResult("a23_creatividad_meta", {
    summary: "La suma de gasto es incorrecta y todo lo demás está perfecto.",
    criteria: rubric.map((criterion) => ({
      criterion_id: criterion.id,
      score: criterion.id === "creative_decision" ? 2 : 4,
      status: "evaluable" as const,
      rationale: criterion.id === "creative_decision"
        ? "El snapshot contiene tres anuncios y la salida solo cubre dos."
        : "La evidencia respalda el criterio.",
      evidence_refs: ["$.immutable_snapshot.blocks[0]"],
      critical_failure: false,
    })),
  });

  assert.match(result.summary, /Decisión creativa/);
  assert.match(result.summary, /solo cubre dos/);
  assert.doesNotMatch(result.summary, /La suma de gasto es incorrecta/);
});

test("A05 separates market holidays from store timezone and accepts safe abstention", () => {
  const rubric = AGENT_JUDGE_RUBRICS.a05_estrategia_campanas;
  const seasonality = rubric.find((criterion) => criterion.id === "seasonality")!.instruction;
  const strategy = rubric.find((criterion) => criterion.id === "campaign_strategy")!.instruction;
  const readiness = rubric.find((criterion) => criterion.id === "calendar_readiness")!.instruction;
  assert.equal(JUDGE_RUBRIC_VERSION, "judge-rubrics-v7");
  assert.match(seasonality, /mercado comercial.*zona horaria IANA de la tienda/s);
  assert.match(seasonality, /no declares contradicción solo porque el mercado sea España/);
  assert.match(strategy, /preparación o acción condicional/);
  assert.match(readiness, /comprobación mínima y fije cuándo decidir/);
});

test("A02 and A19 cannot pass when their evidence-critical domain criteria score below the configured minimum", () => {
  for (const [agentCode, criterionId] of [
    ["a02_monitor_negocio", "prioritization"],
    ["a19_revision_camino", "progress_measurement"],
  ] as const) {
    const rubric = AGENT_JUDGE_RUBRICS[agentCode];
    const result = finalizeAgentJudgeResult(agentCode, {
      summary: "La media sería alta, pero el criterio clave no alcanza el mínimo.",
      criteria: rubric.map((criterion) => ({
        criterion_id: criterion.id,
        score: criterion.id === criterionId ? 3 : 4,
        status: "evaluable" as const,
        rationale: criterion.id === criterionId
          ? "La evidencia no alcanza el nivel requerido para afirmar un diagnóstico fiable."
          : "Evidencia suficiente.",
        evidence_refs: ["$.output"],
        critical_failure: false,
      })),
    }, new Set(["$.output"]));

    assert.ok(result.overall_score != null && result.overall_score > 3.2, "the aggregate alone would pass");
    assert.equal(result.status, "review");
    assert.match(result.summary, /no alcanza el nivel requerido/);
  }
});

test("A27 maps scheduled dates by sequence number and may produce a structured brief for A11", () => {
  const rubric = AGENT_JUDGE_RUBRICS.a27_planificador_mailing;
  const calendar = rubric.find((criterion) => criterion.id === "calendar_strategy")!.instruction;
  const boundary = rubric.find((criterion) => criterion.id === "planning_boundary")!.instruction;
  const knowledge = rubric.find((criterion) => criterion.id === "rag_method")!.instruction;
  assert.match(calendar, /sequence_number con scheduled_dates\[\]/);
  assert.match(calendar, /no exijas repetir scheduled_for/);
  assert.match(boundary, /brief estructurado para que A11 redacte después/);
  assert.match(boundary, /No redacta el cuerpo final/);
  assert.match(knowledge, /recuperación está vacía\/no disponible/);
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

test("median of judge passes discards an outlier score and votes on evaluability", () => {
  const rubric = AGENT_JUDGE_RUBRICS[AGENT_EVAL_AGENT_CODES[0]!];
  const pass = (score: number) => ({
    summary: "x",
    criteria: rubric.map((c) => ({ criterion_id: c.id, score, status: "evaluable" as const, rationale: "r", evidence_refs: ["$.output"], critical_failure: false })),
  });
  const merged = medianAgentJudgeModelOutput([pass(4), pass(3), pass(0)]);
  assert.ok(merged.criteria.every((c) => c.score === 3));
  const noEval = { ...pass(3), criteria: pass(3).criteria.map((c, i) => (i === 0 ? { ...c, score: null, status: "no_evaluable" as const } : c)) };
  const voted = medianAgentJudgeModelOutput([noEval, noEval, pass(3)]);
  assert.equal(voted.criteria[0]!.status, "no_evaluable");
  assert.equal(voted.criteria[1]!.status, "evaluable");
});
