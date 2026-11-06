import assert from "node:assert/strict";
import test from "node:test";
import { getPlanDiagnostic, orchestratorScopesForAgent, runPlanAgent } from "./ai-runtime.js";

const unaffiliatedContext = { memberships: [] } as never;
const emptyEnv = {} as never;

test("A04 cache lookup authorizes the organization before resolving a store", async () => {
  const result = await getPlanDiagnostic(
    emptyEnv,
    unaffiliatedContext,
    "organization-b",
    "day",
    "store-from-organization-b",
  );

  assert.deepEqual(result, {
    ok: false,
    statusCode: 403,
    error: "organization_access_denied",
  });
});

test("A04 generation authorizes the organization before resolving a store or provider", async () => {
  const result = await runPlanAgent(
    emptyEnv,
    unaffiliatedContext,
    "organization-b",
    "day",
    "store-from-organization-b",
  );

  assert.deepEqual(result, {
    ok: false,
    statusCode: 403,
    error: "organization_access_denied",
  });
});

test("A04 cron generates store scopes and the organization aggregate", () => {
  assert.deepEqual(orchestratorScopesForAgent("a04_generador_tareas", [
    { storeId: "store-a", connectionId: "connection-a" },
    { storeId: "store-b", connectionId: "connection-b" },
  ]), [
    { storeId: "store-a", connectionId: "connection-a" },
    { storeId: "store-b", connectionId: "connection-b" },
    { storeId: null, connectionId: null },
  ]);
});
test("A17 cron comparte el plan de la tienda entre cliente y consultor", () => {
  const stores = [{ storeId: "store-1", connectionId: "connection-1" }];
  assert.deepEqual(orchestratorScopesForAgent("a17_plan_semanal", stores), stores);
  assert.deepEqual(orchestratorScopesForAgent("a17_plan_semanal", []), []);
});

test("A18 cron genera exactamente un plan mensual por tienda, compartido entre roles", () => {
  const stores = [{ storeId: "store-a", connectionId: "connection-a" }, { storeId: "store-b", connectionId: "connection-b" }];
  assert.deepEqual(orchestratorScopesForAgent("a18_plan_mensual", stores), stores);
  assert.deepEqual(orchestratorScopesForAgent("a18_plan_mensual", []), []);
});
