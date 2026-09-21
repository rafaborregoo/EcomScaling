import assert from "node:assert/strict";
import test from "node:test";
import {
  insightSpotsFromAiAssessments,
  resolveCopilotUiAction,
} from "./insights-registry";
test("el feed F9 enlaza aprendizaje continuo con su panel", () => {
  const spots = insightSpotsFromAiAssessments({ organizationId: "org-1", connectionId: "", isConsultant: true }, [{ domain: "F9_CONTINUOUS_LEARNING", disposition: "WAITING_FOR_EVIDENCE", reason_codes: ["sample"] }]);
  assert.equal(spots[0]?.href, "/shopify/diagnostico#insight-continuous-learning");
});

test("una accion del Copiloto resuelve contra el catalogo de InsightsMenu", () => {
  const action = resolveCopilotUiAction({
    kind: "open_insight",
    insight_slug: "continuous-learning",
    label: "Ver evidencia",
    reason: "Revisar el gate de evidencia.",
  });

  assert.equal(action?.href, "/shopify/diagnostico#insight-continuous-learning");
  assert.equal(action?.label, "Ver evidencia");
});

test("una accion con slug desconocido se descarta", () => {
  assert.equal(
    resolveCopilotUiAction({
      kind: "open_insight",
      insight_slug: "inventado-por-el-modelo",
      label: "Abrir card",
      reason: "No debe navegar.",
    }),
    null,
  );
});
