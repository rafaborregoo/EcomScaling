import assert from "node:assert/strict";
import test from "node:test";
import { resolveAgentModel, scaledMinRunAgeMs } from "./agent-schedule.js";

const HOUR = 60 * 60 * 1000;

test("sin ajuste se mantiene el intervalo de diseño", () => {
  assert.equal(scaledMinRunAgeMs(20 * HOUR, 1, null), 20 * HOUR);
});

test("el intervalo se escala con las ejecuciones pedidas", () => {
  // Diseño 2/día con 20 h; pedir 1/día dobla el intervalo y pedir 4 lo parte.
  assert.equal(scaledMinRunAgeMs(20 * HOUR, 2, 1), 40 * HOUR);
  assert.equal(scaledMinRunAgeMs(20 * HOUR, 2, 4), 10 * HOUR);
  // Nunca baja de una hora.
  assert.equal(scaledMinRunAgeMs(20 * HOUR, 1, 48), HOUR);
});

test("modelo: cliente > plataforma > defecto; A02 ignora al cliente", () => {
  assert.equal(resolveAgentModel({ agentCode: "a04_generador_tareas", versionModel: "claude-sonnet-5", clientModel: null, platformModel: null }), "gpt-6-luna");
  assert.equal(resolveAgentModel({ agentCode: "a04_generador_tareas", versionModel: "claude-sonnet-5", clientModel: null, platformModel: "claude-sonnet-5" }), "claude-sonnet-5");
  assert.equal(resolveAgentModel({ agentCode: "a04_generador_tareas", versionModel: "claude-sonnet-5", clientModel: "gpt-6-sol", platformModel: "claude-sonnet-5" }), "gpt-6-sol");
  assert.equal(resolveAgentModel({ agentCode: "a02_monitor_negocio", versionModel: "claude-sonnet-5", clientModel: "gpt-6-luna", platformModel: null }), "claude-sonnet-5");
  assert.equal(resolveAgentModel({ agentCode: "a02_monitor_negocio", versionModel: "claude-sonnet-5", clientModel: null, platformModel: "claude-opus-5" }), "claude-opus-5");
  assert.equal(resolveAgentModel({ agentCode: "a19_arquitecto_camino", versionModel: "x", clientModel: null, platformModel: null }), "gpt-6-sol");
});
