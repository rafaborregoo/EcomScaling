"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type OperationsCxRun = {
  organization_id: string;
  disposition: string;
  candidate_count: number;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  input_envelope?: { context?: { facts?: Record<string, string> } };
  result?: {
    selected_instance?: {
      domain_extension?: {
        operations_cx?: {
          operations_motion?: string;
          operational_surface?: string;
          process_scope?: string;
        };
      } | null;
    } | null;
  };
};

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

export function OperationsCxPlaybookPanel() {
  const [runs, setRuns] = useState<OperationsCxRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/operations-cx")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: OperationsCxRun[] }>;
      })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar operaciones y CX."); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando operaciones, fulfillment y CX F5.08..." />;

  const current = runs[0];
  const facts = current?.input_envelope?.context?.facts ?? {};
  const profile = current?.result?.selected_instance?.domain_extension?.operations_cx;
  const value = (key: string) => facts[key] ?? "UNKNOWN";

  return (
    <Card id="insight-operations-cx" title="Operaciones, fulfillment y CX F5.08" description="Separa entrega, promesa, capacidad, devoluciones y soporte; conserva UNKNOWN cuando la tienda no aporta SLA, backlog o experiencia de cliente.">
      {current ? (
        <article className="rounded border border-default-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-xs">{current.organization_id}</span>
            <Badge tone={tone(current.disposition)}>{current.disposition}</Badge>
          </div>
          <p className="mt-3 text-sm">{current.candidate_count ? `${current.candidate_count} playbook(s) operativo(s) evaluado(s).` : "No hay templates OPERATIONS_CX activos; no se inventa un SLA ni se atribuyen fallos al carrier."}</p>
          <p className="text-muted mt-2 text-xs">Pedidos: {value("operations.order_volume.observed")}; fulfillment: {value("operations.delivery.fulfillments_observed")}; entregas: {value("operations.delivery.delivered_observed")}; en tránsito: {value("operations.delivery.in_transit_observed")}.</p>
          <p className="text-muted mt-2 text-xs">Tiempo de preparación: {value("operations.delivery.processing_time_observed")}; tránsito: {value("operations.delivery.transit_time_observed")}; promesa: {value("operations.delivery.promise_observed")}; puntualidad medible: {value("operations.delivery.on_time_observed")}.</p>
          <p className="text-muted mt-2 text-xs">Backlog: {value("operations.backlog.observed")}; capacidad: {value("operations.capacity.observed")}; cuello de botella: {value("operations.capacity.bottleneck_observed")}; calidad de timestamps: {value("operations.data_quality.timestamps_observed")}.</p>
          <p className="text-muted mt-2 text-xs">Devoluciones: {value("operations.returns.observed")}; soporte: {value("operations.support.observed")}; WISMO: {value("operations.support.wismo_observed")}; recuperación de servicio: {value("operations.service_recovery.observed")}.</p>
          {profile ? <p className="text-muted mt-2 text-xs">Movimiento: {profile.operations_motion}; superficie: {profile.operational_surface}; scope: {profile.process_scope}.</p> : null}
          <p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Instancia trazable preparada." : "Sin instancia seleccionada: primero validar SLA, capacidad, tiempos y calidad de datos."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p>
        </article>
      ) : <p className="text-muted text-sm">Todavía no hay evaluaciones de operaciones y CX.</p>}
    </Card>
  );
}
