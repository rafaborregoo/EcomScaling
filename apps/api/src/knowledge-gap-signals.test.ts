import assert from "node:assert/strict";
import test from "node:test";
import { summarizeKnowledgeGapSignals, type KnowledgeGapRejectedDecision } from "./knowledge-gap-signals.js";

const calls = [
  {
    run_id: "run-1",
    agent_code: "a09_copiloto_consultor",
    store_id: "store-1",
    created_at: "2026-09-01T10:00:00.000Z",
    input: { query: "Cómo crear flows de Klaviyo para recuperar carritos maria@example.com", audiences: ["client_visible"] },
    output: { match_count: 0 },
    is_error: false,
  },
  {
    run_id: "run-1",
    agent_code: "a09_copiloto_consultor",
    store_id: "store-1",
    created_at: "2026-09-01T10:01:00.000Z",
    input: { query: "Klaviyo flows carrito", audiences: ["client_visible"] },
    output: { match_count: 0 },
    is_error: false,
  },
  {
    run_id: "run-2",
    agent_code: "a12_analista_email",
    store_id: "store-1",
    created_at: "2026-09-04T10:00:00.000Z",
    input: { query: "Klaviyo automatizaciones de email", audiences: ["client_visible"] },
    output: { match_count: 0 },
    is_error: false,
  },
  {
    run_id: "run-3",
    agent_code: "a09_copiloto_consultor",
    store_id: "store-1",
    created_at: "2026-09-05T10:00:00.000Z",
    input: { query: "Klaviyo flow", audiences: ["consultant_only"] },
    output: { match_count: 0 },
    is_error: false,
  },
  {
    run_id: "run-4",
    agent_code: "a08_gestor_conocimiento",
    store_id: "store-1",
    created_at: "2026-09-06T10:00:00.000Z",
    input: { query: "Klaviyo flow", audiences: ["client_visible"] },
    output: { match_count: 0 },
    is_error: false,
  },
  {
    run_id: "run-5",
    agent_code: "a12_analista_email",
    store_id: "store-1",
    created_at: "2026-09-07T10:00:00.000Z",
    input: { query: "Klaviyo flow", audiences: ["client_visible"] },
    output: { match_count: 4 },
    is_error: false,
  },
  {
    run_id: "run-6",
    agent_code: "a12_analista_email",
    store_id: "store-1",
    created_at: "2026-09-08T10:00:00.000Z",
    input: { query: "Klaviyo flow", audiences: ["client_visible"] },
    output: { match_count: 0 },
    is_error: true,
  },
];

test("prioriza solo busquedas RAG vacias recurrentes por tema, tienda y audiencia", () => {
  const signals = summarizeKnowledgeGapSignals(calls, new Date("2026-09-10T00:00:00.000Z"));
  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.topic_id, "email_marketing");
  assert.equal(signals[0]?.unique_zero_result_runs, 2, "doble llamada dentro del mismo run cuenta una sola vez");
  assert.deepEqual(signals[0]?.source_agent_codes, ["a09_copiloto_consultor", "a12_analista_email"]);
  assert.deepEqual(signals[0]?.source_run_ids, ["run-1", "run-2"]);
  assert.equal(signals[0]?.store_id, "store-1");
  assert.equal(signals[0]?.audience, "client_visible");
  assert.equal(JSON.stringify(signals).includes("maria@example.com"), false, "no se devuelven consultas en bruto");
  assert.equal(signals[0]?.responsible_team, "E-NORA · responsable del conocimiento");
  assert.equal(signals[0]?.suggested_review_by, "2026-09-18T10:00:00.000Z");
});

test("una consulta aislada, con resultados, fallida o del propio A08 no se convierte en hueco", () => {
  const signals = summarizeKnowledgeGapSignals([
    { ...calls[0]!, run_id: "single", output: { match_count: 0 } },
    { ...calls[0]!, run_id: "error", output: { match_count: 0 }, is_error: true },
    { ...calls[0]!, run_id: "found", output: { match_count: 2 } },
    { ...calls[0]!, run_id: "self", agent_code: "a08_gestor_conocimiento", output: { match_count: 0 } },
  ]);
  assert.deepEqual(signals, []);
});

test("clasifica palabras completas, conserva audiencia desconocida y descarta fechas invalidas", () => {
  const signals = summarizeKnowledgeGapSignals([
    { ...calls[0]!, run_id: "loads-1", input: { query: "loads and roads", audiences: [] } },
    { ...calls[0]!, run_id: "loads-2", input: { query: "loads and roads", audiences: [] } },
    { ...calls[0]!, run_id: "email-1", input: { query: "newsletter delivery", audiences: [] } },
    { ...calls[0]!, run_id: "email-2", input: { query: "newsletter delivery", audiences: [] } },
    { ...calls[0]!, run_id: "bad-date", created_at: "not-a-date", input: { query: "newsletter", audiences: [] } },
  ]);

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.topic_id, "email_marketing");
  assert.equal(signals[0]?.audience, "unspecified");
  assert.deepEqual(signals[0]?.source_run_ids, ["email-1", "email-2"]);
});

test("solo enlaza un rechazo como fallo de conocimiento si coincide con un run sin resultados y la razon lo dice", () => {
  const decisions: KnowledgeGapRejectedDecision[] = [
    { id: "linked", run_id: "run-1", decided_at: "2026-09-09T10:00:00.000Z", reason: "Falta evidencia y datos para justificar esta recomendacion" },
    { id: "linked-duplicate", run_id: "run-1", decided_at: "2026-09-09T10:00:01.000Z", reason: "Faltan fuentes verificables" },
    { id: "generic", run_id: "run-1", decided_at: "2026-09-09T10:01:00.000Z", reason: "La recomendacion no encaja con el tono" },
    { id: "unlinked", run_id: "other-run", decided_at: "2026-09-09T10:02:00.000Z", reason: "No tenemos informacion suficiente" },
  ];
  const signals = summarizeKnowledgeGapSignals(
    [{ ...calls[0]!, run_id: "run-1" }],
    new Date("2026-09-10T00:00:00.000Z"),
    decisions,
  );

  assert.equal(signals.length, 1);
  assert.equal(signals[0]?.topic_id, "email_marketing");
  assert.equal(signals[0]?.recurrent, false);
  assert.equal(signals[0]?.explicit_missing_knowledge_rejection_runs, 1);
  assert.equal(signals[0]?.evidence_basis, "explicit_rejection_linked_to_empty_search");
  assert.deepEqual(signals[0]?.rejected_decision_ids, ["linked"]);
  assert.equal(JSON.stringify(signals).includes("Falta evidencia"), false);
});

test("no atribuye un rechazo generico a todas las areas consultadas por el mismo run", () => {
  const multiTopicCalls = [
    { ...calls[0]!, run_id: "multi-topic", input: { query: "Klaviyo email flows", audiences: ["client_visible"] } },
    { ...calls[0]!, run_id: "multi-topic", input: { query: "Shopify conversion checkout", audiences: ["client_visible"] } },
  ];
  const ambiguous = summarizeKnowledgeGapSignals(
    multiTopicCalls,
    new Date("2026-09-10T00:00:00.000Z"),
    [{ id: "generic", run_id: "multi-topic", decided_at: "2026-09-09T10:00:00.000Z", reason: "Falta información suficiente para recomendar" }],
  );
  assert.deepEqual(ambiguous, []);

  const specific = summarizeKnowledgeGapSignals(
    multiTopicCalls,
    new Date("2026-09-10T00:00:00.000Z"),
    [{ id: "email-only", run_id: "multi-topic", decided_at: "2026-09-09T10:00:00.000Z", reason: "Falta información sobre Klaviyo email marketing" }],
  );
  assert.equal(specific.length, 1);
  assert.equal(specific[0]?.topic_id, "email_marketing");
  assert.deepEqual(specific[0]?.rejected_decision_ids, ["email-only"]);
  assert.equal(JSON.stringify(specific).includes("Falta información"), false);
});
