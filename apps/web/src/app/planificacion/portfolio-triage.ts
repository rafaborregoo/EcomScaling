/**
 * Triaje de la cartera para la vista general de Planificación.
 *
 * La vista general no existía: sin cliente activo, el módulo decía "selecciona
 * un cliente" y ya. Pero la pregunta del consultor con doce tiendas no es
 * "¿cómo va esta?", es "¿en cuál tengo que meter horas esta semana?". Un
 * promedio de la cartera no la responde; una lista ordenada por quién está
 * peor, sí.
 *
 * Por eso esto devuelve una fila por cliente con UN motivo, no un panel de
 * cifras: el motivo es la acción a tomar.
 */

export type PlanningItem = {
  id: string;
  title: string;
  channel: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  organization_id: string;
  organization_name: string;
  blocked_reason: string | null;
  marketing_draft_id: string | null;
};

export type TriageClient = {
  organizationId: string;
  organizationName: string;
  blocked: PlanningItem[];
  overdue: PlanningItem[];
  withoutPiece: PlanningItem[];
  next: PlanningItem | null;
  upcomingCount: number;
  /** Qué le pasa a este cliente, en una línea. */
  reason: string;
  /** Mayor = peor. Solo para ordenar. */
  severity: number;
  tone: "danger" | "warn" | "neutral" | "success";
};

/** Una acción sigue viva mientras no se haya completado ni cancelado. */
function isOpen(item: PlanningItem) {
  return item.status !== "completed" && item.status !== "cancelled";
}

/**
 * Los canales que producen una pieza de Marketing. Una acción operativa
 * ("revisar stock", "llamar al proveedor") no necesita pieza, así que contarla
 * como "sin pieza" sería ruido permanente que nadie puede resolver.
 */
const PIECE_CHANNELS = ["Email", "Meta", "Instagram"];
function needsPiece(item: PlanningItem) {
  return PIECE_CHANNELS.includes(item.channel);
}

export function triageClients(
  items: PlanningItem[],
  organizations: Array<{ id: string; display_name: string }>,
  nowMs: number = Date.now(),
): TriageClient[] {
  const byOrg = new Map<string, PlanningItem[]>();
  for (const organization of organizations) byOrg.set(organization.id, []);
  for (const item of items) {
    // Un cliente con acciones pero fuera de la lista de asignados no se
    // inventa: la lista de clientes manda.
    byOrg.get(item.organization_id)?.push(item);
  }

  const rows: TriageClient[] = organizations.map((organization) => {
    const own = byOrg.get(organization.id) ?? [];
    const open = own.filter(isOpen);
    const blocked = open.filter((item) => item.blocked_reason);
    const overdue = open.filter(
      (item) =>
        !item.blocked_reason && Date.parse(item.starts_at) < nowMs,
    );
    const upcoming = open
      .filter((item) => Date.parse(item.starts_at) >= nowMs)
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    const withoutPiece = upcoming.filter(
      (item) => needsPiece(item) && !item.marketing_draft_id,
    );

    const base = {
      organizationId: organization.id,
      organizationName: organization.display_name,
      blocked,
      overdue,
      withoutPiece,
      next: upcoming[0] ?? null,
      upcomingCount: upcoming.length,
    };

    // Un solo motivo por fila, el más grave. Enseñar los cuatro a la vez
    // devuelve el problema original: hay que leerlo todo para saber qué hacer.
    if (blocked.length > 0)
      return {
        ...base,
        severity: 4,
        tone: "danger" as const,
        reason: `${blocked.length} ${blocked.length === 1 ? "acción parada" : "acciones paradas"}`,
      };
    if (overdue.length > 0)
      return {
        ...base,
        severity: 3,
        tone: "danger" as const,
        reason: `${overdue.length} ${overdue.length === 1 ? "acción vencida" : "acciones vencidas"}`,
      };
    if (upcoming.length === 0)
      return {
        ...base,
        severity: 2,
        tone: "warn" as const,
        reason: "Sin nada planificado",
      };
    if (withoutPiece.length > 0)
      return {
        ...base,
        severity: 1,
        tone: "warn" as const,
        reason: `${withoutPiece.length} sin pieza escrita`,
      };
    return {
      ...base,
      severity: 0,
      tone: "success" as const,
      reason: "Al día",
    };
  });

  return rows.sort(
    (a, b) =>
      b.severity - a.severity ||
      a.organizationName.localeCompare(b.organizationName, "es"),
  );
}

/** Cuántos clientes piden algo. Es el único número que merece titular. */
export function clientsNeedingWork(rows: TriageClient[]): number {
  return rows.filter((row) => row.severity > 0).length;
}
