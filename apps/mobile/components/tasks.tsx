import { useState } from "react";
import { c } from "../lib/theme";
import { Sheet, SheetError } from "./sheet";
import { TareasPanel } from "./tareas-panel";
import { completeTask } from "./tarea-hoja";
import { SummaryRow } from "./ui";

// Subconjunto de /v1/organizations/:id/operations (ver apps/web/src/app/tareas/page.tsx).
export type Task = {
  id: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  due_at: string | null;
  assignee_name: string | null;
  store?: { id: string; name: string | null } | null;
};

const PRIORITY_WEIGHT: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };

const SHORT_TERM_DAYS = 14;

const isOpen = (t: Task) => t.status === "pending" || t.status === "in_progress";
// Misma regla que el Dashboard de la web: abiertas, y solo las vencidas, sin fecha o que vencen en las próximas 2 semanas.
const isShortTerm = (t: Task) => isOpen(t) && (t.due_at === null || new Date(t.due_at).getTime() - Date.now() <= SHORT_TERM_DAYS * 86_400_000);
const isOverdue = (t: Task) => isOpen(t) && t.due_at !== null && new Date(t.due_at).getTime() < Date.now();

// Vencidas primero, luego por prioridad y por fecha.
export function sortTasks(tasks: Task[]) {
  return tasks.filter(isShortTerm).sort((a, b) => {
    const o = Number(isOverdue(b)) - Number(isOverdue(a));
    if (o) return o;
    const p = (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0);
    if (p) return p;
    return (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity);
  });
}

/** Tareas a 2 semanas vista: una fila-resumen y todas en la hoja, donde se completan con una línea de resultado. Si no hay ninguna, no ocupa sitio. */
export function TasksWidget({ orgId, tasks, onChanged }: { orgId: string; tasks: Task[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const list = sortTasks(tasks);
  const overdue = list.filter(isOverdue).length;
  if (list.length === 0) return null;

  // El API decide quién puede cerrar (un consultor no cierra tareas del cliente): si no, su mensaje sale tal cual.
  async function complete(task: Task, note: string) {
    setError(null);
    try {
      await completeTask(orgId, task.id, note);
      if (list.length === 1) setOpen(false);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la tarea.");
    }
  }

  return (
    <>
      <SummaryRow
        title="Tareas"
        summary={overdue ? `${overdue} vencida${overdue > 1 ? "s" : ""}` : `${list.length} abierta${list.length > 1 ? "s" : ""}`}
        color={overdue ? c.danger : undefined}
        dot={overdue ? c.danger : undefined}
        onPress={() => setOpen(true)}
      />

      <Sheet visible={open} onClose={() => setOpen(false)} title="Tareas" count={list.length}>
        <TareasPanel tasks={list.map((t) => ({ id: t.id, title: t.title, priority: t.priority, due_at: t.due_at, who: t.assignee_name, mine: false, onComplete: (note) => complete(t, note) }))} />
        <SheetError text={error} />
      </Sheet>
    </>
  );
}
