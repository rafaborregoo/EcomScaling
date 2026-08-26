/**
 * AI-01: "la reaprobacion devuelve 404 en vez de un 200/409 que distinga 'ya
 * estaba aprobada' de 'recurso inexistente'" era un gap listado sin ningun
 * test. `decideSummary` (calls.ts) hacia un UPDATE condicionado a
 * `status in ('draft','pending_approval')`; si no afectaba ninguna fila,
 * devolvia 404 `pending_summary_not_found` tanto si el id no existia como si
 * ya habia sido decidido antes (reintento o doble clic del consultor).
 * Corregido: ahora distingue con una consulta de seguimiento sin el filtro de
 * `status` -- 404 solo si el id no existe de verdad, 409
 * `summary_already_decided` (con el `current_status` real) si ya fue
 * aprobado/rechazado.
 *
 * `decideSummary` recibe el `AuthContext` ya resuelto y usa un cliente de
 * service_role internamente, asi que no hace falta un login real -- se
 * construye un `AuthContext` minimo de `platform_admin` a mano.
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY. Ejecutar
 * con `npm run test:remote -w @ecomscaling/api` en un proyecto aislado.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";
import { decideSummary } from "./calls.js";
import type { AuthContext } from "./auth-context.js";

const env = loadApiEnv(process.env);

const admin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

const RUN_TAG = `${Date.now()}`;

let orgId = "";
let creatorUserId = "";
let callId = "";
let summaryId = "";
let platformAdminContext: AuthContext;

before(async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `AI-01 Decision Status Test ${RUN_TAG}`,
      slug: `ai01-decision-status-test-${RUN_TAG}`,
      status: "active",
    })
    .select("id")
    .single();

  if (orgError || !org) {
    throw new Error(
      `No se pudo crear la organizacion de prueba: ${orgError?.message}`,
    );
  }
  orgId = org.id;

  const { data: user, error: userError } = await admin.auth.admin.createUser({
    email: `ai01-decision-status-${RUN_TAG}@ecomscaling.test`,
    password: "Ai01-Decision-Status-P4ss-9!",
    email_confirm: true,
  });

  if (userError || !user.user) {
    throw new Error(
      `No se pudo crear el usuario de prueba: ${userError?.message}`,
    );
  }
  creatorUserId = user.user.id;

  await admin
    .from("profiles")
    .update({ platform_role: "platform_admin" })
    .eq("id", creatorUserId);

  const { data: call, error: callError } = await admin
    .from("consulting_calls")
    .insert({
      organization_id: orgId,
      title: `AI-01 Decision Status Call ${RUN_TAG}`,
      status: "held",
      created_by: creatorUserId,
    })
    .select("id")
    .single();

  if (callError || !call) {
    throw new Error(
      `No se pudo crear la llamada de prueba: ${callError?.message}`,
    );
  }
  callId = call.id;

  const { data: summary, error: summaryError } = await admin
    .from("call_ai_summaries")
    .insert({
      call_id: callId,
      organization_id: orgId,
      summary: "Resumen de prueba AI-01.",
      key_points: { proposed_tasks: [] },
      status: "pending_approval",
    })
    .select("id")
    .single();

  if (summaryError || !summary) {
    throw new Error(
      `No se pudo crear el resumen de prueba: ${summaryError?.message}`,
    );
  }
  summaryId = summary.id;

  // BE-01 (2026-07-28): `memberships: []` funcionaba antes solo por el bug
  // real corregido en `calls.ts:requireOrganizationAccess` (un platform_admin
  // pasaba el chequeo de organizacion sin necesitar una membership real ni
  // virtual). El `resolveAuthContext` real siempre puebla una membership
  // virtual para platform_admin en cada organizacion -- este fixture manual
  // debe reflejar lo mismo para seguir siendo representativo.
  platformAdminContext = {
    user: { id: creatorUserId },
    profile: {
      id: creatorUserId,
      full_name: null,
      avatar_url: null,
      platform_role: "platform_admin",
      is_active: true,
    },
    memberships: [
      {
        organization_id: orgId,
        role: "consultant",
        accessSource: "platform_admin",
        organization: null,
      },
    ],
    subscriptions: [],
  };
});

after(async () => {
  if (creatorUserId) {
    await admin.auth.admin.deleteUser(creatorUserId);
  }
  if (orgId) {
    await admin.from("organizations").delete().eq("id", orgId);
  }
});

test("primera decision sobre un resumen pending_approval: aprueba con 200", async () => {
  const result = await decideSummary(
    env,
    platformAdminContext,
    orgId,
    summaryId,
    "approved",
    undefined,
  );

  assert.equal(
    (result as { ok: boolean }).ok,
    true,
    `se esperaba exito, se obtuvo: ${JSON.stringify(result)}`,
  );
});

test("reaprobar el mismo resumen ya publicado: 409 summary_already_decided con el status real, no 404", async () => {
  const result = await decideSummary(
    env,
    platformAdminContext,
    orgId,
    summaryId,
    "approved",
    undefined,
  );

  assert.equal((result as { ok: boolean }).ok, false);
  const failure = result as {
    ok: false;
    statusCode: number;
    error: string;
    current_status: string;
  };
  assert.equal(failure.statusCode, 409);
  assert.equal(failure.error, "summary_already_decided");
  assert.equal(failure.current_status, "published");
});

test("decidir sobre un summaryId que no existe de verdad: sigue siendo 404 pending_summary_not_found", async () => {
  const result = await decideSummary(
    env,
    platformAdminContext,
    orgId,
    "00000000-0000-0000-0000-000000000000",
    "approved",
    undefined,
  );

  assert.equal((result as { ok: boolean }).ok, false);
  const failure = result as { ok: false; statusCode: number; error: string };
  assert.equal(failure.statusCode, 404);
  assert.equal(failure.error, "pending_summary_not_found");
});
