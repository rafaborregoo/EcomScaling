import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import { clientManagersOf, consultantsOf, notify, organizationName } from "./notify.js";

/**
 * Avisos diarios, uno por tienda y persona (decision 2026-10-19,
 * docs/AUDITORIA_NOTIFICACIONES.md):
 *
 * - «Para hoy»: tareas abiertas que vencen hoy o van tarde. Al cliente solo
 *   las que ve; al consultor, todas.
 * - Propuestas de la IA esperando decision: al consultor, o al cliente si no
 *   tiene consultor (entonces decide el). Solo si hay alguna nueva desde el
 *   ultimo aviso: las mismas propuestas no se repiten cada mañana.
 *
 * Lo dispara el worker a las 8:00 (Europe/Madrid) via
 * /v1/internal/notifications/daily-tick. Idempotente en el dia: si corre dos
 * veces, la segunda no crea nada.
 */

type ApiEnv = LoadedApiEnv;
const logger = createLogger("notification-daily");
const TZ = "Europe/Madrid";

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

/** Inicio y fin del dia de hoy en Madrid, como instantes UTC. */
export function madridDayBounds(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, Number(part.value)]),
  ) as { hour: number; minute: number; second: number };
  const elapsedMs = (((parts.hour % 24) * 60 + parts.minute) * 60 + parts.second) * 1000;
  const start = new Date(now.getTime() - elapsedMs - now.getMilliseconds());
  return { start, end: new Date(start.getTime() + 86_400_000 - 1) };
}

type DueTask = { id: string; title: string; due_at: string };

async function alreadySentToday(
  supabase: ReturnType<typeof createServiceClient>,
  type: string,
  organizationId: string,
  dayStart: Date,
) {
  const { data } = await supabase
    .from("notifications")
    .select("user_id")
    .eq("type", type)
    .eq("organization_id", organizationId)
    .gte("created_at", dayStart.toISOString());
  return new Set((data ?? []).map((row) => row.user_id as string));
}

async function runToday(supabase: ReturnType<typeof createServiceClient>, start: Date, end: Date) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, organization_id, title, due_at, assigned_to, is_visible_to_client")
    .in("status", ["pending", "in_progress"])
    .not("due_at", "is", null)
    .lte("due_at", end.toISOString())
    .order("due_at", { ascending: true })
    .limit(5000);
  if (error) throw new Error(`daily_today_load_failed: ${error.message}`);

  const byOrg = new Map<string, Array<DueTask & { assigned_to: string | null; is_visible_to_client: boolean }>>();
  for (const row of (data ?? []) as Array<DueTask & { organization_id: string; assigned_to: string | null; is_visible_to_client: boolean }>) {
    byOrg.set(row.organization_id, [...(byOrg.get(row.organization_id) ?? []), row]);
  }

  let sent = 0;
  for (const [organizationId, tasks] of byOrg) {
    const skip = await alreadySentToday(supabase, "daily_today", organizationId, start);
    const store = await organizationName(supabase, organizationId);
    const asItems = (list: DueTask[]) =>
      list.map((task) => ({ id: task.id, title: task.title, late: Date.parse(task.due_at) < start.getTime() }));

    const visible = tasks.filter((task) => task.is_visible_to_client);
    const clientRecipients = new Set(await clientManagersOf(supabase, organizationId));
    for (const task of visible) if (task.assigned_to) clientRecipients.add(task.assigned_to);
    const consultants = await consultantsOf(supabase, organizationId);
    for (const id of consultants) clientRecipients.delete(id);

    if (visible.length > 0) {
      sent += await notify(supabase, {
        type: "daily_today",
        organizationId,
        recipients: [...clientRecipients].filter((id) => !skip.has(id)),
        data: { store: null, tasks: asItems(visible) },
      });
    }
    sent += await notify(supabase, {
      type: "daily_today",
      organizationId,
      recipients: consultants.filter((id) => !skip.has(id)),
      data: { store, tasks: asItems(tasks) },
    });
  }
  return sent;
}

async function runAiPending(supabase: ReturnType<typeof createServiceClient>, start: Date) {
  const { data, error } = await supabase
    .from("agent_outputs")
    .select("id, organization_id, created_at, output")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(`daily_ai_pending_load_failed: ${error.message}`);

  const byOrg = new Map<string, Array<{ id: string; created_at: string; titles: string[] }>>();
  for (const row of (data ?? []) as Array<{ id: string; organization_id: string; created_at: string; output: Record<string, unknown> | null }>) {
    const writes = Array.isArray(row.output?.proposed_writes) ? (row.output!.proposed_writes as Array<Record<string, unknown>>) : [];
    const titles = writes.map((write) => (typeof write.title === "string" ? write.title.trim() : "")).filter(Boolean);
    if (titles.length === 0) continue;
    byOrg.set(row.organization_id, [...(byOrg.get(row.organization_id) ?? []), { id: row.id, created_at: row.created_at, titles }]);
  }

  let sent = 0;
  for (const [organizationId, outputs] of byOrg) {
    const skip = await alreadySentToday(supabase, "ai_pending", organizationId, start);
    const consultants = await consultantsOf(supabase, organizationId);
    // Sin consultor decide el propio cliente (ai-runtime approvalCandidate).
    const forClient = consultants.length === 0;
    const recipients = (forClient ? await clientManagersOf(supabase, organizationId) : consultants).filter((id) => !skip.has(id));
    if (recipients.length === 0) continue;

    // Solo si hay algo nuevo desde el ultimo aviso de cada persona.
    const { data: last } = await supabase
      .from("notifications")
      .select("user_id, created_at")
      .eq("type", "ai_pending")
      .eq("organization_id", organizationId)
      .in("user_id", recipients)
      .order("created_at", { ascending: false });
    const lastByUser = new Map<string, number>();
    for (const row of last ?? []) {
      if (!lastByUser.has(row.user_id as string)) lastByUser.set(row.user_id as string, Date.parse(row.created_at as string));
    }
    const newest = Math.max(...outputs.map((output) => Date.parse(output.created_at)));
    const due = recipients.filter((id) => (lastByUser.get(id) ?? 0) < newest);
    if (due.length === 0) continue;

    sent += await notify(supabase, {
      type: "ai_pending",
      organizationId,
      recipients: due,
      data: {
        store: await organizationName(supabase, organizationId),
        forClient,
        titles: outputs.flatMap((output) => output.titles),
      },
    });
  }
  return sent;
}

export async function runDailyNotifications(env: ApiEnv, now = new Date()) {
  const supabase = createServiceClient(env);
  const { start, end } = madridDayBounds(now);
  const result = { status: "ok" as const, today: 0, ai_pending: 0 };
  try {
    result.today = await runToday(supabase, start, end);
  } catch (error) {
    logger.error("daily_today_failed", { error: error instanceof Error ? error.message : String(error) });
  }
  try {
    result.ai_pending = await runAiPending(supabase, start);
  } catch (error) {
    logger.error("daily_ai_pending_failed", { error: error instanceof Error ? error.message : String(error) });
  }
  return result;
}
