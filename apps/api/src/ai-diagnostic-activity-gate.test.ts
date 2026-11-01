/**
 * La lectura del diagnostico nunca ejecuta el agente. Esta regla pura solo
 * describe la frescura del resultado existente; el orquestador decide cuando
 * generar uno nuevo.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isCaminoReviewDue } from "./camino-review-scheduling.js";
import {
  agentRpcEvidence,
  diagnosticCacheFreshness,
  consultantAssignmentContext,
  summarizeMonitorForPlan,
  orchestratorScopesForAgent,
  decideOrchestratorAction,
  manualRefreshCapExceeded,
  orgDailyRunCapReached,
  platformBudgetExceeded,
  scoreDiagnosticPriority,
  isPlanHorizon,
  orchestratorMinRunAgeFor,
  MONITOR_CADENCES,
  monitorMetaSpendArgs,
  PLAN_HORIZONS,
} from "./ai-runtime.js";

test("A21 no confunde error de consulta, ausencia de filas y datos disponibles", () => {
  assert.deepEqual(agentRpcEvidence([{ sessions: 12 }], null), {
    availability: "available", data: [{ sessions: 12 }],
  });
  assert.deepEqual(agentRpcEvidence(null, null), { availability: "no_data_returned" });
  assert.deepEqual(agentRpcEvidence([], null), { availability: "no_data_returned" });
  assert.deepEqual(agentRpcEvidence([], { message: "timeout" }), {
    availability: "unavailable",
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_000 * DAY_MS;

test("la guia de aprobacion distingue consultor, cliente y estado desconocido", () => {
  const assigned = consultantAssignmentContext(true, "Lucia");
  assert.equal(assigned.has_consultant, true);
  assert.equal(assigned.consultant_name, "Lucia");
  assert.match(assigned.decision_rule, /consultor humano/);

  const unassigned = consultantAssignmentContext(false);
  assert.equal(unassigned.has_consultant, false);
  assert.match(unassigned.decision_rule, /cliente puede aceptar o rechazar/);

  const unknown = consultantAssignmentContext(null);
  assert.equal(unknown.has_consultant, null);
  assert.match(unknown.decision_rule, /No se pudo comprobar/);
});

test("el plan recibe un resumen acotado de A02 y reconoce salidas antiguas y nuevas", () => {
  const now = Date.parse("2026-09-27T12:00:00Z");
  const old = summarizeMonitorForPlan(
    { answer: "Atender stock", findings: [{ title: "Stock bajo", severity: "high", area: "shopify" }] },
    "2026-09-26T12:00:00Z",
    now,
  );
  assert.equal(old?.headline, "Atender stock");
  assert.equal(old?.findings[0]?.title, "Stock bajo");
  assert.equal(old?.stale, false);

  const structured = summarizeMonitorForPlan(
    { headline: "Margen en riesgo", sections: [{ findings: [{ title: "Descuentos altos", severity: "medium" }] }] },
    "2026-09-01T12:00:00Z",
    now,
  );
  assert.equal(structured?.headline, "Margen en riesgo");
  assert.equal(structured?.findings[0]?.title, "Descuentos altos");
  assert.equal(structured?.stale, true);
  assert.equal(summarizeMonitorForPlan(null, null), null);
});

test("el orquestador conserva el agregado y crea una pasada por tienda para los diagnósticos con ámbito", () => {
  const stores = [
    { storeId: "store-1", connectionId: "connection-1" },
    { storeId: "store-2", connectionId: "connection-2" },
  ];
  assert.deepEqual(orchestratorScopesForAgent("a13_operativa_shopify", stores), [
    { storeId: null, connectionId: null },
    ...stores,
  ]);
  assert.deepEqual(orchestratorScopesForAgent("a14_operativa_meta", stores), [
    ...stores,
  ]);
  assert.deepEqual(orchestratorScopesForAgent("a21_adquisicion_shopify", stores), [
    { storeId: null, connectionId: null },
    ...stores,
  ]);
  assert.deepEqual(orchestratorScopesForAgent("a20_retencion_clientes", stores), [
    { storeId: null, connectionId: null },
    ...stores,
  ]);
  assert.deepEqual(orchestratorScopesForAgent("a19_revision_camino", stores), [
    { storeId: null, connectionId: null },
    ...stores,
  ]);
});

test("A23-A25 solo se programan por tienda: nunca incluyen agregado que mezcle cuentas", () => {
  const stores = [
    { storeId: "store-1", connectionId: "connection-1" },
    { storeId: "store-2", connectionId: "connection-2" },
  ];
  for (const agent of ["a23_creatividad_meta", "a24_medicion_meta", "a25_cambios_meta", "a26_contenido_email"]) {
    assert.deepEqual(orchestratorScopesForAgent(agent, stores), stores, agent);
    assert.deepEqual(orchestratorScopesForAgent(agent, []), [], `${agent} without active stores`);
  }
});

test("sin run previo: no hay antiguedad que mostrar", () => {
  const d = diagnosticCacheFreshness({
    generatedAt: null,
    storedDigest: null,
    currentDigest: "abc",
    now: NOW,
  });
  assert.deepEqual(d, { stale: false, noActivitySince: false });
});

test("run reciente (<24h): no esta marcado como obsoleto", () => {
  const d = diagnosticCacheFreshness({
    generatedAt: NOW - DAY_MS / 2,
    storedDigest: "old",
    currentDigest: "new",
    now: NOW,
  });
  assert.equal(d.stale, false);
  assert.equal(d.noActivitySince, false);
});

test("run viejo (>24h) sin actividad: se sigue sirviendo, marcado no_activity_since", () => {
  const d = diagnosticCacheFreshness({
    generatedAt: NOW - 5 * DAY_MS,
    storedDigest: "same",
    currentDigest: "same",
    now: NOW,
  });
  assert.deepEqual(d, { stale: true, noActivitySince: true });
});

test("run viejo (>24h) con actividad nueva: se muestra como obsoleto", () => {
  const d = diagnosticCacheFreshness({
    generatedAt: NOW - 2 * DAY_MS,
    storedDigest: "before",
    currentDigest: "after",
    now: NOW,
  });
  assert.equal(d.stale, true);
  assert.equal(d.noActivitySince, false);
});

test("run viejo con digest no disponible: se muestra como obsoleto", () => {
  const d = diagnosticCacheFreshness({
    generatedAt: NOW - 2 * DAY_MS,
    storedDigest: "before",
    currentDigest: null,
    now: NOW,
  });
  assert.equal(d.stale, true);
  assert.equal(d.noActivitySince, false);
});

test("run viejo sin digest guardado: se muestra como obsoleto", () => {
  const d = diagnosticCacheFreshness({
    generatedAt: NOW - 2 * DAY_MS,
    storedDigest: null,
    currentDigest: "after",
    now: NOW,
  });
  assert.equal(d.stale, true);
  assert.equal(d.noActivitySince, false);
});

test("tope de refrescos manuales por agente: bloquea al llegar al cap", () => {
  // Default alto mientras se prueba el producto; el cupo se cuenta por agente.
  assert.equal(manualRefreshCapExceeded(0), false);
  assert.equal(manualRefreshCapExceeded(999), false);
  assert.equal(manualRefreshCapExceeded(1000), true);
  assert.equal(manualRefreshCapExceeded(1200), true);
  // cap configurable
  assert.equal(manualRefreshCapExceeded(1, 1), true);
  assert.equal(manualRefreshCapExceeded(0, 1), false);
});

test("tope global de plataforma: bloquea al alcanzar el cap", () => {
  assert.equal(platformBudgetExceeded(0, 50), false);
  assert.equal(platformBudgetExceeded(49.99, 50), false);
  assert.equal(platformBudgetExceeded(50, 50), true);
  assert.equal(platformBudgetExceeded(120, 50), true);
});

test("tope de runs por org y dia", () => {
  assert.equal(orgDailyRunCapReached(11, 12), false);
  assert.equal(orgDailyRunCapReached(12, 12), true);
});

const H = 60 * 60 * 1000;
const T0 = 1_000_000 * H;

test("orquestador: sin run previo, siempre ejecuta", () => {
  assert.deepEqual(
    decideOrchestratorAction({
      lastRunAt: null,
      storedDigest: null,
      currentDigest: "x",
      hasUnreviewedPending: false,
      now: T0,
    }),
    { run: true, reason: "ran" },
  );
});

test("orquestador: sin actividad, no ejecuta", () => {
  const d = decideOrchestratorAction({
    lastRunAt: T0 - 48 * H,
    storedDigest: "same",
    currentDigest: "same",
    hasUnreviewedPending: false,
    now: T0,
  });
  assert.deepEqual(d, { run: false, reason: "no_activity" });
});

test("orquestador: con actividad pero run demasiado reciente -> cooldown", () => {
  const d = decideOrchestratorAction({
    lastRunAt: T0 - 3 * H,
    storedDigest: "old",
    currentDigest: "new",
    hasUnreviewedPending: false,
    now: T0,
  });
  assert.deepEqual(d, { run: false, reason: "cooldown" });
});

test("orquestador: con actividad y propuesta anterior sin revisar -> no apila", () => {
  const d = decideOrchestratorAction({
    lastRunAt: T0 - 48 * H,
    storedDigest: "old",
    currentDigest: "new",
    hasUnreviewedPending: true,
    now: T0,
  });
  assert.deepEqual(d, { run: false, reason: "pending_unreviewed" });
});

test("orquestador: con actividad, fuera de cooldown y sin pendientes -> ejecuta", () => {
  const d = decideOrchestratorAction({
    lastRunAt: T0 - 48 * H,
    storedDigest: "old",
    currentDigest: "new",
    hasUnreviewedPending: false,
    now: T0,
  });
  assert.deepEqual(d, { run: true, reason: "ran" });
});

test("prioridad: alertas abiertas pesan mas que facturacion", () => {
  const withAlert = scoreDiagnosticPriority({
    openAlerts: 1,
    revenue30dUsd: 0,
    planActive: false,
  });
  const richNoAlert = scoreDiagnosticPriority({
    openAlerts: 0,
    revenue30dUsd: 800_000,
    planActive: true,
  });
  assert.ok(withAlert > richNoAlert);
});

// Plan diario / semanal / mensual comparten el mismo tick del orquestador (2
// veces al dia). Lo que los separa NO es el cron, es la antiguedad minima: sin
// esto los tres se regenerarian a diario y el "plan mensual" seria un plan
// diario con otro nombre.
test("cada horizonte de plan tiene su propia antiguedad minima", () => {
  const day = orchestratorMinRunAgeFor(PLAN_HORIZONS.day.agentCode);
  const week = orchestratorMinRunAgeFor(PLAN_HORIZONS.week.agentCode);
  const month = orchestratorMinRunAgeFor(PLAN_HORIZONS.month.agentCode);

  assert.ok(day < week, "el plan diario se regenera antes que el semanal");
  assert.ok(week < month, "el plan semanal se regenera antes que el mensual");
  assert.ok(day < DAY_MS, "el diario cabe dentro del dia");
  assert.ok(week >= 6 * DAY_MS, "el semanal no se regenera a media semana");
  assert.ok(month >= 27 * DAY_MS, "el mensual no se regenera a media mes");
});

test("la revision A19 solo vence cada siete dias y no depende del digest", () => {
  const now = Date.now();
  const cadence = orchestratorMinRunAgeFor("a19_revision_camino");
  assert.equal(cadence, 7 * DAY_MS);
  const notYetDue = decideOrchestratorAction({
    lastRunAt: now - 6 * DAY_MS,
    storedDigest: null,
    currentDigest: "changed",
    hasUnreviewedPending: false,
    now,
    minRunAgeMs: cadence,
  });
  assert.equal(notYetDue.run, false);
  assert.equal(notYetDue.reason, "cooldown");
  const due = decideOrchestratorAction({
    lastRunAt: now - cadence,
    storedDigest: null,
    currentDigest: null,
    hasUnreviewedPending: false,
    now,
    minRunAgeMs: cadence,
  });
  assert.equal(due.run, true);
});

test("A19 espera siete dias desde la activacion para la primera revision", () => {
  const now = Date.parse("2026-09-27T12:00:00.000Z");
  assert.equal(isCaminoReviewDue("2026-09-21T12:00:00.000Z", now), false);
  assert.equal(isCaminoReviewDue("2026-09-20T12:00:00.000Z", now), true);
  assert.equal(isCaminoReviewDue(null, now), false);
  assert.equal(isCaminoReviewDue("invalid", now), false);
});

test("A02 separa tres ventanas de diagnostico con sus propias cadencias", () => {
  assert.deepEqual(
    MONITOR_CADENCES.map(({ lookbackDays }) => lookbackDays),
    [7, 30, 90],
  );
  assert.deepEqual(
    MONITOR_CADENCES.map(({ minRunAgeMs }) => minRunAgeMs),
    [DAY_MS, 56 * 60 * 60 * 1000, 7 * DAY_MS],
  );
  assert.ok(MONITOR_CADENCES[0].minRunAgeMs < MONITOR_CADENCES[1].minRunAgeMs);
  assert.ok(MONITOR_CADENCES[1].minRunAgeMs < MONITOR_CADENCES[2].minRunAgeMs);
  assert.equal(
    orchestratorMinRunAgeFor("a06_planificador_stock"),
    20 * 60 * 60 * 1000,
  );
});

test("A02 mantiene el scope de tienda en la consulta de inversión Meta", () => {
  assert.deepEqual(
    monitorMetaSpendArgs({
      organizationId: "org-1",
      periodStart: new Date("2026-09-01T18:20:00.000Z"),
      periodEnd: new Date("2026-09-28T18:20:00.000Z"),
      storeId: "store-1",
    }),
    {
      target_organization_id: "org-1",
      period_start: "2026-09-01",
      period_end: "2026-09-28",
      target_store_id: "store-1",
    },
  );
  assert.equal(
    monitorMetaSpendArgs({
      organizationId: "org-1",
      periodStart: new Date("2026-09-01T00:00:00.000Z"),
      periodEnd: new Date("2026-09-28T00:00:00.000Z"),
      storeId: null,
    }).target_store_id,
    null,
  );
});

test("A02 solo se genera automáticamente y las rutas manuales quedan deshabilitadas", () => {
  const runtime = readFileSync(new URL("./ai-runtime.ts", import.meta.url), "utf8");
  const server = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
  const web = readFileSync(
    new URL("../../web/src/components/ai-diagnostic-section.tsx", import.meta.url),
    "utf8",
  );

  const cacheStart = runtime.indexOf("async function getCachedDiagnostic(");
  const cacheEnd = runtime.indexOf("const DEFAULT_DIAGNOSTIC_LOOKBACK_DAYS", cacheStart);
  assert.ok(cacheStart >= 0 && cacheEnd > cacheStart);
  const cacheReader = runtime.slice(cacheStart, cacheEnd);
  assert.doesNotMatch(cacheReader, /runMonitorAgent|runGenericDiagnosticAgent|runAgentTurn/);

  const getStart = server.indexOf('"/v1/organizations/:organizationId/ai/monitor"');
  const postStart = server.indexOf('"/v1/organizations/:organizationId/ai/monitor-run"');
  assert.ok(getStart >= 0 && postStart > getStart);
  const getRoute = server.slice(getStart, postStart);
  const postEnd = server.indexOf("\n  // AI-05", postStart);
  assert.ok(postEnd > postStart);
  const postRoute = server.slice(postStart, postEnd);
  assert.match(getRoute, /getMonitorDiagnostic/);
  assert.doesNotMatch(getRoute, /runMonitorAgent/);
  assert.match(postRoute, /410/);
  assert.match(postRoute, /monitor_manual_refresh_disabled/);
  const monitorStart = runtime.indexOf("export async function runMonitorAgent(");
  const monitorEnd = runtime.indexOf("export async function getMonitorDiagnostic(", monitorStart);
  assert.ok(monitorStart >= 0 && monitorEnd > monitorStart);
  assert.match(runtime.slice(monitorStart, monitorEnd), /runOptions\?\.trigger !== "cron"/);

  const loadStart = web.indexOf("async function load()");
  const regenerateStart = web.indexOf("async function regenerate()", loadStart);
  assert.ok(loadStart >= 0 && regenerateStart > loadStart);
  const pageLoad = web.slice(loadStart, regenerateStart);
  assert.match(pageLoad, /apiFetch\(/);
  assert.doesNotMatch(pageLoad, /method:\s*["']POST/);
  assert.match(web, /const manualRunEnabled = runPath !== "\/ai\/monitor-run"/);
  assert.match(web, /manualRunEnabled && \(diagnostic \|\| needsFirstRun\)/);
});

test("A09 falla cerrado si no puede leer la conversación o su historial", () => {
  const runtime = readFileSync(new URL("./ai-runtime.ts", import.meta.url), "utf8");
  const turnStart = runtime.indexOf("export async function runConsultantChatTurn(");
  const turnEnd = runtime.indexOf("\nexport async function ", turnStart + 1);
  assert.ok(turnStart >= 0 && turnEnd > turnStart);
  const turn = runtime.slice(turnStart, turnEnd);

  assert.match(turn, /conversationLookupError[\s\S]*?error: "conversation_load_failed"/);
  assert.match(turn, /historyError[\s\S]*?error: "chat_history_load_failed"/);
  assert.ok(turn.indexOf("chat_history_load_failed") < turn.indexOf("const runId = crypto.randomUUID()"));
});

// `:horizon` llega de la URL: si la guarda aceptara cualquier string, se
// indexaria PLAN_HORIZONS con basura y el agentCode saldria undefined.
test("isPlanHorizon solo acepta los tres horizontes reales", () => {
  assert.equal(isPlanHorizon("day"), true);
  assert.equal(isPlanHorizon("week"), true);
  assert.equal(isPlanHorizon("month"), true);
  assert.equal(isPlanHorizon("year"), false);
  assert.equal(isPlanHorizon("constructor"), false);
  assert.equal(isPlanHorizon("__proto__"), false);
});

// El semanal y el mensual solo son utiles si se coordinan: cada uno tiene que
// poder mirar lo que proponen los otros dos, y para eso los codigos han de ser
// distintos entre si.
test("los tres horizontes son agentes distintos", () => {
  const codes = [
    PLAN_HORIZONS.day.agentCode,
    PLAN_HORIZONS.week.agentCode,
    PLAN_HORIZONS.month.agentCode,
  ];
  assert.equal(new Set(codes).size, 3);
});
