import crypto from "node:crypto";
import https from "node:https";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { AuthContext } from "./auth-context.js";
import { normalizeStripeInvoice } from "./billing.js";
import {
  sendInvoiceMail,
  type InvoiceEmailData,
  type InvoiceMailerEnv,
} from "./invoice-mailer.js";
import { createStripeClient, stripeErrorDetail } from "./stripe-client.js";

export type InvoicingEnv = InvoiceMailerEnv & {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VERIFACTU_CERT_PFX_BASE64?: string;
  VERIFACTU_CERT_PASSWORD?: string;
  VERIFACTU_ENVIRONMENT?: "test" | "production";
  STRIPE_SECRET_KEY?: string;
  STRIPE_API_VERSION?: string;
};

type JsonRecord = Record<string, unknown>;

export type PlatformBillingSettings = {
  singleton_id: boolean;
  legal_name: string;
  tax_id: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string;
  city: string;
  region: string | null;
  country_code: string;
  email: string | null;
  phone: string | null;
  invoice_series: string;
  default_vat_rate: number;
  prices_include_vat: boolean;
  vat_regime_code: string;
  system_name: string;
  system_id: string;
  system_version: string;
  installation_number: string;
  verifactu_enabled: boolean;
  verifactu_environment: "test" | "production";
};

export type BillingInvoice = {
  id: string;
  invoice_series: string;
  invoice_year: number;
  invoice_number: number;
  invoice_code: string;
  invoice_type: string;
  status: string;
  issue_date: string;
  operation_date: string;
  customer_name: string | null;
  customer_tax_id: string | null;
  customer_email: string | null;
  currency_code: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  operation_description: string;
  external_payment_id: string | null;
  verifactu_status: string;
  verifactu_qr_url: string | null;
  verifactu_submitted_at: string | null;
  invoice_email_status: string;
  invoice_email_attempts: number;
  invoice_email_sent_at: string | null;
  invoice_email_last_attempt_at: string | null;
  invoice_email_message_id: string | null;
  invoice_email_error: string | null;
  created_at: string;
};

type InvoiceLineInput = {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  base_amount: number;
  tax_amount: number;
  total_amount: number;
};

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xml(value: unknown) {
  return xmlEscape(String(value ?? ""));
}

function isoDateToAeatDate(value: string) {
  const date = new Date(value);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getUTCFullYear()}`;
}

function isoWithMadridOffset(date = new Date()) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  const offset =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Madrid",
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")
      ?.value.replace("GMT", "") ?? "+00:00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${offset || "+00:00"}`;
}

export function buildVerifactuHash(input: {
  issuerTaxId: string;
  invoiceCode: string;
  issueDate: string;
  invoiceType: string;
  taxAmount: number;
  total: number;
  previousHash: string | null;
  generatedAt: string;
}) {
  const source = [
    ["IDEmisorFactura", input.issuerTaxId],
    ["NumSerieFactura", input.invoiceCode],
    ["FechaExpedicionFactura", input.issueDate],
    ["TipoFactura", input.invoiceType],
    ["CuotaTotal", input.taxAmount],
    ["ImporteTotal", input.total],
    ["Huella", input.previousHash ?? ""],
    ["FechaHoraHusoGenRegistro", input.generatedAt],
  ]
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto
    .createHash("sha256")
    .update(source, "utf8")
    .digest("hex")
    .toUpperCase();
}

export function buildVerifactuQrUrl(input: {
  issuerTaxId: string;
  invoiceCode: string;
  issueDate: string;
  total: number;
  environment: "test" | "production";
}) {
  const host =
    input.environment === "test"
      ? "https://prewww2.aeat.es"
      : "https://www2.agenciatributaria.gob.es";
  const params = new URLSearchParams({
    nif: input.issuerTaxId,
    numserie: input.invoiceCode,
    fecha: isoDateToAeatDate(input.issueDate),
    importe: input.total.toFixed(2),
  });
  return `${host}/wlpl/TIKE-CONT/ValidarQR?${params}`;
}

function calculatePaidTotal(
  total: number,
  vatRate: number,
): { subtotal: number; tax: number } {
  if (vatRate <= 0) return { subtotal: roundMoney(total), tax: 0 };
  const subtotal = roundMoney(total / (1 + vatRate / 100));
  return { subtotal, tax: roundMoney(total - subtotal) };
}

function createServiceClient(env: InvoicingEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

type AllocatedNumber = {
  invoice_number: number;
  previous_verifactu_hash: string | null;
  previous_invoice_code: string | null;
  previous_issue_date: string | null;
};

async function allocateInvoiceNumber(
  supabase: ReturnType<typeof createServiceClient>,
  series: string,
  year: number,
) {
  const { data, error } = await supabase
    .schema("private")
    .rpc("allocate_billing_invoice_number", {
      target_series: series,
      target_year: year,
    });
  if (error || !Array.isArray(data) || !data[0]) {
    throw new Error(
      `invoice_number_allocation_failed:${error?.message ?? "empty"}`,
    );
  }
  const row = data[0] as {
    invoice_number: number | string;
    previous_verifactu_hash: string | null;
    previous_invoice_code: string | null;
    previous_issue_date: string | null;
  };
  return {
    invoice_number: Number(row.invoice_number),
    previous_verifactu_hash: row.previous_verifactu_hash ?? null,
    previous_invoice_code: row.previous_invoice_code ?? null,
    previous_issue_date: row.previous_issue_date ?? null,
  } satisfies AllocatedNumber;
}

export async function getPlatformBillingSettings(env: InvoicingEnv) {
  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .schema("private")
    .from("platform_billing_settings")
    .select("*")
    .eq("singleton_id", true)
    .maybeSingle();
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "billing_settings_load_failed",
      detail: error.message,
    };
  }
  return { ok: true as const, data: data as PlatformBillingSettings | null };
}

export async function upsertPlatformBillingSettings(
  env: InvoicingEnv,
  context: AuthContext,
  input: Partial<PlatformBillingSettings>,
) {
  if (context.profile.platform_role !== "platform_admin") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
    };
  }
  const required = [
    "legal_name",
    "tax_id",
    "address_line1",
    "postal_code",
    "city",
  ] as const;
  if (required.some((key) => !text(input[key]))) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "billing_issuer_data_required",
    };
  }
  if (input.tax_id && !/^[A-Z0-9-]{5,40}$/i.test(input.tax_id)) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "billing_tax_id_invalid",
    };
  }
  const vatRate = number(input.default_vat_rate);
  if (vatRate === null || vatRate < 0 || vatRate > 100) {
    return {
      ok: false as const,
      statusCode: 400,
      error: "billing_vat_rate_invalid",
    };
  }
  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .schema("private")
    .from("platform_billing_settings")
    .upsert({
      singleton_id: true,
      ...input,
      legal_name: text(input.legal_name),
      tax_id: text(input.tax_id)?.toUpperCase(),
      address_line1: text(input.address_line1),
      postal_code: text(input.postal_code),
      city: text(input.city),
      default_vat_rate: vatRate,
      updated_by: context.user.id,
    })
    .select("*")
    .single();
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "billing_settings_save_failed",
      detail: error.message,
    };
  }
  return { ok: true as const, data: data as PlatformBillingSettings };
}

function invoiceStatusForCustomer(name: string | null, email: string | null) {
  return name && email ? "issued" : "needs_customer_data";
}

export function stripeInvoiceCustomer(rawPayment: JsonRecord) {
  const user = asRecord(rawPayment.user);
  const address =
    asRecord(rawPayment.customer_address) ??
    asRecord(rawPayment.billing_address) ??
    asRecord(rawPayment.shipping_address);
  const parent = asRecord(rawPayment.parent);
  const subscriptionDetails = asRecord(parent?.subscription_details);
  const metadata = {
    ...(asRecord(subscriptionDetails?.metadata) ?? {}),
    ...(asRecord(rawPayment.metadata) ?? {}),
  };
  const customerTaxIds = Array.isArray(rawPayment.customer_tax_ids)
    ? rawPayment.customer_tax_ids
    : [];
  const firstTaxId = customerTaxIds
    .map(asRecord)
    .find((taxId) => text(taxId?.value));
  return {
    name:
      text(rawPayment.customer_name) ?? text(user?.name) ?? text(address?.name),
    email:
      (text(rawPayment.customer_email) ?? text(user?.email))?.toLowerCase() ??
      null,
    taxId:
      (
        text(firstTaxId?.value) ?? text(metadata.customer_tax_id)
      )?.toUpperCase() ?? null,
    address: address ?? {},
  };
}

export function stripeInvoiceLine(
  rawPayment: JsonRecord,
  paidTotal: number,
  subtotal: number,
  tax: number,
  vatRate: number,
): InvoiceLineInput {
  const plan = asRecord(rawPayment.plan);
  const product = asRecord(rawPayment.product);
  const lines = asRecord(rawPayment.lines);
  const firstLine = Array.isArray(lines?.data) ? asRecord(lines.data[0]) : null;
  const pricing = asRecord(firstLine?.pricing);
  const priceDetails = asRecord(pricing?.price_details);
  const price =
    asRecord(priceDetails?.price) ?? asRecord(firstLine?.price) ?? null;
  const stripeProduct = asRecord(price?.product);
  const label =
    text(price?.nickname) ??
    text(stripeProduct?.name) ??
    text(firstLine?.description) ??
    text(plan?.title) ??
    text(product?.title) ??
    "Suscripción EcomScaling";
  return {
    description: label,
    quantity: 1,
    unit_price: roundMoney(paidTotal),
    vat_rate: vatRate,
    base_amount: subtotal,
    tax_amount: tax,
    total_amount: roundMoney(paidTotal),
  };
}

function buildInvoiceXml(input: {
  settings: PlatformBillingSettings;
  invoice: {
    invoice_code: string;
    issue_date: string;
    operation_date: string;
    invoice_type: string;
    customer_name: string | null;
    customer_tax_id: string | null;
    operation_description: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    previous_hash: string | null;
    previous_invoice_code: string | null;
    previous_issue_date: string | null;
    rectification_type?: "I" | "S";
    rectified_invoice_code?: string | null;
    rectified_invoice_date?: string | null;
    generated_at: string;
  };
  line: InvoiceLineInput;
  hash: string;
}) {
  const s = input.settings;
  const i = input.invoice;
  const customer = i.customer_name
    ? `<sum1:Destinatarios><sum1:IDDestinatario><sum1:NombreRazon>${xml(i.customer_name)}</sum1:NombreRazon>${i.customer_tax_id ? `<sum1:NIF>${xml(i.customer_tax_id)}</sum1:NIF>` : ""}</sum1:IDDestinatario></sum1:Destinatarios>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sum="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd" xmlns:sum1="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd">
  <soapenv:Header/>
  <soapenv:Body>
    <sum:RegFactuSistemaFacturacion>
      <sum:Cabecera><sum1:ObligadoEmision><sum1:NombreRazon>${xml(s.legal_name)}</sum1:NombreRazon><sum1:NIF>${xml(s.tax_id)}</sum1:NIF></sum1:ObligadoEmision></sum:Cabecera>
      <sum:RegistroFactura><sum1:RegistroAlta>
        <sum1:IDVersion>1.0</sum1:IDVersion>
        <sum1:IDFactura><sum1:IDEmisorFactura>${xml(s.tax_id)}</sum1:IDEmisorFactura><sum1:NumSerieFactura>${xml(i.invoice_code)}</sum1:NumSerieFactura><sum1:FechaExpedicionFactura>${xml(isoDateToAeatDate(i.issue_date))}</sum1:FechaExpedicionFactura></sum1:IDFactura>
        <sum1:NombreRazonEmisor>${xml(s.legal_name)}</sum1:NombreRazonEmisor>
        <sum1:TipoFactura>${xml(i.invoice_type)}</sum1:TipoFactura>
        ${i.rectification_type ? `<sum1:TipoRectificativa>${xml(i.rectification_type)}</sum1:TipoRectificativa>` : ""}
        ${i.rectified_invoice_code && i.rectified_invoice_date ? `<sum1:FacturasRectificadas><sum1:IDFacturaRectificada><sum1:IDEmisorFactura>${xml(s.tax_id)}</sum1:IDEmisorFactura><sum1:NumSerieFactura>${xml(i.rectified_invoice_code)}</sum1:NumSerieFactura><sum1:FechaExpedicionFactura>${xml(isoDateToAeatDate(i.rectified_invoice_date))}</sum1:FechaExpedicionFactura></sum1:IDFacturaRectificada></sum1:FacturasRectificadas>` : ""}
        <sum1:DescripcionOperacion>${xml(i.operation_description)}</sum1:DescripcionOperacion>
        ${i.operation_date !== i.issue_date ? `<sum1:FechaOperacion>${xml(isoDateToAeatDate(i.operation_date))}</sum1:FechaOperacion>` : ""}
        ${customer}
        <sum1:Desglose><sum1:DetalleDesglose><sum1:ClaveRegimen>${xml(s.vat_regime_code)}</sum1:ClaveRegimen><sum1:CalificacionOperacion>S1</sum1:CalificacionOperacion><sum1:TipoImpositivo>${xml(input.line.vat_rate)}</sum1:TipoImpositivo><sum1:BaseImponibleOimporteNoSujeto>${xml(input.line.base_amount)}</sum1:BaseImponibleOimporteNoSujeto><sum1:CuotaRepercutida>${xml(input.line.tax_amount)}</sum1:CuotaRepercutida></sum1:DetalleDesglose></sum1:Desglose>
        <sum1:CuotaTotal>${xml(i.tax_amount)}</sum1:CuotaTotal><sum1:ImporteTotal>${xml(i.total)}</sum1:ImporteTotal>
        <sum1:Encadenamiento>${i.previous_hash && i.previous_invoice_code && i.previous_issue_date ? `<sum1:RegistroAnterior><sum1:IDEmisorFactura>${xml(s.tax_id)}</sum1:IDEmisorFactura><sum1:NumSerieFactura>${xml(i.previous_invoice_code)}</sum1:NumSerieFactura><sum1:FechaExpedicionFactura>${xml(isoDateToAeatDate(i.previous_issue_date))}</sum1:FechaExpedicionFactura><sum1:Huella>${xml(i.previous_hash)}</sum1:Huella></sum1:RegistroAnterior>` : "<sum1:PrimerRegistro>S</sum1:PrimerRegistro>"}</sum1:Encadenamiento>
        <sum1:SistemaInformatico><sum1:NombreRazon>${xml(s.legal_name)}</sum1:NombreRazon><sum1:NIF>${xml(s.tax_id)}</sum1:NIF><sum1:NombreSistemaInformatico>${xml(s.system_name)}</sum1:NombreSistemaInformatico><sum1:IdSistemaInformatico>${xml(s.system_id)}</sum1:IdSistemaInformatico><sum1:Version>${xml(s.system_version)}</sum1:Version><sum1:NumeroInstalacion>${xml(s.installation_number)}</sum1:NumeroInstalacion><sum1:TipoUsoPosibleSoloVerifactu>N</sum1:TipoUsoPosibleSoloVerifactu><sum1:TipoUsoPosibleMultiOT>S</sum1:TipoUsoPosibleMultiOT><sum1:IndicadorMultiplesOT>S</sum1:IndicadorMultiplesOT></sum1:SistemaInformatico>
        <sum1:FechaHoraHusoGenRegistro>${xml(i.generated_at)}</sum1:FechaHoraHusoGenRegistro><sum1:TipoHuella>01</sum1:TipoHuella><sum1:Huella>${xml(input.hash)}</sum1:Huella>
      </sum1:RegistroAlta></sum:RegistroFactura>
    </sum:RegFactuSistemaFacturacion>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function postVerifactuXml(
  env: InvoicingEnv,
  xmlBody: string,
  environment: "test" | "production",
) {
  return new Promise<{ ok: boolean; statusCode: number; body: string }>(
    (resolve, reject) => {
      const host =
        environment === "test"
          ? "prewww1.aeat.es"
          : "www1.agenciatributaria.gob.es";
      const request = https.request(
        {
          hostname: host,
          path: "/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
          method: "POST",
          pfx: env.VERIFACTU_CERT_PFX_BASE64
            ? Buffer.from(env.VERIFACTU_CERT_PFX_BASE64, "base64")
            : undefined,
          passphrase: env.VERIFACTU_CERT_PASSWORD,
          headers: {
            "content-type": "text/xml; charset=utf-8",
            soapaction: '""',
            "content-length": Buffer.byteLength(xmlBody),
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          response.on("end", () =>
            resolve({
              ok: (response.statusCode ?? 500) < 300,
              statusCode: response.statusCode ?? 500,
              body: Buffer.concat(chunks).toString("utf8"),
            }),
          );
        },
      );
      request.on("error", reject);
      request.write(xmlBody);
      request.end();
    },
  );
}

function parseVerifactuResponse(response: {
  ok: boolean;
  statusCode: number;
  body: string;
}) {
  const state =
    response.body.match(/<(?:[^:>]+:)?EstadoRegistro>([^<]+)</)?.[1] ?? null;
  const code =
    response.body.match(/<(?:[^:>]+:)?CodigoErrorRegistro>([^<]+)</)?.[1] ??
    null;
  const description =
    response.body.match(
      /<(?:[^:>]+:)?DescripcionErrorRegistro>([^<]+)</,
    )?.[1] ?? null;
  const accepted = state === "Aceptado" || state === "AceptadoConErrores";
  return {
    accepted,
    status: accepted
      ? state === "AceptadoConErrores"
        ? "accepted_with_errors"
        : "accepted"
      : "rejected",
    response: {
      http_status: response.statusCode,
      estado: state,
      codigo_error: code,
      descripcion_error: description,
      raw: response.body.slice(0, 20000),
    },
  } as const;
}

type VerifactuSubmission = {
  status:
    | "not_configured"
    | "accepted"
    | "accepted_with_errors"
    | "rejected"
    | "error";
  hash: string | null;
  xml: string | null;
  qrUrl: string | null;
  response: {
    http_status: number;
    estado: string | null;
    codigo_error: string | null;
    descripcion_error: string | null;
    raw: string;
  } | null;
};

async function submitInvoiceToVerifactu(
  env: InvoicingEnv,
  settings: PlatformBillingSettings,
  invoice: {
    id: string;
    invoice_code: string;
    issue_date: string;
    operation_date: string;
    invoice_type: string;
    customer_name: string | null;
    customer_tax_id: string | null;
    operation_description: string;
    subtotal: number;
    tax_amount: number;
    total: number;
    rectification_type?: "I" | "S";
    rectified_invoice_code?: string | null;
    rectified_invoice_date?: string | null;
  },
  line: InvoiceLineInput,
  previousHash: string | null,
  previousInvoiceCode: string | null = null,
  previousIssueDate: string | null = null,
): Promise<VerifactuSubmission> {
  if (
    !settings.verifactu_enabled ||
    !env.VERIFACTU_CERT_PFX_BASE64 ||
    !env.VERIFACTU_CERT_PASSWORD
  ) {
    return {
      status: "not_configured" as const,
      hash: null,
      xml: null,
      qrUrl: null,
      response: null,
    };
  }
  const environment =
    env.VERIFACTU_ENVIRONMENT ?? settings.verifactu_environment;
  const generatedAt = isoWithMadridOffset();
  const hash = buildVerifactuHash({
    issuerTaxId: settings.tax_id,
    invoiceCode: invoice.invoice_code,
    issueDate: isoDateToAeatDate(invoice.issue_date),
    invoiceType: invoice.invoice_type,
    taxAmount: invoice.tax_amount,
    total: invoice.total,
    previousHash,
    generatedAt,
  });
  const qrUrl = buildVerifactuQrUrl({
    issuerTaxId: settings.tax_id,
    invoiceCode: invoice.invoice_code,
    issueDate: invoice.issue_date,
    total: invoice.total,
    environment,
  });
  const xmlBody = buildInvoiceXml({
    settings,
    invoice: {
      ...invoice,
      previous_hash: previousHash,
      previous_invoice_code: previousInvoiceCode,
      previous_issue_date: previousIssueDate,
      generated_at: generatedAt,
    },
    line,
    hash,
  });
  const response = await postVerifactuXml(env, xmlBody, environment);
  const parsed = parseVerifactuResponse(response);
  return {
    status: parsed.status,
    hash,
    xml: xmlBody,
    qrUrl,
    response: parsed.response,
  } as const;
}

export async function createInvoiceForStripePayment(
  env: InvoicingEnv,
  rawPayment: JsonRecord,
  eventId: string,
) {
  const normalized = normalizeStripeInvoice(rawPayment);
  if (!(normalized.substatus === "succeeded" || normalized.status === "paid")) {
    return {
      ok: true as const,
      skipped: true as const,
      reason: "payment_not_successful",
    };
  }
  if (!normalized.id || normalized.gross_amount === null) {
    return { ok: false as const, error: "stripe_payment_missing_amount" };
  }
  const settingsResult = await getPlatformBillingSettings(env);
  if (!settingsResult.ok) return settingsResult;
  if (!settingsResult.data) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "billing_settings_not_configured",
    };
  }
  const settings = settingsResult.data;
  const supabase = createServiceClient(env);
  const { data: existing, error: existingError } = await supabase
    .schema("private")
    .from("billing_invoices")
    .select("id, invoice_code")
    .eq("external_payment_id", normalized.id)
    .maybeSingle();
  if (existingError)
    return {
      ok: false as const,
      error: "invoice_lookup_failed",
      detail: existingError.message,
    };
  if (existing) {
    const email = await sendInvoiceEmailForInvoice(env, existing.id);
    return {
      ok: true as const,
      duplicate: true as const,
      invoice: existing,
      email,
    };
  }

  const customer = stripeInvoiceCustomer(rawPayment);
  const paidTotal = roundMoney(normalized.gross_amount);
  const vat = calculatePaidTotal(paidTotal, settings.default_vat_rate);
  const line = stripeInvoiceLine(
    rawPayment,
    paidTotal,
    vat.subtotal,
    vat.tax,
    settings.default_vat_rate,
  );
  const issuedAt =
    normalized.paid_at ?? normalized.created_at ?? new Date().toISOString();
  const issuedDate = issuedAt.slice(0, 10);
  const year = Number(issuedDate.slice(0, 4));
  let allocation: AllocatedNumber;
  try {
    allocation = await allocateInvoiceNumber(
      supabase,
      settings.invoice_series,
      year,
    );
  } catch (error) {
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "invoice_number_allocation_failed",
    };
  }
  const invoiceCode = `${settings.invoice_series}${year}-${String(allocation.invoice_number).padStart(5, "0")}`;
  const invoiceStatus = invoiceStatusForCustomer(customer.name, customer.email);
  const baseInvoice = {
    invoice_series: settings.invoice_series,
    invoice_year: year,
    invoice_number: allocation.invoice_number,
    invoice_code: invoiceCode,
    invoice_type: "F1",
    status: invoiceStatus,
    issue_date: issuedDate,
    operation_date: issuedDate,
    issuer_name: settings.legal_name,
    issuer_tax_id: settings.tax_id,
    issuer_address: {
      address_line1: settings.address_line1,
      address_line2: settings.address_line2,
      postal_code: settings.postal_code,
      city: settings.city,
      region: settings.region,
      country_code: settings.country_code,
    },
    customer_name: customer.name,
    customer_tax_id: customer.taxId,
    customer_email: customer.email,
    customer_address: customer.address,
    currency_code: normalized.currency ?? "EUR",
    subtotal: vat.subtotal,
    tax_amount: vat.tax,
    total: paidTotal,
    tax_regime_code: settings.vat_regime_code,
    operation_description: "Suscripción de software EcomScaling",
    payment_method: "stripe",
    external_payment_id: normalized.id,
    external_subscription_id: normalized.subscription_id,
    external_event_id: eventId,
    metadata: { stripe: rawPayment },
  };
  const verifactu = await submitInvoiceToVerifactu(
    env,
    settings,
    { ...baseInvoice, id: "pending" },
    line,
    allocation.previous_verifactu_hash,
    allocation.previous_invoice_code,
    allocation.previous_issue_date,
  );
  const { data: invoice, error: insertError } = await supabase
    .schema("private")
    .from("billing_invoices")
    .insert({
      ...baseInvoice,
      verifactu_status: verifactu.status,
      verifactu_hash: verifactu.hash,
      verifactu_previous_hash: allocation.previous_verifactu_hash,
      verifactu_previous_invoice_code: allocation.previous_invoice_code,
      verifactu_previous_issue_date: allocation.previous_issue_date,
      verifactu_qr_url: verifactu.qrUrl,
      verifactu_xml: verifactu.xml,
      verifactu_response: verifactu.response,
      verifactu_submitted_at: verifactu.response
        ? new Date().toISOString()
        : null,
    })
    .select("id, invoice_code")
    .single();
  if (insertError || !invoice)
    return {
      ok: false as const,
      error: "invoice_insert_failed",
      detail: insertError?.message,
    };
  await supabase
    .schema("private")
    .from("billing_invoice_lines")
    .insert({ invoice_id: invoice.id, position: 1, ...line });
  if (verifactu.hash) {
    await supabase.schema("private").rpc("set_billing_verifactu_hash", {
      target_series: settings.invoice_series,
      target_year: year,
      target_hash: verifactu.hash,
      target_invoice_code: invoiceCode,
      target_issue_date: issuedDate,
    });
  }
  const email = await sendInvoiceEmailForInvoice(env, invoice.id);
  return { ok: true as const, invoice, email };
}

type InvoiceEmailDeliveryResult =
  | { ok: true; sent: true; message_id: string | null }
  | {
      ok: true;
      sent: false;
      reason: string;
      skipped?: boolean;
    }
  | { ok: false; statusCode: number; error: string; detail?: string };

/**
 * Envía una factura ya persistida. Se llama desde `invoice.paid` y también
 * desde el botón de reintento del panel: el estado en la propia factura evita
 * reenviar dos veces cuando Stripe repite el evento.
 */
export async function sendInvoiceEmailForInvoice(
  env: InvoicingEnv,
  invoiceId: string,
): Promise<InvoiceEmailDeliveryResult> {
  const supabase = createServiceClient(env);
  const [{ data: invoice, error }, { data: lines, error: linesError }] =
    await Promise.all([
      supabase
        .schema("private")
        .from("billing_invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle(),
      supabase
        .schema("private")
        .from("billing_invoice_lines")
        .select(
          "description, quantity, unit_price, vat_rate, base_amount, tax_amount, total_amount",
        )
        .eq("invoice_id", invoiceId)
        .order("position"),
  ]);
  if (error || linesError || !invoice) {
    if (error?.message) {
      return {
        ok: false,
        statusCode: 404,
        error: "invoice_email_data_not_found",
        detail: error.message,
      };
    }
    if (linesError?.message) {
      return {
        ok: false,
        statusCode: 404,
        error: "invoice_email_data_not_found",
        detail: linesError.message,
      };
    }
    return {
      ok: false,
      statusCode: 404,
      error: "invoice_email_data_not_found",
    };
  }
  if (invoice.invoice_email_status === "sent") {
    return { ok: true, sent: false, skipped: true, reason: "already_sent" };
  }
  const recipient =
    typeof invoice.customer_email === "string"
      ? invoice.customer_email.trim().toLowerCase()
      : "";
  if (!recipient) {
    await supabase
      .schema("private")
      .from("billing_invoices")
      .update({
        invoice_email_status: "not_sent",
        invoice_email_error: "customer_email_missing",
      })
      .eq("id", invoiceId);
    return { ok: true, sent: false, reason: "customer_email_missing" };
  }

  // La actualizacion condicional hace de claim sencillo: dos reintentos
  // simultaneos no deben entregar dos facturas al mismo destinatario.
  const attempts = Number(invoice.invoice_email_attempts ?? 0) + 1;
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .schema("private")
    .from("billing_invoices")
    .update({
      invoice_email_status: "sending",
      invoice_email_attempts: attempts,
      invoice_email_last_attempt_at: now,
      invoice_email_error: null,
    })
    .eq("id", invoiceId)
    .in("invoice_email_status", ["pending", "failed", "not_sent"])
    .select("id")
    .maybeSingle();
  if (claimError) {
    return {
      ok: false,
      statusCode: 500,
      error: "invoice_email_claim_failed",
      detail: claimError.message,
    };
  }
  if (!claimed) {
    return { ok: true, sent: false, skipped: true, reason: "send_in_progress" };
  }

  const data: InvoiceEmailData = {
    invoice: {
      invoice_code: invoice.invoice_code,
      issue_date: invoice.issue_date,
      issuer_name: invoice.issuer_name,
      issuer_tax_id: invoice.issuer_tax_id,
      issuer_address: invoice.issuer_address,
      customer_name: invoice.customer_name,
      customer_tax_id: invoice.customer_tax_id,
      customer_email: recipient,
      currency_code: invoice.currency_code,
      subtotal: Number(invoice.subtotal),
      tax_amount: Number(invoice.tax_amount),
      total: Number(invoice.total),
      operation_description: invoice.operation_description,
      verifactu_status: invoice.verifactu_status,
      verifactu_qr_url: invoice.verifactu_qr_url,
    },
    lines: (lines ?? []) as InvoiceEmailData["lines"],
  };
  const result = await sendInvoiceMail(env, data);
  if (result.sent) {
    const { error: sentError } = await supabase
      .schema("private")
      .from("billing_invoices")
      .update({
        invoice_email_status: "sent",
        invoice_email_sent_at: new Date().toISOString(),
        invoice_email_message_id: result.messageId,
        invoice_email_error: null,
      })
      .eq("id", invoiceId);
    if (sentError) {
      return {
        ok: false,
        statusCode: 500,
        error: "invoice_email_status_update_failed",
        detail: sentError.message,
      };
    }
    return { ok: true, sent: true, message_id: result.messageId };
  }

  await supabase
    .schema("private")
    .from("billing_invoices")
    .update({
      invoice_email_status: "failed",
      invoice_email_error: result.reason.slice(0, 500),
    })
    .eq("id", invoiceId);
  return { ok: true, sent: false, reason: result.reason };
}

export async function retryInvoiceEmailForStripePayment(
  env: InvoicingEnv,
  externalPaymentId: string,
) {
  if (!externalPaymentId) return { ok: true as const, skipped: true as const };
  const supabase = createServiceClient(env);
  const { data: invoice, error } = await supabase
    .schema("private")
    .from("billing_invoices")
    .select("id")
    .eq("external_payment_id", externalPaymentId)
    .maybeSingle();
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "invoice_email_lookup_failed",
      detail: error.message,
    };
  if (!invoice) return { ok: true as const, skipped: true as const };
  return sendInvoiceEmailForInvoice(env, invoice.id);
}

/**
 * Un reembolso de Stripe es una rectificación por diferencias: la rectificativa
 * lleva el importe devuelto con signo contrario y apunta a la factura original.
 * Si Stripe todavía no permite resolver el pago original, el evento no se pierde
 * y queda pendiente en `billing_invoice_events` para revisión.
 */
function latestStripeRefund(rawCharge: JsonRecord) {
  const refunds = asRecord(rawCharge.refunds);
  const refundList = Array.isArray(refunds?.data)
    ? refunds.data.map(asRecord).filter((refund) => refund !== null)
    : [];
  return (
    refundList.sort(
      (left, right) =>
        (number(right.created) ?? 0) - (number(left.created) ?? 0),
    )[0] ?? null
  );
}

export function stripeRefundGrossAmount(rawCharge: JsonRecord) {
  const latestRefund = latestStripeRefund(rawCharge);
  const amountMinor =
    number(latestRefund?.amount) ?? number(rawCharge.amount_refunded);
  return amountMinor === null ? null : roundMoney(amountMinor / 100);
}

export async function createRectifyingInvoiceForStripeRefund(
  env: InvoicingEnv,
  rawRefund: JsonRecord,
  eventId: string,
) {
  // El evento es `charge.refunded`, asi que `rawRefund` es un CARGO: trae
  // `invoice` (la factura original) y la lista de devoluciones. Se usa el id
  // de la ultima devolucion como clave de idempotencia porque un cargo puede
  // devolverse en varios trozos, y cada trozo es una rectificativa distinta.
  const latestRefund = latestStripeRefund(rawRefund);
  const refundId = text(latestRefund?.id) ?? text(rawRefund.id);
  let paymentId =
    text(asRecord(rawRefund.invoice)?.id) ?? text(rawRefund.invoice);
  const refundStatus = text(latestRefund?.status);
  if (refundStatus && refundStatus !== "succeeded") {
    return {
      ok: true as const,
      skipped: true as const,
      reason: "refund_not_successful",
    };
  }
  if (!paymentId) {
    const paymentIntent =
      text(asRecord(rawRefund.payment_intent)?.id) ??
      text(rawRefund.payment_intent);
    if (paymentIntent && env.STRIPE_SECRET_KEY) {
      try {
        const invoicePayments = await createStripeClient(
          env,
        ).invoicePayments.list({
          limit: 10,
          payment: { type: "payment_intent", payment_intent: paymentIntent },
        });
        const invoice = invoicePayments.data[0]?.invoice;
        paymentId = text(asRecord(invoice)?.id) ?? text(invoice) ?? paymentId;
      } catch (error) {
        return {
          ok: false as const,
          statusCode: 503,
          error: "stripe_refund_reference_lookup_failed",
          detail: stripeErrorDetail(error),
        };
      }
    }
  }
  if (!refundId || !paymentId) {
    return { ok: false as const, error: "stripe_refund_missing_reference" };
  }
  const settingsResult = await getPlatformBillingSettings(env);
  if (!settingsResult.ok) return settingsResult;
  if (!settingsResult.data) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "billing_settings_not_configured",
    };
  }
  const supabase = createServiceClient(env);
  const { data: existingEvent } = await supabase
    .schema("private")
    .from("billing_invoice_events")
    .select("id, invoice_id")
    .eq("provider", "stripe")
    .eq("external_event_id", refundId)
    .maybeSingle();
  if (existingEvent)
    return {
      ok: true as const,
      duplicate: true as const,
      event: existingEvent,
    };

  const { data: original, error: originalError } = await supabase
    .schema("private")
    .from("billing_invoices")
    .select("*")
    .eq("external_payment_id", paymentId)
    .maybeSingle();
  const { data: event, error: eventError } = await supabase
    .schema("private")
    .from("billing_invoice_events")
    .insert({
      provider: "stripe",
      external_event_id: refundId,
      event_type: "charge.refunded",
      status: "received",
      payload: rawRefund,
    })
    .select("id")
    .single();
  if (eventError) {
    if (eventError.code === "23505")
      return { ok: true as const, duplicate: true as const };
    return {
      ok: false as const,
      error: "refund_event_persist_failed",
      detail: eventError.message,
    };
  }
  if (originalError || !original) {
    await supabase
      .schema("private")
      .from("billing_invoice_events")
      .update({
        status: "failed",
        error_message: "original_invoice_not_found",
        processed_at: new Date().toISOString(),
      })
      .eq("id", event.id);
    return {
      ok: false as const,
      statusCode: 503,
      error: "original_invoice_not_found",
    };
  }
  const grossRefund =
    stripeRefundGrossAmount(rawRefund) ??
    roundMoney(Math.abs(Number(original.total)));
  if (!(grossRefund > 0)) {
    await supabase
      .schema("private")
      .from("billing_invoice_events")
      .update({
        status: "failed",
        error_message: "refund_amount_invalid",
        processed_at: new Date().toISOString(),
      })
      .eq("id", event.id);
    return { ok: false as const, error: "refund_amount_invalid" };
  }

  const settings = settingsResult.data;
  const vat = calculatePaidTotal(grossRefund, settings.default_vat_rate);
  const line: InvoiceLineInput = {
    description: `Rectificación de ${original.invoice_code}`,
    quantity: 1,
    unit_price: -grossRefund,
    vat_rate: settings.default_vat_rate,
    base_amount: -vat.subtotal,
    tax_amount: -vat.tax,
    total_amount: -grossRefund,
  };
  const issuedDate = new Date().toISOString().slice(0, 10);
  const year = Number(issuedDate.slice(0, 4));
  let allocation: AllocatedNumber;
  try {
    allocation = await allocateInvoiceNumber(
      supabase,
      settings.invoice_series,
      year,
    );
  } catch (error) {
    await supabase
      .schema("private")
      .from("billing_invoice_events")
      .update({
        status: "failed",
        error_message: "invoice_number_allocation_failed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", event.id);
    return {
      ok: false as const,
      error:
        error instanceof Error
          ? error.message
          : "invoice_number_allocation_failed",
    };
  }
  const invoiceCode = `${settings.invoice_series}${year}-${String(allocation.invoice_number).padStart(5, "0")}`;
  // El cliente de una rectificativa es, por definicion, el mismo que el de la
  // factura que rectifica: cogerlo del cargo abriria la puerta a emitir una R1
  // a nombre de otro si el comprador cambio sus datos entre medias.
  const customerName = original.customer_name;
  const customerEmail = original.customer_email;
  const baseInvoice = {
    invoice_series: settings.invoice_series,
    invoice_year: year,
    invoice_number: allocation.invoice_number,
    invoice_code: invoiceCode,
    invoice_type: "R1",
    status: invoiceStatusForCustomer(customerName, customerEmail),
    issue_date: issuedDate,
    operation_date: original.operation_date,
    issuer_name: settings.legal_name,
    issuer_tax_id: settings.tax_id,
    issuer_address: {
      address_line1: settings.address_line1,
      address_line2: settings.address_line2,
      postal_code: settings.postal_code,
      city: settings.city,
      region: settings.region,
      country_code: settings.country_code,
    },
    customer_name: customerName,
    customer_tax_id: original.customer_tax_id,
    customer_email: customerEmail,
    customer_address: original.customer_address,
    currency_code: original.currency_code,
    subtotal: -vat.subtotal,
    tax_amount: -vat.tax,
    total: -grossRefund,
    tax_regime_code: settings.vat_regime_code,
    operation_description:
      "Rectificación por reembolso de suscripción EcomScaling",
    payment_method: "stripe_refund",
    external_payment_id: null,
    external_subscription_id: original.external_subscription_id,
    external_event_id: eventId,
    rectifies_invoice_id: original.id,
    metadata: {
      stripe_refund_id: refundId,
      external_payment_id: paymentId,
      rectification_type: "I",
    },
  };
  let verifactu: Awaited<ReturnType<typeof submitInvoiceToVerifactu>>;
  try {
    verifactu = await submitInvoiceToVerifactu(
      env,
      settings,
      {
        ...baseInvoice,
        id: "pending",
        rectification_type: "I",
        rectified_invoice_code: original.invoice_code,
        rectified_invoice_date: original.issue_date,
      },
      line,
      allocation.previous_verifactu_hash,
      allocation.previous_invoice_code,
      allocation.previous_issue_date,
    );
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "verifactu_request_failed";
    verifactu = {
      status: "rejected",
      hash: null,
      xml: null,
      qrUrl: null,
      response: {
        http_status: 0,
        estado: null,
        codigo_error: "transport_error",
        descripcion_error: detail,
        raw: detail,
      },
    };
  }
  const { data: invoice, error: insertError } = await supabase
    .schema("private")
    .from("billing_invoices")
    .insert({
      ...baseInvoice,
      verifactu_status: verifactu.status,
      verifactu_hash: verifactu.hash,
      verifactu_previous_hash: allocation.previous_verifactu_hash,
      verifactu_previous_invoice_code: allocation.previous_invoice_code,
      verifactu_previous_issue_date: allocation.previous_issue_date,
      verifactu_qr_url: verifactu.qrUrl,
      verifactu_xml: verifactu.xml,
      verifactu_response: verifactu.response,
      verifactu_submitted_at: verifactu.response
        ? new Date().toISOString()
        : null,
    })
    .select("id, invoice_code")
    .single();
  if (insertError || !invoice) {
    await supabase
      .schema("private")
      .from("billing_invoice_events")
      .update({
        status: "failed",
        error_message: "rectifying_invoice_insert_failed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", event.id);
    return {
      ok: false as const,
      error: "rectifying_invoice_insert_failed",
      detail: insertError?.message,
    };
  }
  await supabase
    .schema("private")
    .from("billing_invoice_lines")
    .insert({ invoice_id: invoice.id, position: 1, ...line });
  if (verifactu.hash)
    await supabase.schema("private").rpc("set_billing_verifactu_hash", {
      target_series: settings.invoice_series,
      target_year: year,
      target_hash: verifactu.hash,
      target_invoice_code: invoiceCode,
      target_issue_date: issuedDate,
    });
  if (grossRefund >= Math.abs(Number(original.total)))
    await supabase
      .schema("private")
      .from("billing_invoices")
      .update({ status: "refunded" })
      .eq("id", original.id);
  await supabase
    .schema("private")
    .from("billing_invoice_events")
    .update({
      status: "processed",
      invoice_id: invoice.id,
      processed_at: new Date().toISOString(),
    })
    .eq("id", event.id);
  return { ok: true as const, invoice };
}

export async function listPlatformInvoices(
  env: InvoicingEnv,
  context: AuthContext,
) {
  if (context.profile.platform_role !== "platform_admin") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
    };
  }
  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .schema("private")
    .from("billing_invoices")
    .select(
      "id, invoice_series, invoice_year, invoice_number, invoice_code, invoice_type, status, issue_date, operation_date, customer_name, customer_tax_id, customer_email, currency_code, subtotal, tax_amount, total, operation_description, external_payment_id, verifactu_status, verifactu_qr_url, verifactu_submitted_at, invoice_email_status, invoice_email_attempts, invoice_email_sent_at, invoice_email_last_attempt_at, invoice_email_message_id, invoice_email_error, created_at",
    )
    .order("issue_date", { ascending: false })
    .order("invoice_number", { ascending: false })
    .limit(500);
  if (error)
    return {
      ok: false as const,
      statusCode: 500,
      error: "invoices_load_failed",
      detail: error.message,
    };
  return {
    ok: true as const,
    data: { invoices: (data ?? []) as BillingInvoice[] },
  };
}

export async function getPlatformInvoice(
  env: InvoicingEnv,
  context: AuthContext,
  invoiceId: string,
) {
  if (context.profile.platform_role !== "platform_admin") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
    };
  }
  const supabase = createServiceClient(env);
  const [{ data: invoice, error }, { data: lines, error: linesError }] =
    await Promise.all([
      supabase
        .schema("private")
        .from("billing_invoices")
        .select("*")
        .eq("id", invoiceId)
        .maybeSingle(),
      supabase
        .schema("private")
        .from("billing_invoice_lines")
        .select("*")
        .eq("invoice_id", invoiceId)
        .order("position"),
    ]);
  if (error || linesError || !invoice)
    return { ok: false as const, statusCode: 404, error: "invoice_not_found" };
  return { ok: true as const, data: { invoice, lines: lines ?? [] } };
}

export async function retryInvoiceVerifactu(
  env: InvoicingEnv,
  context: AuthContext,
  invoiceId: string,
) {
  if (context.profile.platform_role !== "platform_admin") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
    };
  }
  const settingsResult = await getPlatformBillingSettings(env);
  if (!settingsResult.ok) return settingsResult;
  if (!settingsResult.data)
    return {
      ok: false as const,
      statusCode: 503,
      error: "billing_settings_not_configured",
    };
  const supabase = createServiceClient(env);
  const { data: invoice, error } = await supabase
    .schema("private")
    .from("billing_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (error || !invoice)
    return { ok: false as const, statusCode: 404, error: "invoice_not_found" };
  const { data: line } = await supabase
    .schema("private")
    .from("billing_invoice_lines")
    .select("*")
    .eq("invoice_id", invoiceId)
    .eq("position", 1)
    .maybeSingle();
  if (!line)
    return {
      ok: false as const,
      statusCode: 409,
      error: "invoice_lines_missing",
    };
  const result = await submitInvoiceToVerifactu(
    env,
    settingsResult.data,
    invoice,
    line,
    invoice.verifactu_previous_hash,
    invoice.verifactu_previous_invoice_code,
    invoice.verifactu_previous_issue_date,
  );
  const { error: updateError } = await supabase
    .schema("private")
    .from("billing_invoices")
    .update({
      verifactu_status: result.status,
      verifactu_hash: result.hash,
      verifactu_qr_url: result.qrUrl,
      verifactu_xml: result.xml,
      verifactu_response: result.response,
      verifactu_submitted_at: result.response ? new Date().toISOString() : null,
    })
    .eq("id", invoiceId);
  if (updateError)
    return {
      ok: false as const,
      statusCode: 500,
      error: "invoice_verifactu_update_failed",
      detail: updateError.message,
    };
  if (result.hash)
    await supabase.schema("private").rpc("set_billing_verifactu_hash", {
      target_series: invoice.invoice_series,
      target_year: invoice.invoice_year,
      target_hash: result.hash,
      target_invoice_code: invoice.invoice_code,
      target_issue_date: invoice.issue_date,
    });
  return {
    ok: true as const,
    data: { verifactu_status: result.status, qr_url: result.qrUrl },
  };
}
