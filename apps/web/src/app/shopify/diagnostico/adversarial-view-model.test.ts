import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStatusLabel, confounderStatusLabel, groupReviewsByCase, riskLabel, survivalStatusLabel, type AdversarialReviewView } from "./adversarial-view-model";

const review = (over: Partial<AdversarialReviewView> = {}): AdversarialReviewView => ({
  id: "r1", organization_name: "Tienda", case_id: "c1", false_diagnosis_risk: "low",
  survival_status: "survives", robustness: "high", diagnosis_stability: "stable_to_assumptions",
  confidence_before: "high", confidence_after: "high", confidence_adjustment: null,
  red_team_counter_explanation: "Podria existir una explicacion rival.", red_team_supporting_evidence: null,
  red_team_required_evidence: "Serie reconciliada", red_team_effect: "no_material_change",
  revision_triggered: false, reopened_blocks: [], remaining_limitations: null, confounders: [], gates: [], checks: [], sensitivity: [], ...over,
});

test("la pantalla separa sobrevivir, debilitar y revisar", () => {
  assert.equal(survivalStatusLabel("survives").label, "Resiste");
  assert.equal(survivalStatusLabel("weakened").tone, "warn");
  assert.equal(survivalStatusLabel("requires_revision").tone, "danger");
});

test("un candidato no se pinta como hecho y un material explica su efecto", () => {
  assert.match(confounderStatusLabel("candidate").hint, /no .*hecho/);
  assert.match(confounderStatusLabel("material").hint, /fuerza/);
});

test("los checks no posibles conservan la ausencia de evidencia", () => {
  assert.equal(checkStatusLabel("not_possible").label, "No posible");
  assert.equal(riskLabel("critical").tone, "danger");
});

test("las revisiones se agrupan por caso sin convertirlas en ranking", () => {
  const groups = groupReviewsByCase([review(), review({ id: "r2", case_id: "c2" }), review({ id: "r3" })]);
  assert.deepEqual(groups.map((group) => [group.caseId, group.reviews.length]), [["c1", 2], ["c2", 1]]);
});
