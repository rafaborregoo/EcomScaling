import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildMaturityRecommendationContext,
  candidateInputFromMaturitySources,
  type MaturityProfileSnapshot,
} from "./maturity-recommendations-engine.js";

const template = {
  template_id: "checkout",
  template_version: "1",
  source_refs: ["template:checkout"],
  domain_extension: {
    maturity: {
      business_stage: "validation",
      functional_capability: "conversion",
      intervention_readiness: "PARTIAL",
      current_mode: "learning",
      current_bottleneck: "measurement",
      absorption_capacity: "LIMITED",
      candidate_complexity: "ADVANCED",
      focus_capacity: "one priority",
      organization_complexity: [],
      current_debt: [],
      current_recommendation: "Mejorar medición básica del checkout",
      deferred_recommendation: "Instalar personalización avanzada",
      capability_to_build: "Instrumentar eventos fiables de checkout",
      maturity_unlock: ["controlled experimentation"],
      evidence: ["session recordings"],
      risk: ["conversion loss"],
      resource_constraints: ["small team"],
      missing_capabilities: ["reliable checkout measurement"],
    },
  },
} as any;

const profile: MaturityProfileSnapshot = {
  profile_id: "profile-1",
  business_stage: null,
  confidence: "low",
  capabilities: [
    { capability: "conversion", current_level: "ad_hoc", confidence: "medium" },
  ],
};

test("F7.10 runtime compone un contexto trazable desde la cadena anterior", () => {
  const context = buildMaturityRecommendationContext(
    "org-1",
    { context_id: "ctx:intensity", decision_cycle_id: "cycle:intensity", primary_priority_candidate_id: "checkout@1", source_refs: ["source:intensity"] },
    [profile],
    "2026-09-20T12:00:00.000Z",
  );

  assert.equal(context.business_id, "org-1");
  assert.equal(context.maturity_profile_refs[0], "profile-1");
  assert.ok(context.source_refs.includes("f7-p10.v1"));
});

test("F7.10 runtime no inventa madurez si no hay perfil y conserva la extension declarada", () => {
  const context = buildMaturityRecommendationContext(
    "org-1",
    {},
    [],
    "2026-09-20T12:00:00.000Z",
  );
  const input = candidateInputFromMaturitySources(template, context, profile, {
    candidate_id: "checkout@1",
    selected_intervention: "Instalar personalización avanzada",
    unresolved_unknowns: [],
    source_refs: ["source:intensity-candidate"],
  });

  assert.equal(input.functional_maturity, "ad_hoc");
  assert.equal(input.business_stage, "validation");
  assert.deepEqual(input.missing_capabilities, ["reliable checkout measurement"]);
  assert.equal(input.candidate_complexity, "ADVANCED");
});
