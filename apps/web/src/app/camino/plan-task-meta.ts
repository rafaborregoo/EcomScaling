/**
 * Lo que A19 escribe de cada tarea al crear el camino y que antes se perdía:
 * quién la ejecuta, de qué tipo es, cuánto cuesta, cuándo se da por hecha y qué
 * dato la justifica. Llega en `task.plan_meta`; es null en tareas hechas a mano.
 */

export type PlanTaskEvidence = { label: string; value: string; period: string | null; source: string };

export type PlanTaskMeta = {
  owner_role: "client" | "consultant" | "shared" | null;
  kind: string | null;
  /** Carril (puesta_a_punto, temporada, crecimiento) y cada cuanto se repite. */
  track?: string | null;
  cadence?: string | null;
  effort_hours: number | null;
  definition_of_done: string | null;
  rationale: string | null;
  evidence: PlanTaskEvidence[];
};

/** «Tu equipo», «Tu consultor», «Cliente», «Consultor» o «Compartida». */
export function metaOwnerLabel(meta: PlanTaskMeta | null | undefined, viewerIsClient: boolean): string | null {
  if (!meta?.owner_role) return null;
  if (meta.owner_role === "shared") return "Compartida";
  if (meta.owner_role === "client") return viewerIsClient ? "Tu equipo" : "Cliente";
  return viewerIsClient ? "Tu consultor" : "Consultor";
}

export function formatEffort(hours: number | null | undefined): string | null {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return null;
  return `${hours.toLocaleString("es-ES", { maximumFractionDigits: 2 })} h`;
}

/**
 * ¿Ofrecer «Crear borrador de email»? Si el camino dice de qué tipo es la tarea,
 * se fía de eso. Solo las tareas anteriores a ese dato (o hechas a mano) se
 * adivinan por el texto, como se hacía antes en dos sitios con la misma regex.
 */
export function taskWantsEmailDraft(task: {
  title: string;
  categories?: string[];
  plan_meta?: PlanTaskMeta | null;
}): boolean {
  const kind = task.plan_meta?.kind;
  if (kind) return kind === "email";
  const context = `${task.title} ${(task.categories ?? []).join(" ")}`
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  return /mail(?:ing)?|email|e-mail|correo|newsletter|klaviyo|lista de espera|acceso anticipado|campana/.test(context);
}
