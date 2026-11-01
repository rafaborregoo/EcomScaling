"use client";
import { ButtonLink, Card, CardContent, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown } from "@/components/ui";

export type CaminoClosure = { id: string; created_at: string; snapshot: {
  plan?: { name?: string; goal?: { metric_label?: string; baseline?: number | null; target?: number | null } };
  review?: { period_end?: string; output?: { goal_progress?: { status?: string; observed_value?: number | null; explanation?: string } } };
  milestones?: Array<{ name: string; status: string; completion_kind?: string | null; completion_evidence?: string | null }>;
  tasks?: Array<{ title: string; status: string }>;
} };
export function ClosureSummary({ closures, completed }: { closures: CaminoClosure[]; completed: boolean }) {
  if (!closures.length) return completed ? <Card><CardContent><h2>Recorrido cerrado</h2><p>Este cierre anterior no conserva una verificación estructurada del resultado.</p><ButtonLink href="/camino/nuevo">Preparar el siguiente camino</ButtonLink></CardContent></Card> : null;
  return <section aria-label="Historial de cierre del Camino">{closures.map((closure, index) => {
    const snapshot = closure.snapshot, milestones = snapshot.milestones ?? [], tasks = snapshot.tasks ?? [];
    const result = snapshot.review?.output?.goal_progress;
    return <Card key={closure.id}><CardContent>
      <h2>{index === 0 && completed ? "Recorrido cerrado" : "Cierre anterior a la reapertura"} · {new Date(closure.created_at).toLocaleDateString("es-ES")}</h2>
      <p>Trabajo: {tasks.filter((t) => t.status === "completed").length} de {tasks.length} tareas hechas.</p>
      <p>Hitos: {milestones.filter((m) => m.status === "completed" && m.completion_kind !== "exception").length} cerrados con verificación · {milestones.filter((m) => m.status === "skipped").length} omitidos · {milestones.filter((m) => m.completion_kind === "exception").length} por excepción.</p>
      <p>Resultado: {result?.status === "achieved" ? "Meta alcanzada en la última medición disponible" : result?.observed_value != null ? "Meta pendiente en la última medición disponible" : "Resultado pendiente de verificar"}.</p>
      {snapshot.plan?.goal ? <p>{snapshot.plan.goal.metric_label}: meta {snapshot.plan.goal.target ?? "sin cuantificar"}; valor observado {result?.observed_value ?? "sin lectura fiable"}.</p> : null}
      {snapshot.review?.period_end ? <p>Medición del {new Date(snapshot.review.period_end).toLocaleDateString("es-ES")}; no equivale a una medición al cerrar.</p> : null}
      <Collapsible><CollapsibleTrigger>Trabajo y evidencias del cierre<IconChevronDown aria-hidden /></CollapsibleTrigger><CollapsibleContent>
        <ul>{milestones.map((m, i) => <li key={i}>{m.name} · {m.status === "skipped" ? "Omitido" : m.completion_kind === "exception" ? "Cierre por excepción" : m.completion_kind ? "Verificado" : "Cierre anterior sin verificación estructurada"}{m.completion_evidence ? `: ${m.completion_evidence}` : ""}</li>)}</ul>
      </CollapsibleContent></Collapsible>
      <p>Revisa los aprendizajes en Seguimiento IA antes de reutilizarlos. El resultado observado no demuestra causalidad.</p>
      {index === 0 && completed ? <ButtonLink href="/camino/nuevo">Preparar el siguiente camino</ButtonLink> : null}
    </CardContent></Card>;
  })}</section>;
}
