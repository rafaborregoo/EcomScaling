"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type AcquisitionRun = {
  organization_id: string;
  disposition: string;
  candidate_count: number;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  reason_codes: string[];
  result?: {
    selected_instance?: {
      domain_extension?: {
        acquisition?: {
          acquisition_motion?: string;
          channel_scope?: string;
          target_population_ref?: string;
          qualification_objective_ref?: string;
          acquisition_evidence_requirements?: string[];
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

export function AcquisitionPlaybookPanel() {
  const [runs, setRuns] = useState<AcquisitionRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/acquisition")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: AcquisitionRun[] }>;
      })
      .then((payload) => {
        if (!cancelled) setRuns(payload.assessments);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudo cargar adquisición.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando adquisición F5.01..." />;

  const current = runs[0];
  const profile = current?.result?.selected_instance?.domain_extension?.acquisition;
  return (
    <Card
      id="insight-acquisition"
      title="Adquisición y demanda F5.01"
      description="Distingue demanda cualificada de tráfico y conserva la incertidumbre de canal, audiencia, economics y capacidad."
    >
      {current ? (
        <article className="rounded border border-default-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-xs">{current.organization_id}</span>
            <Badge tone={tone(current.disposition)}>{current.disposition}</Badge>
          </div>
          <p className="mt-3 text-sm">
            {current.candidate_count
              ? `${current.candidate_count} playbook(s) de adquisición evaluado(s).`
              : "No hay templates ACQUISITION activos; no se inventa un canal ni una audiencia."}
          </p>
          {profile ? (
            <p className="text-muted mt-2 text-xs">
              Movimiento: {profile.acquisition_motion}; alcance: {profile.channel_scope}.
              {profile.target_population_ref
                ? ` Población: ${profile.target_population_ref}.`
                : " Población no declarada."}
            </p>
          ) : null}
          <p className="text-muted mt-2 text-xs">
            {current.selected_instance_id ? "Instancia trazable preparada." : "Sin instancia seleccionada."}
            {current.unresolved_unknowns.length
              ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.`
              : ""}
          </p>
        </article>
      ) : (
        <p className="text-muted text-sm">Todavía no hay evaluaciones de adquisición.</p>
      )}
    </Card>
  );
}
