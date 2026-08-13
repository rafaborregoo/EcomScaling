/**
 * Q-012 (2026-07-29, decision de Rafa): ademas del limite por turno que ya
 * existia (DEFAULT_AGENT_BUDGET), un tope diario por organizacion --
 * `checkOrganizationDailyBudget` (apps/api/src/ai-runtime.ts) suma
 * `estimated_cost_usd` de `agent_runs` desde el inicio del dia UTC para la
 * organizacion y bloquea turnos nuevos si se supera. Test directo contra
 * Supabase remoto real (sin invocar al LLM: solo se prueba el chequeo de
 * presupuesto, no un turno de agente completo).
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.
 * Ejecutar con `npm run test -w @ecomscaling/api`.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";
import { checkOrganizationDailyBudget } from "./ai-runtime.js";

const env = loadApiEnv(process.env);

const admin: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

const RUN_TAG = `${Date.now()}`;

let orgId = "";
let agentVersionId = "";

async function insertAgentRun(estimatedCostUsd: number, startedAt: Date) {
  const { error } = await admin.from("agent_runs").insert({
    organization_id: orgId,
    agent_version_id: agentVersionId,
    trigger_type: "manual",
    objective: `AI-09 daily budget test run ${RUN_TAG}`,
    status: "succeeded",
    estimated_cost_usd: estimatedCostUsd,
    started_at: startedAt.toISOString(),
  });
  if (error) {
    throw new Error(
      `No se pudo sembrar el agent_run de prueba: ${error.message}`,
    );
  }
}

before(async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `AI-09 Daily Budget Test ${RUN_TAG}`,
      slug: `ai09-daily-budget-test-${RUN_TAG}`,
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
});

after(async () => {
  await admin.from("organizations").delete().eq("id", orgId);
});

test("sin runs hoy, el presupuesto diario no esta agotado", async () => {
  const result = await checkOrganizationDailyBudget(admin, orgId, 5);
  assert.equal(result.ok, true);
});

test("gasto de hoy por debajo del limite no bloquea", async () => {
  await insertAgentRun(3, new Date());
  const result = await checkOrganizationDailyBudget(admin, orgId, 5);
  assert.equal(result.ok, true);
});

test("gasto de hoy igual o por encima del limite bloquea con 429", async () => {
  await insertAgentRun(2.5, new Date());
  // Acumulado hoy: 3 + 2.5 = 5.5, >= limite de 5.
  const result = await checkOrganizationDailyBudget(admin, orgId, 5);
  assert.equal(result.ok, false);
  if (result.ok === false) {
    assert.equal(result.statusCode, 429);
    assert.equal(result.error, "organization_daily_budget_exceeded");
  }
});

test("runs de dias anteriores no cuentan para el tope de hoy", async () => {
  const freshOrgTag = `${RUN_TAG}-yesterday`;
  const { data: freshOrg, error: freshOrgError } = await admin
    .from("organizations")
    .insert({
      display_name: `AI-09 Daily Budget Yesterday ${freshOrgTag}`,
      slug: `ai09-daily-budget-yesterday-${freshOrgTag}`,
      status: "active",
    })
    .select("id")
    .single();
  if (freshOrgError || !freshOrg) {
    throw new Error(
      `No se pudo crear la organizacion de prueba: ${freshOrgError?.message}`,
    );
  }

  try {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const { error } = await admin.from("agent_runs").insert({
      organization_id: freshOrg.id,
      agent_version_id: agentVersionId,
      trigger_type: "manual",
      objective: `AI-09 daily budget test run (ayer) ${freshOrgTag}`,
      status: "succeeded",
      estimated_cost_usd: 100,
      started_at: yesterday.toISOString(),
    });
    if (error) {
      throw new Error(
        `No se pudo sembrar el agent_run de ayer: ${error.message}`,
      );
    }

    const result = await checkOrganizationDailyBudget(admin, freshOrg.id, 5);
    assert.equal(result.ok, true);
  } finally {
    await admin.from("organizations").delete().eq("id", freshOrg.id);
  }
});

test("si falla la consulta del limite, el runtime bloquea en fail-closed", async () => {
  const failingSupabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async gte() {
                  return {
                    data: null,
                    error: { message: "database unavailable" },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  const result = await checkOrganizationDailyBudget(failingSupabase, orgId, 5);
  assert.equal(result.ok, false);
  if (result.ok === false) {
    assert.equal(result.statusCode, 503);
    assert.equal(result.error, "organization_daily_budget_unavailable");
  }
});
