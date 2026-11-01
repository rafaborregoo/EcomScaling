"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

type Assessment = { id: string; candidate_ref: string; as_of: string; temporal_assessment: string; temporal_confidence: string; total_response_time_days: number | null; unresolved_unknowns: string[]; reason_codes: string[] };
const labels: Record<string, string> = { TIME_CRITICAL: "Tiempo crítico", TIME_SENSITIVE: "Sensible al tiempo", NOT_TIME_SENSITIVE: "Sin sensibilidad temporal", UNKNOWN: "Timing desconocido" };

export function TemporalUrgencyPanel() {
  const [items, setItems] = useState<Assessment[] | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { let cancelled = false; apiFetch("/v1/consultant/temporal-urgency").then(async (response) => { if (cancelled) return; if (!response.ok) { setError(await readApiError(response)); return; } setItems((await response.json() as { assessments: Assessment[] }).assessments); }).catch(() => { if (!cancelled) setError("No se pudo cargar la evaluación temporal."); }); return () => { cancelled = true; }; }, []);
  if (error) return <ErrorBlock>{error}</ErrorBlock>; if (!items) return <LoadingBlock label="Cargando urgencia temporal..." />;
  return <Card>
    <CardHeader>
      <CardTitle>Urgencia temporal P03</CardTitle>
      <CardDescription>Evalúa ventanas, deadlines y tiempos de respuesta. No convierte urgencia en ranking ni en acción automática.</CardDescription>
    </CardHeader>
    <CardContent>{items.length ? <div className="space-y-2">{items.map((item) => <article key={item.id} className="border-default-200 space-y-2 border-t py-4 first:border-t-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={item.temporal_assessment === "TIME_CRITICAL" ? "danger" : item.temporal_assessment === "UNKNOWN" ? "warn" : "neutral"}>{labels[item.temporal_assessment] ?? item.temporal_assessment}</Badge><Badge tone="neutral">{item.temporal_confidence}</Badge><span className="text-muted text-xs">{new Date(item.as_of).toLocaleString("es-ES")}</span></div><p className="text-muted text-sm">Candidato: <span className="font-mono">{item.candidate_ref}</span>. Tiempo total de respuesta: {item.total_response_time_days === null ? "desconocido" : `${item.total_response_time_days} días`}.</p>{item.unresolved_unknowns.length ? <p className="text-muted text-xs">Pendiente: {item.unresolved_unknowns.join(", ")}.</p> : null}</article>)}</div> : <EmptyState title="Sin assessments temporales" hint="El worker P03 evalúa los diagnósticos temporales vigentes de F3." />}</CardContent>
  </Card>;
}
