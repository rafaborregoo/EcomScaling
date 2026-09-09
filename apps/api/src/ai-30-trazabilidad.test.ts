/**
 * AI-30: tests de la fase 1 de trazabilidad.
 *
 * Puros, sin I/O: cubren las dos decisiones que cambian el comportamiento del
 * sistema y que serian faciles de revertir sin darse cuenta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateCostGate } from "./eval-cost-gate.js";
import {
  aiContextRetentionCutoff,
  aiSecurityEventRetentionCutoff,
} from "./ai-context-retention.js";
import {
  currentParallelGroupId,
  currentRequestId,
  runWithRequestCorrelation,
} from "./request-context.js";

test("el gate de coste falla cuando el coste no es calculable", () => {
  // Antes de AI-30 esto valia 0 y pasaba el gate: la forma mas facil de colar
  // un modelo caro por el gate de coste era usar uno sin tarifa conocida.
  const outcome = evaluateCostGate("escenario X", null, 0.5);

  assert.equal(
    outcome.addToTotalUsd,
    0,
    "un coste desconocido no se suma como 0 al total",
  );
  assert.equal(outcome.violations.length, 1);
  assert.match(outcome.violations[0]!, /no calculable/);
});

test("el gate de coste falla por encima del umbral y pasa por debajo", () => {
  const over = evaluateCostGate("escenario X", 0.9, 0.5);
  assert.equal(over.violations.length, 1);
  assert.match(over.violations[0]!, /supera el umbral/);
  assert.equal(
    over.addToTotalUsd,
    0.9,
    "aunque falle, el coste real si cuenta en el total",
  );

  const under = evaluateCostGate("escenario X", 0.2, 0.5);
  assert.deepEqual(under.violations, []);
  assert.equal(under.addToTotalUsd, 0.2);
});

test("el gate de coste acepta el umbral exacto", () => {
  assert.deepEqual(evaluateCostGate("escenario X", 0.5, 0.5).violations, []);
});

test("fuera de una peticion no hay correlacion inventada", () => {
  // Worker, cron, script o test: null es la respuesta honesta. Quien registra
  // la ejecucion decide el fallback (hoy: el propio id del run).
  assert.equal(currentRequestId(), null);
  assert.equal(currentParallelGroupId(), null);
});

test("la correlacion sobrevive a los await dentro de la misma operacion", async () => {
  const observed = await runWithRequestCorrelation(
    { requestId: "req-1", parallelGroupId: "tick-1" },
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      // El punto de usar AsyncLocalStorage: el runtime de IA lee esto varios
      // await despues, sin que nadie se lo haya pasado por parametro.
      return {
        requestId: currentRequestId(),
        groupId: currentParallelGroupId(),
      };
    },
  );

  assert.deepEqual(observed, { requestId: "req-1", groupId: "tick-1" });
  // Y no se filtra fuera de la operacion.
  assert.equal(currentRequestId(), null);
});

test("dos operaciones concurrentes no se mezclan la correlacion", async () => {
  const operation = (id: string) =>
    runWithRequestCorrelation({ requestId: id }, async () => {
      await new Promise((resolve) => setTimeout(resolve, id === "a" ? 5 : 1));
      return currentRequestId();
    });

  assert.deepEqual(await Promise.all([operation("a"), operation("b")]), [
    "a",
    "b",
  ]);
});

// ---------------------------------------------------------------------------
// AI-30: retencion diferenciada de los eventos de seguridad.
// ---------------------------------------------------------------------------

test("los eventos de seguridad viven mas que el contexto que explican", () => {
  const now = new Date("2027-01-01T00:00:00.000Z");

  const contextCutoff = aiContextRetentionCutoff(now);
  const securityCutoff = aiSecurityEventRetentionCutoff(now);

  // Un evento de seguridad que caduca antes que la evidencia operativa que
  // explica no sirve de nada: su corte tiene que ser mas antiguo.
  assert.ok(
    securityCutoff < contextCutoff,
    "el corte de seguridad debe alcanzar mas atras en el tiempo",
  );
});

test("no se puede configurar una retencion de seguridad mas corta que la del contexto", () => {
  assert.throws(
    () => aiSecurityEventRetentionCutoff(new Date(), 30),
    /ai_security_event_retention_days_out_of_range/,
  );
  // El limite inferior es exactamente el horizonte del contexto.
  assert.doesNotThrow(() => aiSecurityEventRetentionCutoff(new Date(), 180));
});
