import assert from "node:assert/strict";
import { test } from "node:test";
import { decideAgentOutput } from "./ai-runtime.js";
import type { AuthContext } from "./auth-context.js";

const organizationId = "org-approval-guards";
const env = {} as Parameters<typeof decideAgentOutput>[0];

function context(platformRole: "owner" | "consultant"): AuthContext {
  return {
    user: { id: "user-approval-guards" },
    profile: {
      id: "user-approval-guards",
      full_name: null,
      avatar_url: null,
      platform_role: platformRole,
      is_active: true,
    },
    memberships: [
      {
        organization_id: organizationId,
        role: "owner",
        accessSource: "membership",
        organization: null,
      },
    ],
    subscriptions: [],
  };
}

test("solo consultor o platform admin puede pasar el guard de aprobacion", async () => {
  const result = await decideAgentOutput(
    env,
    context("consultant"),
    organizationId,
    "output-id",
    "invalid",
    undefined,
  );

  assert.deepEqual(result, {
    ok: false,
    statusCode: 400,
    error: "invalid_decision",
  });
});

test("un owner de cliente no puede aprobar salidas IA aunque pertenezca a la organizacion", async () => {
  const result = await decideAgentOutput(
    env,
    context("owner"),
    organizationId,
    "output-id",
    "approved",
    undefined,
  );

  assert.deepEqual(result, {
    ok: false,
    statusCode: 403,
    error: "approval_denied",
    message: "Solo un consultor o platform admin puede aprobar salidas IA.",
  });
});

test("una organizacion sin membership no puede alcanzar el guard de decision", async () => {
  const result = await decideAgentOutput(
    env,
    { ...context("consultant"), memberships: [] },
    organizationId,
    "output-id",
    "approved",
    undefined,
  );

  assert.deepEqual(result, {
    ok: false,
    statusCode: 403,
    error: "organization_access_denied",
  });
});
