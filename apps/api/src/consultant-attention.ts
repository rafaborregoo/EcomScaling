// "Que cliente necesita atencion hoy": senal determinista (sin IA) sobre las
// alertas vivas y las tareas abiertas. Aqui vive el calculo y la lectura
// paginada; consultant.ts solo lo llama.

export type AttentionAlertRow = {
  organization_id: string;
  severity: string | null;
  first_detected_at: string | null;
};
export type AttentionTaskRow = { organization_id: string; due_at: string | null };

export type Attention = {
  open_alerts: number;
  critical_alerts: number;
  high_alerts: number;
  oldest_alert_days: number;
  overdue_tasks: number;
  open_tasks: number;
  score: number;
};

const SEVERITY_WEIGHT: Record<string, number> = { critical: 10, high: 5, medium: 2, low: 1, info: 0 };
const DAY_MS = 86_400_000;

export const EMPTY_ATTENTION: Attention = {
  open_alerts: 0,
  critical_alerts: 0,
  high_alerts: 0,
  oldest_alert_days: 0,
  overdue_tasks: 0,
  open_tasks: 0,
  score: 0,
};

/** Agrupa una vez por organizacion: O(filas), no O(clientes x filas). */
export function scoreAttention(
  ids: string[],
  alerts: AttentionAlertRow[],
  tasks: AttentionTaskRow[],
  now: number,
): Map<string, Attention> {
  const alertsByOrg = new Map<string, AttentionAlertRow[]>();
  for (const row of alerts) {
    const list = alertsByOrg.get(row.organization_id);
    if (list) list.push(row);
    else alertsByOrg.set(row.organization_id, [row]);
  }
  const tasksByOrg = new Map<string, AttentionTaskRow[]>();
  for (const row of tasks) {
    const list = tasksByOrg.get(row.organization_id);
    if (list) list.push(row);
    else tasksByOrg.set(row.organization_id, [row]);
  }

  const result = new Map<string, Attention>();
  for (const id of ids) {
    const orgAlerts = alertsByOrg.get(id) ?? [];
    const orgTasks = tasksByOrg.get(id) ?? [];

    const oldestAlertDays = orgAlerts.reduce((max, row) => {
      const detectedAt = row.first_detected_at ? Date.parse(row.first_detected_at) : now;
      return Math.max(max, Math.floor((now - detectedAt) / DAY_MS));
    }, 0);
    const overdueTasks = orgTasks.filter((row) => row.due_at && Date.parse(row.due_at) < now).length;
    const severityScore = orgAlerts.reduce((sum, row) => sum + (SEVERITY_WEIGHT[row.severity ?? ""] ?? 1), 0);

    result.set(id, {
      open_alerts: orgAlerts.length,
      critical_alerts: orgAlerts.filter((row) => row.severity === "critical").length,
      high_alerts: orgAlerts.filter((row) => row.severity === "high").length,
      oldest_alert_days: oldestAlertDays,
      overdue_tasks: overdueTasks,
      open_tasks: orgTasks.length,
      score: severityScore + Math.min(oldestAlertDays, 14) + overdueTasks * 3,
    });
  }
  return result;
}

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Lee todas las filas de una consulta `.in("organization_id", ids)` sin pasar
 * de la URL ni del tope de filas de PostgREST (1.000 por peticion): los ids
 * van en lotes y cada lote se pagina. Devuelve el primer error en vez de
 * esconderlo: unos ceros por un fallo parecen un cliente tranquilo.
 */
export async function fetchAllByOrganization<T>(
  ids: string[],
  load: (chunk: string[], from: number, to: number) => PageResult<T>,
  options: { chunkSize?: number; pageSize?: number; maxPages?: number } = {},
): Promise<{ data: T[]; error: string | null }> {
  const chunkSize = options.chunkSize ?? 100;
  const pageSize = options.pageSize ?? 1000;
  const maxPages = options.maxPages ?? 50;
  const rows: T[] = [];
  for (let start = 0; start < ids.length; start += chunkSize) {
    const chunk = ids.slice(start, start + chunkSize);
    for (let page = 0; page < maxPages; page += 1) {
      const from = page * pageSize;
      const { data, error } = await load(chunk, from, from + pageSize - 1);
      if (error) return { data: rows, error: error.message };
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < pageSize) break;
    }
  }
  return { data: rows, error: null };
}
