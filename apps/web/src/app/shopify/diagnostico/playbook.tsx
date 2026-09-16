"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type PlaybookRun = {
  id: string;
  organization_id: string;
  context_id: string;
  disposition: string;
  candidate_count: number;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  reason_codes: string[];
};

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

export function PlaybookFrameworkPanel() {
  const [runs, setRuns] = useState<PlaybookRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/playbooks")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: PlaybookRun[] }>;
      })
      .then((payload) => {
        if (!cancelled) setRuns(payload.assessments);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudo cargar el framework de playbooks.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando framework de playbooks..." />;

  const current = runs[0];
  return (
    <Card
      title="Framework universal de playbooks F5.00"
      description="Evalúa contexto, aplicabilidad y trazabilidad. No convierte una métrica en una orden."
    >
      {current ? (
        <article className="rounded border border-default-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-xs">
              {current.organization_id}
            </span>
            <Badge tone={tone(current.disposition)}>
              {current.disposition}
            </Badge>
          </div>
          <p className="mt-3 text-sm">
            {current.candidate_count
              ? `${current.candidate_count} candidato(s) evaluado(s).`
              : "No hay templates activos en el catálogo; no se inventa una intervención."}
          </p>
          <p className="text-muted mt-2 text-xs">
            {current.selected_instance_id
              ? "Instancia trazable preparada para recomendación."
              : "Sin instancia seleccionada."}{" "}
            {current.unresolved_unknowns.length
              ? `Unknowns: ${current.unresolved_unknowns.join(", ")}.`
              : ""}
          </p>
        </article>
      ) : (
        <p className="text-muted text-sm">
          Todavía no hay evaluaciones de playbooks.
        </p>
      )}
    </Card>
  );
}
