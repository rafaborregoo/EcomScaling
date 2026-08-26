import { useId } from "react";
import { Badge } from "./badge";
import { getIntegrationActivationGateLabel } from "./integration-activation-state";

export function IntegrationActivationChecklist({ ready, missing }: { ready: boolean; missing: readonly string[] }) {
  const titleId = `${useId()}-integration-activation-title`;
  return (
    <section
    className="mt-4 border-l-2 border-line pl-3"
    role="region"
    aria-labelledby={titleId}
    aria-live="polite"
    aria-atomic="true"
    >
      <h3 id={titleId} className="sr-only">
        Requisitos de activación
      </h3>
      <div className="flex items-center gap-2">
        <Badge tone={ready ? "success" : "neutral"}>{ready ? "Listo para activar" : "Preparación pendiente"}</Badge>
      </div>
      {!ready ? (
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {missing.length > 0 ? (
            missing.map((gate) => (
              <li key={gate}>· {getIntegrationActivationGateLabel(gate)}</li>
            ))
          ) : (
            <li>· Requisitos pendientes de verificar</li>
          )}
        </ul>
      ) : null}
    </section>
  );
}
