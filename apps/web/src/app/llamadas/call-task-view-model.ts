export type CallTaskAudience = "cliente" | "consultor";

export type CallTaskData = {
  is_visible_to_client?: boolean;
  metadata?: { owner?: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Por hacer",
  in_progress: "En curso",
  completed: "Completada",
  ignored: "Ignorada",
  cancelled: "Cancelada",
};

export function callTaskStatusLabel(status: string | null | undefined) {
  return STATUS_LABELS[status ?? ""] ?? "Sin estado";
}

export function callTaskAudience(task: CallTaskData): CallTaskAudience {
  if (
    task.is_visible_to_client === false ||
    task.metadata?.owner === "consultor"
  ) {
    return "consultor";
  }

  return "cliente";
}
