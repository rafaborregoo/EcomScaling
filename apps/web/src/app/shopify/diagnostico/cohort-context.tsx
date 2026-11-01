"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { EmptyState, Badge, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type CohortRun = { organization_id: string; disposition: string; selected_instance_id: string | null; unresolved_unknowns: string[]; input_envelope?: { context?: { facts?: Record<string, string> } } };
const FACTS = [
  ["cohort.metric.observed", "Métrica observada"], ["cohort.sample.observed", "Muestra"],
  ["cohort.history.observed", "Histórico comparable"], ["cohort.tenant_context.observed", "Contexto tenant"],
  ["cohort.reference.observed", "Referencia"], ["cohort.definition_compatibility.observed", "Definiciones"],
  ["cohort.mix.observed", "Control de mix"], ["cohort.temporal_context.observed", "Temporalidad"],
  ["cohort.comparability.observed", "Comparabilidad"], ["cohort.confidence.observed", "Confianza"],
] as const;
function tone(disposition: string) { if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const; if (disposition === "BLOCKED") return "danger" as const; return "warn" as const; }

export function CohortContextPanel() {
  const [runs, setRuns] = useState<CohortRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/cohort-context").then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: CohortRun[] }>; }).then((payload) => { if (!cancelled) setRuns(payload.assessments); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar el contexto de cohortes."); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando contexto y cohortes F6.01..." />;
  const current = runs[0]; const facts = current?.input_envelope?.context?.facts ?? {}; const value = (key: string) => facts[key] ?? "UNKNOWN"; const observed = FACTS.filter(([key]) => value(key) !== "UNKNOWN").length;
  return <Card id="insight-cohort-context">
    <CardHeader>
      <CardTitle>Contexto y cohortes comparables</CardTitle>
      <CardDescription>Selecciona la referencia según la métrica y conserva las limitaciones de definición, muestra, mix y temporalidad. Una similitud superficial no se presenta como benchmark válido.</CardDescription>
    </CardHeader>
    <CardContent>{current ? <Card role="article"><CardContent><div className="flex items-center justify-between gap-3"><span className="text-muted text-xs">{current.organization_id}</span><Badge tone={tone(current.disposition)}>{current.disposition}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{FACTS.map(([key, label]) => <Card size="sm" key={key}><CardContent><div className="flex items-center justify-between gap-2 text-xs"><span>{label}</span><span className="font-mono text-muted">{value(key)}</span></div><div className="mt-2 h-1.5 rounded bg-default-100"><div className={`h-1.5 rounded ${value(key) === "TRUE" ? "bg-success" : value(key) === "FALSE" ? "bg-danger" : "bg-muted"}`} style={{ width: value(key) === "UNKNOWN" ? "22%" : "100%" }} /></div></CardContent></Card>)}</div><p className="text-muted mt-3 text-xs">Cobertura contextual: {observed}/{FACTS.length}. No se usa una cohorte universal ni se inventan dimensiones que Shopify no haya medido.</p><p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Referencia trazable preparada." : "Sin referencia seleccionada: faltan definiciones, contexto, muestra o comparabilidad suficientes."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p></CardContent></Card> : <EmptyState title="Todavía no hay evaluaciones de cohortes" />}</CardContent>
  </Card>;
}
