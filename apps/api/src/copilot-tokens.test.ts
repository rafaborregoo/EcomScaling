/**
 * El saldo del copiloto es lo primero que el usuario mira cuando le llega la
 * factura, asi que lo que se prueba aqui no es aritmetica: es que el numero de
 * la pantalla signifique lo que dice, y que quedarse a cero no deje a nadie
 * sin copiloto.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  COPILOT_MODELS,
  describeBalance,
  finDelPeriodo,
  inicioDelPeriodo,
  modelosDelPlan,
  resolveCopilotModel,
  TOKENS_POR_MENSAJE,
} from "./copilot-tokens.js";

test("el plan basico ofrece Sonnet y no Opus", () => {
  const modelos = modelosDelPlan("sonnet");
  assert.deepEqual(
    modelos.map((model) => model.id),
    ["sonnet"],
  );
});

test("el plan de arriba añade Opus, y Haiku nunca es elegible", () => {
  const modelos = modelosDelPlan("opus");
  assert.deepEqual(
    modelos.map((model) => model.id),
    ["sonnet", "opus"],
  );
  assert.equal(
    COPILOT_MODELS.find((model) => model.id === "haiku")?.selectable,
    false,
  );
});

test("sin saldo se responde con Haiku en vez de cortar", () => {
  const resuelto = resolveCopilotModel({
    requested: "opus",
    tier: "opus",
    remainingTokens: 0,
  });
  assert.equal(resuelto.model.id, "haiku");
  assert.equal(resuelto.degraded, true);
});

test("pedir Opus sin plan para Opus atiende con Sonnet, no falla", () => {
  const resuelto = resolveCopilotModel({
    requested: "opus",
    tier: "sonnet",
    remainingTokens: 500_000,
  });
  assert.equal(resuelto.model.id, "sonnet");
  assert.equal(resuelto.degraded, false);
});

test("un modelo desconocido cae al de por defecto del plan", () => {
  const resuelto = resolveCopilotModel({
    requested: "gpt-inventado",
    tier: "opus",
    remainingTokens: 500_000,
  });
  assert.equal(resuelto.model.id, "sonnet");
});

test("con saldo se respeta lo que pidio el usuario", () => {
  const resuelto = resolveCopilotModel({
    requested: "opus",
    tier: "opus",
    remainingTokens: 1,
  });
  assert.equal(resuelto.model.id, "opus");
  assert.equal(resuelto.degraded, false);
});

test("el saldo restante nunca se enseña en negativo", () => {
  const saldo = describeBalance({
    granted: 1_000_000,
    used: 1_400_000,
    tier: "sonnet",
    now: new Date("2026-09-16T10:00:00Z"),
  });
  assert.equal(saldo.remaining, 0);
  assert.equal(saldo.approx_messages_left, 0);
  assert.equal(saldo.exhausted, true);
  // El consumo real sigue estando, para quien tenga que mirarlo.
  assert.equal(saldo.used, 1_400_000);
});

test("el saldo se traduce a mensajes con el consumo real medido", () => {
  const saldo = describeBalance({
    granted: 1_000_000,
    used: 0,
    tier: "opus",
    now: new Date("2026-09-16T10:00:00Z"),
  });
  assert.equal(saldo.remaining, 1_000_000);
  assert.equal(
    saldo.approx_messages_left,
    Math.floor(1_000_000 / TOKENS_POR_MENSAJE),
  );
});

test("se renueva el 1 del mes siguiente y se dicen los dias que faltan", () => {
  const saldo = describeBalance({
    granted: 1_000_000,
    used: 250_000,
    tier: "sonnet",
    now: new Date("2026-09-16T10:00:00Z"),
  });
  assert.equal(saldo.renews_at, "2026-10-01T00:00:00.000Z");
  assert.equal(saldo.days_to_renewal, 15);
});

test("el periodo es el mes natural, incluido diciembre", () => {
  const nochevieja = new Date("2026-12-31T23:30:00Z");
  assert.equal(
    inicioDelPeriodo(nochevieja).toISOString(),
    "2026-12-01T00:00:00.000Z",
  );
  assert.equal(
    finDelPeriodo(nochevieja).toISOString(),
    "2027-01-01T00:00:00.000Z",
  );
});
