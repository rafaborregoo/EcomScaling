"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { EmptyState, Badge, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type ConversionRun = {
  organization_id: string;
  disposition: string;
  candidate_count: number;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  input_envelope?: {
    context?: {
      facts?: Record<string, string>;
    };
  };
  result?: {
    selected_instance?: {
      domain_extension?: {
        conversion_cro?: {
          intervention_mode?: string;
          funnel_stage?: string;
          affected_segment_ref?: string;
          primary_metric_ref?: string;
          economic_metric_ref?: string;
        };
      };
    } | null;
  };
};

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

export function ConversionCroPlaybookPanel() {
  const [runs, setRuns] = useState<ConversionRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/conversion")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: ConversionRun[] }>;
      })
      .then((payload) => {
        if (!cancelled) setRuns(payload.assessments);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudo cargar conversión y CRO.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando conversión y CRO F5.03..." />;

  const current = runs[0];
  const profile = current?.result?.selected_instance?.domain_extension?.conversion_cro;
  const facts = current?.input_envelope?.context?.facts ?? {};
  const funnelStatus = facts["conversion_cro.funnel.measurement.sufficient"] ?? "UNKNOWN";

  return (
    <Card id="insight-conversion">
      <CardHeader>
        <CardTitle>Conversión y CRO</CardTitle>
        <CardDescription>Localiza la etapa y separa fix, research o test sin confundir cobertura incompleta con una fuga real.</CardDescription>
      </CardHeader>
      <CardContent>
        {current ? (
          <Card role="article"><CardContent>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted text-xs">{current.organization_id}</span>
              <Badge tone={tone(current.disposition)}>{current.disposition}</Badge>
            </div>
            <p className="mt-3 text-sm">
              {current.candidate_count
                ? `${current.candidate_count} playbook(s) CRO evaluado(s).`
                : "No hay templates CONVERSION activos; no se inventa una fuga ni una intervención."}
            </p>
            <p className="text-muted mt-2 text-xs">
              Cobertura del funnel: {funnelStatus}. La tasa o la caída no se interpreta sin etapa, segmento y evidencia.
            </p>
            {profile ? (
              <p className="text-muted mt-2 text-xs">
                Modo: {profile.intervention_mode}; etapa: {profile.funnel_stage}.
                {profile.affected_segment_ref ? ` Segmento: ${profile.affected_segment_ref}.` : " Segmento no declarado."}
                {profile.primary_metric_ref ? ` Métrica primaria: ${profile.primary_metric_ref}.` : ""}
              </p>
            ) : null}
            <p className="text-muted mt-2 text-xs">
              {current.selected_instance_id ? "Instancia trazable preparada." : "Sin instancia seleccionada: primero validar evidencia."}
              {current.unresolved_unknowns.length
                ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.`
                : ""}
            </p>
          </CardContent></Card>
        ) : (
          <EmptyState title="Todavía no hay evaluaciones de conversión y CRO" />
        )}
      </CardContent>
    </Card>
  );
}
