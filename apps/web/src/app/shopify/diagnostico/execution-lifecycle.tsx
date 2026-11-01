"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { EmptyState, Badge, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import {
  executionLifecycleViewModel,
  type ExecutionLifecycleState,
} from "./execution-lifecycle-view-model";

const join = (items: string[]) => (items.length ? items.join(" · ") : "Ninguno");

export function ExecutionLifecyclePanel({ organizationId }: { organizationId?: string }) {
  const [states, setStates] = useState<ExecutionLifecycleState[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setStates([]);
      setError(null);
      return;
    }
    let cancelled = false;
    apiFetch(`/v1/consultant/execution-lifecycle?organizationId=${encodeURIComponent(organizationId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ states: ExecutionLifecycleState[] }>;
      })
      .then((payload) => {
        if (!cancelled) setStates(payload.states);
      })
      .catch((reason) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar F8.10.");
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!states) return <LoadingBlock label="Cargando ciclo de vida de ejecucion F8.10..." />;

  const model = executionLifecycleViewModel(states);

  return (
    <Card id="insight-execution-lifecycle">
      <CardHeader>
        <CardTitle>Ciclo de vida de ejecucion</CardTitle>
        <CardDescription>Estado autoritativo de cada intervencion: que puede hacer ahora, que tiene prohibido y que la bloquea.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted">{model.total} intervenciones abiertas</span>
            {model.inconsistent.length ? (
              <Badge tone="danger">{model.inconsistent.length} incoherentes</Badge>
            ) : null}
            {model.waitingOnHuman.length ? (
              <Badge tone="warn">{model.waitingOnHuman.length} esperando a una persona</Badge>
            ) : null}
            {model.writing.length ? <Badge tone="neutral">{model.writing.length} pueden escribir</Badge> : null}
          </div>

          {model.total === 0 ? (
            <EmptyState title="No hay intervenciones con ciclo de vida abierto" hint="Aparecen aqui en cuanto una pasa de propuesta a plan." />
          ) : null}

          {model.rows.map((row) => (
            <Card size="sm" key={row.interventionId}><CardContent>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{row.interventionId}</span>
                <Badge tone={row.tone}>{row.state}</Badge>
              </div>
              <p className="mt-1 text-sm">{row.why}</p>

              {row.inconsistencies.length ? (
                <p className="mt-2 text-xs text-danger">Incoherencia: {join(row.inconsistencies)}</p>
              ) : null}

              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Puede hacer</p>
                  <p className="mt-1 text-xs text-muted">{join(row.allowed)}</p>
                  <p className="mt-1 text-xs text-muted">Siguientes estados: {join(row.nextStates)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">Que lo bloquea</p>
                  <p className="mt-1 text-xs text-muted">{join(row.blocking)}</p>
                  <p className="mt-1 text-xs text-muted">
                    Escritura material: {row.materialWriteAllowed ? "permitida" : "no permitida"} · plan v{row.planVersion}
                  </p>
                </div>
              </div>
            </CardContent></Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
