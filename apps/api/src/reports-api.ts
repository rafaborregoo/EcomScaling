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
import { buildOrganizationReport, consultoraBrandFor, isoDate, lastFullMonth, previousPeriod, REPORT_BUCKET, saveReport } from "./report-generate.js";
import { getReportTemplate, listReportTemplates, resolveReportTemplateId } from "./report-templates.js";

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

const REPORT_COLUMNS = "id, store_id, template_id, title, period_start, period_end, currency_code, file_name, source, prepared_by, highlights, recommendations, emailed_to, created_at";
const SCHEDULE_COLUMNS = "id, template_id, store_id, recipients, is_active, last_period_end, pending_period_end, pending_report_id, last_delivery_error, last_delivery_attempt_at, delivery_attempts, updated_at";

export async function listReports(env: ApiEnv, context: AuthContext, organizationId: string) {
  const access = requireOperationalOrganization(context, organizationId);
  if (isOperationalOrganizationError(access)) return access;
  const supabase = createServiceClient(env);
  const [reports, schedules, stores] = await Promise.all([
    supabase.from("copilot_reports").select(REPORT_COLUMNS).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100),
    supabase.from("report_schedules").select(SCHEDULE_COLUMNS).eq("organization_id", organizationId).order("created_at"),
    supabase.from("shopify_stores").select("id, connection_id, shop_name, myshopify_domain").eq("organization_id", organizationId).eq("is_active", true).order("shop_name"),
  ]);
  if (reports.error || schedules.error || stores.error) {
    return denied("reports_unavailable", reports.error?.message ?? schedules.error?.message ?? stores.error?.message ?? "", 500);
  }
  return {
    ok: true as const,
    data: {
      reports: reports.data ?? [],
      schedules: schedules.data ?? [],
      can_manage: canManage(context, organizationId),
      // Con varias tiendas hay que elegir una: no se mezclan monedas en un informe.
      stores: (stores.data ?? []).map((store) => ({ id: store.id, connection_id: store.connection_id, name: store.shop_name || store.myshopify_domain })),
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
  body: { template_id?: unknown; store_id?: unknown; recipients?: unknown; is_active?: unknown },
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
  const supabase = createServiceClient(env);
  const requestedStoreId = typeof body.store_id === "string" && body.store_id ? body.store_id : null;
  let storesQuery = supabase.from("shopify_stores").select("id").eq("organization_id", organizationId).eq("is_active", true);
  if (requestedStoreId) storesQuery = storesQuery.eq("id", requestedStoreId);
  const { data: stores, error: storesError } = await storesQuery.limit(2);
  if (storesError) return denied("report_store_scope_unavailable", "No se pudieron comprobar las tiendas. Reintenta la operación.", 503);
  if (requestedStoreId && !stores?.length) return denied("invalid_store", "La tienda no está activa en este cliente.", 400);
  if (!requestedStoreId && (stores?.length ?? 0) > 1) return denied("shopify_store_selection_required", "Selecciona la tienda del envío mensual.", 400);
  const storeId = requestedStoreId ?? stores?.[0]?.id ?? null;
  if (!storeId && getReportTemplate(templateId)?.applications.includes("Shopify")) return denied("shopify_store_unavailable", "Conecta una tienda Shopify antes de programar el informe.", 400);
  const { data, error } = await supabase.from("report_schedules").upsert({
    organization_id: organizationId,
    template_id: templateId,
    store_id: storeId,
    recipients,
    is_active: body.is_active !== false,
    created_by: context.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "organization_id,template_id,store_id" }).select(SCHEDULE_COLUMNS).single();
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
 * el último mes completo. El PDF pendiente se conserva hasta su entrega.
 * `last_period_end` solo avanza tras el envío; una concesión temporal evita
 * que dos ejecuciones envíen a la vez la misma programación.
 */
export async function runScheduledReports(env: ApiEnv, now = new Date()) {
  const supabase = createServiceClient(env);
  const period = lastFullMonth(now);
  const periodEnd = isoDate(period.end);
  const { data: schedules, error } = await supabase
    .from("report_schedules")
    .select("id, organization_id, template_id, store_id, recipients, last_period_end, pending_report_id, pending_period_end, delivery_attempts")
    .eq("is_active", true)
    .or(`pending_report_id.not.is.null,last_period_end.is.null,last_period_end.lt.${periodEnd}`);
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
    const leaseId = crypto.randomUUID();
    let leaseQuery = supabase.from("report_schedules").update({
      delivery_lease_id: leaseId,
      delivery_lease_until: new Date(now.getTime() + 15 * 60_000).toISOString(),
    }).eq("id", schedule.id).eq("is_active", true)
      .or(`delivery_lease_until.is.null,delivery_lease_until.lt.${now.toISOString()}`);
    // A worker may have completed between the initial read and this claim.
    leaseQuery = schedule.last_period_end === null ? leaseQuery.is("last_period_end", null) : leaseQuery.eq("last_period_end", schedule.last_period_end);
    const lease = await leaseQuery.select("id").maybeSingle();
    if (lease.error) { fail("report_delivery_claim_failed"); continue; }
    if (!lease.data) continue;
    try {
      const update = async (patch: Record<string, unknown>) => {
        const changed = await supabase.from("report_schedules").update(patch).eq("id", schedule.id).eq("delivery_lease_id", leaseId).select("id").single();
        if (changed.error) throw new Error("report_delivery_state_failed");
      };
      await update({ last_delivery_attempt_at: now.toISOString(), delivery_attempts: (schedule.delivery_attempts ?? 0) + 1 });
      const organization = await supabase.from("organizations").select("status").eq("id", schedule.organization_id).maybeSingle();
      if (organization.error || !organization.data) throw new Error("report_organization_unavailable");
      if (!["onboarding", "active"].includes(organization.data.status)) throw new Error("report_organization_inactive");
      if (schedule.store_id) {
        const store = await supabase.from("shopify_stores").select("id").eq("organization_id", schedule.organization_id).eq("id", schedule.store_id).eq("is_active", true).maybeSingle();
        if (store.error || !store.data) throw new Error("report_store_scope_unavailable");
      }
      let reportId: string | null = schedule.pending_report_id;
      let deliveryPeriodEnd: string = schedule.pending_period_end ?? periodEnd;
      if (!reportId) {
        const built = await buildOrganizationReport(supabase, { organizationId: schedule.organization_id, storeId: schedule.store_id, templateId, periodStart: period.start, periodEnd: period.end });
        if (!built.ok) throw new Error(built.error);
        const saved = await saveReport(supabase, built.report, { organizationId: schedule.organization_id, storeId: built.storeId, source: "scheduled", requestedBy: null });
        if (!saved.ok) throw new Error(saved.error);
        if (saved.historyError) throw new Error("report_history_unavailable");
        reportId = saved.reportId;
        deliveryPeriodEnd = periodEnd;
        await update({ pending_report_id: reportId, pending_period_end: deliveryPeriodEnd, last_delivery_error: null });
      }
      const { data: report, error: reportError } = await supabase.from("copilot_reports")
        .select("id, title, period_start, period_end, prepared_by, highlights, file_name, storage_path, emailed_to")
        .eq("id", reportId).eq("organization_id", schedule.organization_id).single();
      if (reportError || !report) throw new Error("report_history_unavailable");
      const { data: file, error: downloadError } = await supabase.storage.from(REPORT_BUCKET).download(report.storage_path);
      if (downloadError || !file) throw new Error("report_storage_unavailable");
      if (file.size > 20 * 1024 * 1024) throw new Error("report_too_large");
      const recipients = (schedule.recipients ?? []) as string[];
      const alreadySent = (report.emailed_to ?? []) as string[];
      const remaining = recipients.filter((email) => !alreadySent.includes(email));
      const { replyTo } = await consultoraBrandFor(supabase, schedule.organization_id);
      const sent = remaining.length ? await sendReportEmail(env, {
        to: remaining,
        replyTo,
        pdf: Buffer.from(await file.arrayBuffer()),
        filename: report.file_name,
        summary: {
          title: report.title,
          period_start: report.period_start,
          period_end: report.period_end,
          prepared_by: report.prepared_by,
          highlights: report.highlights ?? [],
        },
      }) : { ok: true as const, accepted: [] as string[] };
      const accepted = sent.accepted ?? [];
      if (accepted.length) {
        const history = await supabase.from("copilot_reports").update({ emailed_to: [...new Set([...alreadySent, ...accepted])] }).eq("id", reportId).eq("organization_id", schedule.organization_id);
        if (history.error) throw new Error("report_email_history_failed");
      }
      if (!sent.ok) throw new Error(sent.error);
      await update({ last_period_end: deliveryPeriodEnd, pending_report_id: null, pending_period_end: null, last_delivery_error: null, delivery_attempts: 0 });
      result.sent += 1;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const recorded = await supabase.from("report_schedules").update({ last_delivery_error: message.slice(0, 500) }).eq("id", schedule.id).eq("delivery_lease_id", leaseId);
      fail(recorded.error ? "report_delivery_state_failed" : message);
    } finally {
      const released = await supabase.from("report_schedules").update({ delivery_lease_id: null, delivery_lease_until: null }).eq("id", schedule.id).eq("delivery_lease_id", leaseId);
      if (released.error) result.failures.push({ schedule_id: schedule.id, error: "report_delivery_lease_release_failed" });
    }
  }
  return result;
}

export { REPORT_BUCKET };
