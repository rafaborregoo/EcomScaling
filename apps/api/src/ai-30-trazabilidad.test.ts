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
  stalledAgentRunCutoff,
} from "./ai-context-retention.js";
import { describeProviderRedundancy } from "./ai-runtime.js";
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

// AI-30 (2026-09-09): el fallback R-020 llevaba meses escrito y probado, pero
// `OPENAI_API_KEY` no estaba declarada en deploy/docker-compose.prod.yml. Entre
// el 3 y el 9 de septiembre murieron 61 ejecuciones por saldo de Anthropic
// agotado con un segundo proveedor que no podia entrar. Estos tests fijan la
// comprobacion que faltaba: no la de "hay clave", sino la de "hay red".
test("un solo proveedor se declara como sin red, no como configuracion correcta", () => {
  const solo = describeProviderRedundancy({ ANTHROPIC_API_KEY: "sk-ant" });

  assert.equal(solo.level, "single_provider");
  assert.match(solo.message, /SIN RED/);
  // Tiene que decir QUE falta, no solo que algo falta.
  assert.match(solo.message, /OPENAI_API_KEY/);
});

test("con los dos proveedores hay fallback, y sin ninguno la IA esta apagada", () => {
  assert.equal(
    describeProviderRedundancy({
      ANTHROPIC_API_KEY: "sk-ant",
      OPENAI_API_KEY: "sk-oai",
    }).level,
    "redundant",
  );
  assert.equal(describeProviderRedundancy({}).level, "none");

  // Una cadena vacia es "no configurada": los .env se copian del .env.example
  // con las claves opcionales en blanco.
  assert.equal(
    describeProviderRedundancy({ ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "" })
      .level,
    "none",
  );
});

// El reaper marca ejecuciones como `timeout`. Un umbral demasiado corto no es
// un bug menor: cerraria como fallidas ejecuciones que siguen vivas y el panel
// mentiria sobre runs que en realidad terminaron bien.
test("el umbral de ejecucion colgada no puede bajar de un turno largo legitimo", () => {
  assert.throws(
    () => stalledAgentRunCutoff(new Date(), 5),
    /ai_stalled_run_minutes_out_of_range/,
  );
  assert.throws(
    () => stalledAgentRunCutoff(new Date(), 10_000),
    /ai_stalled_run_minutes_out_of_range/,
  );

  const now = new Date("2026-09-09T12:00:00.000Z");
  assert.equal(
    stalledAgentRunCutoff(now).toISOString(),
    "2026-09-09T11:30:00.000Z",
  );
});
