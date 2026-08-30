import assert from "node:assert/strict";
import test from "node:test";
import {
  isMetaCampaignObjective,
  META_OBJECTIVE_OPTIONS,
} from "./meta-objectives.js";

test("mantiene un catálogo tipado de objetivos Meta para la UI", () => {
  assert.deepEqual(
    META_OBJECTIVE_OPTIONS.map((option) => option.value),
    [
      "OUTCOME_AWARENESS",
      "OUTCOME_TRAFFIC",
      "OUTCOME_ENGAGEMENT",
      "OUTCOME_LEADS",
      "OUTCOME_APP_PROMOTION",
      "OUTCOME_SALES",
    ],
  );
  assert.equal(isMetaCampaignObjective("OUTCOME_SALES"), true);
  assert.equal(isMetaCampaignObjective("conversion"), false);
});
