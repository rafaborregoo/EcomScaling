/**
 * Cómo se traduce una tarea de Mi Camino a las columnas de `tasks`.
 *
 * Antes la categoría era siempre «general» y `assigned_to` era quien pulsaba
 * «Crear»: si lo hacía el consultor, las tareas del cliente quedaban a su nombre,
 * y al revés. Ahora lo decide el contenido de la tarea: A19 dice quién la ejecuta
 * (`owner`) y de qué tipo es (`kind`), y el servidor lo resuelve.
 */

export const TASK_OWNERS = ["client", "consultant", "shared"] as const;
export const TASK_KINDS = [
  "email",
  "ads",
  "catalogo",
  "operaciones",
  "medicion",
  "contenido",
  "analisis",
  "otro",
] as const;

export type TaskOwner = (typeof TASK_OWNERS)[number];
export type TaskKind = (typeof TASK_KINDS)[number];
export type TaskCategory = "shopify" | "meta" | "klaviyo" | "general";

// Las categorías válidas de `tasks.categories` son shopify, meta, klaviyo y
// general (tasks_categories_valid): las fija el módulo, no el modelo.
const CATEGORY_BY_KIND: Record<TaskKind, TaskCategory> = {
  email: "klaviyo",
  ads: "meta",
  catalogo: "shopify",
  operaciones: "shopify",
  contenido: "general",
  medicion: "general",
  analisis: "general",
  otro: "general",
};

export function categoryForKind(kind: string | null | undefined): TaskCategory {
  return CATEGORY_BY_KIND[kind as TaskKind] ?? "general";
}

export function normalizeOwner(owner: unknown): TaskOwner | null {
  return TASK_OWNERS.includes(owner as TaskOwner) ? (owner as TaskOwner) : null;
}

export const TASK_TRACKS = ["puesta_a_punto", "temporada", "crecimiento"] as const;
export const TASK_CADENCES = ["una_vez", "semanal", "quincenal", "mensual"] as const;

export function normalizeTrack(track: unknown): (typeof TASK_TRACKS)[number] | null {
  return TASK_TRACKS.includes(track as (typeof TASK_TRACKS)[number]) ? (track as (typeof TASK_TRACKS)[number]) : null;
}

export function normalizeCadence(cadence: unknown): (typeof TASK_CADENCES)[number] | null {
  return TASK_CADENCES.includes(cadence as (typeof TASK_CADENCES)[number]) ? (cadence as (typeof TASK_CADENCES)[number]) : null;
}

export function normalizeKind(kind: unknown): TaskKind | null {
  return TASK_KINDS.includes(kind as TaskKind) ? (kind as TaskKind) : null;
}

/**
 * A quién se asigna. Sin `owner` (camino a mano o plantilla .md) se conserva el
 * comportamiento anterior: quien lo crea. Con `owner`, el consultor recibe lo
 * suyo y lo del cliente o lo compartido queda para el equipo del cliente
 * (`assigned_to` nulo; el responsable se muestra por `owner_role`).
 */
export function assigneeForOwner(
  owner: unknown,
  ids: { consultantId: string | null; creatorId: string },
): string | null {
  const normalized = normalizeOwner(owner);
  if (normalized === null) return ids.creatorId;
  return normalized === "consultant" ? ids.consultantId : null;
}

/**
 * Orden de las tareas de un hito: por `position` (la secuencia en que hay que
 * hacerlas) y, las anteriores a esa columna o añadidas a mano, al final por
 * fecha de alta. El select anidado de Supabase no garantiza ningún orden.
 */
export function sortTaskLinks<T extends { position?: number | null; created_at?: string | null }>(
  links: T[],
): T[] {
  return links.slice().sort((a, b) => {
    const pa = a.position ?? Number.POSITIVE_INFINITY;
    const pb = b.position ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa < pb ? -1 : 1;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });
}
