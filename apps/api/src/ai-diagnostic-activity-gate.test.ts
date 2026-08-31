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

test("tope de refrescos manuales: bloquea al llegar a 3, no antes", () => {
  assert.equal(manualRefreshCapExceeded(0), false);
  assert.equal(manualRefreshCapExceeded(2), false);
  assert.equal(manualRefreshCapExceeded(3), true);
  assert.equal(manualRefreshCapExceeded(9), true);
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
