import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInvoicePdf,
  hasInvoiceSmtp,
  renderInvoiceEmailHtml,
  renderInvoiceEmailText,
  type InvoiceEmailData,
} from "./invoice-mailer.js";

const data: InvoiceEmailData = {
  invoice: {
    invoice_code: "F2026-00001",
    issue_date: "2026-09-16",
    issuer_name: "Rafael Borrego",
    issuer_tax_id: "12345678A",
    issuer_address: { address_line1: "Calle Mayor 1", city: "Madrid" },
    customer_name: "Ada Lovelace SL",
    customer_tax_id: "B12345678",
    customer_email: "ada@example.com",
    currency_code: "EUR",
    subtotal: 82.64,
    tax_amount: 17.36,
    total: 100,
    operation_description: "Suscripción de software EcomScaling",
    verifactu_status: "accepted",
    verifactu_qr_url: "https://www2.agenciatributaria.gob.es/qr",
  },
  lines: [
    {
      description: "Plan Growth mensual",
      quantity: 1,
      unit_price: 100,
      vat_rate: 21,
      base_amount: 82.64,
      tax_amount: 17.36,
      total_amount: 100,
    },
  ],
};

test("la plantilla de factura incluye destinatario, total y enlace VERI*FACTU", () => {
  const html = renderInvoiceEmailHtml(data);
  const text = renderInvoiceEmailText(data);
  assert.match(html, /ada@example\.com|Ada Lovelace/);
  assert.match(html, /F2026-00001/);
  assert.match(text, /Total: 100,00/);
  assert.match(text, /agenciatributaria/);
});

test("el PDF de factura es un documento PDF adjuntable", () => {
  const pdf = buildInvoicePdf(data);
  assert.equal(pdf.subarray(0, 8).toString("binary"), "%PDF-1.4");
  assert.match(pdf.toString("binary"), /F2026-00001/);
  assert.match(pdf.toString("binary"), /%%EOF/);
});

test("el mailer solo se considera configurado con credenciales SMTP", () => {
  assert.equal(hasInvoiceSmtp({ SMTP_USER: "rafael@noraapp.es" }), false);
  assert.equal(
    hasInvoiceSmtp({ SMTP_USER: "rafael@noraapp.es", SMTP_BREVO: "secret" }),
    true,
  );
});
