"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";

type PrioritizationRunView = {
  id: string;
  run_status: string;
  decision_validity: string;
  decision_as_of: string;
  unresolved_unknowns: string[];
  abstention_reason_codes: string[];
  input_envelope: { diagnostic_refs?: string[] };
  rule_traces: Array<{ rule_id: string; reason_codes: string[] }>;
};

const labels: Record<string, string> = {
  INPUT_INCOMPLETE: "Falta contexto",
  READY: "Listo para evaluar",
  COMPLETED: "Completado",
  ABSTAINED: "Abstención explícita",
  FAILED: "Fallo técnico",
};

function Run({ item }: { item: PrioritizationRunView }) {
  const missing = item.unresolved_unknowns.length ? `Pendiente: ${item.unresolved_unknowns.join(", ")}.` : "Sin unknowns materiales.";
  return <article className="border-default-200 space-y-2 border-t py-4 first:border-t-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={item.run_status === "FAILED" ? "danger" : item.run_status === "COMPLETED" ? "success" : "warn"}>{labels[item.run_status] ?? item.run_status}</Badge><Badge tone="neutral">{item.decision_validity}</Badge><span className="text-muted text-xs">{new Date(item.decision_as_of).toLocaleString("es-ES")}</span></div><p className="text-muted text-sm">{missing} Diagnósticos referenciados: {item.input_envelope.diagnostic_refs?.length ?? 0}. Trazas: {item.rule_traces.length}.</p>{item.abstention_reason_codes.length ? <p className="text-muted text-xs">Motivos: {item.abstention_reason_codes.join(", ")}</p> : null}</article>;
}

export function PrioritizationPanel() {
  const [items, setItems] = useState<PrioritizationRunView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; apiFetch("/v1/consultant/prioritization").then(async (response) => { if (cancelled) return; if (!response.ok) { setError(await readApiError(response)); return; } setItems((await response.json() as { runs: PrioritizationRunView[] }).runs); }).catch(() => { if (!cancelled) setError("No se pudo cargar la ejecución de priorización."); }); return () => { cancelled = true; }; }, []);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!items) return <LoadingBlock label="Cargando ejecución de priorización..." />;
  return <Card title="Ejecución de priorización P0" description="P0 congela la entrada y hace visibles los límites. El ranking aparece cuando exista contexto decisional de P1; no se inventa una cola.">{items.length ? <div className="space-y-2">{items.map((item) => <Run key={item.id} item={item} />)}</div> : <EmptyState title="Sin ejecuciones de priorización" hint="El worker P0 crea una ejecución al leer salidas diagnósticas vigentes." />}</Card>;
}
