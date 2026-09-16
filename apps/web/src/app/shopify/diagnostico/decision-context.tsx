"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, Card, EmptyState, ErrorBlock, LoadingBlock } from "@/components/ui";

type DecisionContextView = {
  id: string;
  organization_id: string;
  as_of: string;
  context_status: string;
  context_confidence: string;
  primary_objective_kind: string | null;
  primary_objective_statement: string | null;
  unresolved_unknowns: string[];
  reason_codes: string[];
  source_lineage_refs: string[];
};

const statusLabels: Record<string, string> = {
  COMPLETE: "Contexto completo",
  INCOMPLETE: "Falta contexto",
  CONFLICTING: "Contexto conflictivo",
  STALE: "Contexto obsoleto",
  FAILED: "Fallo técnico",
};

export function DecisionContextPanel() {
  const [items, setItems] = useState<DecisionContextView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    apiFetch("/v1/consultant/decision-context").then(async (response) => {
      if (cancelled) return;
      if (!response.ok) { setError(await readApiError(response)); return; }
      setItems((await response.json() as { contexts: DecisionContextView[] }).contexts);
    }).catch(() => { if (!cancelled) setError("No se pudo cargar el contexto decisional."); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!items) return <LoadingBlock label="Cargando contexto decisional..." />;
  return <Card title="Contexto decisional P1" description="El contexto separa objetivo, restricciones, recursos y riesgo. Si falta el objetivo o hay conflicto, queda visible y no se convierte en un ranking implícito.">
    {items.length ? <div className="space-y-2">{items.map((item) => <article key={item.id} className="border-default-200 space-y-2 border-t py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2"><Badge tone={item.context_status === "COMPLETE" ? "success" : item.context_status === "CONFLICTING" ? "danger" : "warn"}>{statusLabels[item.context_status] ?? item.context_status}</Badge><Badge tone="neutral">{item.context_confidence}</Badge><span className="text-muted text-xs">{new Date(item.as_of).toLocaleString("es-ES")}</span></div>
      <p className="text-sm">{item.primary_objective_statement ?? "No hay objetivo empresarial declarado."}</p>
      <p className="text-muted text-xs">{item.unresolved_unknowns.length ? `Pendiente: ${item.unresolved_unknowns.join(", ")}.` : "Sin unknowns materiales."} Lineage: {item.source_lineage_refs.length}. {item.reason_codes.length ? `Motivos: ${item.reason_codes.join(", ")}.` : ""}</p>
    </article>)}</div> : <EmptyState title="Sin snapshots de contexto" hint="El worker P1 crea un snapshot al leer la realidad y la declaración decisional del tenant." />}
  </Card>;
}
