import { useId } from "react";
import { Badge } from "./badge";
import { CollapsibleSection } from "./collapsible-section";
import { getIntegrationActivationGateLabel } from "./integration-activation-state";

export function IntegrationActivationChecklist({
  ready,
  missing,
}: {
  ready: boolean;
  missing: readonly string[];
}) {
  const titleId = `${useId()}-integration-activation-title`;
  return (
    <section
      className="mt-4"
      role="region"
      aria-labelledby={titleId}
      aria-live="polite"
      aria-atomic="true"
    >
      <h3 id={titleId} className="sr-only">
        Requisitos de activación
      </h3>
      <CollapsibleSection
        title={
          <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <span>Preparación de los datos</span>
            <Badge tone={ready ? "success" : "neutral"}>
              {ready ? "Listo" : `${missing.length || "Varios"} pendientes`}
            </Badge>
          </span>
        }
      >
        <div className="sr-only">
          <span className="text-xs font-medium text-muted">Preparación</span>
          <Badge tone={ready ? "success" : "neutral"}>
            {ready ? "Listo para activar" : "Preparación pendiente"}
          </Badge>
        </div>
        {!ready ? (
          <ul className="mt-3 grid gap-x-4 gap-y-1.5 text-xs text-muted sm:grid-cols-2">
            {missing.length > 0 ? (
              missing.map((gate) => (
                <li key={gate}>· {getIntegrationActivationGateLabel(gate)}</li>
              ))
            ) : (
              <li>· Requisitos pendientes de verificar</li>
            )}
          </ul>
        ) : null}
      </CollapsibleSection>
    </section>
  );
}
