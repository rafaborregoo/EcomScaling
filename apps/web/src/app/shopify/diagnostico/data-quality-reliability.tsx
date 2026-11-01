"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { EmptyState, Badge, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type DataQualityRun = { organization_id: string; disposition: string; selected_instance_id: string | null; unresolved_unknowns: string[]; input_envelope?: { context?: { facts?: Record<string, string> } } };
const FACTS = [
  ["data_quality.metric.observed", "Métrica observada"], ["data_quality.source.observed", "Fuente"],
  ["data_quality.definition.observed", "Definición"], ["data_quality.source_of_truth.observed", "Source of truth"],
  ["data_quality.completeness.observed", "Completitud"], ["data_quality.freshness.observed", "Frescura"],
  ["data_quality.granularity.observed", "Granularidad"], ["data_quality.traceability.observed", "Trazabilidad"],
  ["data_quality.sample.observed", "Muestra"], ["data_quality.maturity.observed", "Maduración"],
  ["data_quality.missingness.observed", "Missingness"], ["data_quality.reconciliation.observed", "Reconciliación"],
  ["data_quality.math_checks.observed", "Checks matemáticos"], ["data_quality.confidence.observed", "Confianza"],
] as const;
function tone(disposition: string) { if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const; if (disposition === "BLOCKED") return "danger" as const; return "warn" as const; }

export function DataQualityReliabilityPanel() {
  const [runs, setRuns] = useState<DataQualityRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/data-quality-reliability").then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: DataQualityRun[] }>; }).then((payload) => { if (!cancelled) setRuns(payload.assessments); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar la calidad y fiabilidad de datos."); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando calidad y fiabilidad F6.02..." />;
  const current = runs[0]; const facts = current?.input_envelope?.context?.facts ?? {}; const value = (key: string) => facts[key] ?? "UNKNOWN"; const observed = FACTS.filter(([key]) => value(key) !== "UNKNOWN").length;
  return <Card id="insight-data-quality-reliability">
    <CardHeader>
      <CardTitle>Calidad y fiabilidad de datos</CardTitle>
      <CardDescription>Valida el dato antes de diagnosticar: fuente, definición, cobertura, frescura, muestra, maduración, reconciliación, missingness y alcance de la afirmación. La calidad de la evidencia limita la confianza del diagnóstico.</CardDescription>
    </CardHeader>
    <CardContent>{current ? <Card role="article"><CardContent><div className="flex items-center justify-between gap-3"><span className="text-muted text-xs">{current.organization_id}</span><Badge tone={tone(current.disposition)}>{current.disposition}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{FACTS.map(([key, label]) => <Card size="sm" key={key}><CardContent><div className="flex items-center justify-between gap-2 text-xs"><span>{label}</span><span className="font-mono text-muted">{value(key)}</span></div><div className="mt-2 h-1.5 rounded bg-default-100"><div className={`h-1.5 rounded ${value(key) === "TRUE" ? "bg-success" : value(key) === "FALSE" ? "bg-danger" : "bg-muted"}`} style={{ width: value(key) === "UNKNOWN" ? "22%" : "100%" }} /></div></CardContent></Card>)}</div><p className="text-muted mt-3 text-xs">Cobertura de validación: {observed}/{FACTS.length}. Dato observado no equivale automáticamente a dato fiable, atribuido ni causal.</p><p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Puerta de uso del dato preparada." : "Sin puerta de uso seleccionada: faltan definiciones, fuente de verdad, reconciliación o evidencia suficiente."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p></CardContent></Card> : <EmptyState title="Todavía no hay evaluaciones de calidad de datos" />}</CardContent>
  </Card>;
}
