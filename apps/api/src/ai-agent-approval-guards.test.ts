import assert from "node:assert/strict";
import { test } from "node:test";
import {
  approvalCandidate,
  decideAgentOutput,
  submitConsultantChatFeedback,
} from "./ai-runtime.js";
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

/**
 * Contrato ampliado el 2026-09-06: el owner de un cliente SIN consultor
 * asignado si decide sobre sus propias salidas de IA.
 *
 * Antes (FE-07) no podia nunca, y eso dejaba a esos clientes sin nadie que
 * aprobara: el orquestador lanzaba 8 agentes dos veces al dia y sus salidas se
 * quedaban en `pending_approval` para siempre. Quien decide depende ahora de
 * si la organizacion tiene consultor, asi que la parte que no toca la base se
 * prueba aqui con `approvalCandidate`.
 */
test("el owner de un cliente es candidato a decidir; un tercero no", async () => {
  assert.equal(
    approvalCandidate({
      platformRole: "owner",
      membershipRole: "owner",
      accessSource: "membership",
    }),
    "client",
  );
  assert.equal(
    approvalCandidate({
      platformRole: "user",
      membershipRole: "member",
      accessSource: "membership",
    }),
    "none",
    "un miembro raso no decide sobre lo que la IA escribe",
  );
  assert.equal(
    approvalCandidate({
      platformRole: "consultant",
      membershipRole: "consultant",
      accessSource: "consultant_assignment",
    }),
    "privileged",
  );
});

test("la membresia VIRTUAL de un consultor no entra por la puerta del cliente", async () => {
  // Un consultor lleva rol en su membresia virtual. Sin mirar `accessSource`,
  // un consultor no asignado a esta organizacion pasaria como si fuera su
  // dueño -- y la puerta del cliente no comprueba asignacion.
  assert.equal(
    approvalCandidate({
      platformRole: "user",
      membershipRole: "owner",
      accessSource: "consultant_assignment",
    }),
    "none",
  );
});

test("quien no es candidato recibe 403 sin tocar la base", async () => {
  // Con env vacio: si el guard consultara Supabase antes de rechazar, esto
  // reventaria en vez de devolver el 403.
  const result = await decideAgentOutput(
    env,
    {
      ...context("owner"),
      memberships: [
        {
          organization_id: organizationId,
          role: "member",
          accessSource: "membership",
          organization: null,
        },
      ],
    },
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

test("el feedback solo acepta las dos señales de utilidad", async () => {
  const result = await submitConsultantChatFeedback(
    env,
    context("consultant"),
    organizationId,
    "message-id",
    "maybe",
    undefined,
  );

  assert.deepEqual(result, {
    ok: false,
    statusCode: 400,
    error: "invalid_feedback_rating",
  });
});
