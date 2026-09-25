import nodemailer from "nodemailer";

export type InvoiceMailerEnv = {
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_USER?: string;
  SMTP_BREVO?: string;
  SMTP_FROM_EMAIL?: string;
  SMTP_FROM_NAME?: string;
};

export type InvoiceEmailInvoice = {
  invoice_code: string;
  issue_date: string;
  issuer_name: string;
  issuer_tax_id: string;
  issuer_address?: Record<string, unknown> | null;
  customer_name: string | null;
  customer_tax_id: string | null;
  customer_email: string | null;
  currency_code: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  operation_description: string;
  verifactu_status?: string | null;
  verifactu_qr_url?: string | null;
};

export type InvoiceEmailLine = {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  base_amount: number;
  tax_amount: number;
  total_amount: number;
};

export type InvoiceEmailData = {
  invoice: InvoiceEmailInvoice;
  lines: InvoiceEmailLine[];
};

function value(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ascii(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function pdfEscape(input: string): string {
  return ascii(input)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function date(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Madrid",
  }).format(parsed);
}

function addressLines(address: Record<string, unknown> | null | undefined) {
  if (!address) return [];
  return [
    value(address.address_line1) || value(address.line1),
    value(address.address_line2) || value(address.line2),
    [value(address.postal_code) || value(address.postal), value(address.city)]
      .filter(Boolean)
      .join(" "),
    value(address.region),
    value(address.country_code) || value(address.country),
  ].filter(Boolean);
}

function invoiceRecipient(invoice: InvoiceEmailInvoice): string {
  return invoice.customer_name || invoice.customer_email || "Cliente";
}

/**
 * PDF de una pagina con la informacion fiscal esencial. Se genera con las
 * primitivas PDF de Node para no introducir un motor de navegador en el API.
 * Los caracteres no incluidos en Helvetica se transliteran, mientras que el
 * HTML del correo conserva el texto original.
 */
export function buildInvoicePdf({ invoice, lines }: InvoiceEmailData): Buffer {
  const content: string[] = ["BT"];
  const text = (x: number, y: number, size: number, input: string) => {
    content.push(`/F1 ${size} Tf 1 0 0 1 ${x} ${y} Tm (${pdfEscape(input)}) Tj`);
  };

  text(48, 790, 18, invoice.issuer_name);
  text(48, 768, 10, `NIF: ${invoice.issuer_tax_id}`);
  for (const [index, line] of addressLines(invoice.issuer_address).entries()) {
    text(48, 750 - index * 14, 9, line);
  }

  text(365, 790, 16, "FACTURA");
  text(365, 768, 10, `Numero: ${invoice.invoice_code}`);
  text(365, 752, 10, `Fecha: ${date(invoice.issue_date)}`);
  text(365, 736, 10, `Tipo: ${invoice.invoice_code ? "F1" : ""}`);

  content.push("0.85 0.85 0.85 RG 48 680 m 547 680 l S");
  text(48, 658, 10, "CLIENTE");
  text(48, 642, 11, invoiceRecipient(invoice));
  if (invoice.customer_tax_id) text(48, 626, 10, `NIF: ${invoice.customer_tax_id}`);
  text(48, 610, 10, invoice.customer_email || "");

  text(48, 568, 10, "CONCEPTO");
  text(325, 568, 10, "BASE");
  text(410, 568, 10, "IVA");
  text(492, 568, 10, "TOTAL");
  content.push("0.85 0.85 0.85 RG 48 558 m 547 558 l S");

  let y = 536;
  for (const line of lines.slice(0, 8)) {
    text(48, y, 9, ascii(line.description).slice(0, 56));
    text(325, y, 9, money(line.base_amount, invoice.currency_code));
    text(410, y, 9, money(line.tax_amount, invoice.currency_code));
    text(492, y, 9, money(line.total_amount, invoice.currency_code));
    y -= 22;
  }

  content.push("0.85 0.85 0.85 RG 330 330 m 547 330 l S");
  text(350, 308, 10, "Base imponible");
  text(492, 308, 10, money(invoice.subtotal, invoice.currency_code));
  text(350, 290, 10, "IVA");
  text(492, 290, 10, money(invoice.tax_amount, invoice.currency_code));
  text(350, 266, 12, "TOTAL");
  text(492, 266, 12, money(invoice.total, invoice.currency_code));
  text(48, 240, 10, invoice.operation_description);
  text(48, 216, 9, "Factura emitida tras la confirmacion del pago en Stripe.");
  if (invoice.verifactu_qr_url) {
    text(48, 190, 8, "Consulta VERI*FACTU:");
    text(48, 176, 7, invoice.verifactu_qr_url.slice(0, 100));
  }
  content.push("ET");

  const stream = content.join("\n") + "\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}endstream`,
  ];
  const header = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary");
  const chunks = [header];
  const offsets = [0];
  let offset = header.length;
  for (const [index, object] of objects.entries()) {
    offsets.push(offset);
    const chunk = Buffer.from(`${index + 1} 0 obj\n${object}\nendobj\n`, "ascii");
    chunks.push(chunk);
    offset += chunk.length;
  }
  const xrefOffset = offset;
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (const objectOffset of offsets.slice(1)) {
    xref.push(`${String(objectOffset).padStart(10, "0")} 00000 n `);
  }
  xref.push(
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  );
  chunks.push(Buffer.from(`${xref.join("\n")}\n`, "ascii"));
  return Buffer.concat(chunks);
}

export function renderInvoiceEmailHtml({ invoice, lines }: InvoiceEmailData) {
  const rows = lines
    .map(
      (line) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827">${escapeHtml(line.description)}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #e5e7eb;color:#111827">${escapeHtml(money(line.total_amount, invoice.currency_code))}</td>
      </tr>`,
    )
    .join("");
  const qr = invoice.verifactu_qr_url
    ? `<p style="font-size:12px;line-height:1.5;color:#6b7280">Consulta VERI*FACTU: <a href="${escapeHtml(invoice.verifactu_qr_url)}" style="color:#1d4ed8">verificar factura</a></p>`
    : "";
  return `<!-- preheader --><div style="display:none;max-height:0;overflow:hidden;opacity:0">Factura ${escapeHtml(invoice.invoice_code)} de E-NORA</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8ff;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e5e7eb;border-radius:10px"><tr><td style="padding:30px 32px"><div style="font-size:17px;font-weight:700;color:#1d4ed8">E-NORA</div><h1 style="margin:24px 0 12px;font-size:22px;color:#111827">Tu factura ${escapeHtml(invoice.invoice_code)}</h1><p style="font-size:15px;line-height:1.6;color:#111827">Hola ${escapeHtml(invoiceRecipient(invoice))},</p><p style="font-size:15px;line-height:1.6;color:#111827">Adjuntamos la factura correspondiente a tu suscripcion de E-NORA.</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;font-size:14px"><thead><tr><th align="left" style="padding-bottom:8px;color:#6b7280">Concepto</th><th align="right" style="padding-bottom:8px;color:#6b7280">Importe</th></tr></thead><tbody>${rows}</tbody></table><p style="margin:22px 0 0;text-align:right;font-size:17px;font-weight:700;color:#111827">Total: ${escapeHtml(money(invoice.total, invoice.currency_code))}</p>${qr}<p style="margin:26px 0 0;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.6;color:#6b7280">Este correo ha sido enviado automáticamente tras confirmar el pago. Si necesitas corregir tus datos fiscales, responde a este mensaje.</p></td></tr></table></td></tr></table>`;
}

export function renderInvoiceEmailText({ invoice, lines }: InvoiceEmailData) {
  return [
    `Hola ${invoiceRecipient(invoice)},`,
    "",
    `Adjuntamos la factura ${invoice.invoice_code} de E-NORA.`,
    "",
    ...lines.map(
      (line) => `${line.description}: ${money(line.total_amount, invoice.currency_code)}`,
    ),
    "",
    `Total: ${money(invoice.total, invoice.currency_code)}`,
    invoice.verifactu_qr_url
      ? `Consulta VERI*FACTU: ${invoice.verifactu_qr_url}`
      : null,
    "",
    "E-NORA",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export function hasInvoiceSmtp(env: InvoiceMailerEnv): boolean {
  return Boolean(env.SMTP_USER && env.SMTP_BREVO);
}

export async function sendInvoiceMail(
  env: InvoiceMailerEnv,
  data: InvoiceEmailData,
): Promise<
  | { sent: true; messageId: string | null }
  | { sent: false; reason: string }
> {
  const recipient = data.invoice.customer_email?.trim().toLowerCase();
  if (!recipient) return { sent: false, reason: "customer_email_missing" };
  if (!hasInvoiceSmtp(env)) return { sent: false, reason: "smtp_not_configured" };

  const host = env.SMTP_HOST ?? "smtp-relay.brevo.com";
  const port = env.SMTP_PORT ?? 587;
  const fromEmail = env.SMTP_FROM_EMAIL ?? env.SMTP_USER!;
  const fromName = env.SMTP_FROM_NAME ?? "E-NORA";
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      auth: { user: env.SMTP_USER!, pass: env.SMTP_BREVO! },
    });
    const info = await transporter.sendMail({
      from: `"${fromName.replaceAll('"', "")}" <${fromEmail}>`,
      to: recipient,
      subject: `Factura ${data.invoice.invoice_code} - E-NORA`,
      text: renderInvoiceEmailText(data),
      html: renderInvoiceEmailHtml(data),
      attachments: [
        {
          filename: `factura-${data.invoice.invoice_code}.pdf`,
          content: buildInvoicePdf(data),
          contentType: "application/pdf",
        },
      ],
    });
    return { sent: true, messageId: info.messageId ?? null };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "smtp_send_failed",
    };
  }
}
