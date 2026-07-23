import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { type AuthContext, createUserScopedClient } from "./auth-context.js";
import { enqueueMemoryIngestion } from "./memory-ingestion.js";

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
  const membership = context.memberships.find((item) => item.organization_id === organizationId);

  if (!membership) {
    return { ok: false as const, statusCode: 403, error: "organization_access_denied" };
  }

  return { ok: true as const, membership };
}

function isConsultantOrAdmin(context: AuthContext) {
  return ["consultant", "platform_admin"].includes(context.profile.platform_role);
}

function interpolate(template: string, values: Record<string, string | number | null | undefined>) {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value != null ? String(value) : "";
  });
}

const TASK_CATEGORIES = ["shopify", "meta", "klaviyo", "general"] as const;

function normalizeProviderCategory(provider: string): (typeof TASK_CATEGORIES)[number] {
  return (TASK_CATEGORIES as readonly string[]).includes(provider) ? (provider as (typeof TASK_CATEGORIES)[number]) : "general";
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
      title: interpolate(template.alert_title_template, detection.templateValues).slice(0, 255),
      message: interpolate(template.alert_message_template, detection.templateValues),
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

  await notifyAlertCreated(supabase, organizationId, alert.id, template, detection);

  if (template.task_title_template) {
    const { error: taskError } = await supabase.from("tasks").insert({
      organization_id: organizationId,
      alert_id: alert.id,
      source: "alert",
      priority:
        template.default_severity === "critical" || template.default_severity === "high"
          ? "high"
          : "medium",
      title: interpolate(template.task_title_template, detection.templateValues).slice(0, 255),
      description: template.task_description_template
        ? interpolate(template.task_description_template, detection.templateValues)
        : null,
      category:
        template.code === "integration_sync_failed" && typeof detection.contextData?.provider === "string"
          ? normalizeProviderCategory(detection.contextData.provider)
          : template.category,
    });

    // El indice unico tasks_unique_alert hace la creacion idempotente.
    if (taskError && !taskError.message.includes("tasks_unique_alert")) {
      throw new Error(`alert_task_insert_failed: ${taskError.message}`);
    }
  }

  return { alertId: alert.id, created: true };
}

/**
 * Notifica una alerta nueva a los owner/manager activos de la organizacion.
 * Best-effort: un fallo aqui no debe tumbar la evaluacion de reglas.
 */
async function notifyAlertCreated(
  supabase: SupabaseClient,
  organizationId: string,
  alertId: string,
  template: TemplateRow,
  detection: Detection,
) {
  try {
    const { data: members, error } = await supabase
      .from("organization_members")
      .select("user_id, role")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .in("role", ["owner", "manager"]);

    if (error || !members || members.length === 0) {
      return;
    }

    const title = interpolate(template.alert_title_template, detection.templateValues).slice(0, 255);

    await supabase.from("notifications").insert(
      members.map((member) => ({
        organization_id: organizationId,
        user_id: member.user_id,
        type: "alert",
        title,
        message: interpolate(template.alert_message_template, detection.templateValues),
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
    query = query.not("fingerprint", "in", `(${liveFingerprints.map((f) => `"${f}"`).join(",")})`);
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

  const summary = { evaluated: 0, alerts_created: 0, alerts_refreshed: 0 };

  for (const template of (templates ?? []) as TemplateRow[]) {
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
          contextData: { provider: connection.provider, error: connection.last_error_message },
          templateValues: {
            context_provider: connection.provider_account_name ?? connection.provider,
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
            contextData: { current_net_sales: current, previous_net_sales: previous },
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
      const result = await upsertAlertWithTask(supabase, organizationId, template, detection);
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

  const summary = { organizations: 0, succeeded: 0, failed: 0, alerts_created: 0 };

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
        error: ruleError instanceof Error ? ruleError.message : String(ruleError),
      });
    }
  }

  return summary;
}

export async function evaluateAlertRules(env: ApiEnv, context: AuthContext, organizationId: string) {
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
        "id, alert_id, source, status, priority, category, title, description, due_at, is_visible_to_client, created_at, updated_at, task_comments(id, body, is_internal, author_user_id, created_at)",
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

  return {
    ok: true as const,
    data: {
      organization_id: organizationId,
      tasks: tasksResult.data ?? [],
      alerts: alertsResult.data ?? [],
    },
  };
}

const TASK_STATUSES = ["pending", "in_progress", "completed", "ignored", "cancelled"] as const;

export async function updateTaskStatus(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  taskId: string,
  statusInput: string | undefined,
  reason: string | undefined,
) {
  const access = requireMembership(context, organizationId);
  if (access.ok === false) {
    return access;
  }

  if (!statusInput || !TASK_STATUSES.includes(statusInput as (typeof TASK_STATUSES)[number])) {
    return { ok: false as const, statusCode: 400, error: "invalid_task_status" };
  }

  const supabase = createServiceClient(env);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("tasks")
    .update({
      status: statusInput,
      ...(statusInput === "in_progress" ? { started_at: now } : {}),
      ...(statusInput === "completed" ? { completed_at: now } : {}),
      ...(statusInput === "ignored" ? { ignored_at: now, ignored_reason: reason ?? null } : {}),
    })
    .eq("id", taskId)
    .eq("organization_id", organizationId)
    .select("id, status, alert_id")
    .maybeSingle();

  if (error) {
    return { ok: false as const, statusCode: 500, error: "task_update_failed", detail: error.message };
  }

  if (!data) {
    return { ok: false as const, statusCode: 404, error: "task_not_found" };
  }

  // Completar la tarea resuelve su alerta origen; el historial lo escribe el
  // trigger record_task_status_change, no hace falta insertarlo aqui.
  if (statusInput === "completed" && data.alert_id) {
    await supabase
      .from("alerts")
      .update({ status: "resolved", resolved_by: context.user.id, resolved_at: now })
      .eq("id", data.alert_id)
      .eq("organization_id", organizationId)
      .in("status", ["open", "acknowledged"]);
  }

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
    return { ok: false as const, statusCode: 400, error: "missing_comment_body" };
  }

  if (isInternal && !isConsultantOrAdmin(context)) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "internal_comment_denied",
      message: "Solo consultores o administradores pueden crear comentarios internos.",
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
    return { ok: false as const, statusCode: 500, error: "task_lookup_failed", detail: taskError.message };
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
    return { ok: false as const, statusCode: 500, error: "task_comment_failed", detail: error?.message };
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

  if (!statusInput || !["acknowledged", "resolved", "dismissed"].includes(statusInput)) {
    return { ok: false as const, statusCode: 400, error: "invalid_alert_status" };
  }

  const supabase = createServiceClient(env);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("alerts")
    .update({
      status: statusInput,
      ...(statusInput === "acknowledged" ? { acknowledged_by: context.user.id, acknowledged_at: now } : {}),
      ...(statusInput === "resolved" || statusInput === "dismissed"
        ? { resolved_by: context.user.id, resolved_at: now }
        : {}),
    })
    .eq("id", alertId)
    .eq("organization_id", organizationId)
    .select("id, status")
    .maybeSingle();

  if (error) {
    return { ok: false as const, statusCode: 500, error: "alert_update_failed", detail: error.message };
  }

  if (!data) {
    return { ok: false as const, statusCode: 404, error: "alert_not_found" };
  }

  return { ok: true as const, data: { id: data.id, status: data.status } };
}
