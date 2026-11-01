import assert from "node:assert/strict";
import { test } from "node:test";
import type { LoadedApiEnv } from "@e-nora/config";
import type { AuthContext } from "./auth-context.js";
import {
  getAdminAiCostModel,
  setAdminAiAgentSettings,
} from "./ai-cost-model.js";

test("Costes rechaza cambiar A01 cerrado a otro modelo antes de acceder a la base de datos", async () => {
  const result = await setAdminAiAgentSettings(
    {} as LoadedApiEnv,
    { profile: { platform_role: "platform_admin" } } as AuthContext,
    {
      settings: [
        {
          agent_code: "a01_analista_llamadas",
          runs_per_day: null,
          model: "gpt-6-luna",
        },
      ],
    },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "agent_model_fixed");
});

test("Costes rechaza un override de modelo en A02 cerrado", async () => {
  const result = await setAdminAiAgentSettings(
    {} as LoadedApiEnv,
    { profile: { platform_role: "platform_admin" } } as AuthContext,
    {
      settings: [
        {
          agent_code: "a02_monitor_negocio",
          runs_per_day: null,
          model: "gpt-6-luna",
        },
      ],
    },
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, "agent_model_fixed");
});

test("el inventario de Costes coincide con Sol aunque versiones y overrides antiguos indiquen otro modelo", async () => {
  const original = globalThis.fetch;
  const code = "a01_analista_llamadas";
  globalThis.fetch = (async (request) => {
    const url = String(request);
    let data: unknown = [];
    if (url.includes("/agent_versions?"))
      data = [
        {
          model: "gpt-6-luna",
          agent_definitions: { code, name: "Analista de llamadas" },
        },
        {
          model: "claude-sonnet-5",
          agent_definitions: {
            code: "a02_monitor_negocio",
            name: "Monitor de negocio",
          },
        },
        {
          model: "claude-sonnet-5",
          agent_definitions: { code: "a08_gestor_conocimiento", name: "Gestor de conocimiento" },
        },
      ];
    else if (url.includes("/rpc/admin_ai_run_profile"))
      data = [
        {
          agent_code: code,
          run_count: 10,
          avg_input_total: 825,
          avg_cache_read: 0,
          avg_output: 1766,
        },
      ];
    else if (url.includes("/platform_ai_agent_settings?"))
      data = [{ agent_code: code, model: "claude-opus-5", runs_per_day: null }];
    else assert.ok(url.includes("/ai_model_prices?"), "consulta inesperada");
    return new Response(JSON.stringify(data), {
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const result = await getAdminAiCostModel(
      {
        SUPABASE_URL: "https://stub.invalid",
        SUPABASE_SERVICE_ROLE_KEY: "test-key",
      } as LoadedApiEnv,
      { profile: { platform_role: "platform_admin" } } as AuthContext,
    );
    assert.ok(result.ok);
    if (!result.ok) return;
    const agent = result.data.agents.find((row) => row.code === code)!;
    assert.equal(agent.effective_model, "gpt-6.1-sol");
    assert.equal(agent.default_model, "gpt-6.1-sol");
    assert.equal(agent.model_configurable, false);
    assert.equal(agent.model_decision?.status, "closed");
    assert.equal(agent.profile.source, "estimado");
    assert.equal(agent.profile.input_total, 46667);
    assert.equal(agent.profile.output, 3396);
    const monitor = result.data.agents.find(
      (row) => row.code === "a02_monitor_negocio",
    )!;
    assert.equal(monitor.default_runs_per_day, 4.33);
    assert.equal(monitor.additional_runs_per_day, 2);
    assert.equal(monitor.effective_model, "gpt-6.1-terra");
    assert.equal(monitor.model_configurable, false);
    assert.equal(monitor.profile.input_total, 33655);
    assert.equal(monitor.profile.output, 1711.5);
    const knowledge = result.data.agents.find((row) => row.code === "a08_gestor_conocimiento")!;
    assert.equal(knowledge.effective_model, "gpt-6.1-terra");
    assert.equal(knowledge.model_configurable, false);
    assert.equal(knowledge.scheduled, false);
    assert.equal(knowledge.default_runs_per_day, 0);
    assert.equal(knowledge.profile.input_total, 37831);
    assert.equal(knowledge.profile.output, 1458);
    assert.equal(result.data.models.find((model) => model.id === knowledge.effective_model)?.provider, "openai");
    assert.equal(result.data.monitor_operation.panel_min_run_age_hours, 8);
    assert.deepEqual(result.data.monitor_operation.cadences, [
      { lookback_days: 7, min_run_age_hours: 24 },
      { lookback_days: 30, min_run_age_hours: 56 },
      { lookback_days: 90, min_run_age_hours: 168 },
    ]);
    assert.equal(
      result.data.models.find((model) => model.id === "gpt-6.1-sol")
        ?.cache_read,
      0.1,
    );
  } finally {
    globalThis.fetch = original;
  }
});
