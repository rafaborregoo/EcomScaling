/** Derives onboarding only from persisted evidence; unreadable sources remain unknown. */
export function buildClientOnboarding(input: {
  organizationId: string;
  connections: Array<{ provider: string; status: string; last_sync_at: string | null }>;
  hasFinancialSettings: boolean;
  reviewedAt: string | null;
  tasks: Array<{ assigned_to: string | null; due_at: string | null }>;
  sources: { connections: string; financial: string; reviews: string; tasks: string };
  nowMs: number;
}) {
  const org = encodeURIComponent(input.organizationId);
  const steps = [
    { key: "linked", label: "Cliente vinculado", complete: true, known: true, href: `/consultor?organizationId=${org}`, action: "Abrir cliente", detail: "El cliente ya pertenece a tu cartera." },
    { key: "connected", label: "Shopify conectado y sincronizado", complete: input.connections.some((c) => c.provider === "shopify" && ["connected", "syncing"].includes(c.status) && c.last_sync_at !== null && Date.parse(c.last_sync_at) >= input.nowMs - 24 * 60 * 60_000), known: input.sources.connections === "ok", href: `/consultor?tab=gestion&organizationId=${org}`, action: "Revisar conexión", detail: "El cliente conecta Shopify desde Integraciones. La última sincronización debe tener menos de 24 horas." },
    { key: "reviewed", label: "Costes configurados y revisión registrada", complete: input.hasFinancialSettings && input.reviewedAt !== null, known: input.sources.financial === "ok" && input.sources.reviews === "ok", href: `/consultor?organizationId=${org}`, action: "Revisar datos", detail: "Confirma costes, moneda y cobertura; después usa Marcar como revisado. Una sincronización por sí sola no confirma la calidad del dato." },
    { key: "action", label: "Acción con responsable y fecha", complete: input.tasks.some((task) => Boolean(task.assigned_to && task.due_at)), known: input.sources.tasks === "ok", href: `/tareas?organizationId=${org}`, action: "Preparar acción", detail: "Deja una tarea pendiente con responsable, fecha y un criterio de cierre claro." },
  ].map((step) => ({ ...step, status: !step.known ? "unknown" as const : step.complete ? "done" as const : "pending" as const }));
  return { organization_id: input.organizationId, steps, completed: steps.filter((s) => s.status === "done").length, next: steps.find((s) => s.status !== "done")?.key ?? null };
}
