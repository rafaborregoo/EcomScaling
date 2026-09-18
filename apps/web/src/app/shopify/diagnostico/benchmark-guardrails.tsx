"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

type BenchmarkRun = { organization_id: string; disposition: string; candidate_count: number; selected_instance_id: string | null; unresolved_unknowns: string[]; input_envelope?: { context?: { facts?: Record<string, string> } } };
const FACTS = [
  ["benchmark.metric.value.observed", "Métrica observada"], ["benchmark.sample.observed", "Muestra"],
  ["benchmark.history.observed", "Histórico propio"], ["benchmark.context.observed", "Contexto tenant"],
  ["benchmark.comparability.observed", "Comparabilidad"], ["benchmark.reference.observed", "Referencia benchmark"],
  ["benchmark.economics.observed", "Economics"], ["benchmark.guardrails.observed", "Guardrails"],
  ["benchmark.confidence.observed", "Confianza"],
] as const;
function tone(disposition: string) { if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const; if (disposition === "BLOCKED") return "danger" as const; return "warn" as const; }

export function BenchmarkGuardrailsPanel() {
  const [runs, setRuns] = useState<BenchmarkRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/benchmark-guardrails").then(async (response) => { if (!response.ok) throw new Error(await readApiError(response)); return response.json() as Promise<{ assessments: BenchmarkRun[] }>; }).then((payload) => { if (!cancelled) setRuns(payload.assessments); }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar benchmarks y guardrails."); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!runs) return <LoadingBlock label="Cargando benchmarks y guardrails F6.00..." />;
  const current = runs[0]; const facts = current?.input_envelope?.context?.facts ?? {}; const value = (key: string) => facts[key] ?? "UNKNOWN"; const observed = FACTS.filter(([key]) => value(key) !== "UNKNOWN").length;
  return <Card id="insight-benchmark-guardrails" title="Benchmarks y guardrails F6.00" description="Contextualiza las métricas y protege economics, caja, inventario, operaciones, experiencia y calidad del crecimiento sin convertir una referencia en objetivo ni en acción.">{current ? <article className="rounded border border-default-200 p-4"><div className="flex items-center justify-between gap-3"><span className="text-muted text-xs">{current.organization_id}</span><Badge tone={tone(current.disposition)}>{current.disposition}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-3">{FACTS.map(([key, label]) => <div key={key} className="rounded border border-default-200 p-3"><div className="flex items-center justify-between gap-2 text-xs"><span>{label}</span><span className="font-mono text-muted">{value(key)}</span></div><div className="mt-2 h-1.5 rounded bg-default-100"><div className={`h-1.5 rounded ${value(key) === "TRUE" ? "bg-success" : value(key) === "FALSE" ? "bg-danger" : "bg-muted"}`} style={{ width: value(key) === "UNKNOWN" ? "22%" : "100%" }} /></div></div>)}</div><p className="text-muted mt-3 text-xs">Cobertura contextual: {observed}/{FACTS.length}. Benchmark, diagnóstico, prioridad y playbook permanecen separados.</p><p className="text-muted mt-2 text-xs">{current.selected_instance_id ? "Instancia trazable preparada." : "Sin instancia seleccionada: faltan comparabilidad, contexto y guardrails suficientes."}{current.unresolved_unknowns.length ? ` Unknowns: ${current.unresolved_unknowns.join(", ")}.` : ""}</p></article> : <p className="text-muted text-sm">Todavía no hay evaluaciones de benchmarks.</p>}</Card>;
}
