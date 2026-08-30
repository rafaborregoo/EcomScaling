import { useId } from "react";
import { Badge } from "./badge";
import { getAiEvidencePresentation, type AiEvidenceSource } from "./ai-evidence-state";

const statusTone = {
  verified: "success",
  partial: "warn",
  insufficient: "neutral",
} as const;

export function AiEvidence({
  sources,
  warnings = [],
}: {
  sources: readonly AiEvidenceSource[];
  warnings?: readonly string[];
}) {
  const titleId = `${useId()}-ai-evidence-title`;
  const presentation = getAiEvidencePresentation(sources, warnings);
  return (
    <section
      className="mt-4 border-l-2 border-edge pl-3"
      role="region"
      aria-labelledby={titleId}
    >
      <h3 id={titleId} className="sr-only">
        Evidencia de la respuesta
      </h3>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={statusTone[presentation.status]}>{presentation.label}</Badge>
        {sources.length > 0 ? (
          <span className="text-xs text-muted">
            {sources.length} {sources.length === 1 ? "fuente" : "fuentes"}
          </span>
        ) : null}
      </div>
      {sources.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs text-muted">
          {sources.map((source) => (
            <li key={`${source.kind}:${source.reference}:${source.period ?? ""}`}>
              <span className="font-medium text-foreground">{source.kind}</span>{" "}
              <span>{source.reference}</span>
              {source.period ? <span> · {source.period}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {warnings.length > 0 ? <p className="mt-2 text-xs text-muted">{warnings.join(" · ")}</p> : null}
    </section>
  );
}
