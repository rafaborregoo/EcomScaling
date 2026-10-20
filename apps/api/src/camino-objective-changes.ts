import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { createLogger } from "@e-nora/observability";
import type { AuthContext } from "./auth-context.js";
import { notify, organizationName } from "./notify.js";

/**
 * Cambios de objetivos de Mi Camino: quien cambio que, aviso a la otra parte y
 * revision del Camino fuera de ciclo para que la IA proponga ajustes.
 *
 * Mi Camino es la unica fuente de objetivos (decision de Rafa, 2026-10-19) y
 * los pueden cambiar tanto el consultor como el cliente. Cada cambio:
 * 1. queda en `camino_objective_changes` (lo lee la revision del Camino);
 * 2. avisa a los demas -- consultores asignados y owners/managers --, nunca a
 *    quien lo hizo; sin consultor, solo al resto del equipo del cliente;
 * 3. programa una revision A19 que propone ajustes. Nada se aplica solo: las
 *    propuestas las acepta quien pueda gestionar el plan, consultor o cliente.
 */

const logger = createLogger("camino-objective-changes");

export type ObjectiveChangeAction = "created" | "updated" | "removed";

export type ObjectiveChange = {
  organizationId: string;
  storeId: string | null;
  planId?: string | null;
  targetId?: string | null;
  milestoneId?: string | null;
  scope: "objective" | "plan_goal";
  metricKey: string;
  metricLabel: string;
  unit?: string | null;
  period?: string | null;
  action: ObjectiveChangeAction;
  previousValue: number | null;
  newValue: number | null;
  reason?: string | null;
};

export function objectiveActorRole(context: AuthContext): "consultant" | "client" {
  return ["platform_admin", "consultant"].includes(context.profile.platform_role)
    ? "consultant"
    : "client";
}

const PERIOD_TEXT: Record<string, string> = {
  monthly: " al mes",
  quarterly: " al trimestre",
  yearly: " al año",
};

function formatValue(value: number | null, unit?: string | null) {
  if (value === null) return "sin cifra";
  const number = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(value);
  return unit === "pct" ? `${number} %` : number;
}

/** «Margen neto: 20 % → 25 % al mes». Sin moneda: el aviso no la conoce. */
export function describeObjectiveChange(change: Pick<ObjectiveChange, "action" | "metricLabel" | "unit" | "period" | "previousValue" | "newValue">) {
  const period = change.period ? (PERIOD_TEXT[change.period] ?? "") : "";
  const label = `«${change.metricLabel}»`;
  if (change.action === "created") return `${label}: ${formatValue(change.newValue, change.unit)}${period}`;
  if (change.action === "removed") return `${label} (era ${formatValue(change.previousValue, change.unit)}${period})`;
  return `${label}: ${formatValue(change.previousValue, change.unit)} → ${formatValue(change.newValue, change.unit)}${period}`;
}

async function audience(supabase: SupabaseClient, organizationId: string) {
  const [consultants, members] = await Promise.all([
    supabase
      .from("consultant_assignments")
      .select("consultant_user_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true),
    supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("role", ["owner", "manager"]),
  ]);
  return new Set<string>([
    ...(consultants.data ?? []).map((row) => row.consultant_user_id as string),
    ...(members.data ?? []).map((row) => row.user_id as string),
  ]);
}


/**
 * Registra el cambio y avisa a los demas. Best-effort: el objetivo ya esta
 * guardado y un aviso que falla no puede deshacerlo ni tumbar la respuesta.
 */
export async function recordObjectiveChange(
  supabase: SupabaseClient,
  context: AuthContext,
  change: ObjectiveChange,
) {
  try {
    const { data, error } = await supabase
      .from("camino_objective_changes")
      .insert({
        organization_id: change.organizationId,
        store_id: change.storeId,
        plan_id: change.planId ?? null,
        target_id: change.targetId ?? null,
        milestone_id: change.milestoneId ?? null,
        scope: change.scope,
        metric_key: change.metricKey,
        metric_label: change.metricLabel,
        period: change.period ?? null,
        action: change.action,
        previous_value: change.previousValue,
        new_value: change.newValue,
        reason: change.reason?.trim().slice(0, 500) || null,
        actor_user_id: context.user.id,
        actor_role: objectiveActorRole(context),
      })
      .select("id")
      .single();
    if (error) {
      logger.error("objective_change_insert_failed", { organization_id: change.organizationId, error: error.message });
    }

    const recipients = await audience(supabase, change.organizationId);
    recipients.delete(context.user.id);
    if (recipients.size === 0) return;

    // Con nombres: el consultor por su nombre de pila; alguien del cliente,
    // con su tienda al lado (el consultor lleva varias).
    const firstName = context.profile.full_name?.trim().split(/\s+/)[0] ?? "";
    const who = objectiveActorRole(context) === "consultant"
      ? firstName || "Tu consultor"
      : `${firstName || "Alguien"} de ${await organizationName(supabase, change.organizationId)}`;
    await notify(supabase, {
      type: "camino_objective",
      organizationId: change.organizationId,
      recipients,
      actorUserId: context.user.id,
      data: {
        kind: "changed",
        changeId: (data?.id as string | undefined) ?? null,
        who,
        action: change.action,
        scope: change.scope,
        detail: describeObjectiveChange(change),
        reason: change.reason?.trim() || null,
      },
    });
  } catch (error) {
    logger.error("objective_change_record_threw", {
      organization_id: change.organizationId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

/** Resultado de la revision disparada por el cambio: le llega a todos. */
export async function notifyObjectiveReviewDone(
  supabase: SupabaseClient,
  organizationId: string,
  proposals: number,
) {
  try {
    await notify(supabase, {
      type: "camino_objective",
      organizationId,
      recipients: await audience(supabase, organizationId),
      data: { kind: "review", proposals },
    });
  } catch (error) {
    logger.error("objective_review_notify_threw", {
      organization_id: organizationId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
  }
}

// Espera antes de revisar: quien cambia un objetivo suele cambiar dos o tres
// seguidos, y una sola revision con todos cuesta menos y propone mejor.
const REVIEW_DELAY_MS = 2 * 60 * 1000;
const pendingReviews = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Programa la revision del Camino tras un cambio de objetivo, reiniciando la
 * espera si llega otro cambio del mismo alcance.
 *
 * ponytail: espera en memoria de un solo proceso. Si la API se reinicia en esos
 * dos minutos no se pierde el cambio: la revision periodica lee todos los
 * cambios desde la anterior. Pasar a un job retrasado de BullMQ si hay varias
 * replicas de la API.
 */
export function scheduleObjectiveChangeReview(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  storeId: string | null,
) {
  const key = `${organizationId}:${storeId ?? "org"}`;
  const previous = pendingReviews.get(key);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    pendingReviews.delete(key);
    // Import diferido: ai-runtime importa strategic-plans, que importa este modulo.
    void Promise.all([import("./ai-runtime.js"), import("./decision-context-engine.js")])
      .then(async ([{ runCaminoObjectiveChangeReviews }, { runDecisionContextEngine }]) => {
        // Primero el contexto de decision (determinista, sin modelo): su
        // objetivo principal es la meta del Camino y el diagnostico lo lee.
        await runDecisionContextEngine(env, organizationId).catch((error: unknown) => {
          logger.error("objective_change_decision_context_failed", {
            organization_id: organizationId,
            error: error instanceof Error ? error.message : "unknown_error",
          });
        });
        await runCaminoObjectiveChangeReviews(env, context, organizationId, storeId);
      })
      .catch((error) => {
        logger.error("objective_review_schedule_failed", {
          organization_id: organizationId,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      });
  }, REVIEW_DELAY_MS);
  timer.unref?.();
  pendingReviews.set(key, timer);
}
