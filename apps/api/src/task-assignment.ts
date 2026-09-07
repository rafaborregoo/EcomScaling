// A quien le toca la siguiente tarea de una tienda.
//
// `tasks.assigned_to` existe desde DB-07 y la agenda ya filtra por ella para
// "Mi trabajo", pero no la escribia nadie: con dos consultores sobre la misma
// tienda, cada tarea automatica era de nadie y las dos personas veian la misma
// lista sin saber cual era suya.
//
// El reparto sale de `consultant_assignments.work_share` (peso 0-100), que se
// gestiona desde Configuracion -> Accesos.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Candidate = {
  consultantUserId: string;
  workShare: number;
  isPrimary: boolean;
  openTasks: number;
};

const OPEN_STATUSES = ["pending", "in_progress"] as const;

/**
 * Metodo del divisor (D'Hondt): gana el menor `(carga + 1) / peso`.
 *
 * Con pesos iguales sale reparto por carga, que se autocorrige solo cuando uno
 * se atasca -- cosa que un round-robin no hace: alterna igual aunque el otro
 * tenga cuarenta tareas abiertas. Y con 100/0 todo cae en el principal sin
 * ninguna rama aparte. Peso 0 nunca recibe: no se puede dividir por cero, que
 * es exactamente lo que significa "a este no le repartas".
 *
 * Devuelve null si nadie puede recibir (sin consultores, o todos a 0): la tarea
 * nace sin responsable, como hasta ahora.
 */
export function pickAssignee(candidates: Candidate[]): string | null {
  let best: Candidate | null = null;
  let bestCost = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate.workShare <= 0) continue;

    const cost = (candidate.openTasks + 1) / candidate.workShare;
    // Empate al principal: es el interlocutor que ve el cliente. Sin desempate
    // estable el responsable bailaria segun el orden que devolviera la consulta.
    const wins =
      cost < bestCost ||
      (cost === bestCost && candidate.isPrimary && !best?.isPrimary);

    if (wins) {
      best = candidate;
      bestCost = cost;
    }
  }

  return best?.consultantUserId ?? null;
}

/**
 * Elige y apunta la carga en el propio candidato, para repartir un lote sin
 * releer la base de datos por tarea. Sin esto, las ocho tareas que propone la
 * IA de una tacada caerian todas en la misma persona: leen la misma carga.
 */
export function pickAssigneeForBatch(candidates: Candidate[]): string | null {
  const chosen = pickAssignee(candidates);
  const candidate = candidates.find(
    (item) => item.consultantUserId === chosen,
  );
  if (candidate) candidate.openTasks += 1;
  return chosen;
}

/**
 * Consultores activos de una tienda con su peso y su carga actual.
 *
 * La carga son las tareas abiertas en TODA su cartera, no solo en esta tienda:
 * la capacidad de un consultor es global, y contar por tienda dejaria al que
 * lleva diez recibiendo tanto como al que lleva una.
 */
export async function loadAssignmentCandidates(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Candidate[]> {
  const { data: assignments, error } = await supabase
    .from("consultant_assignments")
    .select("consultant_user_id, work_share, is_primary")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("consultant_user_id");

  if (error || !assignments || assignments.length === 0) return [];

  // Un count exacto por consultor en vez de traer las filas: son dos o tres
  // consultores por tienda, y asi no hay limite que trunque y sesgue la carga.
  const loads = await Promise.all(
    assignments.map(async (row) => {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", row.consultant_user_id as string)
        .in("status", OPEN_STATUSES);
      return count ?? 0;
    }),
  );

  return assignments.map((row, index) => ({
    consultantUserId: row.consultant_user_id as string,
    workShare: Number(row.work_share ?? 100),
    isPrimary: Boolean(row.is_primary),
    openTasks: loads[index] ?? 0,
  }));
}

/** A quien asignar una tarea suelta. Null si la tienda no tiene consultor. */
export async function resolveTaskAssignee(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  return pickAssignee(await loadAssignmentCandidates(supabase, organizationId));
}
