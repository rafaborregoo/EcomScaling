import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkOrganizationProviderCircuit,
  resolveAgentBudget,
  resolvePlanBudget,
  resolveProviderModel,
  shouldOpenProviderCircuit,
} from "./ai-runtime.js";

test("el circuit breaker se abre al alcanzar tres fallos recientes", () => {
  assert.equal(shouldOpenProviderCircuit(0), false);
  assert.equal(shouldOpenProviderCircuit(2), false);
  assert.equal(shouldOpenProviderCircuit(3), true);
  assert.equal(shouldOpenProviderCircuit(10), true);
});

test("el routing por agente sobrescribe solo lo configurado y conserva defaults", () => {
  const routing = {
    a02_monitor_negocio: {
      anthropicModel: "claude-sonnet-4-5",
      openaiModel: "gpt-4.1-mini",
      maxCostUsd: 0.5,
    },
  };

  assert.equal(
    resolveProviderModel(
      "a02_monitor_negocio",
      "anthropic",
      "db-model",
      routing,
    ),
    "claude-sonnet-4-5",
  );
  assert.equal(
    resolveProviderModel(
      "a04_generador_tareas",
      "openai",
      "gpt-default",
      routing,
    ),
    "gpt-default",
  );
  assert.deepEqual(resolveAgentBudget("a02_monitor_negocio", routing), {
    maxCostUsd: 0.5,
    maxToolCalls: 24,
  });
});

test("el presupuesto por plan aplica limites y complejidad sin exponer datos al cliente", () => {
  const raw = JSON.stringify({
    starter: {
      dailyBudgetUsd: 8,
      maxCostUsd: 0.25,
      maxToolCalls: 4,
      complexityMultiplier: 1.5,
    },
  });
  const policy = resolvePlanBudget("starter", raw);

  assert.deepEqual(policy, {
    dailyBudgetUsd: 8,
    maxCostUsd: 0.25,
    maxToolCalls: 4,
    complexityMultiplier: 1.5,
  });
  assert.deepEqual(resolveAgentBudget("a06_planificador_stock", {}, policy), {
    maxCostUsd: 0.375,
    maxToolCalls: 6,
  });
  assert.deepEqual(resolvePlanBudget("missing", raw), {});
});

function fakeSupabase(result: { data: unknown[] | null; error: { message: string } | null }) {
  const query = {
    select() {
      return query;
    },
    eq() {
      return query;
    },
    gte() {
      return query;
    },
    async limit() {
      return result;
    },
  };
  return { from: () => query } as unknown as SupabaseClient;
}

test("bloquea la organizacion cuando hay fallos consecutivos persistidos", async () => {
  const result = await checkOrganizationProviderCircuit(
    fakeSupabase({ data: [{ id: "1" }, { id: "2" }, { id: "3" }], error: null }),
    "00000000-0000-0000-0000-000000000001",
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.statusCode, 503);
    assert.equal(result.error, "organization_provider_circuit_open");
  }
});

test("el circuito falla cerrado si no se puede leer agent_runs", async () => {
  const result = await checkOrganizationProviderCircuit(
    fakeSupabase({ data: null, error: { message: "database unavailable" } }),
    "00000000-0000-0000-0000-000000000001",
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.statusCode, 503);
    assert.equal(result.error, "organization_provider_circuit_unavailable");
  }
});
