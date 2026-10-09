import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { caminoCalendarHorizonDays, caminoPlanOutputSchema, type CaminoPlanOutput } from "@e-nora/ai";
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
    evidence: [], milestones: [{ name: "Prueba", description: "A/B", target_offset_days: 60, success_metric: "Sube la conversión", rationale: "", tasks: [] }],
  }],
  sources: [], confidence: "medium", warnings: [],
};

const referenceDate = new Date("2026-10-05T00:00:00.000Z");

describe("edición humana del objetivo y plazo A19", () => {
  it("ajusta target y horizonte sin mutar la salida original y conserva las fechas de calendario", () => {
    const adjusted = adjustCaminoProposal(sample, 6, 18000, referenceDate);
    assert.equal(adjusted.goal?.target, 18000);
    assert.equal(adjusted.goal?.target_offset_days, 120);
    assert.equal(adjusted.horizon_months, 6);
    assert.equal(adjusted.phases[0]?.milestones[0]?.target_offset_days, 60);
    assert.equal(sample.goal?.target, 15000);
    assert.equal(caminoPlanOutputSchema.safeParse(adjusted).success, true);
  });

  it("con un plazo menor mantiene las fechas dentro del horizonte y permite objetivo sin target", () => {
    const adjusted = adjustCaminoProposal(sample, 2, null, referenceDate);
    assert.equal(adjusted.goal?.target, null);
    assert.equal(adjusted.goal?.target_offset_days, caminoCalendarHorizonDays(referenceDate, 2));
    assert.equal(adjusted.phases[0]?.milestones[0]?.target_offset_days, 60);
    assert.equal(caminoPlanOutputSchema.safeParse(adjusted).success, true);
  });

  it("un plazo menor deja fuera los hitos que ya no caben y las fases que se quedan vacías", () => {
    const withBlackFriday: CaminoPlanOutput = {
      ...sample,
      phases: [
        sample.phases[0]!,
        { ...sample.phases[0]!, name: "Navidad", milestones: [{ ...sample.phases[0]!.milestones[0]!, name: "Navidad lista", target_offset_days: 100 }] },
      ],
    };
    const adjusted = adjustCaminoProposal(withBlackFriday, 2, null, referenceDate);
    assert.deepEqual(adjusted.phases.map((phase) => phase.name), ["Mejorar conversión"]);
    assert.equal(adjustCaminoProposal(withBlackFriday, 1, null, referenceDate).phases.length, 0);
  });

  it("los objetivos mensuales se recortan o se amplían sin repetir valores", () => {
    const monthly = {
      ...sample,
      goal: {
        ...sample.goal!,
        monthly_targets: [
          { month: 1, target_value: 11000, rationale: "a" },
          { month: 2, target_value: 15000, rationale: "b" },
          { month: 3, target_value: 12000, rationale: "c" },
          { month: 4, target_value: 13000, rationale: "d" },
        ],
      },
    };
    const shorter = adjustCaminoProposal(monthly, 2, 16000, referenceDate);
    assert.deepEqual(shorter.goal?.monthly_targets?.map((checkpoint) => checkpoint.target_value), [11000, 16000, 12000]);
    const longer = adjustCaminoProposal(monthly, 6, 15000, referenceDate);
    assert.deepEqual(longer.goal?.monthly_targets?.map((checkpoint) => checkpoint.target_value), [11000, 15000, 12000, 13000, null, null, null]);
  });
});
