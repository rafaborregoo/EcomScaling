import assert from "node:assert/strict";
import test from "node:test";
import {
  copilotInsightHref,
  isCopilotInsightTarget,
} from "./copilot-navigation.js";

test("los destinos del Copiloto se resuelven a anchors canonicos", () => {
  assert.equal(isCopilotInsightTarget("continuous-learning"), true);
  assert.equal(
    copilotInsightHref("continuous-learning"),
    "/shopify/diagnostico#insight-continuous-learning",
  );
});

test("un destino que no existe en InsightsMenu no se puede navegar", () => {
  assert.equal(isCopilotInsightTarget("inventado-por-el-modelo"), false);
  assert.equal(copilotInsightHref("inventado-por-el-modelo"), null);
});
