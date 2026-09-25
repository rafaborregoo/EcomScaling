/**
 * AI-12 (Orchestration patterns): A02 (monitor) y A04 (generador de tareas)
 * corren de forma independiente sobre el mismo backlog/alertas y pueden
 * proponer la misma tarea sin saberlo -- riesgo real senalado en
 * ESTADO_GLOBAL sin mitigacion hasta ahora. `decideAgentOutput` (ai-runtime.ts)
 * es el unico punto donde una `proposed_write` de tipo task se materializa;
 * ahi es donde se cierra el gap, con el mismo patron de dedup por titulo
 * exacto normalizado que ya usaba `calls.ts` para A01 (no detecta duplicados
 * semanticos, solo el caso mas comun: dos agentes proponiendo literalmente el
 * mismo titulo).
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY. Ejecutar
 * con `npm run test:remote -w @e-nora/api` en un proyecto aislado.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { decideAgentOutput } from "./ai-runtime.js";
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
let userId = "";
let agentVersionId = "";
let context: AuthContext;

function makeAgentOutput(proposedWrites: Array<Record<string, unknown>>) {
  return admin
    .from("agent_runs")
    .insert({
      organization_id: orgId,
      agent_version_id: agentVersionId,
      actor_user_id: userId,
      trigger_type: "manual",
      objective: "Run de prueba AI-12 dedup",
      status: "succeeded",
    })
    .select("id")
    .single()
    .then(async ({ data: run, error: runError }) => {
      if (runError || !run) {
        throw new Error(
          `No se pudo crear el run de prueba: ${runError?.message}`,
        );
      }

      const { data: output, error: outputError } = await admin
        .from("agent_outputs")
        .insert({
          run_id: run.id,
          organization_id: orgId,
          output: {
            answer: "diagnostico de prueba",
            findings: [],
            recommendations: [],
            sources: [],
            proposed_writes: proposedWrites,
            confidence: "medium",
            warnings: [],
          },
          approval_required: true,
          status: "pending_approval",
        })
        .select("id")
        .single();

      if (outputError || !output) {
        throw new Error(
          `No se pudo crear la salida de prueba: ${outputError?.message}`,
        );
      }

      return output.id;
    });
}

before(async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `AI-12 Dedup Test ${RUN_TAG}`,
      slug: `ai12-dedup-test-${RUN_TAG}`,
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
    email: `ai12-dedup-${RUN_TAG}@ecomscaling.test`,
    password: "Ai12-Dedup-Test-P4ss-9!",
    email_confirm: true,
  });
  if (userError || !user.user) {
    throw new Error(
      `No se pudo crear el usuario de prueba: ${userError?.message}`,
    );
  }
  userId = user.user.id;
  await admin
    .from("profiles")
    .update({ platform_role: "platform_admin" })
    .eq("id", userId);

  const { data: agentVersion, error: agentVersionError } = await admin
    .from("agent_versions")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (agentVersionError || !agentVersion) {
    throw new Error(
      `No se encontro una version de agente activa para el test: ${agentVersionError?.message}`,
    );
  }
  agentVersionId = agentVersion.id;

  const { error: taskError } = await admin.from("tasks").insert({
    organization_id: orgId,
    title: "Revisar margen bruto de la tienda",
    source: "manual",
    priority: "medium",
    status: "pending",
    is_visible_to_client: true,
    created_by: userId,
  });
  if (taskError) {
    throw new Error(
      `No se pudo crear la tarea existente de prueba: ${taskError.message}`,
    );
  }

  context = {
    user: { id: userId },
    profile: {
      id: userId,
      full_name: null,
      avatar_url: null,
      platform_role: "platform_admin",
      is_active: true,
    },
    memberships: [
      {
        organization_id: orgId,
        role: "owner",
        accessSource: "membership",
        organization: null,
      },
    ],
    subscriptions: [],
  };
});

after(async () => {
  await admin.from("organizations").delete().eq("id", orgId);
  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
});

test("no duplica una tarea cuando otro agente ya propuso el mismo titulo (normalizado)", async () => {
  const outputId = await makeAgentOutput([
    {
      kind: "task",
      title: "  REVISAR margen bruto de la tienda  ",
      priority: "high",
    },
    {
      kind: "task",
      title: "Renegociar plazo con proveedor X",
      priority: "medium",
    },
  ]);

  const result = await decideAgentOutput(
    env,
    context,
    orgId,
    outputId,
    "approved",
    undefined,
  );
  assert.equal(
    (result as { ok: boolean }).ok,
    true,
    `se esperaba exito: ${JSON.stringify(result)}`,
  );
  const success = result as { ok: true; data: { tasks_created: number } };
  assert.equal(
    success.data.tasks_created,
    1,
    "solo la tarea genuinamente nueva debe crearse",
  );

  const { data: matchingTasks, error } = await admin
    .from("tasks")
    .select("id")
    .eq("organization_id", orgId)
    .ilike("title", "%margen bruto de la tienda%");
  assert.equal(error, null);
  assert.equal(
    matchingTasks?.length,
    1,
    "no debe existir una segunda fila duplicada de la misma tarea",
  );

  const { data: newTask } = await admin
    .from("tasks")
    .select("id")
    .eq("organization_id", orgId)
    .eq("title", "Renegociar plazo con proveedor X");
  assert.equal(
    newTask?.length,
    1,
    "la tarea genuinamente nueva si debe crearse",
  );
});

test("un consultor no puede aprobar una salida de otra organizacion", async () => {
  const consultantContext: AuthContext = {
    ...context,
    profile: { ...context.profile, platform_role: "consultant" },
  };

  const result = await decideAgentOutput(
    env,
    consultantContext,
    randomUUID(),
    randomUUID(),
    "approved",
    undefined,
  );

  assert.deepEqual(result, {
    ok: false,
    statusCode: 403,
    error: "organization_access_denied",
  });
});
