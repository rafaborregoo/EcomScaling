import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  appendMonthlyInitiativeDetails,
  appendWeeklyDeliveryDetails,
  readA18InitiativeChange,
  readInitiativeMeasurement,
  readProposedMilestoneId,
  readWeeklyDeliveryContract,
  shouldFallbackToCurrentMilestone,
} from "./agent-task-delivery.js";

test("A17 task descriptions retain owner, closure test, metric window and relative deadline", () => {
  assert.equal(
    appendWeeklyDeliveryDetails("Preparar la prueba.", {
      owner_role: "cliente",
      completion_criteria: "La variante queda aprobada y publicada.",
      expected_metric: "Conversión de sesión a pedido; revisar tras 14 días.",
      due_hint: "Antes del viernes de esta semana",
    }, "a17_plan_semanal"),
    "Preparar la prueba.\n\nRol de ejecución: cliente.\nCriterio de cierre: La variante queda aprobada y publicada.\nMétrica y ventana de revisión: Conversión de sesión a pedido; revisar tras 14 días.\nPlazo orientativo: Antes del viernes de esta semana.",
  );
});

test("A17 entrega contract is persisted as bounded, typed metadata", () => {
  assert.deepEqual(
    readWeeklyDeliveryContract({
      owner_role: "consultor",
      completion_criteria: ` ${"x".repeat(501)} `,
      expected_metric: "Ingresos atribuibles; 7 días",
      due_hint: "  viernes  ",
    }),
    {
      owner_role: "consultor",
      completion_criteria: "x".repeat(500),
      expected_metric: "Ingresos atribuibles; 7 días",
      due_hint: "viernes",
    },
  );
  assert.deepEqual(
    readWeeklyDeliveryContract({ owner_role: "admin", due_hint: " " }),
    { owner_role: null, completion_criteria: null, expected_metric: null, due_hint: null },
  );
});

test("weekly delivery hints are not converted into fabricated dates and do not affect other agents", () => {
  assert.equal(
    appendWeeklyDeliveryDetails("Keep original.", { due_hint: "el viernes" }, "a04_generador_tareas"),
    "Keep original.",
  );
  assert.equal(
    appendWeeklyDeliveryDetails("Keep original.", { due_hint: "el viernes" }, "a17_plan_semanal"),
    "Keep original.\n\nPlazo orientativo: el viernes.",
  );
});

test("A18 measurement and exact Camino milestone survive task materialization without invented fallbacks", () => {
  const fields = {
    milestone_id: "83000000-0000-4000-8000-000000000018",
    initiative_measurement: {
      metric_name: "Margen de contribución",
      unit: "%",
      baseline: 18.5,
      target: null,
      evaluation_window: "30 días desde la activación",
    },
  };
  assert.deepEqual(readInitiativeMeasurement(fields), fields.initiative_measurement);
  assert.equal(readProposedMilestoneId(fields.milestone_id), fields.milestone_id);
  assert.equal(readProposedMilestoneId("not-a-uuid"), null);
  assert.equal(shouldFallbackToCurrentMilestone("a18_plan_mensual"), false);
  assert.equal(shouldFallbackToCurrentMilestone("a17_plan_semanal"), true);
  assert.equal(
    appendMonthlyInitiativeDetails("Reducir descuentos sin margen.", fields, "a18_plan_mensual"),
    "Reducir descuentos sin margen.\n\nMedición de la iniciativa: Margen de contribución.\nLínea base: 18.5 %; objetivo: no disponible.\nVentana de evaluación: 30 días desde la activación.\nVinculada al hito de Camino indicado en esta propuesta.",
  );
});

test("A17 v5 builds on the currently active v4 prompt and defines the full weekly contract", async () => {
  const migration = await readFile(
    new URL("../../../supabase/migrations/20261115650000_a17_weekly_task_quality_contract.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /a17_plan_semanal_system' and version = 'v4'/);
  assert.match(migration, /'v5', 'claude-sonnet-5', 'a17_plan_semanal_system', 'v5'/);
  for (const field of ["owner_role", "completion_criteria", "expected_metric", "due_hint"]) {
    assert.ok(migration.includes(field), `missing ${field} from the versioned contract`);
  }
  assert.match(migration, /nunca fuerces un/i);
  assert.match(migration, /no autorizan cambios/i);
});

test("A17 v6 adds fresh approved specialist context without replacing A02 or the active Camino", async () => {
  const migration = await readFile(
    new URL("../../../supabase/migrations/20261115660000_a17_weekly_specialist_context.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /a17_plan_semanal_system' and version = 'v5'/);
  assert.match(migration, /'v6'.*'a17_plan_semanal_system'.*'v6'/s);
  assert.match(migration, /diagnósticos exitosos, aprobados\/publicados, recientes y de la misma tienda/i);
  assert.match(migration, /no relances agentes/i);
});

test("A18 v5 and A17 v7 preserve a typed Camino initiative handoff", async () => {
  const migration = await readFile(
    new URL("../../../supabase/migrations/20261115670000_a18_initiative_camino_handoff.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /a18_plan_mensual_system' and version = 'v4'/);
  assert.match(migration, /a17_plan_semanal_system' and p\.version = 'v6'/);
  assert.match(migration, /'v5', v\.model, 'a18_plan_mensual_system', 'v5'/);
  assert.match(migration, /'v7', v\.model, 'a17_plan_semanal_system', 'v7'/);
  assert.match(migration, /milestone_id/);
  assert.match(migration, /initiative_measurement/);
  assert.match(migration, /null (nunca )?significa cero/i);
});

test("A18 v6 consumes server workload counts without inventing available capacity", async () => {
  const migration = await readFile(
    new URL("../../../supabase/migrations/20261115794000_a18_observed_capacity_gate.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /a18_plan_mensual_system' and p\.version = 'v5'/);
  assert.match(migration, /'v6', v\.model, 'a18_plan_mensual_system', 'v6'/);
  assert.match(migration, /available_capacity_hours=null/);
  assert.match(migration, /no conviertas conteos o bandas en horas/i);
  assert.match(migration, /no la interpretes como cero/i);
});

test("A18 initiative changes require an exact task identity and supported action", () => {
  const id = "83000000-0000-4000-8000-000000000018";
  assert.deepEqual(readA18InitiativeChange({
    action: "replace",
    previous_task_id: id.toUpperCase(),
    previous_task_title: "Mejorar el margen",
  }), {
    action: "replace",
    previous_task_id: id,
    previous_task_title: "Mejorar el margen",
  });
  assert.deepEqual(readA18InitiativeChange({
    action: "retire",
    previous_task_id: id,
    previous_task_title: "Mejorar el margen",
  })?.action, "retire");
  assert.equal(readA18InitiativeChange({ action: "delete", previous_task_id: id, previous_task_title: "x" }), null);
  assert.equal(readA18InitiativeChange({ action: "replace", previous_task_id: "not-a-uuid", previous_task_title: "x" }), null);
  assert.equal(readA18InitiativeChange({ action: "replace", previous_task_id: id, previous_task_title: " " }), null);
});

test("A18 v7 applies versioned replacement only through the human approval RPC", async () => {
  const migration = await readFile(
    new URL("../../../supabase/migrations/20261115795000_a18_versioned_replanning.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /for update/i);
  assert.match(migration, /v_previous\.store_id is distinct from p_store_id/i);
  assert.match(migration, /v_previous\.status not in \('pending', 'in_progress'\)/i);
  assert.match(migration, /lifecycle_status', case when p_action = 'retire' then 'retired' else 'superseded' end/i);
  assert.match(migration, /'supersedes_task_id', p_previous_task_id/i);
  assert.match(migration, /grant execute on function public\.approve_a18_monthly_initiative_change[\s\S]*to service_role/i);
  assert.match(migration, /'v7', v\.model, 'a18_plan_mensual_system', 'v7'/);
});
