"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type RetentionCrmRun = {
  organization_id: string;
  disposition: string;
  candidate_count: number;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  input_envelope?: { context?: { facts?: Record<string, string> } };
  result?: { selected_instance?: { domain_extension?: { retention_crm?: { intervention_family?: string; primary_metric_ref?: string; economic_metric_ref?: string; consent_required?: boolean; reversible?: boolean } } } | null };
};

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

export function RetentionCrmPlaybookPanel() {
  const [runs, setRuns] = useState<RetentionCrmRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/retention-crm")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: RetentionCrmRun[] }>;
      })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar retención y CRM."); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando retención, CRM, lifecycle y LTV F5.05..." />;

  const current = runs[0];
  const profile = current?.result?.selected_instance?.domain_extension?.retention_crm;
  const facts = current?.input_envelope?.context?.facts ?? {};
  return (
    <Card id="insight-retention-crm" title="Retención, CRM, lifecycle y LTV" description="Separa repeat observable, experiencia, economics, consentimiento e incrementalidad; no convierte más mensajes ni revenue atribuido en retención real.">
      {current ? (
        <article className="rounded border border-default-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-xs">{current.organization_id}</span>
            <Badge tone={tone(current.disposition)}>{current.disposition}</Badge>
          </div>
          <p className="mt-3 text-sm">
            {current.candidate_count ? `${current.candidate_count} playbook(s) de retención evaluado(s).` : "No hay templates RETENTION_CRM activos; no se inventa un churn ni un LTV."}
          </p>
          <p className="text-muted mt-2 text-xs">
            Base: {facts["retention.customer_base.available"] ?? "UNKNOWN"}; repeat: {facts["retention.repeat.observed"] ?? "UNKNOWN"}; lifecycle: {facts["retention.lifecycle.state_observed"] ?? "UNKNOWN"}; contribution: {facts["retention.economics.contribution.available"] ?? "UNKNOWN"}.
          </p>
          <p className="text-muted mt-2 text-xs">
            CRM: {facts["retention.crm.capabilities.available"] ?? "UNKNOWN"}; consentimiento observado: {facts["retention.consent.observed"] ?? "UNKNOWN"}; incrementalidad: {facts["retention.incrementality.supported"] ?? "UNKNOWN"}; LTV: {facts["retention.ltv.observed"] ?? "UNKNOWN"}.
          </p>
          {profile ? <p className="text-muted mt-2 text-xs">Familia: {profile.intervention_family}; métrica económica: {profile.economic_metric_ref ?? "UNKNOWN"}; consentimiento requerido: {profile.consent_required ? "sí" : "no"}; reversible: {profile.reversible ? "sí" : "no"}.</p> : null}
          <p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Instancia trazable preparada." : "Sin instancia seleccionada: primero validar recurrencia, experiencia y economics."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p>
        </article>
      ) : <p className="text-muted text-sm">Todavía no hay evaluaciones de retención y CRM.</p>}
    </Card>
  );
}
