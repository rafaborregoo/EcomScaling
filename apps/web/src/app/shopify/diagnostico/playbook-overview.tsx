"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, ErrorBlock, LoadingBlock } from "@/components/ui";

const DOMAINS = [
  ["playbooks", "Framework universal"],
  ["acquisition", "Adquisición"],
  ["paid-media", "Paid media"],
  ["conversion", "Conversión / CRO"],
  ["offer-pricing", "Oferta / pricing"],
  ["retention-crm", "Retención / CRM"],
  ["unit-economics", "Unit economics"],
  ["product-inventory", "Producto / stock"],
  ["operations-cx", "Operaciones / CX"],
  ["measurement-experimentation", "Datos / experimentación"],
  ["scalability", "Escalabilidad / constraints"],
  ["recovery-crisis", "Recovery / crisis"],
  ["benchmark-guardrails", "Benchmarks / guardrails"],
  ["cohort-context", "Contexto / cohortes"],
  ["data-quality-reliability", "Calidad / fiabilidad"],
  ["acquisition-demand", "Adquisición / demanda"],
  ["paid-media-benchmarks", "Paid Media / benchmarks"],
  ["conversion-cro-benchmarks", "Conversión / CRO benchmarks"],
  ["offer-pricing-benchmarks", "Oferta / pricing benchmarks"],
  ["retention-crm-benchmarks", "Retención / CRM benchmarks"],
  ["unit-economics-benchmarks", "Unit economics benchmarks"],
  ["operations-cx-benchmarks", "Operaciones / CX benchmarks"],
  ["product-inventory-benchmarks", "Inventario / salud comercial"],
  ["scalability-benchmarks", "Escalabilidad / límites"],
  ["anomalies-red-flags", "Anomalías / red flags"],
  ["benchmark-confidence", "Confianza / incertidumbre"],
] as const;

type Run = { disposition: string; unresolved_unknowns?: string[] };
type DomainSummary = { key: string; label: string; disposition: string; unknowns: number };

function tone(disposition: string) {
  if (disposition === "READY_FOR_RECOMMENDATION") return "success" as const;
  if (disposition === "BLOCKED") return "danger" as const;
  return "warn" as const;
}

function barClass(disposition: string) {
  return disposition === "BLOCKED" ? "bg-danger" : disposition === "READY_FOR_RECOMMENDATION" ? "bg-success" : "bg-warn";
}

export function PlaybookDiagnosticOverviewPanel() {
  const [summaries, setSummaries] = useState<DomainSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(DOMAINS.map(async ([key, label]) => {
      try {
        const response = await apiFetch(`/v1/consultant/${key}`);
        if (!response.ok) throw new Error(await readApiError(response));
        const payload = await response.json() as { assessments?: Run[] };
        const current = payload.assessments?.[0];
        return { key, label, disposition: current?.disposition ?? "SIN_EVALUACION", unknowns: current?.unresolved_unknowns?.length ?? 0 };
      } catch {
        return { key, label, disposition: "NO_DISPONIBLE", unknowns: 0 };
      }
    })).then((next) => { if (!cancelled) setSummaries(next); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar el resumen de diagnósticos."); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!summaries) return <LoadingBlock label="Ordenando diagnósticos de los playbooks..." />;

  const attention = summaries.filter((item) => ["BLOCKED", "VALIDATION_REQUIRED", "REASSESS_DIAGNOSIS", "REPRIORITIZE"].includes(item.disposition)).length;
  const ready = summaries.filter((item) => item.disposition === "READY_FOR_RECOMMENDATION").length;

  return (
    <Card id="insight-diagnostic-overview" title="Mapa de diagnóstico IA" description="Una lectura transversal de todos los playbooks: cada fila enlaza con su card de detalle y conserva los huecos de evidencia para el Copiloto.">
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-default-200 p-3"><p className="text-muted text-xs">Bloques revisados</p><p className="mt-1 text-xl font-semibold">{summaries.length}</p></div>
        <div className="rounded border border-default-200 p-3"><p className="text-muted text-xs">Requieren atención</p><p className="mt-1 text-xl font-semibold text-warn-deep">{attention}</p></div>
        <div className="rounded border border-default-200 p-3"><p className="text-muted text-xs">Listos para recomendar</p><p className="mt-1 text-xl font-semibold text-success">{ready}</p></div>
      </div>
      <div className="space-y-3" role="list" aria-label="Estado de diagnósticos IA">
        {summaries.map((item) => {
          const width = item.disposition === "SIN_EVALUACION" || item.disposition === "NO_DISPONIBLE" ? 12 : item.disposition === "READY_FOR_RECOMMENDATION" ? 100 : 66;
          return <div key={item.key} role="listitem" className="grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-center"><span className="text-sm">{item.label}</span><div className="h-2 rounded bg-default-100" aria-hidden="true"><div className={`h-2 rounded ${barClass(item.disposition)}`} style={{ width: `${width}%` }} /></div><Badge tone={item.disposition === "SIN_EVALUACION" || item.disposition === "NO_DISPONIBLE" ? "neutral" : tone(item.disposition)}>{item.disposition}{item.unknowns ? ` · ${item.unknowns} huecos` : ""}</Badge></div>;
        })}
      </div>
    </Card>
  );
}
