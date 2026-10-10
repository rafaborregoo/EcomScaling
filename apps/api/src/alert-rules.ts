// Alertas por cliente (`organization_alert_rules`, DB-07).
//
// La tabla existe desde DB-07 con `is_enabled`, `severity_override` y
// `condition_override`, y hasta ahora `runAlertRules` no la miraba: las tres
// plantillas activas se evaluaban igual para toda la cartera y rellenar la
// tabla a mano no habria cambiado nada. Estas funciones son la puerta; el
// motor ya la lee (ver `runAlertRules` en operations.ts).
//
// Escrituras por service role + chequeo manual de rol (patron ADR-0006 #7):
// la RLS de la tabla solo concede lectura a quien accede a la organizacion.
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  requireOperationalOrganization,
  isOperationalOrganizationError,
  createUserScopedClient,
  type AuthContext,
} from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";

type ApiEnv = LoadedApiEnv;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

const SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;

/**
 * Mismo criterio que la configuracion financiera: el consultor configura los
 * avisos del cliente que asesora. Su membresia es virtual y solo cubre sus
 * `consultant_assignments` activas, asi que el alcance ya viene acotado.
 */
function assertCanManage(context: AuthContext, organizationId: string) {
  const operational = requireOperationalOrganization(context, organizationId);
  if (isOperationalOrganizationError(operational)) return operational;

  if (
    !["platform_admin", "consultant"].includes(context.profile.platform_role) &&
    !["owner", "manager"].includes(operational.membership.role)
  ) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "alert_rules_manage_denied",
      message:
        "Solo owner, manager, consultor o platform admin pueden configurar las alertas.",
    };
  }

  return { ok: true as const };
}

type TemplateRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  default_severity: string;
  default_condition: { operator?: string; threshold?: number } | null;
};

type OverrideRow = {
  template_id: string;
  is_enabled: boolean;
  severity_override: string | null;
  condition_override: { operator?: string; threshold?: number } | null;
};

/**
 * Las plantillas activas con lo que este cliente tiene configurado encima.
 * Devuelve el valor EFECTIVO junto al de la plantilla, para que la UI pueda
 * decir "personalizado" sin volver a calcular la fusion.
 */
export async function listAlertRules(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string,
) {
  const gate = assertCanManage(context, organizationId);
  if (gate.ok === false) return gate;

  const supabase = createUserScopedClient(
    env,
    authorization.slice("Bearer ".length),
  );

  // Cuantas veces salto cada aviso en 30 dias: sin esto el umbral se ajusta a
  // ciegas. Si la lectura falla, la lista sigue saliendo sin el recuento.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [templatesResult, overridesResult, firedResult] = await Promise.all([
    supabase
      .from("alert_rule_templates")
      .select(
        "id, code, name, description, default_severity, default_condition",
      )
      .eq("is_active", true)
      .order("code", { ascending: true }),
    supabase
      .from("organization_alert_rules")
      .select("template_id, is_enabled, severity_override, condition_override")
      .eq("organization_id", organizationId),
    supabase
      .from("alerts")
      .select("rule_template_id, first_detected_at")
      .eq("organization_id", organizationId)
      .gte("first_detected_at", since)
      .limit(2000),
  ]);
  const fired = new Map<string, { count: number; last: string }>();
  if (!firedResult.error) {
    for (const row of (firedResult.data ?? []) as Array<{ rule_template_id: string | null; first_detected_at: string }>) {
      if (!row.rule_template_id) continue;
      const current = fired.get(row.rule_template_id);
      fired.set(row.rule_template_id, {
        count: (current?.count ?? 0) + 1,
        last: current && current.last > row.first_detected_at ? current.last : row.first_detected_at,
      });
    }
  }

  if (templatesResult.error || overridesResult.error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "alert_rules_load_failed",
      detail:
        templatesResult.error?.message ?? overridesResult.error?.message,
    };
  }

  const overrideByTemplate = new Map(
    ((overridesResult.data ?? []) as OverrideRow[]).map((row) => [
      row.template_id,
      row,
    ]),
  );

  const rules = ((templatesResult.data ?? []) as TemplateRow[]).map(
    (template) => {
      const override = overrideByTemplate.get(template.id);
      return {
        template_id: template.id,
        code: template.code,
        name: template.name,
        description: template.description,
        is_enabled: override?.is_enabled ?? true,
        severity: override?.severity_override ?? template.default_severity,
        threshold:
          override?.condition_override?.threshold ??
          template.default_condition?.threshold ??
          null,
        default_severity: template.default_severity,
        default_threshold: template.default_condition?.threshold ?? null,
        is_customized: override !== undefined,
        fired_30d: firedResult.error ? null : (fired.get(template.id)?.count ?? 0),
        last_fired_at: fired.get(template.id)?.last ?? null,
      };
    },
  );

  return {
    ok: true as const,
    data: { organization_id: organizationId, rules },
  };
}

export async function upsertAlertRule(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  templateId: string,
  payload: { isEnabled?: unknown; severity?: unknown; threshold?: unknown },
) {
  const gate = assertCanManage(context, organizationId);
  if (gate.ok === false) return gate;

  if (
    payload.severity !== undefined &&
    payload.severity !== null &&
    !(SEVERITIES as readonly string[]).includes(String(payload.severity))
  ) {
    return { ok: false as const, statusCode: 400, error: "severidad_invalida" };
  }

  const threshold =
    payload.threshold === undefined || payload.threshold === null
      ? null
      : Number(payload.threshold);
  if (threshold !== null && !Number.isFinite(threshold)) {
    return { ok: false as const, statusCode: 400, error: "umbral_invalido" };
  }

  const supabase = createServiceClient(env);

  // La plantilla se comprueba aqui y no se confia en la FK: sin esto, un
  // template_id inventado devolveria un 500 de Postgres en vez de un 400.
  // Ademas hace falta su `default_condition` para conservar el operador --
  // guardar solo `{threshold}` dejaria la condicion sin operador y el motor
  // compararia contra un undefined.
  const { data: template, error: templateError } = await supabase
    .from("alert_rule_templates")
    .select("id, default_condition")
    .eq("id", templateId)
    .maybeSingle();

  if (templateError) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "alert_template_load_failed",
      detail: templateError.message,
    };
  }
  if (!template) {
    return { ok: false as const, statusCode: 404, error: "plantilla_no_encontrada" };
  }

  const defaultCondition = (template.default_condition ?? {}) as {
    operator?: string;
    threshold?: number;
  };

  const { data, error } = await supabase
    .from("organization_alert_rules")
    .upsert(
      {
        organization_id: organizationId,
        template_id: templateId,
        is_enabled: payload.isEnabled === undefined ? true : Boolean(payload.isEnabled),
        severity_override: (payload.severity as string | null) ?? null,
        condition_override:
          threshold === null
            ? null
            : { ...defaultCondition, threshold },
        configured_by: context.user.id,
      },
      { onConflict: "organization_id,template_id" },
    )
    .select("template_id, is_enabled, severity_override, condition_override")
    .single();

  if (error || !data) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "alert_rule_save_failed",
      detail: error?.message,
    };
  }

  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "alerts.configure_rule",
    entityType: "organization_alert_rule",
    entityId: templateId,
    newData: {
      is_enabled: data.is_enabled,
      severity_override: data.severity_override,
      condition_override: data.condition_override,
    },
  });

  return { ok: true as const, data };
}
