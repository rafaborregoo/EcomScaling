import { metaOwnerLabel, type PlanTaskMeta } from "./plan-task-meta";

type OwnedTask = {
  plan_meta?: PlanTaskMeta | null;
  assigned_to?: string | null;
  assignee_name?: string | null;
  assignee_origin?: "consultant" | "client" | null;
};

/** «Tú», «Tu consultor», «Cliente» o el nombre de pila: a quién le toca. */
export function taskOwnerLabel(
  task: OwnedTask,
  viewerUserId: string,
  viewerIsClient: boolean,
): string | null {
  // Sin persona concreta (las tareas del equipo del cliente o las compartidas),
  // lo que diga el camino sobre quien la ejecuta.
  if (!task.assigned_to) return metaOwnerLabel(task.plan_meta, viewerIsClient);
  if (task.assigned_to === viewerUserId) return "Tú";
  if (viewerIsClient && task.assignee_origin === "consultant") return "Tu consultor";
  if (!viewerIsClient && task.assignee_origin === "client") return "Cliente";
  const first = (task.assignee_name ?? "").trim().split(/\s+/)[0];
  return first || "Otra persona";
}
