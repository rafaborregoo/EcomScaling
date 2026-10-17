import { useState } from "react";
import { Text, View } from "react-native";
import { c, font } from "../lib/theme";
import { Sheet } from "./sheet";
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
};

const PRIORITY_LABEL: Record<string, string> = { urgent: "Urgente", high: "Alta", medium: "Media", low: "Baja" };
const PRIORITY_WEIGHT: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const SHORT_TERM_DAYS = 14;

const isOpen = (t: Task) => t.status === "pending" || t.status === "in_progress";
// Misma regla que el Dashboard de la web: abiertas, y solo las vencidas, sin fecha o que vencen en las próximas 2 semanas.
const isShortTerm = (t: Task) => isOpen(t) && (t.due_at === null || new Date(t.due_at).getTime() - Date.now() <= SHORT_TERM_DAYS * 86_400_000);
const isOverdue = (t: Task) => isOpen(t) && t.due_at !== null && new Date(t.due_at).getTime() < Date.now();

function dueLabel(t: Task) {
  if (!t.due_at) return "Sin fecha";
  const d = new Date(t.due_at);
  return `${isOverdue(t) ? "Vencida · " : "Vence "}${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

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

function Row({ task }: { task: Task }) {
  const overdue = isOverdue(task);
  const hot = task.priority === "urgent" || task.priority === "high";
  return (
    <View style={{ paddingVertical: 12, gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hot ? c.danger : c.edge }} />
        <Text numberOfLines={2} style={{ flex: 1, fontSize: 15, fontFamily: font.medium, color: c.ink }}>{task.title}</Text>
      </View>
      <Text style={{ marginLeft: 16, fontSize: 13, fontFamily: overdue ? font.medium : font.regular, color: overdue ? c.danger : c.muted }}>
        {PRIORITY_LABEL[task.priority] ?? task.priority} · {dueLabel(task)}
      </Text>
    </View>
  );
}

/** Tareas a 2 semanas vista: una fila-resumen y todas en la hoja. Solo lectura; completarlas pide un resultado y se hace en la web. Si no hay ninguna, no ocupa sitio. */
export function TasksWidget({ tasks }: { tasks: Task[] }) {
  const [open, setOpen] = useState(false);
  const list = sortTasks(tasks);
  const overdue = list.filter(isOverdue).length;
  if (list.length === 0) return null;

  return (
    <>
      <SummaryRow
        title="Tareas"
        summary={overdue ? `${overdue} vencida${overdue > 1 ? "s" : ""}` : `${list.length} abierta${list.length > 1 ? "s" : ""}`}
        color={overdue ? c.danger : undefined}
        dot={overdue ? c.danger : undefined}
        onPress={() => setOpen(true)}
      />

      <Sheet visible={open} onClose={() => setOpen(false)} title={`Tareas (${list.length})`}>
        {list.map((t, i) => (
          <View key={t.id} style={{ borderTopWidth: i === 0 ? 0 : 1, borderTopColor: c.edge }}>
            <Row task={t} />
          </View>
        ))}
      </Sheet>
    </>
  );
}
