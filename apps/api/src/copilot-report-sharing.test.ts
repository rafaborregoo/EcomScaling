import assert from "node:assert/strict";
import test from "node:test";
import {
  renderReportEmail,
  createCopilotReportShareLink,
  emailCopilotReport,
  isCopilotReportId,
  normalizeReportRecipient,
  safeCopilotReportFileName,
} from "./copilot-report-sharing.js";
import type { AuthContext } from "./auth-context.js";

test("report sharing accepts valid email recipients and normalizes casing", () => {
  assert.equal(normalizeReportRecipient("  INFORMES@Empresa.es "), "informes@empresa.es");
  assert.equal(normalizeReportRecipient("bad-address"), null);
  assert.equal(normalizeReportRecipient("a@b"), null);
  assert.equal(normalizeReportRecipient("x".repeat(255) + "@example.com"), null);
  assert.equal(normalizeReportRecipient(null), null);
});

test("report IDs must be UUIDs before storage paths are built", () => {
  assert.equal(isCopilotReportId("4ab57fd3-8ca7-4df0-9f80-1756d36ff236"), true);
  assert.equal(isCopilotReportId("../another-tenant/report.pdf"), false);
  assert.equal(isCopilotReportId("not-a-uuid"), false);
});

test("download names are restricted to the generated report filename format", () => {
  const reportId = "4ab57fd3-8ca7-4df0-9f80-1756d36ff236";
  assert.equal(
    safeCopilotReportFileName(
      "informe-shopify_comercial-2026-09-01-2026-09-30.pdf",
      reportId,
    ),
    "informe-shopify_comercial-2026-09-01-2026-09-30.pdf",
  );
  assert.equal(
    safeCopilotReportFileName("../../report.pdf", reportId),
    `informe-${reportId}.pdf`,
  );
  assert.equal(safeCopilotReportFileName("x".repeat(101), reportId), `informe-${reportId}.pdf`);
});

test("share and email endpoints reject users without organization membership before storage access", async () => {
  const context = { memberships: [] } as unknown as AuthContext;
  const env = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "not-used-by-this-test",
    SMTP_USER: "sender@example.com",
    SMTP_BREVO: "not-used-by-this-test",
  };
  const organizationId = "4ab57fd3-8ca7-4df0-9f80-1756d36ff236";
  const reportId = "5bc68fe4-9db8-4ef1-8a91-2867e47aa347";

  const link = await createCopilotReportShareLink(env, context, organizationId, reportId);
  const email = await emailCopilotReport(env, context, organizationId, reportId, "person@example.com");
  assert.equal(link.ok, false);
  assert.equal(email.ok, false);
  if (!link.ok) assert.equal(link.error, "organization_access_denied");
  if (!email.ok) assert.equal(email.error, "organization_access_denied");
});

test("report email leads with the reading and signs with the consultora", () => {
  const { subject, text, html } = renderReportEmail({
    title: "Resumen ejecutivo de negocio",
    period_start: "2026-09-01",
    period_end: "2026-09-30",
    prepared_by: "Consultora <Demo>",
    highlights: ["Las ventas suben un 13 %.", 42],
  }, "informe.pdf");
  assert.match(subject, /^Resumen ejecutivo de negocio · 1 de septiembre de 2026 – 30 de septiembre de 2026$/);
  assert.match(text, /- Las ventas suben un 13 %\./);
  assert.match(text, /Consultora <Demo>, con E-NORA$/);
  assert.ok(html.includes("Consultora &lt;Demo&gt;, con E-NORA"));
  assert.equal(html.includes("42"), false);
});
