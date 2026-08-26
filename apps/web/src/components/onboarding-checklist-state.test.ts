import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getOnboardingChecklistSteps } from "./onboarding-checklist-state";

describe("onboarding checklist state", () => {
  it("keeps future connectors honest without external credentials", () => {
    const steps = getOnboardingChecklistSteps({
      shopifyConnectionCount: 1,
      hasShopifyMetrics: true,
      hasFinancialConfig: true,
      isLoadingMetrics: false,
      isLoadingFinancialConfig: false,
      metricsError: null,
      financialConfigError: null,
    });

    assert.deepEqual(steps.map((step) => step.state), ["done", "done", "done", "ready"]);
    assert.match(steps[3].detail, /credenciales y permisos reales/);
  });

  it("separates metrics loading from financial configuration loading", () => {
    const steps = getOnboardingChecklistSteps({
      shopifyConnectionCount: 1,
      hasShopifyMetrics: false,
      hasFinancialConfig: false,
      isLoadingMetrics: true,
      isLoadingFinancialConfig: false,
      metricsError: null,
      financialConfigError: null,
    });

    assert.match(steps[1].detail, /comprobando la primera sincronización/);
    assert.match(steps[2].detail, /Añade costes/);
  });
});
