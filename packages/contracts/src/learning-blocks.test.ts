import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateLearningBlocks } from "./continuous-learning.js";
import { F9_BLOCK_CODES, type LearningExperience, type LearningSnapshot, type PriorLearning } from "./learning-snapshot.js";

const AS_OF = "2026-09-25T10:00:00.000Z";
const daysAgo = (n: number) => new Date(new Date(AS_OF).getTime() - n * 86_400_000).toISOString();

const exp = (over: Partial<LearningExperience> = {}): LearningExperience => ({
  id: "exp-1",
  intervention_id: "int-1",
  recommendation_id: "rec-1",
  started_at: daysAgo(45),
  closed_at: daysAgo(35),
  closure_state: "CLOSED",
  operational_outcome: "SUCCESS",
  verification_status: "VERIFIED",
  closure_maturity: "MATURE",
  tasks: { total: 3, completed: 3, blocked: 0 },
  planned_actions: 3,
  rolled_back: false,
  incident: false,
  expected_state: "B",
  actual_state: "B",
  observed_effect: { metric: "conversion_rate", direction: "up", material: true },
  expected_effect: { metric: "conversion_rate", direction: "up" },
  sample_sufficient: true,
  human: { approved: true, modified: false, rejected: false },
  unknowns: [],
  ...over,
});

const prior = (over: Partial<PriorLearning> = {}): PriorLearning => ({
  id: "l-1",
  experience_id: "exp-old-1",
  metric: "conversion_rate",
  direction: "up",
  classification: "POSITIVE",
  confidence: "MEDIUM",
  context: { main_channel: "paid_social" },
  evaluated_at: daysAgo(20),
  status: "active",
  ...over,
});

const snap = (over: Partial<LearningSnapshot> = {}): LearningSnapshot => ({
  organization_id: "org-1",
  as_of: AS_OF,
  experiences: [exp()],
  prior_learnings: [],
  approvals: [],
  readiness: [],
  autonomy: [],
  prioritization: [],
  playbooks: [],
  data_quality: { reliability: "high", coverage: "complete" },
  context_events: [],
  current_context: { main_channel: "paid_social" },
  signals_30d: [],
  expected_outcomes_available: true,
  cross_tenant_sources: 0,
  ...over,
});

const run = (s: LearningSnapshot) => new Map(evaluateLearningBlocks(s).map((r) => [r.block, r]));
const block = (s: LearningSnapshot, code: string) => run(s).get(code as never)!;

test("los 40 bloques tienen evaluador propio, sin 9.21, y ninguno promociona ni cambia autoridad", () => {
  const results = evaluateLearningBlocks(snap());
  assert.deepEqual(results.map((r) => r.block), [...F9_BLOCK_CODES]);
  assert.equal(results.find((r) => r.block === ("9.21" as never)), undefined);
  assert.ok(results.every((r) => r.promotes_knowledge === false && r.changes_authority === false));
  assert.ok(results.every((r) => r.gate === (r.status === "READY")));
  // Titulos distintos: ya no es el mismo codigo con otra etiqueta.
  assert.equal(new Set(results.map((r) => r.title)).size, 40);
});

test("sin experiencias, los bloques de evidencia esperan y el flujo universal no asume aprendizaje", () => {
  const r = run(snap({ experiences: [] }));
  for (const code of ["9.01", "9.03", "9.04", "9.05", "9.08", "9.12"] as const) assert.equal(r.get(code)!.status, "WAITING_FOR_EVIDENCE", code);
  assert.equal(r.get("9.00")!.block_decision, "SIN_EXPERIENCIA");
});

test("9.01: sin efecto medido la experiencia no sostiene aprendizaje de eficacia", () => {
  assert.equal(block(snap(), "9.01").block_decision, "COMPLETA");
  assert.equal(block(snap({ experiences: [exp({ observed_effect: null })] }), "9.01").block_decision, "SIN_OUTCOME");
});

test("9.03: sin recuento de tareas la fidelidad es UNKNOWN; con rollback, NO", () => {
  assert.equal(block(snap(), "9.03").block_decision, "YES");
  assert.equal(block(snap({ experiences: [exp({ tasks: null })] }), "9.03").block_decision, "UNKNOWN");
  assert.equal(block(snap({ experiences: [exp({ rolled_back: true })] }), "9.03").status, "BLOCKED");
  assert.equal(block(snap({ experiences: [exp({ tasks: { total: 4, completed: 2, blocked: 2 } })] }), "9.03").block_decision, "PARTIALLY");
});

test("9.04: la calidad depende de D01, la muestra y la madurez", () => {
  assert.equal(block(snap(), "9.04").block_decision, "HIGH");
  assert.equal(block(snap({ data_quality: { reliability: "low", coverage: null } }), "9.04").block_decision, "LOW");
  assert.equal(block(snap({ data_quality: null }), "9.04").block_decision, "UNKNOWN");
});

test("9.05: sin control el techo es causal_plausible, y un confusor lo baja a asociativa", () => {
  assert.equal(block(snap(), "9.05").block_decision, "causal_plausible");
  const withEvent = snap({ context_events: [{ event_type: "promotion", source: "declared", occurred_at: daysAgo(40), ended_at: null }] });
  assert.equal(block(withEvent, "9.05").block_decision, "asociativa");
});

test("9.06: otra intervencion en la ventana es confusion severa", () => {
  const two = snap({ experiences: [exp(), exp({ id: "exp-2", intervention_id: "int-2", started_at: daysAgo(42), closed_at: daysAgo(38) })] });
  assert.equal(block(two, "9.06").block_decision, "SEVERE");
  assert.equal(block(snap(), "9.06").block_decision, "NONE");
});

test("9.07: la accion es proporcional a la fuerza; con replicas es reutilizable dentro de limites", () => {
  assert.equal(block(snap(), "9.07").block_decision, "RECOMENDACION_AMPLIA");
  const replicated = snap({ prior_learnings: [prior(), prior({ id: "l-2", experience_id: "exp-old-2" })] });
  assert.equal(block(replicated, "9.07").block_decision, "REUTILIZABLE_DENTRO_DE_LIMITES");
  assert.equal(block(snap({ data_quality: { reliability: "low", coverage: null } }), "9.07").block_decision, "HIPOTESIS_O_TEST_PEQUENO");
});

test("9.08: un cierre de hace dos dias es inmaduro aunque F8 lo diera por maduro", () => {
  assert.equal(block(snap(), "9.08").block_decision, "MATURE");
  assert.equal(block(snap({ experiences: [exp({ closed_at: daysAgo(2) })] }), "9.08").block_decision, "IMMATURE");
});

test("9.09: la confianza la limita la evidencia mas debil, y una contradiccion la hunde", () => {
  assert.equal(block(snap(), "9.09").block_decision, "MEDIUM");
  const contradicted = snap({ prior_learnings: [prior({ direction: "down" })] });
  assert.equal(block(contradicted, "9.09").block_decision, "LOW");
});

test("9.12: positivo de negocio sin atribucion no es positivo de la intervencion; INCONCLUSIVE no es NEUTRAL", () => {
  assert.equal(block(snap(), "9.12").classification, "POSITIVE");
  const confounded = snap({ context_events: [{ event_type: "promotion", source: "declared", occurred_at: daysAgo(40), ended_at: null }] });
  assert.equal(block(confounded, "9.12").block_decision, "POSITIVO_NO_ATRIBUIBLE");
  assert.equal(block(confounded, "9.12").classification, "INCONCLUSIVE");
  const neutral = snap({ experiences: [exp({ observed_effect: { metric: "conversion_rate", direction: "flat", material: false } })] });
  assert.equal(block(neutral, "9.12").classification, "NEUTRAL");
  assert.equal(block(snap({ experiences: [exp({ observed_effect: null })] }), "9.12").classification, "INCONCLUSIVE");
});

test("9.13: un rollback deja la causa sin confirmar y marca los datos como contaminados", () => {
  const r = block(snap({ experiences: [exp({ rolled_back: true, operational_outcome: "ROLLED_BACK" })] }), "9.13");
  assert.equal(r.block_decision, "CAUSA_NO_CONFIRMADA");
  assert.deepEqual(r.payload.contaminated_experiences, ["exp-1"]);
});

test("9.14: el mismo motivo de rechazo repetido es un patron a investigar", () => {
  const rejected = { decision: "rejected" as const, reason_category: "sin_evidencia", decided_at: daysAgo(3) };
  assert.equal(block(snap({ approvals: [rejected, rejected, rejected] }), "9.14").block_decision, "PATRON_RECURRENTE");
  assert.equal(block(snap({ approvals: [rejected] }), "9.14").block_decision, "OVERRIDE_SIN_OUTCOME");
});

test("9.15: una recomendacion no ejecutada no tiene outcome que atribuirle", () => {
  assert.equal(block(snap(), "9.15").block_decision, "EVALUABLE");
  assert.equal(block(snap({ experiences: [exp({ operational_outcome: "NOT_EXECUTED" })] }), "9.15").block_decision, "SIN_RECOMENDACIONES_EJECUTADAS");
});

test("9.16: una priorizacion vieja con senales nuevas pide repriorizar", () => {
  const old = snap({ prioritization: [{ primary_candidate_id: "rec-1", disposition: "PRIORITIZED", evaluated_at: daysAgo(45) }], signals_30d: [{ metric: "net_sales", direction: "down", trajectory: "deteriorating" }] });
  assert.equal(block(old, "9.16").block_decision, "REPRIORIZAR");
  const fresh = snap({ prioritization: [{ primary_candidate_id: "rec-1", disposition: "PRIORITIZED", evaluated_at: daysAgo(5) }] });
  assert.equal(block(fresh, "9.16").block_decision, "PRIORIDAD_EJECUTADA");
});

test("9.17 y 9.18: playbooks y guardrails se separan por dominio", () => {
  const s = snap({ playbooks: [
    { domain: "CONVERSION", disposition: "READY_FOR_RECOMMENDATION", evaluated_at: daysAgo(1) },
    { domain: "CONVERSION_CRO_BENCHMARKS", disposition: "BLOCKED", evaluated_at: daysAgo(1) },
  ] });
  assert.equal(block(s, "9.17").block_decision, "EVIDENCIA_POR_PASO_DESCONOCIDA");
  assert.equal(block(s, "9.18").block_decision, "CALIBRACION_PENDIENTE_DE_OUTCOMES");
});

test("9.19: un incidente reciente recomienda reducir autonomia; nunca se autopromociona", () => {
  const incident = snap({ experiences: [exp({ incident: true, closed_at: daysAgo(10) })] });
  assert.equal(block(incident, "9.19").block_decision, "REGRESION_RECOMENDADA");
  const clean = snap({ experiences: Array.from({ length: 5 }, (_, i) => exp({ id: `e${i}`, intervention_id: `i${i}`, started_at: daysAgo(200 - i * 30), closed_at: daysAgo(195 - i * 30) })) });
  assert.equal(block(clean, "9.19").block_decision, "ELEGIBLE_PARA_REVISION");
  assert.equal(block(clean, "9.30").block_decision, "REVISION_HUMANA");
});

test("9.20: el mismo bloqueo dos veces es un cuello de botella", () => {
  const blocked = { decision: "BLOCKED", blockers: ["tracking_missing"], evaluated_at: daysAgo(2) };
  assert.equal(block(snap({ readiness: [blocked, blocked] }), "9.20").block_decision, "CUELLO_DE_BOTELLA");
});

test("9.10 y 9.11: un aprendizaje de otro canal no se reutiliza en silencio", () => {
  const s = snap({ prior_learnings: [prior({ context: { main_channel: "email" } })] });
  assert.equal(block(s, "9.10").block_decision, "REVALIDACION_NECESARIA");
  assert.equal(block(s, "9.11").block_decision, "ADAPT");
  assert.equal(block(snap({ prior_learnings: [prior()] }), "9.10").block_decision, "DENTRO_DEL_LIMITE");
});

test("9.22 y 9.27: contradiccion real en el mismo contexto; el mas reciente y fuerte propone sustituir", () => {
  const s = snap({ prior_learnings: [prior({ id: "old", evaluated_at: daysAgo(60), confidence: "LOW" }), prior({ id: "new", direction: "down", evaluated_at: daysAgo(5), confidence: "MEDIUM" })] });
  assert.equal(block(s, "9.22").block_decision, "CONTRADICCION_SIN_RESOLVER");
  assert.deepEqual(block(s, "9.27").payload.proposals, [{ predecessor: "old", successor: "new", metric: "conversion_rate" }]);
  const contextual = snap({ prior_learnings: [prior(), prior({ id: "l-2", direction: "down", context: { main_channel: "email" } })] });
  assert.equal(block(contextual, "9.22").block_decision, "CONTRADICCION_APARENTE");
});

test("9.23: un cambio de precio despues del aprendizaje es una ruptura estructural", () => {
  const s = snap({ prior_learnings: [prior()], context_events: [{ event_type: "price_change", source: "declared", occurred_at: daysAgo(10), ended_at: null }] });
  assert.equal(block(s, "9.23").block_decision, "RUPTURA_ESTRUCTURAL");
  assert.equal(block(snap({ prior_learnings: [prior({ evaluated_at: daysAgo(120) })] }), "9.23").block_decision, "STALE");
});

test("9.24: sin medicion fiable no se explora", () => {
  assert.equal(block(snap({ data_quality: { reliability: "low", coverage: null } }), "9.24").block_decision, "EXPLORACION_BLOQUEADA");
  assert.equal(block(snap(), "9.24").block_decision, "EXPLOTAR");
});

test("9.26: tres experiencias con el mismo patron son candidato, nunca promocion automatica", () => {
  const s = snap({ prior_learnings: [1, 2, 3].map((i) => prior({ id: `l${i}`, experience_id: `e${i}` })) });
  const r = block(s, "9.26");
  assert.equal(r.block_decision, "CANDIDATO_A_REVISION");
  assert.equal(r.status, "REVIEW_REQUIRED");
});

test("9.28: con dato poco fiable el aprendizaje queda en cuarentena", () => {
  assert.equal(block(snap({ data_quality: { reliability: "low", coverage: null } }), "9.28").block_decision, "CUARENTENA");
  assert.equal(block(snap(), "9.28").block_decision, "VALIDAR");
});

test("9.29: dos incidentes en 30 dias activan el circuit breaker", () => {
  const s = snap({ experiences: [1, 2, 3].map((i) => exp({ id: `e${i}`, intervention_id: `i${i}`, recommendation_id: `r${i}`, incident: i < 3, closed_at: daysAgo(5 + i) })) });
  assert.equal(block(s, "9.29").block_decision, "CIRCUIT_BREAKER");
});

test("9.33: un aprendizaje sobre una experiencia invalidada se propone retirar", () => {
  const s = snap({ experiences: [exp({ verification_status: "FAILED" })], prior_learnings: [prior({ experience_id: "exp-1" })] });
  assert.equal(block(s, "9.33").block_decision, "RETIRADA_PROPUESTA");
});

test("9.34-9.37: solo datos de la tienda; si apareciera otra, privacidad bloquea", () => {
  const r = run(snap());
  assert.equal(r.get("9.34")!.block_decision, "SIN_CAPA_DE_TRANSFERENCIA");
  assert.equal(r.get("9.35")!.block_decision, "SIN_COHORTES");
  assert.equal(r.get("9.36")!.block_decision, "COLD_START");
  assert.equal(r.get("9.37")!.block_decision, "AISLADO");
  assert.equal(block(snap({ cross_tenant_sources: 1 }), "9.37").status, "BLOCKED");
});

test("9.39: tres intervenciones maduras con el mismo efecto pueden reforzar una tesis", () => {
  const s = snap({ experiences: [1, 2, 3].map((i) => exp({ id: `e${i}`, intervention_id: `i${i}`, started_at: daysAgo(200 - i * 40), closed_at: daysAgo(190 - i * 40) })) });
  assert.equal(block(s, "9.39").block_decision, "TESIS_REFORZABLE");
});

test("9.40: si la mayoria de episodios no llega a aprendizaje, la deuda es de evidencia", () => {
  const s = snap({ experiences: [1, 2, 3].map((i) => exp({ id: `e${i}`, intervention_id: `i${i}`, observed_effect: null, closed_at: daysAgo(40 + i * 20), started_at: daysAgo(45 + i * 20) })) });
  assert.equal(block(s, "9.40").block_decision, "DEUDA_DE_EVIDENCIA");
});

test("9.41 y 9.00: el pipeline se detiene en la primera puerta cerrada y el flujo elige su rama", () => {
  const noOutcome = run(snap({ experiences: [exp({ observed_effect: null })] }));
  assert.equal(noOutcome.get("9.41")!.block_decision, "DETENIDO_EN_OBSERVE");
  assert.equal(noOutcome.get("9.00")!.block_decision, "SIN_ACTUALIZACION_MATERIAL");
  assert.equal(run(snap({ experiences: [exp({ rolled_back: true })] })).get("9.00")!.block_decision, "REVISION_DE_EJECUCION");
  assert.equal(run(snap()).get("9.00")!.block_decision, "ACTUALIZACION_DE_CREENCIA");
});

test("9.31: toda abstencion dice que evidencia falta", () => {
  assert.equal(block(snap({ experiences: [] }), "9.31").block_decision, "EXPLICABLE");
});

test("en cualquier foto, cada bloque que espera evidencia dice cual", () => {
  const fotos = [
    snap({ experiences: [] }),
    snap(),
    snap({ experiences: [exp({ observed_effect: null, tasks: null, closed_at: daysAgo(1) })], data_quality: null }),
    snap({ prior_learnings: [prior({ context: { main_channel: "email" } })], playbooks: [{ domain: "CONVERSION", disposition: "BLOCKED", evaluated_at: daysAgo(1) }] }),
  ];
  for (const foto of fotos) {
    const mudos = evaluateLearningBlocks(foto).filter((r) => r.status === "WAITING_FOR_EVIDENCE" && !r.next_evidence.length).map((r) => r.block);
    assert.deepEqual(mudos, []);
  }
});
