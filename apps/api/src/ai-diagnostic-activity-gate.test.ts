/**
 * Fase 1 del control de coste de agentes de diagnostico: getCachedDiagnostic
 * ya no regenera solo por superar las 24h -- ademas tiene que haber habido
 * actividad en la organizacion (digest distinto). decideDiagnosticCacheServe
 * es la regla pura; aqui se fija su tabla de casos.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  decideDiagnosticCacheServe,
  decideOrchestratorAction,
  manualRefreshCapExceeded,
  orgDailyRunCapReached,
  platformBudgetExceeded,
  scoreDiagnosticPriority,
  isPlanHorizon,
  orchestratorMinRunAgeFor,
  PLAN_HORIZONS,
} from "./ai-runtime.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_000 * DAY_MS;

test("sin run previo: no se puede servir cache", () => {
  const d = decideDiagnosticCacheServe({
    generatedAt: null,
    storedDigest: null,
    currentDigest: "abc",
    now: NOW,
  });
  assert.deepEqual(d, { serve: false, stale: false, noActivitySince: false });
});

test("run reciente (<24h): se sirve cache aunque el digest haya cambiado", () => {
  const d = decideDiagnosticCacheServe({
    generatedAt: NOW - DAY_MS / 2,
    storedDigest: "old",
    currentDigest: "new",
    now: NOW,
  });
  assert.equal(d.serve, true);
  assert.equal(d.stale, false);
  assert.equal(d.noActivitySince, false);
});

test("run viejo (>24h) sin actividad: se sigue sirviendo, marcado no_activity_since", () => {
  const d = decideDiagnosticCacheServe({
    generatedAt: NOW - 5 * DAY_MS,
    storedDigest: "same",
    currentDigest: "same",
    now: NOW,
  });
  assert.deepEqual(d, { serve: true, stale: true, noActivitySince: true });
});

test("run viejo (>24h) con actividad nueva: se regenera", () => {
  const d = decideDiagnosticCacheServe({
    generatedAt: NOW - 2 * DAY_MS,
    storedDigest: "before",
    currentDigest: "after",
    now: NOW,
  });
  assert.equal(d.serve, false);
  assert.equal(d.stale, true);
});

test("run viejo pero digest no disponible (rpc caida): cae a la regla de 24h y regenera", () => {
  const d = decideDiagnosticCacheServe({
    generatedAt: NOW - 2 * DAY_MS,
    storedDigest: "before",
    currentDigest: null,
    now: NOW,
  });
  assert.equal(d.serve, false);
});

test("run viejo, digest guardado nulo (run anterior a esta feature): regenera al pasar 24h", () => {
  const d = decideDiagnosticCacheServe({
    generatedAt: NOW - 2 * DAY_MS,
    storedDigest: null,
    currentDigest: "after",
    now: NOW,
  });
  assert.equal(d.serve, false);
});

test("tope de refrescos manuales: bloquea al llegar al cap, no antes", () => {
  // El default subio de 3 a 12 al dejar de cubrir solo tres agentes y pasar a
  // contar cualquier refresco manual de la organizacion.
  assert.equal(manualRefreshCapExceeded(0), false);
  assert.equal(manualRefreshCapExceeded(11), false);
  assert.equal(manualRefreshCapExceeded(12), true);
  assert.equal(manualRefreshCapExceeded(30), true);
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

test("un agente sin horizonte propio usa la antiguedad general", () => {
  assert.equal(
    orchestratorMinRunAgeFor("a02_monitor_negocio"),
    orchestratorMinRunAgeFor("a06_planificador_stock"),
  );
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
