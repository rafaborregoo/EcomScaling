import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { caminoPlanOutputSchema, type CaminoPlanOutput } from "@e-nora/ai";
import { adjustCaminoProposal } from "./camino-proposal-adjustment.js";

const sample: CaminoPlanOutput = {
  plan_name: "Crecimiento sostenible",
  horizon_months: 4,
  diagnosis: "La conversión limita el crecimiento.",
  goal: {
    metric_key: "net_sales", metric_label: "Ingresos netos", unit: "money", currency_code: "EUR",
    baseline: 10000, target: 15000, target_offset_days: 120, rationale: "Escenario condicionado",
    assumptions: [], confidence: "medium",
  },
  phases: [{
    name: "Mejorar conversión", description: "Medir y probar", rationale: "Primero resolver la fuga",
    evidence: [], milestones: [{ name: "Prueba", description: "A/B", target_offset_days: 60, success_metric: "Sube la conversión" }],
  }],
  sources: [], confidence: "medium", warnings: [],
};

describe("edición humana del objetivo y plazo A19", () => {
  it("ajusta target y horizonte sin mutar la salida original y reubica fechas proporcionalmente", () => {
    const adjusted = adjustCaminoProposal(sample, 6, 18000);
    assert.equal(adjusted.goal?.target, 18000);
    assert.equal(adjusted.goal?.target_offset_days, 180);
    assert.equal(adjusted.horizon_months, 6);
    assert.equal(adjusted.phases[0]?.milestones[0]?.target_offset_days, 90);
    assert.equal(sample.goal?.target, 15000);
    assert.equal(sample.phases[0]?.milestones[0]?.target_offset_days, 60);
    assert.equal(caminoPlanOutputSchema.safeParse(adjusted).success, true);
  });

  it("mantiene todas las fechas dentro de un horizonte menor y permite objetivo sin target", () => {
    const adjusted = adjustCaminoProposal(sample, 2, null);
    assert.equal(adjusted.goal?.target, null);
    assert.ok((adjusted.goal?.target_offset_days ?? 0) <= 60);
    assert.ok((adjusted.phases[0]?.milestones[0]?.target_offset_days ?? 0) <= 60);
    assert.equal(caminoPlanOutputSchema.safeParse(adjusted).success, true);
  });
});
