import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  type AuthContext,
  createUserScopedClient,
  requireOperationalOrganization,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { enqueueMemoryIngestion } from "./memory-ingestion.js";
import { findCurrentMilestoneId } from "./strategic-plans.js";
import { resolveTaskAssignee } from "./task-assignment.js";
import { parseTaskOutcomeInput } from "./task-outcome.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function requireMembership(context: AuthContext, organizationId: string) {
  return requireOperationalOrganization(context, organizationId);
}

function isConsultantOrAdmin(context: AuthContext) {
  return ["consultant", "platform_admin"].includes(
    context.profile.platform_role,
  );
}

function interpolate(
  template: string,
  values: Record<string, string | number | null | undefined>,
) {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value != null ? String(value) : "";
  });
}

const TASK_CATEGORIES = ["shopify", "meta", "klaviyo", "general"] as const;

function normalizeProviderCategory(
  provider: string,
): (typeof TASK_CATEGORIES)[number] {
  return (TASK_CATEGORIES as readonly string[]).includes(provider)
    ? (provider as (typeof TASK_CATEGORIES)[number])
    : "general";
}

type TemplateRow = {
  id: string;
  code: string;
  default_severity: string;
  default_condition: { operator?: string; threshold?: number };
  alert_title_template: string;
  alert_message_template: string;
  task_title_template: string | null;
  task_description_template: string | null;
  category: string;
};

type Detection = {
  fingerprint: string;
  metricValue: number;
  thresholdValue: number | null;
  sourceEntityType?: string;
  sourceEntityId?: string;
  contextData?: Record<string, unknown>;
  templateValues: Record<string, string | number | null | undefined>;
};

/**
 * Crea o refresca una alerta viva (idempotente por organizacion+fingerprint) y
 * su tarea asociada (maximo una por alerta, garantizado por indice unico).
 */
async function upsertAlertWithTask(
  supabase: SupabaseClient,
  organizationId: string,
  template: TemplateRow,
  detection: Detection,
) {
  const { data: existing, error: lookupError } = await supabase
    .from("alerts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("fingerprint", detection.fingerprint)
    .in("status", ["open", "acknowledged"])
    .maybeSingle();

  if (lookupError) {
    throw new Error(`alert_lookup_failed: ${lookupError.message}`);
  }

  const now = new Date().toISOString();

  if (existing) {
    const { error } = await supabase
      .from("alerts")
      .update({ last_detected_at: now, metric_value: detection.metricValue })
      .eq("id", existing.id);

    if (error) {
      throw new Error(`alert_refresh_failed: ${error.message}`);
    }

    return { alertId: existing.id, created: false };
  }

  const { data: alert, error: insertError } = await supabase
    .from("alerts")
    .insert({
      organization_id: organizationId,
      rule_template_id: template.id,
      source_entity_type: detection.sourceEntityType ?? null,
      source_entity_id: detection.sourceEntityId ?? null,
      severity: template.default_severity,
      title: interpolate(
        template.alert_title_template,
        detection.templateValues,
      ).slice(0, 255),
      message: interpolate(
        template.alert_message_template,
        detection.templateValues,
      ),
      metric_code: null,
      metric_value: detection.metricValue,
      threshold_value: detection.thresholdValue,
      context_data: detection.contextData ?? null,
      fingerprint: detection.fingerprint,
    })
    .select("id")
    .single();

  if (insertError || !alert) {
    // Carrera con otra evaluacion simultanea: el indice unico parcial la corta.
    if (insertError?.message.includes("alerts_unique_live_fingerprint")) {
      return { alertId: null, created: false };
    }
    throw new Error(`alert_insert_failed: ${insertError?.message}`);
  }

  let assigneeId: string | null = null;

  if (template.task_title_template) {
    assigneeId = await resolveTaskAssignee(supabase, organizationId);

    const { data: createdTask, error: taskError } = await supabase
      .from("tasks")
      .insert({
        organization_id: organizationId,
        alert_id: alert.id,
        source: "alert",
        assigned_to: assigneeId,
        priority:
          template.default_severity === "critical" ||
          template.default_severity === "high"
            ? "high"
            : "medium",
        title: interpolate(
          template.task_title_template,
          detection.templateValues,
        ).slice(0, 255),
        description: template.task_description_template
          ? interpolate(
              template.task_description_template,
              detection.templateValues,
            )
          : null,
        categories: [
          template.code === "integration_sync_failed" &&
          typeof detection.contextData?.provider === "string"
            ? normalizeProviderCategory(detection.contextData.provider)
            : template.category,
        ],
      })
      .select("id")
      .single();

    // El indice unico tasks_unique_alert hace la creacion idempotente.
    if (taskError && !taskError.message.includes("tasks_unique_alert")) {
      throw new Error(`alert_task_insert_failed: ${taskError.message}`);
    }

    // Enlace best-effort al hito activo de Mi Camino (DB-07 2026-07-29, mismo
    // criterio que ai-runtime.ts): las tareas generadas por el motor de
    // alertas no tenian ninguna conexion con el plan estrategico.
    if (createdTask) {
      const milestoneId = await findCurrentMilestoneId(
        supabase,
        organizationId,
      );
      if (milestoneId) {
        await supabase.from("milestone_task_links").insert({
          organization_id: organizationId,
          milestone_id: milestoneId,
          task_id: createdTask.id,
        });
      }
    }
  }

  // Despues de la tarea, no antes: la notificacion va tambien a su responsable
  // y hasta que la tarea no existe no se sabe quien es.
  await notifyAlertCreated(
    supabase,
    organizationId,
    alert.id,
    template,
    detection,
    assigneeId,
  );

  return { alertId: alert.id, created: true };
}

/**
 * Notifica una alerta nueva a los owner/manager activos de la organizacion y al
 * consultor responsable de su tarea, si lo hay.
 *
 * El consultor no es fila de `organization_members` -- su acceso es virtual, via
 * `consultant_assignments` --, asi que hasta ahora una alerta no le llegaba
 * nunca: la veia solo si entraba a mirar.
 *
 * Best-effort: un fallo aqui no debe tumbar la evaluacion de reglas.
 */
async function notifyAlertCreated(
  supabase: SupabaseClient,
  organizationId: string,
  alertId: string,
  template: TemplateRow,
  detection: Detection,
  assigneeId: string | null,
) {
  try {
    const { data: members, error } = await supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("role", ["owner", "manager"]);

    const recipients = new Set(
      error ? [] : (members ?? []).map((member) => member.user_id as string),
    );
    if (assigneeId) recipients.add(assigneeId);

    if (recipients.size === 0) {
      return;
    }

    const title = interpolate(
      template.alert_title_template,
      detection.templateValues,
    ).slice(0, 255);

    await supabase.from("notifications").insert(
      [...recipients].map((userId) => ({
        organization_id: organizationId,
        user_id: userId,
        type: "alert",
        title,
        message: interpolate(
          template.alert_message_template,
          detection.templateValues,
        ),
        action_url: `/tareas?organizationId=${organizationId}`,
        entity_type: "alert",
        entity_id: alertId,
      })),
    );
  } catch {
    // Notificar es secundario frente a registrar la alerta.
  }
}

async function resolveStaleAlerts(
  supabase: SupabaseClient,
  organizationId: string,
  templateId: string,
  liveFingerprints: string[],
) {
  let query = supabase
    .from("alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("rule_template_id", templateId)
    .in("status", ["open", "acknowledged"]);

  if (liveFingerprints.length > 0) {
    query = query.not(
      "fingerprint",
      "in",
      `(${liveFingerprints.map((f) => `"${f}"`).join(",")})`,
    );
  }

  const { error } = await query;

  if (error) {
    throw new Error(`alert_autoresolve_failed: ${error.message}`);
  }
}

/**
 * Motor de reglas determinista (BE-05). Evalua las plantillas activas contra
 * los datos ya sincronizados y crea/refresca/resuelve alertas idempotentes.
 */
export async function runAlertRules(env: ApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);

  const { data: templates, error: templatesError } = await supabase
    .from("alert_rule_templates")
    .select(
      "id, code, default_severity, default_condition, alert_title_template, alert_message_template, task_title_template, task_description_template, category",
    )
    .eq("is_active", true);

  if (templatesError) {
    throw new Error(`alert_templates_load_failed: ${templatesError.message}`);
  }

  // Ajustes por cliente. `organization_alert_rules` existe desde DB-07 con
  // is_enabled / severity_override / condition_override, y hasta ahora este
  // motor no la miraba: todos los clientes recibian las mismas alertas con el
  // mismo umbral, y rellenar la tabla no cambiaba nada.
  const { data: overrides, error: overridesError } = await supabase
    .from("organization_alert_rules")
    .select("template_id, is_enabled, severity_override, condition_override")
    .eq("organization_id", organizationId);

  if (overridesError) {
    throw new Error(`alert_overrides_load_failed: ${overridesError.message}`);
  }

  const overrideByTemplate = new Map(
    (overrides ?? []).map((row) => [row.template_id as string, row]),
  );

  const summary = {
    evaluated: 0,
    skipped: 0,
    alerts_created: 0,
    alerts_refreshed: 0,
  };

  for (const rawTemplate of (templates ?? []) as TemplateRow[]) {
    const override = overrideByTemplate.get(rawTemplate.id);

    if (override?.is_enabled === false) {
      summary.skipped += 1;
      continue;
    }

    // Se fusiona una sola vez y el resto del motor sigue leyendo
    // `default_severity` / `default_condition`: asi las tres ramas de reglas y
    // `upsertAlertWithTask` no necesitan saber que existen los overrides.
    const template: TemplateRow = {
      ...rawTemplate,
      default_severity:
        (override?.severity_override as string | null) ??
        rawTemplate.default_severity,
      default_condition:
        (override?.condition_override as TemplateRow["default_condition"]) ??
        rawTemplate.default_condition,
    };

    summary.evaluated += 1;
    const detections: Detection[] = [];

    if (template.code === "shopify_stock_out") {
      const { data, error } = await supabase.rpc("shopify_stock_summary", {
        target_organization_id: organizationId,
        low_stock_threshold: 5,
        target_store_id: null,
      });

      if (error) {
        throw new Error(`rule_stock_summary_failed: ${error.message}`);
      }

      const outOfStock = Number(data?.[0]?.out_of_stock_items ?? 0);

      if (outOfStock > (template.default_condition.threshold ?? 0)) {
        detections.push({
          fingerprint: `shopify_stock_out:${organizationId}`,
          metricValue: outOfStock,
          thresholdValue: template.default_condition.threshold ?? 0,
          templateValues: { metric_value: outOfStock },
        });
      }
    } else if (template.code === "integration_sync_failed") {
      const { data, error } = await supabase
        .from("integration_connections")
        .select("id, provider, provider_account_name, last_error_message")
        .eq("organization_id", organizationId)
        .eq("status", "error");

      if (error) {
        throw new Error(`rule_sync_failed_lookup_failed: ${error.message}`);
      }

      for (const connection of data ?? []) {
        detections.push({
          fingerprint: `integration_sync_failed:${connection.id}`,
          metricValue: 1,
          thresholdValue: 0,
          sourceEntityType: "integration_connection",
          sourceEntityId: connection.id,
          contextData: {
            provider: connection.provider,
            error: connection.last_error_message,
          },
          templateValues: {
            context_provider:
              connection.provider_account_name ?? connection.provider,
            context_error: connection.last_error_message ?? "desconocido",
          },
        });
      }
    } else if (template.code === "shopify_revenue_drop") {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const currentStart = new Date(now - 7 * day).toISOString();
      const previousStart = new Date(now - 14 * day).toISOString();
      const nowIso = new Date(now).toISOString();

      const [currentResult, previousResult] = await Promise.all([
        supabase.rpc("shopify_sales_summary", {
          target_organization_id: organizationId,
          period_start: currentStart,
          period_end: nowIso,
          target_store_id: null,
        }),
        supabase.rpc("shopify_sales_summary", {
          target_organization_id: organizationId,
          period_start: previousStart,
          period_end: currentStart,
          target_store_id: null,
        }),
      ]);

      if (currentResult.error || previousResult.error) {
        throw new Error(
          `rule_revenue_drop_failed: ${currentResult.error?.message ?? previousResult.error?.message}`,
        );
      }

      const current = Number(currentResult.data?.[0]?.net_sales ?? 0);
      const previous = Number(previousResult.data?.[0]?.net_sales ?? 0);
      const threshold = template.default_condition.threshold ?? -30;

      if (previous > 0) {
        const changePct = ((current - previous) / previous) * 100;

        if (changePct < threshold) {
          const weekKey = new Date(now).toISOString().slice(0, 10);
          detections.push({
            fingerprint: `shopify_revenue_drop:${organizationId}:${weekKey}`,
            metricValue: Math.round(changePct * 100) / 100,
            thresholdValue: threshold,
            contextData: {
              current_net_sales: current,
              previous_net_sales: previous,
            },
            templateValues: {
              metric_value_abs: Math.abs(Math.round(changePct)),
              threshold_abs: Math.abs(threshold),
              context_current: current.toFixed(2),
              context_previous: previous.toFixed(2),
            },
          });
        }
      }
    }

    for (const detection of detections) {
      const result = await upsertAlertWithTask(
        supabase,
        organizationId,
        template,
        detection,
      );
      if (result.created) {
        summary.alerts_created += 1;
      } else {
        summary.alerts_refreshed += 1;
      }
    }

    await resolveStaleAlerts(
      supabase,
      organizationId,
      template.id,
      detections.map((detection) => detection.fingerprint),
    );
  }

  return summary;
}

/**
 * Pasada global del motor de reglas (cron): evalua todas las organizaciones
 * activas u onboarding. Cada organizacion falla o triunfa por separado.
 */
export async function runAlertRulesForAllOrganizations(env: ApiEnv) {
  const supabase = createServiceClient(env);

  const { data: organizations, error } = await supabase
    .from("organizations")
    .select("id")
    .in("status", ["onboarding", "active"]);

  if (error) {
    throw new Error(`organizations_load_failed: ${error.message}`);
  }

  const summary = {
    organizations: 0,
    succeeded: 0,
    failed: 0,
    alerts_created: 0,
  };

  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runAlertRules(env, organization.id);
      summary.succeeded += 1;
      summary.alerts_created += result.alerts_created;
    } catch (ruleError) {
      summary.failed += 1;
      console.error("alert_rules_org_failed", {
        organization_id: organization.id,
        error:
          ruleError instanceof Error ? ruleError.message : String(ruleError),
      });
    }
  }

  return summary;
}

export async function evaluateAlertRules(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  try {
    const summary = await runAlertRules(env, organizationId);
    return { ok: true as const, data: summary };
  } catch (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "alert_rules_evaluation_failed",
      detail: error instanceof Error ? error.message : "unknown_error",
    };
  }
}

export async function listOperations(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const token = authorization.slice("Bearer ".length);
  const supabase = createUserScopedClient(env, token);

  const [tasksResult, alertsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, alert_id, source, status, priority, categories, title, description, due_at, assigned_to, is_visible_to_client, created_at, updated_at, outcome_metric_name, outcome_before_value, outcome_after_value, outcome_unit, outcome_summary, outcome_measured_at, outcome_recorded_at, task_comments(id, body, is_internal, author_user_id, created_at), milestone_task_links(strategic_plan_milestones(id, name, strategic_plan_phases(name)))",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("alerts")
      .select(
        "id, status, severity, title, message, metric_value, threshold_value, fingerprint, first_detected_at, last_detected_at, resolved_at",
      )
      .eq("organization_id", organizationId)
      .order("last_detected_at", { ascending: false })
      .limit(200),
  ]);

  if (tasksResult.error || alertsResult.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "operations_load_failed",
      detail: tasksResult.error?.message ?? alertsResult.error?.message,
    };
  }

  // Aplana el enlace a Mi Camino (una tarea vive en 0..1 hitos): la lista de
  // tareas y Mi Camino comparten la misma tabla `tasks`; esto solo expone en
  // qué fase/hito cae cada una, sin duplicar nada.
  // Supabase devuelve los embeds anidados como arrays; normalizamos a 0..1.
  const firstOf = (value: unknown): Record<string, unknown> | undefined =>
    Array.isArray(value)
      ? (value[0] as Record<string, unknown> | undefined)
      : (value as Record<string, unknown> | undefined);

  // Nombre del responsable. La RLS de `profiles` es "yo o platform admin", asi
  // que un cliente no puede leer el perfil de su consultor por join: se resuelve
  // aparte y acotado a quien tiene tareas en ESTA organizacion, que no es un
  // directorio de la plataforma.
  const assigneeIds = [
    ...new Set(
      (tasksResult.data ?? [])
        .map((task) => task.assigned_to as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const nameByAssignee = new Map<string, string | null>();
  if (assigneeIds.length > 0) {
    const { data: profiles } = await createServiceClient(env)
      .from("profiles")
      .select("id, full_name")
      .in("id", assigneeIds);
    for (const profile of profiles ?? []) {
      nameByAssignee.set(
        profile.id as string,
        profile.full_name as string | null,
      );
    }
  }

  const tasks = (tasksResult.data ?? []).map((task) => {
    const { milestone_task_links: rawLinks, ...rest } = task as Record<
      string,
      unknown
    > & { milestone_task_links?: unknown };
    const link = Array.isArray(rawLinks) ? rawLinks[0] : undefined;
    const ms = firstOf(
      (link as { strategic_plan_milestones?: unknown } | undefined)
        ?.strategic_plan_milestones,
    );
    const phase = firstOf(ms?.strategic_plan_phases);
    return {
      ...rest,
      assignee_name: task.assigned_to
        ? (nameByAssignee.get(task.assigned_to as string) ?? null)
        : null,
      milestone: ms
        ? {
            id: ms.id as string,
            name: ms.name as string,
            phase_name: (phase?.name as string | undefined) ?? null,
          }
        : null,
    };
  });

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      tasks,
      alerts: alertsResult.data ?? [],
    },
  };
}

const TASK_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "ignored",
  "cancelled",
] as const;

const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

/** Candidatos acotados a una organizacion; nunca se expone un directorio global. */
export async function listTaskAssignees(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;

  const supabase = createServiceClient(env);
  const [{ data: members, error: membersError }, { data: assignments, error: assignmentsError }] = await Promise.all([
    supabase.from("organization_members").select("user_id, role").eq("organization_id", organizationId).eq("is_active", true),
    supabase.from("consultant_assignments").select("consultant_user_id, is_primary").eq("organization_id", organizationId).eq("is_active", true),
  ]);
  if (membersError || assignmentsError) {
    return { ok: false as const, statusCode: 500, error: "task_assignees_load_failed", detail: membersError?.message ?? assignmentsError?.message };
  }

  const memberRoleById = new Map((members ?? []).map((member) => [member.user_id as string, member.role as string]));
  const consultantIds = new Set((assignments ?? []).map((assignment) => assignment.consultant_user_id as string));
  const ids = [...new Set([...memberRoleById.keys(), ...consultantIds])];
  if (!ids.includes(context.user.id)) ids.push(context.user.id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, is_active")
    .in("id", ids);
  if (profilesError) {
    return { ok: false as const, statusCode: 500, error: "task_assignee_profiles_load_failed", detail: profilesError.message };
  }

  return {
    ok: true as const,
    data: {
      assignees: (profiles ?? []).filter((profile) => profile.is_active).map((profile) => ({
        id: profile.id as string,
        name: (profile.full_name as string | null) ?? "Usuario",
        role: memberRoleById.get(profile.id as string) ?? (consultantIds.has(profile.id as string) ? "consultant" : "member"),
        is_self: profile.id === context.user.id,
      })).sort((a, b) => Number(b.is_self) - Number(a.is_self) || a.name.localeCompare(b.name, "es")),
    },
  };
}

async function validateTaskAssignee(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  currentUserId: string,
) {
  const [{ data: member }, { data: assignment }, { data: profile }] = await Promise.all([
    supabase.from("organization_members").select("user_id").eq("organization_id", organizationId).eq("user_id", userId).eq("is_active", true).maybeSingle(),
    supabase.from("consultant_assignments").select("consultant_user_id").eq("organization_id", organizationId).eq("consultant_user_id", userId).eq("is_active", true).maybeSingle(),
    supabase.from("profiles").select("id, is_active").eq("id", userId).maybeSingle(),
  ]);
  return Boolean(profile?.is_active && (member || assignment || userId === currentUserId));
}

/**
 * Alta manual de una tarea (FE-03: el modulo de tareas no tenia forma de
 * anadir un pendiente ad-hoc -- solo llegaban desde reglas de alertas, IA,
 * llamadas o Mi Camino). Mismo criterio de permisos que el resto de
 * mutaciones de tareas (`requireMembership`, cualquier miembro de la
 * organizacion, no solo consultor/admin).
 */
export async function createTask(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  input: {
    title?: string;
    description?: string | null;
    priority?: string;
    category?: string;
    categories?: string[];
    dueAt?: string | null;
    isVisibleToClient?: boolean;
    assignedTo?: string | null;
    milestoneId?: string | null;
  },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  const title = input.title?.trim();
  if (!title) {
    return { ok: false as const, statusCode: 400, error: "missing_task_title" };
  }
  if (title.length > 255) {
    return { ok: false as const, statusCode: 400, error: "task_title_too_long" };
  }
  if (input.dueAt && !Number.isFinite(Date.parse(input.dueAt))) {
    return { ok: false as const, statusCode: 400, error: "invalid_task_due_at" };
  }
  if (input.isVisibleToClient === false && !isConsultantOrAdmin(context)) {
    return { ok: false as const, statusCode: 403, error: "internal_task_denied", message: "Solo un consultor o administrador puede crear trabajo interno." };
  }

  const milestoneId = input.milestoneId?.trim() || null;

  const priority = TASK_PRIORITIES.includes(
    input.priority as (typeof TASK_PRIORITIES)[number],
  )
    ? (input.priority as (typeof TASK_PRIORITIES)[number])
    : "medium";
  // Acepta `categories` (nuevo, 1+) o `category` (compat, 1). Filtra a valores
  // validos, dedupe, y cae a ['general'] si no queda ninguna.
  const requested = input.categories ?? (input.category ? [input.category] : []);
  const valid = [...new Set(requested)].filter((value): value is
    (typeof TASK_CATEGORIES)[number] =>
    (TASK_CATEGORIES as readonly string[]).includes(value),
  );
  const categories = valid.length > 0 ? valid : ["general"];

  const supabase = createServiceClient(env);

  const assignedTo = input.assignedTo?.trim() || context.user.id;
  if (!(await validateTaskAssignee(supabase, organizationId, assignedTo, context.user.id))) {
    return { ok: false as const, statusCode: 400, error: "invalid_task_assignee", message: "El responsable debe tener acceso activo a esta tienda." };
  }

  // La tarea puede nacer ya colgada de un hito de Mi Camino (misma tabla
  // `tasks`, solo se añade el enlace en milestone_task_links).
  let milestone: { id: string; name: string; phase_name: string | null } | null =
    null;
  if (milestoneId) {
    const { data: milestoneRow } = await supabase
      .from("strategic_plan_milestones")
      .select("id, name, strategic_plan_phases(name)")
      .eq("id", milestoneId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!milestoneRow) {
      return { ok: false as const, statusCode: 400, error: "invalid_milestone" };
    }
    const phaseRaw = (
      milestoneRow as { strategic_plan_phases?: unknown }
    ).strategic_plan_phases;
    const phase = (
      Array.isArray(phaseRaw) ? phaseRaw[0] : phaseRaw
    ) as { name?: string } | undefined;
    milestone = {
      id: milestoneRow.id as string,
      name: milestoneRow.name as string,
      phase_name: phase?.name ?? null,
    };
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: organizationId,
      title,
      description: input.description?.trim() || null,
      priority,
      categories,
      due_at: input.dueAt || null,
      source: "manual",
      created_by: context.user.id,
      // Quien la crea se hace responsable. El reparto automatico solo decide
      // cuando no hay nadie eligiendo (alertas, IA).
      assigned_to: assignedTo,
      // Por defecto visible: una tarea manual sin marcar como interna es
      // igual de visible para el cliente que cualquier otra de la lista.
      is_visible_to_client: input.isVisibleToClient ?? true,
    })
    .select(
      "id, alert_id, source, status, priority, categories, title, description, due_at, is_visible_to_client, created_at, updated_at",
    )
    .single();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "task_create_failed",
      detail: error.message,
    };
  }

  if (milestoneId) {
    const { error: linkError } = await supabase
      .from("milestone_task_links")
      .insert({
        organization_id: organizationId,
        milestone_id: milestoneId,
        task_id: data.id,
      });
    if (linkError) {
      return {
        ok: false as const,
        statusCode: 500,
        error: "milestone_task_link_failed",
        detail: linkError.message,
      };
    }
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "operations.create_task",
    entityType: "task",
    entityId: data.id,
    newData: {
      title: data.title,
      priority: data.priority,
      categories: data.categories,
      assigned_to: assignedTo,
    },
  });

  return {
    ok: true as const,
    data: { ...data, task_comments: [], milestone },
  };
}

export async function updateTaskAssignment(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  taskId: string,
  input: { assignedTo?: string | null; dueAt?: string | null },
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) return access;

  if (input.assignedTo !== undefined && input.assignedTo !== null) {
    const assignedTo = input.assignedTo.trim();
    if (!assignedTo || !(await validateTaskAssignee(createServiceClient(env), organizationId, assignedTo, context.user.id))) {
      return { ok: false as const, statusCode: 400, error: "invalid_task_assignee", message: "El responsable debe tener acceso activo a esta tienda." };
    }
  }
  if (input.dueAt !== undefined && input.dueAt !== null && !Number.isFinite(Date.parse(input.dueAt))) {
    return { ok: false as const, statusCode: 400, error: "invalid_task_due_at" };
  }

  const supabase = createServiceClient(env);
  const { data, error } = await supabase.from("tasks").update({
    ...(input.assignedTo !== undefined ? { assigned_to: input.assignedTo?.trim() || null } : {}),
    ...(input.dueAt !== undefined ? { due_at: input.dueAt } : {}),
  }).eq("id", taskId).eq("organization_id", organizationId).select("id, assigned_to, due_at").maybeSingle();
  if (error) return { ok: false as const, statusCode: 500, error: "task_assignment_update_failed", detail: error.message };
  if (!data) return { ok: false as const, statusCode: 404, error: "task_not_found" };

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "operations.update_task_assignment",
    entityType: "task",
    entityId: taskId,
    newData: { assigned_to: data.assigned_to, due_at: data.due_at },
  });
  return { ok: true as const, data };
}

export async function updateTaskStatus(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  taskId: string,
  statusInput: string | undefined,
  reason: string | undefined,
  outcomeInput?: unknown,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  // Proponer no es decidir: un consultor (persona hoy, agente IA manana) puede
  // crear una tarea para un cliente, pero completarla, ignorarla o cambiarle
  // el estado es del cliente -- si no, la trazabilidad "propuesta -> decidida"
  // se pierde porque las dos mitades las escribiria la misma mano. Solo
  // cuenta como "ser el cliente" una membership real (o platform_admin, igual
  // que en el resto del programa); la membership sintetica de
  // consultant_assignment no.
  if (access.membership.accessSource === "consultant_assignment") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "consultant_cannot_resolve_client_task",
      message:
        "Solo el cliente puede completar, ignorar o cambiar el estado de sus tareas. El consultor puede proponerlas, no resolverlas.",
    };
  }

  if (
    !statusInput ||
    !TASK_STATUSES.includes(statusInput as (typeof TASK_STATUSES)[number])
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_task_status",
    };
  }

  const parsedOutcome = parseTaskOutcomeInput(outcomeInput);
  if (!parsedOutcome.ok || (parsedOutcome.data && statusInput !== "completed")) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_task_outcome",
      message: "El resultado debe tener una métrica y fecha válidas y solo puede guardarse al completar la tarea.",
    };
  }

  const supabase = createServiceClient(env);
  const now = new Date().toISOString();

  const { data: previousTask, error: previousTaskError } = await supabase
    .from("tasks")
    .select("id, status, completed_at")
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (previousTaskError) {
    return { ok: false as const, statusCode: 500, error: "task_load_failed", detail: previousTaskError.message };
  }
  if (!previousTask) return { ok: false as const, statusCode: 404, error: "task_not_found" };

  const { data, error } = await supabase
    .from("tasks")
    .update({
      ...(previousTask.status === "completed" && statusInput === "completed"
        ? {}
        : { status: statusInput }),
      ...(statusInput === "in_progress" ? { started_at: now } : {}),
      ...(statusInput === "completed" && previousTask.status !== "completed"
        ? { completed_at: now }
        : {}),
      ...(statusInput === "ignored"
        ? { ignored_at: now, ignored_reason: reason ?? null }
        : {}),
      ...(statusInput === "completed" && parsedOutcome.data
        ? {
            outcome_metric_name: parsedOutcome.data.metric_name,
            outcome_before_value: parsedOutcome.data.before_value,
            outcome_after_value: parsedOutcome.data.after_value,
            outcome_unit: parsedOutcome.data.unit,
            outcome_summary: parsedOutcome.data.summary,
            outcome_measured_at: parsedOutcome.data.measured_at,
            outcome_recorded_at: now,
          }
        : {}),
    })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select("id, status, alert_id")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "task_update_failed",
      detail: error.message,
    };
  }

  if (!data) {
    return { ok: false as const, statusCode: 404, error: "task_not_found" };
  }

  // A task may be the execution handle of one or more calendar items. Keep
  // Planning aligned when the task is completed from Tareas or Mi Camino.
  const calendarStatus =
    statusInput === "in_progress"
      ? "in_progress"
      : statusInput === "completed"
        ? "completed"
        : statusInput === "ignored" || statusInput === "cancelled"
          ? "cancelled"
          : "planned";
  await supabase
    .from("campaign_calendar_items")
    .update({ status: calendarStatus })
    .eq("organization_id", organizationId)
    .eq("task_id", data.id)
    .is("deleted_at", null);

  // Completar la tarea resuelve su alerta origen; el historial lo escribe el
  // trigger record_task_status_change, no hace falta insertarlo aqui.
  if (statusInput === "completed" && data.alert_id) {
    await supabase
      .from("alerts")
      .update({
        status: "resolved",
        resolved_by: context.user.id,
        resolved_at: now,
      })
      .eq("id", data.alert_id)
      .eq("organization_id", organizationId)
      .in("status", ["open", "acknowledged"]);
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: previousTask.status === "completed" && statusInput === "completed" && parsedOutcome.data
      ? "operations.record_task_outcome"
      : "operations.update_task_status",
    entityType: "task",
    entityId: data.id,
    newData: {
      status: data.status,
      reason: reason ?? null,
      ...(parsedOutcome.data ? {
        measured_outcome: {
          metric_name: parsedOutcome.data.metric_name,
          before_value: parsedOutcome.data.before_value,
          after_value: parsedOutcome.data.after_value,
          unit: parsedOutcome.data.unit,
          measured_at: parsedOutcome.data.measured_at,
        },
      } : {}),
    },
  });

  return { ok: true as const, data: { id: data.id, status: data.status } };
}

export async function addTaskComment(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  taskId: string,
  body: string | undefined,
  isInternal: boolean | undefined,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  if (!body || body.trim().length === 0) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "missing_comment_body",
    };
  }

  if (isInternal && !isConsultantOrAdmin(context)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "internal_comment_denied",
      message:
        "Solo consultores o administradores pueden crear comentarios internos.",
    };
  }

  const supabase = createServiceClient(env);

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title")
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (taskError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "task_lookup_failed",
      detail: taskError.message,
    };
  }

  if (!task) {
    return { ok: false as const, statusCode: 404, error: "task_not_found" };
  }

  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      organization_id: organizationId,
      task_id: taskId,
      author_user_id: context.user.id,
      body: body.trim(),
      is_internal: Boolean(isInternal),
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "task_comment_failed",
      detail: error?.message,
    };
  }

  // AI-07: solo las notas internas del consultor entran a la memoria (nunca
  // vistas por un cliente ni por ningun agente automatico en V1, ver
  // AI-07-memoria-acumulativa-consultor-experto.md).
  if (isInternal) {
    await enqueueMemoryIngestion(env, {
      organizationId,
      storeId: null,
      sourceType: "internal_note",
      sourceEntityType: "task_comment",
      sourceEntityId: data.id,
      sourceActorId: context.user.id,
      audience: "consultant_only",
      origin: "human_authored",
      authority: "operational",
      title: `Nota interna en tarea: ${task.title ?? taskId}`,
      content: body.trim(),
    });
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "operations.add_task_comment",
    entityType: "task_comment",
    entityId: data.id,
    newData: { task_id: taskId, is_internal: Boolean(isInternal) },
  });

  return { ok: true as const, data: { id: data.id } };
}

export async function updateAlertStatus(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  alertId: string,
  statusInput: string | undefined,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  if (
    !statusInput ||
    !["acknowledged", "resolved", "dismissed"].includes(statusInput)
  ) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "invalid_alert_status",
    };
  }

  const supabase = createServiceClient(env);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("alerts")
    .update({
      status: statusInput,
      ...(statusInput === "acknowledged"
        ? { acknowledged_by: context.user.id, acknowledged_at: now }
        : {}),
      ...(statusInput === "resolved" || statusInput === "dismissed"
        ? { resolved_by: context.user.id, resolved_at: now }
        : {}),
    })
    .eq("id", alertId)
    .eq("organization_id", organizationId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "alert_update_failed",
      detail: error.message,
    };
  }

  if (!data) {
    return { ok: false as const, statusCode: 404, error: "alert_not_found" };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "operations.update_alert_status",
    entityType: "alert",
    entityId: data.id,
    newData: { status: data.status },
  });

  return { ok: true as const, data: { id: data.id, status: data.status } };
}
