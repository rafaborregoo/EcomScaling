"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { EmptyState, Badge, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type PaidMediaRun = {
  organization_id: string;
  disposition: string;
  candidate_count: number;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
};

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

export function PaidMediaPlaybookPanel() {
  const [runs, setRuns] = useState<PaidMediaRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/paid-media")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: PaidMediaRun[] }>;
      })
      .then((payload) => {
        if (!cancelled) setRuns(payload.assessments);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudo cargar Paid Media.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando Paid Media F5.02..." />;

  const current = runs[0];
  return (
    <Card id="insight-paid-media">
      <CardHeader>
        <CardTitle>Paid Media y eficiencia de tráfico</CardTitle>
        <CardDescription>Descompone distribución, respuesta, tráfico, conversión y verdad económica antes de proponer cambios.</CardDescription>
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
                ? `${current.candidate_count} playbook(s) de Paid Media evaluado(s).`
                : "No hay templates PAID_MEDIA activos; no se inventa una campaña, audiencia ni presupuesto."}
            </p>
            <p className="text-muted mt-2 text-xs">
              {current.selected_instance_id
                ? "Instancia trazable preparada para recomendación."
                : "Sin instancia seleccionada: primero hay que validar la evidencia."}{" "}
              {current.unresolved_unknowns.length
                ? `Unknowns: ${current.unresolved_unknowns.join(", ")}.`
                : ""}
            </p>
          </CardContent></Card>
        ) : (
          <EmptyState title="Todavía no hay evaluaciones de Paid Media" />
        )}
      </CardContent>
    </Card>
  );
}
