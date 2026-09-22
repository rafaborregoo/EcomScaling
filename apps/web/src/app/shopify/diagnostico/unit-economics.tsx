"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type UnitEconomicsRun = {
  organization_id: string;
  disposition: string;
  candidate_count: number;
  selected_instance_id: string | null;
  unresolved_unknowns: string[];
  input_envelope?: { context?: { facts?: Record<string, string> } };
  result?: { selected_instance?: { domain_extension?: { unit_economics?: { intervention_family?: string; analysis_unit?: string; economic_metric_ref?: string; reversible?: boolean } } } | null };
};

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

function fact(facts: Record<string, string>, key: string) {
  return facts[key] ?? "UNKNOWN";
}

export function UnitEconomicsPlaybookPanel() {
  const [runs, setRuns] = useState<UnitEconomicsRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/unit-economics")
      .then(async (response) => {
        if (!response.ok) throw new Error(await readApiError(response));
        return response.json() as Promise<{ assessments: UnitEconomicsRun[] }>;
      })
      .then((payload) => { if (!cancelled) setRuns(payload.assessments); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar unit economics."); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando unit economics y rentabilidad F5.06..." />;

  const current = runs[0];
  const facts = current?.input_envelope?.context?.facts ?? {};
  const profile = current?.result?.selected_instance?.domain_extension?.unit_economics;
  return (
    <Card id="insight-unit-economics" title="Unit economics y rentabilidad" description="Muestra el waterfall económico observado y mantiene separados contribution, CAC, payback, cash, cohortes y escenarios cuando no hay datos comparables.">
      {current ? (
        <article className="rounded border border-default-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted text-xs">{current.organization_id}</span>
            <Badge tone={tone(current.disposition)}>{current.disposition}</Badge>
          </div>
          <p className="mt-3 text-sm">
            {current.candidate_count ? `${current.candidate_count} playbook(s) económicos evaluado(s).` : "No hay templates UNIT_ECONOMICS activos; no se inventa rentabilidad ni umbrales."}
          </p>
          <p className="text-muted mt-2 text-xs">
            Revenue neto: {fact(facts, "unit_economics.revenue.net_observed")}; pedidos: {fact(facts, "unit_economics.unit_order.observed")}; COGS: {fact(facts, "unit_economics.costs.cogs_observed")}; margen bruto: {fact(facts, "unit_economics.gross_profit.observed")}.
          </p>
          <p className="text-muted mt-2 text-xs">
            Resumen financiero: {fact(facts, "unit_economics.financial_summary.available")}; contribution: {fact(facts, "unit_economics.contribution.observed")}; CAC: {fact(facts, "unit_economics.acquisition.cac_observed")}; payback: {fact(facts, "unit_economics.payback.observed")}; cash: {fact(facts, "unit_economics.cash.observed")}.
          </p>
          <p className="text-muted mt-2 text-xs">
            Segmentación: {fact(facts, "unit_economics.segmented.observed")}; escenarios: {fact(facts, "unit_economics.scenarios.observed")}; comparabilidad: {fact(facts, "unit_economics.data_quality.comparable")}.
          </p>
          {profile ? <p className="text-muted mt-2 text-xs">Familia: {profile.intervention_family}; unidad: {profile.analysis_unit}; métrica económica: {profile.economic_metric_ref ?? "UNKNOWN"}; reversible: {profile.reversible ? "sí" : "no"}.</p> : null}
          <p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Instancia trazable preparada." : "Sin instancia seleccionada: primero validar definiciones, cobertura de costes y comparabilidad."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p>
        </article>
      ) : <p className="text-muted text-sm">Todavía no hay evaluaciones de unit economics.</p>}
    </Card>
  );
}
