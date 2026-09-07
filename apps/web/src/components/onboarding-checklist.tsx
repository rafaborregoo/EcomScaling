"use client";

import { Badge, ButtonLink, CollapsibleSection } from "@/components/ui";
import {
  getOnboardingChecklistSteps,
  type ChecklistStepState,
} from "./onboarding-checklist-state";

function StepState({ state }: { state: ChecklistStepState }) {
  const copy = {
    done: { label: "Listo", tone: "success" as const, marker: "✓" },
    current: { label: "Siguiente", tone: "brand" as const, marker: "→" },
    waiting: { label: "En espera", tone: "neutral" as const, marker: "·" },
    ready: { label: "Preparado", tone: "neutral" as const, marker: "○" },
  }[state];

  return (
    <Badge tone={copy.tone} title={copy.label}>
      <span aria-hidden="true" className="mr-1 font-mono">
        {copy.marker}
      </span>
      {copy.label}
    </Badge>
  );
}

export function OnboardingChecklist({
  organizationStatus,
  shopifyConnectionCount,
  hasShopifyMetrics,
  hasFinancialConfig,
  isLoadingMetrics,
  isLoadingFinancialConfig,
  metricsError,
  financialConfigError,
}: {
  organizationStatus: string;
  shopifyConnectionCount: number;
  hasShopifyMetrics: boolean;
  hasFinancialConfig: boolean;
  isLoadingMetrics: boolean;
  isLoadingFinancialConfig: boolean;
  metricsError: string | null;
  financialConfigError: string | null;
}) {
  const shopifyConnected = shopifyConnectionCount > 0;
  const dataValidated = shopifyConnected && hasShopifyMetrics && !metricsError;
  const financialModelReady = hasFinancialConfig && !financialConfigError;
  const shouldShow =
    organizationStatus === "onboarding" ||
    !shopifyConnected ||
    !dataValidated ||
    !financialModelReady;

  if (!shouldShow) return null;

  const steps = getOnboardingChecklistSteps({
    shopifyConnectionCount,
    hasShopifyMetrics,
    hasFinancialConfig,
    isLoadingMetrics,
    isLoadingFinancialConfig,
    metricsError,
    financialConfigError,
  });
  const actionHref = !shopifyConnected
    ? "/integraciones"
    : !financialModelReady
      ? "/configuracion"
      : "/integraciones";
  const actionLabel = !shopifyConnected
    ? "Conectar Shopify"
    : !financialModelReady
      ? "Configurar costes"
      : "Ver integraciones";

  return (
    <CollapsibleSection title="Ruta de activación: pon tu tienda en marcha">
      <p className="text-sm leading-6 text-muted">
        Sigue el orden que protege la calidad de tus decisiones: primero datos
        propios, después adquisición y retención.
      </p>
      <p id="onboarding-checklist-description" className="sr-only">
        El estado de cada paso se actualiza con los datos disponibles de tu organización.
      </p>
      <ol
        className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        aria-label="Pasos de activación"
        aria-describedby="onboarding-checklist-description"
      >
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="border-t border-separator pt-3"
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted">0{index + 1}</span>
              <StepState state={step.state} />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">{step.title}</h3>
            <p className="mt-1 text-sm leading-6 text-muted">{step.detail}</p>
          </li>
        ))}
      </ol>
      <div className="mt-4">
        <ButtonLink variant="secondary" href={actionHref}>
          {actionLabel}
        </ButtonLink>
      </div>
    </CollapsibleSection>
  );
}
