import assert from "node:assert/strict";
import test from "node:test";
import {
  nextCampaignOutcomeSourceVersion,
  parseCampaignOutcomeVerdict,
} from "./campaign-planning.js";

test("el veredicto requiere una categoría permitida y un motivo humano", () => {
  assert.deepEqual(parseCampaignOutcomeVerdict({ verdict: "worked", reason: "El segmento respondió y el email generó conversaciones." }), {
    ok: true,
    verdict: "worked",
    reason: "El segmento respondió y el email generó conversaciones.",
  });
  assert.deepEqual(parseCampaignOutcomeVerdict({ verdict: "unknown", reason: "Motivo suficientemente largo" }), {
    ok: false,
    error: "invalid_campaign_verdict",
  });
  assert.deepEqual(parseCampaignOutcomeVerdict({ verdict: "mixed", reason: "corto" }), {
    ok: false,
    error: "campaign_verdict_reason_required",
  });
});

test("las correcciones del veredicto crean versiones monotónicas aunque ocurran el mismo segundo", () => {
  const sameSecond = 1_800_000_000_000;
  assert.equal(nextCampaignOutcomeSourceVersion(sameSecond, null), 1_800_000_000);
  assert.equal(nextCampaignOutcomeSourceVersion(sameSecond, 1_800_000_000), 1_800_000_001);
});
