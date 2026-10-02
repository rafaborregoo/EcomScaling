import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import { requireOperationalOrganization, type AuthContext } from "./auth-context.js";
import { recordAuditLog } from "./audit-log.js";
import { createKlaviyoClient } from "./klaviyo-client.js";
import { getValidKlaviyoAccessToken } from "./klaviyo-token-store.js";
import {
  describeKlaviyoMissingPermissions,
  isKlaviyoPermissionError,
  klaviyoCapability,
} from "./klaviyo-permissions.js";
import { activeKlaviyoConnectionId, canManage, pushDraftToKlaviyoTemplate } from "./klaviyo.js";

/**
 * Marketing → Flows: flows de Klaviyo diseñados a mano en NORA.
 *
 * El diseño (disparador, pasos, ramas y la pieza del Estudio de cada email) se
 * guarda en `marketing_flow_designs`. Al crearlo en Klaviyo se sube cada pieza
 * aprobada como plantilla y se manda el flow con `POST /flows/` (revisión
 * 2026-07-15), con todos los emails en borrador: nadie recibe nada hasta que
 * alguien lo active. Klaviyo no deja reescribir la definición de un flow ya
 * creado, así que «actualizar» crea uno nuevo y el anterior se queda en
 * borrador en la cuenta.
 */

type Failure = { ok: false; statusCode: number; error: string; message?: string; detail?: string };
type Result<T> = { ok: true; data: T } | Failure;

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
const NUMERIC_OPERATORS = ["equals", "not-equals", "greater-than", "greater-than-or-equal", "less-than", "less-than-or-equal"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Más pasos que esto no es un flow que alguien mantenga a mano. */
const MAX_STEPS = 60;

const timeframeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("flow-start") }),
  z.object({ kind: z.literal("alltime") }),
  z.object({ kind: z.literal("in-the-last"), quantity: z.number().int().min(1).max(3650), unit: z.enum(["hour", "day", "week"]) }),
]);

const conditionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("metric"),
    metric_id: z.string().trim().max(64),
    operator: z.enum(NUMERIC_OPERATORS),
    value: z.number().int().min(0).max(100000),
    timeframe: timeframeSchema,
  }),
  z.object({
    kind: z.literal("group"),
    group_id: z.string().trim().max(64),
    member: z.boolean(),
  }),
  z.object({
    kind: z.literal("property"),
    property: z.string().trim().max(120),
    operator: z.enum(["equals", "not-equals", "contains", "not-contains"]),
    value: z.string().max(255),
  }),
]);

export type FlowCondition = z.infer<typeof conditionSchema>;

export type FlowStep =
  | {
      id: string;
      type: "email";
      name: string;
      draft_id: string | null;
      subject: string;
      preheader: string;
      from_label: string;
      from_email: string;
      reply_to: string;
      smart_sending: boolean;
      utm: boolean;
    }
  | { id: string; type: "delay"; value: number; unit: "minutes" | "hours" | "days"; until: string | null; weekdays: Array<(typeof WEEKDAYS)[number]> }
  | { id: string; type: "split"; condition: FlowCondition; yes: FlowStep[]; no: FlowStep[] }
  | { id: string; type: "trigger_split"; field: string; operator: (typeof NUMERIC_OPERATORS)[number]; value: number; yes: FlowStep[]; no: FlowStep[] }
  | { id: string; type: "update"; property: string; value: string };

const stepId = z.string().trim().min(1).max(64);

const stepSchema: z.ZodType<FlowStep> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      id: stepId,
      type: z.literal("email"),
      name: z.string().trim().max(120),
      draft_id: z.string().uuid().nullable(),
      subject: z.string().max(255),
      preheader: z.string().max(255),
      from_label: z.string().trim().max(120),
      from_email: z.string().trim().max(255),
      reply_to: z.string().trim().max(255).default(""),
      smart_sending: z.boolean(),
      utm: z.boolean(),
    }),
    z.object({
      id: stepId,
      type: z.literal("delay"),
      value: z.number().int().min(1).max(999),
      unit: z.enum(["minutes", "hours", "days"]),
      until: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      weekdays: z.array(z.enum(WEEKDAYS)).max(7),
    }),
    z.object({ id: stepId, type: z.literal("split"), condition: conditionSchema, yes: z.array(stepSchema), no: z.array(stepSchema) }),
    z.object({
      id: stepId,
      type: z.literal("trigger_split"),
      field: z.string().trim().max(120),
      operator: z.enum(NUMERIC_OPERATORS),
      value: z.number().min(0).max(10_000_000),
      yes: z.array(stepSchema),
      no: z.array(stepSchema),
    }),
    z.object({ id: stepId, type: z.literal("update"), property: z.string().trim().max(120), value: z.string().max(255) }),
  ]),
);

export const flowDesignSchema = z
  .object({
    version: z.literal(1),
    trigger: z.object({
      type: z.enum(["metric", "list", "segment"]),
      id: z.string().trim().max(64),
      min_value: z.number().min(0).max(10_000_000).nullable(),
      exclude_purchasers: z.boolean(),
      reentry_days: z.number().int().min(0).max(365).nullable(),
    }),
    steps: z.array(stepSchema),
  })
  .strict();

export type FlowDesign = z.infer<typeof flowDesignSchema>;

const designBodySchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    design: flowDesignSchema,
  })
  .strict();

function serviceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Ver y guardar diseños: los mismos que ven Marketing (consultor, owner, manager). */
function access(context: AuthContext, organizationId: string): Failure | null {
  const membership = requireOperationalOrganization(context, organizationId);
  if (membership.ok === false) return membership;
  const allowed =
    ["platform_admin", "consultant"].includes(context.profile.platform_role) ||
    ["owner", "manager"].includes(membership.membership.role);
  return allowed ? null : { ok: false, statusCode: 403, error: "marketing_access_required" };
}

function walk(steps: FlowStep[], fn: (step: FlowStep) => void) {
  for (const step of steps) {
    fn(step);
    if (step.type === "split" || step.type === "trigger_split") {
      walk(step.yes, fn);
      walk(step.no, fn);
    }
  }
}

export type FlowIssue = { step_id: string | null; message: string };

/**
 * Lo que impide crear el flow en Klaviyo. Pura: la usa la API antes de
 * escribir y el test la cubre. La web tiene su propia revisión, más amplia y
 * con consejos; esta solo bloquea lo que Klaviyo rechazaría o mandaría mal.
 */
export function flowDesignIssues(design: FlowDesign, context: { placedOrderMetricId: string | null }): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const t = design.trigger;
  if (!t.id) issues.push({ step_id: "trigger", message: "Elige qué hace entrar a la gente en el flow." });
  if (t.exclude_purchasers && !context.placedOrderMetricId) {
    issues.push({ step_id: "trigger", message: "Klaviyo no está conectado a Shopify: no se puede sacar a quien compra." });
  }
  if (!design.steps.length) issues.push({ step_id: null, message: "El flow no tiene pasos." });
  let count = 0;
  let emails = 0;
  const ids = new Set<string>();
  walk(design.steps, (step) => {
    count += 1;
    if (ids.has(step.id)) issues.push({ step_id: step.id, message: "Hay dos pasos con el mismo identificador." });
    ids.add(step.id);
    if (step.type === "email") {
      emails += 1;
      const label = step.name || "Un email";
      if (!step.draft_id) issues.push({ step_id: step.id, message: `«${label}» no tiene pieza del Estudio.` });
      if (!step.subject.trim()) issues.push({ step_id: step.id, message: `«${label}» no tiene asunto.` });
      if (!EMAIL_RE.test(step.from_email)) issues.push({ step_id: step.id, message: `El remitente de «${label}» no es un email válido.` });
      if (step.reply_to && !EMAIL_RE.test(step.reply_to)) issues.push({ step_id: step.id, message: `La respuesta de «${label}» no es un email válido.` });
    }
    if (step.type === "split") {
      const c = step.condition;
      const empty = c.kind === "metric" ? !c.metric_id : c.kind === "group" ? !c.group_id : !c.property;
      if (empty) issues.push({ step_id: step.id, message: "Una división no tiene la condición completa." });
    }
    if (step.type === "trigger_split" && !step.field) issues.push({ step_id: step.id, message: "Una división por disparador no dice qué propiedad mirar." });
    if (step.type === "update" && !step.property) issues.push({ step_id: step.id, message: "«Actualizar perfil» no dice qué propiedad guardar." });
    if (step.type === "trigger_split" && t.type !== "metric") {
      issues.push({ step_id: step.id, message: "La división por disparador solo sirve si el flow empieza por algo que hace la persona." });
    }
  });
  if (count > MAX_STEPS) issues.push({ step_id: null, message: `El flow tiene ${count} pasos; el máximo aquí es ${MAX_STEPS}.` });
  if (design.steps.length && !emails) issues.push({ step_id: null, message: "El flow no manda ningún email." });
  return issues;
}

function conditionFilter(condition: FlowCondition): Record<string, unknown> {
  if (condition.kind === "group") {
    return { type: "profile-group-membership", is_member: condition.member, group_ids: [condition.group_id] };
  }
  if (condition.kind === "property") {
    return { type: "profile-property", property: condition.property, filter: { type: "string", operator: condition.operator, value: condition.value } };
  }
  const timeframe =
    condition.timeframe.kind === "in-the-last"
      ? { type: "date", operator: "in-the-last", unit: condition.timeframe.unit, quantity: condition.timeframe.quantity }
      : { type: "date", operator: condition.timeframe.kind };
  return {
    type: "profile-metric",
    metric_id: condition.metric_id,
    measurement: "count",
    measurement_filter: { type: "numeric", operator: condition.operator, value: condition.value },
    timeframe_filter: timeframe,
    metric_filters: null,
  };
}

/**
 * Cuerpo de `POST /flows/` a partir del diseño. `templateIds` va de pieza del
 * Estudio a plantilla de Klaviyo; sin ella (vista previa) queda un marcador.
 */
export function klaviyoFlowBody(
  name: string,
  design: FlowDesign,
  context: { placedOrderMetricId: string | null; templateIds: ReadonlyMap<string, string> },
) {
  const ids = new Map<string, string>();
  let n = 0;
  walk(design.steps, (step) => ids.set(step.id, `a${++n}`));
  const first = (list: FlowStep[]) => (list[0] ? (ids.get(list[0].id) ?? null) : null);
  const t = design.trigger;
  const actions: Array<Record<string, unknown>> = [];

  const emit = (list: FlowStep[]) => {
    list.forEach((step, index) => {
      const next = list[index + 1] ? (ids.get(list[index + 1]!.id) ?? null) : null;
      const base = { temporary_id: ids.get(step.id) };
      if (step.type === "email") {
        actions.push({
          ...base,
          type: "send-email",
          links: { next },
          data: {
            message: {
              name: step.name || step.subject,
              from_email: step.from_email,
              from_label: step.from_label || step.from_email,
              reply_to_email: step.reply_to || null,
              cc_email: null,
              bcc_email: null,
              subject_line: step.subject,
              preview_text: step.preheader,
              template_id: step.draft_id ? (context.templateIds.get(step.draft_id) ?? `pieza:${step.draft_id}`) : null,
              smart_sending_enabled: step.smart_sending,
              transactional: false,
              add_tracking_params: step.utm,
              custom_tracking_params: null,
              additional_filters: null,
            },
            status: "draft",
          },
        });
      } else if (step.type === "delay") {
        const daily = step.unit === "days";
        actions.push({
          ...base,
          type: "time-delay",
          links: { next },
          data: {
            unit: step.unit,
            value: step.value,
            secondary_value: null,
            timezone: "profile",
            delay_until_time: daily && step.until ? `${step.until}:00` : null,
            delay_until_weekdays: daily && step.weekdays.length ? step.weekdays : null,
          },
        });
      } else if (step.type === "split") {
        actions.push({
          ...base,
          type: "conditional-split",
          links: { next_if_true: first(step.yes), next_if_false: first(step.no) },
          data: { profile_filter: { condition_groups: [{ conditions: [conditionFilter(step.condition)] }] } },
        });
      } else if (step.type === "trigger_split") {
        actions.push({
          ...base,
          type: "trigger-split",
          links: { next_if_true: first(step.yes), next_if_false: first(step.no) },
          data: {
            trigger_id: t.id,
            trigger_type: "metric",
            trigger_filter: {
              condition_groups: [
                { conditions: [{ type: "metric-property", metric_id: t.id, field: step.field, filter: { type: "numeric", operator: step.operator, value: step.value } }] },
              ],
            },
          },
        });
      } else {
        actions.push({
          ...base,
          type: "update-profile",
          links: { next },
          data: { profile_operations: [{ operator: "update", property_type: "string", property_key: step.property, property_value: step.value }] },
        });
      }
      if (step.type === "split" || step.type === "trigger_split") {
        emit(step.yes);
        emit(step.no);
      }
    });
  };
  emit(design.steps);

  const trigger =
    t.type === "metric"
      ? {
          type: "metric",
          id: t.id,
          trigger_filter: t.min_value
            ? { condition_groups: [{ conditions: [{ type: "metric-property", metric_id: t.id, field: "$value", filter: { type: "numeric", operator: "greater-than-or-equal", value: t.min_value } }] }] }
            : null,
        }
      : { type: t.type, id: t.id };
  const profileFilter =
    t.exclude_purchasers && context.placedOrderMetricId
      ? {
          condition_groups: [
            {
              conditions: [
                conditionFilter({ kind: "metric", metric_id: context.placedOrderMetricId, operator: "equals", value: 0, timeframe: { kind: "flow-start" } }),
              ],
            },
          ],
        }
      : null;

  return {
    data: {
      type: "flow",
      attributes: {
        name,
        definition: {
          triggers: [trigger],
          profile_filter: profileFilter,
          actions,
          entry_action_id: first(design.steps),
          ...(t.type === "metric" && t.reentry_days ? { reentry_criteria: { duration: t.reentry_days, unit: "day" } } : {}),
        },
      },
    },
  };
}

const DESIGN_SELECT = "id, name, design, status, klaviyo_flow_id, pushed_at, updated_at";

async function accountFor(supabase: ReturnType<typeof serviceClient>, organizationId: string) {
  const connectionId = await activeKlaviyoConnectionId(supabase, organizationId);
  if (!connectionId) return null;
  const { data: account } = await supabase
    .from("klaviyo_accounts")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("connection_id", connectionId)
    .limit(1)
    .maybeSingle();
  return { connectionId, accountId: (account?.id as string | undefined) ?? null };
}

type AccountMetric = { id: string; name: string; integration: string | null };

/**
 * Métricas de la cuenta. La integración (Shopify, Klaviyo, API…) no tiene
 * columna propia desde la convergencia de esquema: vive en `raw_data.integration`.
 */
async function accountMetrics(supabase: ReturnType<typeof serviceClient>, accountId: string | null): Promise<AccountMetric[]> {
  if (!accountId) return [];
  const { data, error } = await supabase.from("klaviyo_metrics").select("external_metric_id, name, raw_data").eq("account_id", accountId).order("name");
  if (error) {
    console.warn(`klaviyo_metrics_load_failed:${accountId}:${error.message}`);
    return [];
  }
  return (data ?? []).map((row) => {
    const integration = (row.raw_data as { integration?: { name?: unknown } } | null)?.integration?.name;
    return { id: String(row.external_metric_id), name: String(row.name), integration: typeof integration === "string" ? integration : null };
  });
}

/** «Placed Order» de la cuenta; si hay varias (Shopify y API), la de Shopify. */
export function placedOrderFrom(metrics: AccountMetric[]): string | null {
  const matches = metrics.filter((metric) => metric.name === "Placed Order");
  return (matches.find((metric) => (metric.integration ?? "").toLowerCase().includes("shopify")) ?? matches[0])?.id ?? null;
}

async function placedOrderMetric(supabase: ReturnType<typeof serviceClient>, accountId: string | null) {
  return placedOrderFrom(await accountMetrics(supabase, accountId));
}

/** Diseños guardados y lo que el editor necesita de la cuenta (métricas, permiso). */
export async function listFlowDesigns(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
): Promise<Result<Record<string, unknown>>> {
  const denied = access(context, organizationId);
  if (denied) return denied;
  const supabase = serviceClient(env);
  const [designs, target] = await Promise.all([
    supabase.from("marketing_flow_designs").select(DESIGN_SELECT).eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(100),
    accountFor(supabase, organizationId),
  ]);
  if (designs.error) return { ok: false, statusCode: 500, error: "flow_designs_load_failed", detail: designs.error.message };
  let metrics: AccountMetric[] = [];
  let canWrite = false;
  if (target) {
    const [metricRows, connection] = await Promise.all([
      accountMetrics(supabase, target.accountId),
      supabase.from("integration_connections").select("scopes").eq("id", target.connectionId).maybeSingle(),
    ]);
    metrics = metricRows;
    canWrite = Array.isArray(connection.data?.scopes) && (connection.data.scopes as string[]).includes("flows:write");
  }
  return { ok: true, data: { designs: designs.data ?? [], metrics, can_write: canWrite, connected: Boolean(target) } };
}

function parseBody(body: unknown): { ok: true; value: z.infer<typeof designBodySchema> } | Failure {
  const parsed = designBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, statusCode: 400, error: "flow_design_invalid", message: "El diseño del flow no tiene el formato esperado.", detail: parsed.error.issues[0]?.message ?? "invalid" };
  }
  if (JSON.stringify(parsed.data.design).length > 200_000) {
    return { ok: false, statusCode: 413, error: "flow_design_too_large", message: "El flow es demasiado grande para guardarlo." };
  }
  return { ok: true, value: parsed.data };
}

export async function saveFlowDesign(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  designId: string | null,
  body: unknown,
): Promise<Result<Record<string, unknown>>> {
  const denied = access(context, organizationId);
  if (denied) return denied;
  const parsed = parseBody(body);
  if (!parsed.ok) return parsed;
  const supabase = serviceClient(env);
  const target = await accountFor(supabase, organizationId);
  const fields = { name: parsed.value.name, design: parsed.value.design, updated_by: context.user.id };
  const query = designId
    ? supabase.from("marketing_flow_designs").update(fields).eq("id", designId).eq("organization_id", organizationId)
    : supabase.from("marketing_flow_designs").insert({ ...fields, organization_id: organizationId, connection_id: target?.connectionId ?? null, created_by: context.user.id });
  const { data, error } = await query.select(DESIGN_SELECT).maybeSingle();
  if (error) return { ok: false, statusCode: 500, error: "flow_design_save_failed", detail: error.message };
  if (!data) return { ok: false, statusCode: 404, error: "flow_design_not_found" };
  return { ok: true, data };
}

export async function deleteFlowDesign(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  designId: string,
): Promise<Result<{ deleted: true }>> {
  const denied = access(context, organizationId);
  if (denied) return denied;
  const { error } = await serviceClient(env).from("marketing_flow_designs").delete().eq("id", designId).eq("organization_id", organizationId);
  if (error) return { ok: false, statusCode: 500, error: "flow_design_delete_failed", detail: error.message };
  return { ok: true, data: { deleted: true } };
}

/** Lo que se mandaría a Klaviyo, sin mandarlo (vista «Formato Klaviyo»). */
export async function previewFlowDesign(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  body: unknown,
): Promise<Result<{ body: unknown; issues: FlowIssue[] }>> {
  const denied = access(context, organizationId);
  if (denied) return denied;
  const parsed = parseBody(body);
  if (!parsed.ok) return parsed;
  const supabase = serviceClient(env);
  const target = await accountFor(supabase, organizationId);
  const placedOrderMetricId = await placedOrderMetric(supabase, target?.accountId ?? null);
  const design = parsed.value.design;
  return {
    ok: true,
    data: {
      body: klaviyoFlowBody(parsed.value.name, design, { placedOrderMetricId, templateIds: new Map() }),
      issues: flowDesignIssues(design, { placedOrderMetricId }),
    },
  };
}

/**
 * Crea el flow en Klaviyo, en borrador. Escribe en la cuenta del cliente, así
 * que pide rol de gestión y piezas aprobadas (lo exige la subida de plantilla).
 */
export async function pushFlowDesign(
  env: LoadedApiEnv,
  context: AuthContext,
  organizationId: string,
  designId: string,
): Promise<Result<{ klaviyo_flow_id: string; replaced: string | null }>> {
  const accessError = canManage(context, organizationId);
  if (accessError) return { ok: false, statusCode: 403, error: accessError };
  const supabase = serviceClient(env);
  const { data: row, error } = await supabase
    .from("marketing_flow_designs")
    .select(DESIGN_SELECT)
    .eq("id", designId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return { ok: false, statusCode: 500, error: "flow_design_load_failed", detail: error.message };
  if (!row) return { ok: false, statusCode: 404, error: "flow_design_not_found" };
  const parsed = flowDesignSchema.safeParse(row.design);
  if (!parsed.success) return { ok: false, statusCode: 422, error: "flow_design_invalid", detail: parsed.error.issues[0]?.message ?? "invalid" };
  const design = parsed.data;

  const target = await accountFor(supabase, organizationId);
  if (!target) return { ok: false, statusCode: 409, error: "klaviyo_not_connected", message: "Conecta Klaviyo antes de crear flows." };
  const placedOrderMetricId = await placedOrderMetric(supabase, target.accountId);
  const issues = flowDesignIssues(design, { placedOrderMetricId });
  if (issues.length) {
    return { ok: false, statusCode: 422, error: "flow_design_incomplete", message: issues[0]!.message, detail: JSON.stringify(issues) };
  }

  // Una plantilla por pieza, aunque la pieza se use en dos emails.
  const drafts = new Set<string>();
  walk(design.steps, (step) => {
    if (step.type === "email" && step.draft_id) drafts.add(step.draft_id);
  });
  const templateIds = new Map<string, string>();
  for (const draftId of drafts) {
    const pushed = await pushDraftToKlaviyoTemplate(env, context, organizationId, draftId);
    if (!pushed.ok) {
      return pushed.error === "marketing_draft_not_approved"
        ? { ...pushed, message: "Todas las piezas del flow tienen que estar aprobadas antes de crearlo en Klaviyo." }
        : pushed;
    }
    templateIds.set(draftId, pushed.data.klaviyo_template_id);
  }

  const body = klaviyoFlowBody(row.name as string, design, { placedOrderMetricId, templateIds });
  let flowId: string;
  try {
    const client = createKlaviyoClient(await getValidKlaviyoAccessToken(env, target.connectionId));
    const created = await client.request<{ data?: { id?: string } }>("/flows/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!created.data?.id) throw new Error("klaviyo_flow_id_missing");
    flowId = created.data.id;
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : "unknown_error";
    // ADR-0006 punto 8: si Klaviyo rechaza el cuerpo, que quede el motivo exacto.
    console.warn(`klaviyo_flow_create_failed:${designId}:${message}`);
    if (isKlaviyoPermissionError(message)) {
      const capability = klaviyoCapability("flows:write");
      return {
        ok: false,
        statusCode: 403,
        error: "klaviyo_flow_write_denied",
        message: capability
          ? describeKlaviyoMissingPermissions([capability], "api_key") + " Si conectaste por OAuth, vuelve a autorizar la cuenta."
          : "Klaviyo no deja crear flows con esta conexión.",
        detail: message,
      };
    }
    return { ok: false, statusCode: 502, error: "klaviyo_flow_create_failed", message: "Klaviyo no aceptó el flow.", detail: message };
  }

  const replaced = (row.klaviyo_flow_id as string | null) ?? null;
  await supabase
    .from("marketing_flow_designs")
    .update({ status: "in_klaviyo", klaviyo_flow_id: flowId, pushed_at: new Date().toISOString(), connection_id: target.connectionId, updated_by: context.user.id })
    .eq("id", designId);
  await recordAuditLog(supabase, {
    organizationId,
    actorUserId: context.user.id,
    action: "klaviyo.flow_created",
    entityType: "marketing_flow_design",
    entityId: designId,
    newData: { klaviyo_flow_id: flowId, replaced_flow_id: replaced, templates: [...templateIds.values()] },
  });
  return { ok: true, data: { klaviyo_flow_id: flowId, replaced } };
}
