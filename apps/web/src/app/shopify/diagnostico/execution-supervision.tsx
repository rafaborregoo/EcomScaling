"use client";

/**
 * F8.00–F8.17 (salvo 8.02-8.05, 8.10 y 8.16, que tienen su panel): una
 * seccion por bloque, cada una con su ancla para InsightsMenu y el Copiloto.
 * Solo consultor. Nada de esto ejecuta ni concede autoridad.
 */

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import {
  executionSupervisionViewModel,
  supervisionTone,
  type ExecutionSupervisionRun,
  type SupervisionBlockView,
} from "./execution-supervision-view-model";

function BlockSection({ view }: { view: SupervisionBlockView }) {
  return (
    <section id={view.anchor} className="border-t border-default-200 py-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium">
          {view.block} · {view.label}
        </span>
        <Badge tone={supervisionTone(view.decision)}>{view.blockDecision}</Badge>
      </div>
      <p className="mt-1 max-w-prose text-sm leading-6">{view.why}</p>
      {view.highlights.length ? (
        <ul className="text-muted mt-2 space-y-1 text-sm">
          {view.highlights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {view.failedChecks.length ? (
        <ul className="mt-2 space-y-1 text-xs">
          {view.failedChecks.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline gap-2">
              <Badge tone={c.hard ? "danger" : "warn"}>{c.status === "UNKNOWN" ? "sin dato" : "no cumple"}</Badge>
              <span>{c.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {view.next.length ? <p className="text-muted mt-2 text-xs">Siguiente: {view.next.join(" · ")}.</p> : null}
    </section>
  );
}

export function ExecutionSupervisionPanel({ organizationId }: { organizationId?: string }) {
  const [runs, setRuns] = useState<ExecutionSupervisionRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setRuns([]);
      return;
    }
    let cancelled = false;
    apiFetch(`/v1/consultant/execution-supervision?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: ExecutionSupervisionRun[] }>;
      })
      .then((payload) => {
        if (!cancelled) setRuns(payload.assessments);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar la supervisión F8.");
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando supervisión de ejecución..." />;

  return (
    <Card id="insight-execution-supervision">
      <CardHeader>
        <CardTitle>Supervisión de ejecución</CardTitle>
        <CardDescription>Lo que decide cada bloque de la fase 8 sobre la intervención vigente. No ejecuta ni concede autoridad.</CardDescription>
      </CardHeader>
      <CardContent>
        <div>
          {executionSupervisionViewModel(runs).map((view) => (
            <BlockSection key={view.stage} view={view} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
