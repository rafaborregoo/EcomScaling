export type ChecklistStepState = "done" | "current" | "waiting" | "ready";

export type OnboardingChecklistInput = {
  shopifyConnectionCount: number;
  hasShopifyMetrics: boolean;
  hasFinancialConfig: boolean;
  isLoadingMetrics: boolean;
  isLoadingFinancialConfig: boolean;
  metricsError: string | null;
  financialConfigError: string | null;
};

export type OnboardingChecklistStep = {
  title: string;
  detail: string;
  state: ChecklistStepState;
};

export function getOnboardingChecklistSteps(
  input: OnboardingChecklistInput,
): OnboardingChecklistStep[] {
  const shopifyConnected = input.shopifyConnectionCount > 0;
  const dataValidated =
    shopifyConnected && input.hasShopifyMetrics && !input.metricsError;
  const financialModelReady =
    input.hasFinancialConfig && !input.financialConfigError;

  return [
    {
      title: "Conecta Shopify",
      detail: shopifyConnected
        ? `${input.shopifyConnectionCount} ${input.shopifyConnectionCount === 1 ? "tienda conectada" : "tiendas conectadas"}.`
        : "Es el primer paso para calcular ventas, margen y stock.",
      state: shopifyConnected ? "done" : "current",
    },
    {
      title: "Valida tus datos",
      detail: dataValidated
        ? "La cuenta ya tiene métricas disponibles para trabajar."
        : input.isLoadingMetrics
          ? "Estamos comprobando la primera sincronización."
          : input.metricsError
            ? "Hay que revisar la sincronización antes de tomar decisiones."
            : "La primera sincronización habilitará este paso.",
      state: dataValidated ? "done" : shopifyConnected ? "current" : "waiting",
    },
    {
      title: "Configura costes y margen",
      detail: financialModelReady
        ? "El modelo financiero de la organización está disponible."
        : input.isLoadingFinancialConfig
          ? "Estamos comprobando la configuración financiera."
          : input.financialConfigError
            ? "No se pudo leer la configuración financiera; revisa Configuración."
            : "Añade costes de pago, envío e impuestos para interpretar el margen.",
      state: financialModelReady
        ? "done"
        : dataValidated
          ? "current"
          : "waiting",
    },
    {
      title: "Prepara Meta y Klaviyo",
      detail:
        "Los conectores están preparados; se activarán cuando existan credenciales y permisos reales.",
      state: "ready",
    },
  ];
}
