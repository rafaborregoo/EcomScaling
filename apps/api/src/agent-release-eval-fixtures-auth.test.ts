import assert from "node:assert/strict";
import test from "node:test";
import type { AuthContext } from "./auth-context.js";
import { createAgentReleaseEvalFixture, listAgentReleaseEvalFixtures, runAgentReleaseEvalAsPlatformAdmin } from "./agent-release-eval-fixtures.js";

test("solo platform_admin puede leer o escribir fixtures de release", async () => {
  const env = {} as never;
  const auth = {
    user: { id: "consultant-1" },
    profile: { platform_role: "consultant" },
    memberships: [],
    subscriptions: [],
  } as unknown as AuthContext;
  const list = await listAgentReleaseEvalFixtures(env, auth, {});
  const create = await createAgentReleaseEvalFixture(env, auth, {});
  const run = await runAgentReleaseEvalAsPlatformAdmin(env, auth, { candidateVersionId: "candidate", fixtureIds: ["fixture"] });

  assert.deepEqual(list, { ok: false, statusCode: 403, error: "platform_admin_required" });
  assert.deepEqual(create, { ok: false, statusCode: 403, error: "platform_admin_required" });
  assert.deepEqual(run, { ok: false, statusCode: 403, error: "platform_admin_required" });
});
