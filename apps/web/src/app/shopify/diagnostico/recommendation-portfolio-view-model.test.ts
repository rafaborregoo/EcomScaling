import assert from "node:assert/strict";
import test from "node:test";
import { recommendationPortfolioViewModel, portfolioRoleTone } from "./recommendation-portfolio-view-model";

test("el modelo de F7.12 conserva roles, cartera activa y diferidos", () => {
  const model = recommendationPortfolioViewModel({ disposition: "PORTFOLIO_AVAILABLE", candidate_count: 2, primary_candidate_id: "fix@1", result: { portfolio_feasibility: "FEASIBLE_WITH_DEFERRED", portfolio_narrative: "Primary visible.", candidate_evaluations: [{ candidate_id: "fix@1", role: "PRIMARY", selection_status: "ACTIVE", sequence_position: "FIRST", role_reason: "dominant", intervention: "Fix checkout" }, { candidate_id: "scale@1", role: "DEFERRED", selection_status: "DEFERRED", sequence_position: "LATER", role_reason: "resource conflict", intervention: "Scale" }] } });
  assert.equal(model.primaryCandidateId, "fix@1");
  assert.equal(model.activeCandidates.length, 1);
  assert.equal(model.deferredCandidates.length, 1);
  assert.equal(model.portfolioFeasibility, "FEASIBLE_WITH_DEFERRED");
  assert.match(model.narrative, /Primary/);
});

test("los roles de F7.12 tienen una lectura visual estable", () => {
  assert.equal(portfolioRoleTone("PRIMARY"), "brand");
  assert.equal(portfolioRoleTone("DEFERRED"), "warn");
  assert.equal(portfolioRoleTone("EXCLUDED"), "danger");
});
