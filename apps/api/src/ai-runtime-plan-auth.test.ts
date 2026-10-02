import assert from "node:assert/strict";
import test from "node:test";
import { getPlanDiagnostic, runPlanAgent } from "./ai-runtime.js";

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
