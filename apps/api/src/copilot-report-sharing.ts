import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  type AuthContext,
  requireOperationalOrganization,
} from "./auth-context.js";

type ReportSharingEnv = Pick<
  LoadedApiEnv,
  | "SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SMTP_HOST"
  | "SMTP_PORT"
  | "SMTP_USER"
  | "SMTP_BREVO"
  | "SMTP_FROM_EMAIL"
  | "SMTP_FROM_NAME"
>;

const BUCKET = "copilot-reports";
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export function normalizeReportRecipient(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

export function isCopilotReportId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export function safeCopilotReportFileName(value: unknown, reportId: string): string {
  if (
    typeof value === "string" &&
    value.length <= 100 &&
    /^informe-[a-z0-9_]+-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.pdf$/i.test(value)
  ) return value;
  return `informe-${reportId}.pdf`;
}

function createServiceClient(env: ReportSharingEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function authorizedReportPath(
  context: AuthContext,
  organizationId: string,
  reportId: string,
) {
  const access = requireOperationalOrganization(context, organizationId);
  if (access.ok === false) return access;
  if (!isCopilotReportId(reportId)) {
    return { ok: false as const, statusCode: 404, error: "report_not_found" };
  }
  return { ok: true as const, path: `${organizationId}/${reportId}.pdf` };
}

export async function createCopilotReportShareLink(
  env: ReportSharingEnv,
  context: AuthContext,
  organizationId: string,
  reportId: string,
  requestedFileName?: unknown,
) {
  const target = authorizedReportPath(context, organizationId, reportId);
  if (!target.ok) return target;
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false as const, statusCode: 503, error: "report_storage_unavailable" };
  }

  const fileName = safeCopilotReportFileName(requestedFileName, reportId);
  const { data, error } = await createServiceClient(env).storage
    .from(BUCKET)
    .createSignedUrl(target.path, 60 * 60, { download: fileName });
  if (error || !data?.signedUrl) {
    return { ok: false as const, statusCode: 404, error: "report_not_found" };
  }
  return { ok: true as const, data: { download_url: data.signedUrl, expires_in_seconds: 3600 } };
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export async function emailCopilotReport(
  env: ReportSharingEnv,
  context: AuthContext,
  organizationId: string,
  reportId: string,
  rawRecipient: unknown,
  requestedFileName?: unknown,
) {
  const target = authorizedReportPath(context, organizationId, reportId);
  if (!target.ok) return target;
  const recipient = normalizeReportRecipient(rawRecipient);
  if (!recipient) {
    return { ok: false as const, statusCode: 400, error: "invalid_email" };
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false as const, statusCode: 503, error: "report_storage_unavailable" };
  }
  if (!env.SMTP_USER || !env.SMTP_BREVO) {
    return { ok: false as const, statusCode: 503, error: "email_not_configured" };
  }

  const { data: file, error } = await createServiceClient(env).storage
    .from(BUCKET)
    .download(target.path);
  if (error || !file) {
    return { ok: false as const, statusCode: 404, error: "report_not_found" };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false as const, statusCode: 413, error: "report_too_large" };
  }

  const pdf = Buffer.from(await file.arrayBuffer());
  const filename = safeCopilotReportFileName(requestedFileName, reportId);
  const host = env.SMTP_HOST ?? "smtp-relay.brevo.com";
  const port = env.SMTP_PORT ?? 587;
  const fromEmail = env.SMTP_FROM_EMAIL ?? env.SMTP_USER;
  const fromName = (env.SMTP_FROM_NAME ?? "E-NORA").replaceAll('"', "");

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      auth: { user: env.SMTP_USER, pass: env.SMTP_BREVO },
    });
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: recipient,
      subject: "Tu informe PDF - E-NORA",
      text: "Adjuntamos el informe PDF que has solicitado desde el copiloto de E-NORA.",
      html: `<p>Adjuntamos el informe PDF que has solicitado desde el copiloto de E-NORA.</p><p><strong>${escapeHtml(filename)}</strong></p>`,
      attachments: [{ filename, content: pdf, contentType: "application/pdf" }],
    });
  } catch {
    return { ok: false as const, statusCode: 502, error: "report_email_send_failed" };
  }

  return { ok: true as const, data: { sent: true, recipient } };
}
