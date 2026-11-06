import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultAgentModel,
  resolveAgentModel,
  scaledMinRunAgeMs,
} from "./agent-schedule.js";

const HOUR = 60 * 60 * 1000;

test("A17 cerrado fija Sonnet por encima de preferencias antiguas", () => {
  assert.equal(resolveAgentModel({ agentCode: "a17_plan_semanal", versionModel: "gpt-6-luna", clientModel: "gpt-6.1-sol", platformModel: "claude-opus-5-5" }), "claude-sonnet-5-5");
});

test("A01 cerrado usa el ID exacto de Sol aunque haya ajustes antiguos de plataforma o cliente", () => {
  assert.equal(
    defaultAgentModel("a01_analista_llamadas", "claude-sonnet-5"),
    "gpt-6.1-sol",
  );
  assert.equal(
    resolveAgentModel({
      agentCode: "a01_analista_llamadas",
      versionModel: "claude-sonnet-5",
      clientModel: "gpt-6-luna",
      platformModel: "claude-opus-5",
    }),
    "gpt-6.1-sol",
  );
});

test("sin ajuste se mantiene el intervalo de diseño", () => {
  assert.equal(scaledMinRunAgeMs(20 * HOUR, 1, null), 20 * HOUR);
});

test("A04 cerrado mantiene Terra frente a ajustes anteriores", () => {
  assert.equal(defaultAgentModel("a04_generador_tareas", "gpt-6-luna"), "gpt-6.1-terra");
  assert.equal(resolveAgentModel({ agentCode: "a04_generador_tareas", versionModel: "gpt-6-luna", clientModel: "gpt-6.1-sol", platformModel: "claude-opus-5" }), "gpt-6.1-terra");
});

test("A05 cerrado mantiene Sol frente a ajustes anteriores", () => {
  assert.equal(defaultAgentModel("a05_estrategia_campanas", "gpt-6-luna"), "gpt-6.1-sol");
  assert.equal(resolveAgentModel({ agentCode: "a05_estrategia_campanas", versionModel: "gpt-6-luna", clientModel: "gpt-6.1-terra", platformModel: "claude-opus-5" }), "gpt-6.1-sol");
});

test("el intervalo se escala con las ejecuciones pedidas", () => {
  // Diseño 2/día con 20 h; pedir 1/día dobla el intervalo y pedir 4 lo parte.
  assert.equal(scaledMinRunAgeMs(20 * HOUR, 2, 1), 40 * HOUR);
  assert.equal(scaledMinRunAgeMs(20 * HOUR, 2, 4), 10 * HOUR);
  // Nunca baja de una hora.
  assert.equal(scaledMinRunAgeMs(20 * HOUR, 1, 48), HOUR);
});

test("modelo de especialistas: plataforma > defecto; la preferencia del cliente no lo cambia", () => {
  assert.equal(
    resolveAgentModel({
      agentCode: "a06_planificador_stock",
      versionModel: "claude-sonnet-5",
      clientModel: null,
      platformModel: null,
    }),
    "claude-haiku-5-5",
  );
  assert.equal(
    resolveAgentModel({
      agentCode: "a06_planificador_stock",
      versionModel: "claude-sonnet-5",
      clientModel: null,
      platformModel: "claude-sonnet-5",
    }),
    "claude-haiku-5-5",
  );
  assert.equal(
    resolveAgentModel({
      agentCode: "a06_planificador_stock",
      versionModel: "claude-sonnet-5",
      clientModel: "gpt-6-sol",
      platformModel: "claude-sonnet-5",
    }),
    "claude-haiku-5-5",
  );
  assert.equal(
    resolveAgentModel({
      agentCode: "a02_monitor_negocio",
      versionModel: "claude-sonnet-5",
      clientModel: "gpt-6-luna",
      platformModel: null,
    }),
    "gpt-6.1-terra",
  );
  assert.equal(
    resolveAgentModel({
      agentCode: "a02_monitor_negocio",
      versionModel: "claude-sonnet-5",
      clientModel: null,
      platformModel: "claude-opus-5",
    }),
    "gpt-6.1-terra",
  );
  assert.equal(
    resolveAgentModel({
      agentCode: "a19_arquitecto_camino",
      versionModel: "x",
      clientModel: null,
      platformModel: null,
    }),
    "claude-opus-5-5",
  );
});

test("la elección heredada sigue disponible solo para el copiloto", () => {
  assert.equal(
    resolveAgentModel({
      agentCode: "a09_copiloto_consultor",
      versionModel: "claude-sonnet-5",
      clientModel: "claude-opus-5",
      platformModel: "gpt-6-luna",
    }),
    "claude-opus-5",
  );
  assert.equal(
    resolveAgentModel({
      agentCode: "a06_planificador_stock",
      versionModel: "claude-sonnet-5",
      clientModel: "claude-opus-5",
      platformModel: null,
    }),
    "claude-haiku-5-5",
  );
});
