// Informes PDF fuera del chat: historial por organización, generación desde la
// pantalla Informes, envío mensual programado e informe de cartera.
//
// Escrituras por service role + chequeo manual de acceso (ADR-0006 #7): la RLS
// de `copilot_reports` y `report_schedules` solo concede lectura.
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  isOperationalOrganizationError,
  requireOperationalOrganization,
  type AuthContext,
} from "./auth-context.js";
import { consultingOrganizationIdOf } from "./capacidad-cartera.js";
import { getConsultantProfitability, normalizeProfitabilityDays } from "./consultant-profitability.js";
import { normalizeReportRecipient, sendReportEmail } from "./copilot-report-sharing.js";
import { buildPortfolioReportDocument } from "./report-data.js";
import { buildOrganizationReport, isoDate, lastFullMonth, previousPeriod, REPORT_BUCKET, saveReport } from "./report-generate.js";
import { listReportTemplates, resolveReportTemplateId } from "./report-templates.js";

type ApiEnv = LoadedApiEnv;

function createServiceClient(env: ApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

const denied = (error: string, message: string, statusCode = 403) => ({ ok: false as const, statusCode, error, message });

/** Mismo criterio que alertas y costes: owner, manager, consultor o platform admin. */
function canManage(context: AuthContext, organizationId: string) {
  const operational = requireOperationalOrganization(context, organizationId);
  if (isOperationalOrganizationError(operational)) return false;
  return ["platform_admin", "consultant"].includes(context.profile.platform_role)
    || ["owner", "manager"].includes(operational.membership.role);
}

const REPORT_COLUMNS = "id, template_id, title, period_start, period_end, currency_code, file_name, source, prepared_by, highlights, recommendations, emailed_to, created_at";

export async function listReports(env: ApiEnv, context: AuthContext, organizationId: string) {
  const access = requireOperationalOrganization(context, organizationId);
  if (isOperationalOrganizationError(access)) return access;
  const supabase = createServiceClient(env);
  const [reports, schedules, stores] = await Promise.all([
    supabase.from("copilot_reports").select(REPORT_COLUMNS).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("report_schedules").select("id, template_id, recipients, is_active, last_period_end, updated_at").eq("organization_id", organizationId).order("created_at"),
    supabase.from("shopify_stores").select("id, shop_name, myshopify_domain").eq("organization_id", organizationId).eq("is_active", true).order("shop_name"),
  ]);
  if (reports.error || schedules.error) {
    return denied("reports_unavailable", reports.error?.message ?? schedules.error?.message ?? "", 500);
  }
  return {
    ok: true as const,
    data: {
      reports: reports.data ?? [],
      schedules: schedules.data ?? [],
      can_manage: canManage(context, organizationId),
      // Con varias tiendas hay que elegir una: no se mezclan monedas en un informe.
      stores: (stores.data ?? []).map((store) => ({ id: store.id, name: store.shop_name || store.myshopify_domain })),
      templates: listReportTemplates().map(({ id, name, description, applications }) => ({ id, name, description, applications })),
    },
  };
}

function parsePeriod(body: { period_start?: unknown; period_end?: unknown }) {
  if (body.period_start === undefined && body.period_end === undefined) return lastFullMonth();
  const valid = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!valid(body.period_start) || !valid(body.period_end)) return null;
  const start = new Date(`${body.period_start}T00:00:00.000Z`);
  const end = new Date(`${body.period_end}T23:59:59.999Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start || end.getTime() > Date.now() || end.getTime() - start.getTime() >= 93 * 86_400_000) return null;
  return { start, end };
}

/** «Generar informe» de la pantalla Informes: mismas plantillas que el copiloto, sin lectura IA. */
export async function generateReportOnDemand(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: { template_id?: unknown; store_id?: unknown; period_start?: unknown; period_end?: unknown },
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (isOperationalOrganizationError(access)) return access;
  const templateId = resolveReportTemplateId(body.template_id);
  if (!templateId) return denied("invalid_template", "Elige una plantilla del catálogo.", 400);
  const period = parsePeriod(body);
  if (!period) return denied("invalid_period", "El periodo debe ser válido, no futuro y de máximo 92 días.", 400);
  const storeId = typeof body.store_id === "string" && body.store_id ? body.store_id : null;
  const supabase = createServiceClient(env);
  const built = await buildOrganizationReport(supabase, { organizationId, storeId, templateId, periodStart: period.start, periodEnd: period.end });
  if (!built.ok) return denied(built.error, `${built.why} ${built.how_to_fix}`, 422);
  const saved = await saveReport(supabase, built.report, { organizationId, storeId: built.storeId, source: "copilot", requestedBy: context.user.id });
  if (!saved.ok) return denied(saved.error, saved.why, 503);
  return { ok: true as const, data: { report_id: saved.reportId, file_name: saved.fileName } };
}

export async function upsertReportSchedule(
  env: ApiEnv,
  context: AuthContext,
  organizationId: string,
  body: { template_id?: unknown; recipients?: unknown; is_active?: unknown },
) {
  if (!canManage(context, organizationId)) {
    return denied("report_schedule_manage_denied", "Solo owner, manager o el consultor pueden programar informes.");
  }
  const templateId = resolveReportTemplateId(body.template_id);
  if (!templateId) return denied("invalid_template", "Elige una plantilla del catálogo.", 400);
  const rawRecipients = Array.isArray(body.recipients) ? body.recipients : [];
  const recipients = [...new Set(rawRecipients.map(normalizeReportRecipient))];
  if (recipients.some((email) => email === null) || recipients.length === 0 || recipients.length > 10) {
    return denied("invalid_recipients", "Indica entre 1 y 10 correos válidos.", 400);
  }
  const { data, error } = await createServiceClient(env).from("report_schedules").upsert({
    organization_id: organizationId,
    template_id: templateId,
    recipients,
    is_active: body.is_active !== false,
    created_by: context.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,template_id" }).select("id, template_id, recipients, is_active, last_period_end, updated_at").single();
  if (error) return denied("report_schedule_failed", error.message, 500);
  return { ok: true as const, data: { schedule: data } };
}

export async function deleteReportSchedule(env: ApiEnv, context: AuthContext, organizationId: string, scheduleId: string) {
  if (!canManage(context, organizationId)) {
    return denied("report_schedule_manage_denied", "Solo owner, manager o el consultor pueden programar informes.");
  }
  const { error } = await createServiceClient(env).from("report_schedules").delete().eq("id", scheduleId).eq("organization_id", organizationId);
  if (error) return denied("report_schedule_failed", error.message, 500);
  return { ok: true as const, data: { deleted: true } };
}

/**
 * Informe de cartera: se guarda en la organización de la consultora, así que
 * lo ven todos sus consultores en Informes sin cliente activo.
 */
export async function generatePortfolioReport(env: ApiEnv, authorization: string, context: AuthContext, rawDays: unknown) {
  const consultingOrganizationId = consultingOrganizationIdOf(context);
  if (context.profile.platform_role !== "consultant" || !consultingOrganizationId) {
    return denied("portfolio_report_denied", "El informe de cartera es para consultores de una consultora.");
  }
  const days = normalizeProfitabilityDays(rawDays);
  const profitability = await getConsultantProfitability(env, authorization, context, { days });
  if (profitability.ok === false) return profitability;
  const { data } = profitability;
  if (data.clients.length === 0) return denied("portfolio_empty", "Aún no hay clientes con tienda en tu cartera.", 422);
  const consultoraName = context.memberships.find((membership) => membership.organization_id === consultingOrganizationId)?.organization?.display_name ?? "Tu consultora";
  const start = new Date(data.period.start);
  const end = new Date(data.period.end);
  const previous = previousPeriod(start, end);
  const report = buildPortfolioReportDocument({
    consultoraName,
    periodStart: isoDate(start),
    periodEnd: isoDate(end),
    previousPeriodStart: isoDate(previous.start),
    previousPeriodEnd: isoDate(previous.end),
    generatedAt: data.generated_at,
    totals: data.totals,
    clients: data.clients,
    monthly: data.monthly,
    failedStores: data.failed_stores.length,
  });
  const saved = await saveReport(createServiceClient(env), report, {
    organizationId: consultingOrganizationId,
    storeId: null,
    source: "portfolio",
    requestedBy: context.user.id,
  });
  if (!saved.ok) return denied(saved.error, saved.why, 503);
  return { ok: true as const, data: { report_id: saved.reportId, file_name: saved.fileName, organization_id: consultingOrganizationId } };
}

/**
 * Envío mensual (worker `scheduled-reports`, diario). Cada programación genera
 * el último mes completo una sola vez (`last_period_end`), así que si un día
 * falla, la siguiente pasada lo recupera sin duplicar.
 */
export async function runScheduledReports(env: ApiEnv, now = new Date()) {
  const supabase = createServiceClient(env);
  const period = lastFullMonth(now);
  const periodEnd = isoDate(period.end);
  const { data: schedules, error } = await supabase
    .from("report_schedules")
    .select("id, organization_id, template_id, store_id, recipients, last_period_end")
    .eq("is_active", true)
    .or(`last_period_end.is.null,last_period_end.lt.${periodEnd}`);
  if (error) throw new Error(`report_schedules: ${error.message}`);

  const result = { due: schedules?.length ?? 0, sent: 0, failed: 0, failures: [] as Array<{ schedule_id: string; error: string }> };
  for (const schedule of schedules ?? []) {
    const fail = (message: string) => {
      result.failed += 1;
      result.failures.push({ schedule_id: schedule.id, error: message });
    };
    const templateId = resolveReportTemplateId(schedule.template_id);
    if (!templateId) {
      fail("invalid_template");
      continue;
    }
    try {
      const built = await buildOrganizationReport(supabase, { organizationId: schedule.organization_id, storeId: schedule.store_id, templateId, periodStart: period.start, periodEnd: period.end });
      if (!built.ok) {
        fail(built.error);
        continue;
      }
      const saved = await saveReport(supabase, built.report, { organizationId: schedule.organization_id, storeId: built.storeId, source: "scheduled", requestedBy: null });
      if (!saved.ok) {
        fail(saved.error);
        continue;
      }
      const changes = built.report.sections.find((section) => section.kind === "summary");
      const recipients = (schedule.recipients ?? []) as string[];
      const sent = await sendReportEmail(env, {
        to: recipients,
        pdf: saved.pdf,
        filename: saved.fileName,
        summary: {
          title: built.report.title,
          period_start: built.report.periodStart,
          period_end: built.report.periodEnd,
          prepared_by: built.report.preparedBy ?? null,
          highlights: changes?.kind === "summary" ? changes.points : [],
        },
      });
      // El mes se da por hecho aunque el correo falle: el PDF ya está en el
      // historial y reintentarlo cada día solo duplicaría informes.
      await Promise.all([
        supabase.from("report_schedules").update({ last_period_end: periodEnd }).eq("id", schedule.id),
        sent.ok ? supabase.from("copilot_reports").update({ emailed_to: recipients }).eq("id", saved.reportId) : Promise.resolve(),
      ]);
      if (sent.ok) result.sent += 1;
      else fail(sent.error);
    } catch (cause) {
      fail(cause instanceof Error ? cause.message : String(cause));
    }
  }
  return result;
}

export { REPORT_BUCKET };
