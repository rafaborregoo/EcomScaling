"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { Badge, EmptyState, ErrorBlock, LoadingBlock, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
type Assessment = { id: string; as_of: string; current_primary_ref: string | null; unresolved_unknowns: string[]; result: { constraint_map?: { near_constraints?: string[]; emerging_constraints?: string[]; future_constraints?: string[] }; dependency_graph?: Array<{ relation: string }> } };
export function ConstraintsPanel() { const [items, setItems] = useState<Assessment[] | null>(null); const [error, setError] = useState<string | null>(null); useEffect(() => { let cancelled = false; apiFetch("/v1/consultant/constraints").then(async (response) => { if (cancelled) return; if (!response.ok) { setError(await readApiError(response)); return; } setItems((await response.json() as { assessments: Assessment[] }).assessments); }).catch(() => { if (!cancelled) setError("No se pudo cargar el mapa de constraints."); }); return () => { cancelled = true; }; }, []); if (error) return <ErrorBlock>{error}</ErrorBlock>; if (!items) return <LoadingBlock label="Cargando constraints y dependencias..." />; return <Card>
  <CardHeader>
    <CardTitle>Constraints y dependencias P05</CardTitle>
    <CardDescription>Muestra restricciones y estructura de secuencia. No calcula prioridad ni fuerza una lista lineal.</CardDescription>
  </CardHeader>
  <CardContent>{items.length ? <div className="space-y-2">{items.map((item) => <article key={item.id} className="border-default-200 space-y-2 border-t py-4 first:border-t-0"><div className="flex flex-wrap items-center gap-2"><Badge tone={item.current_primary_ref ? "danger" : "warn"}>{item.current_primary_ref ? "Constraint primario" : "Objetivo o constraint desconocido"}</Badge><span className="text-muted text-xs">{new Date(item.as_of).toLocaleString("es-ES")}</span></div><p className="text-muted text-sm">Primario: <span className="font-mono">{item.current_primary_ref ?? "desconocido"}</span>. Dependencias: {item.result.dependency_graph?.length ?? 0}.</p>{item.unresolved_unknowns.length ? <p className="text-muted text-xs">Pendiente: {item.unresolved_unknowns.join(", ")}.</p> : null}</article>)}</div> : <EmptyState title="Sin mapas de constraints" hint="El worker P05 evalúa el objetivo y las restricciones activas del tenant." />}</CardContent>
</Card>; }
