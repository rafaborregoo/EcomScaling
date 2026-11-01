"use client";
import { EmptyState, Checkbox, DatePicker, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown } from "@/components/ui";

import { useEffect, useState } from "react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { useCachedQuery } from "@/lib/use-cached-query";
import { apiFetch } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import {
  AsyncState,
  AreaChart,
  Badge,
  BarChart,
  Banner,
  Button,
  ErrorBlock,
  Field,
  EYEBROW,
  Input,
  Metric,
  Select,
  DataTable,
  type DataTableColumn,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui";

type Subscription = {
  id: string;
  plan_code: string;
  status: string;
  store_limit: number | null;
  member_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  external_subscription_id: string | null;
  subject_type: "user" | "organization";
  subject_name: string | null;
  user_id: string | null;
  organization_id: string | null;
};

type SubscriptionsPayload = { subscriptions: Subscription[] };

type ConsultantsPayload = {
  consultants: { id: string; full_name: string | null }[];
  organizations: { id: string; display_name: string }[];
};

type FinancialPayment = {
  id: string;
  status: string | null;
  substatus: string | null;
  currency: string | null;
  gross_amount: number | null;
  amount_after_fees: number | null;
  fee_amount: number | null;
  refunded_amount: number;
  net_amount: number | null;
  paid_at: string | null;
  created_at: string | null;
  billing_reason: string | null;
  plan_id: string | null;
  plan_name: string | null;
  plan_code: string | null;
  product_name: string | null;
  customer_name: string | null;
  customer_email: string | null;
  membership_id: string | null;
};

type FinancialPayload = {
  window_days: number;
  window_start: string;
  window_end: string;
  currency: string | null;
  truncated: boolean;
  totals: {
    gross_amount: number | null;
    fee_amount: number | null;
    refunded_amount: number | null;
    net_amount: number | null;
    successful_payments: number;
    failed_payments: number;
    pending_payments: number;
  };
  by_currency: Array<{
    currency: string;
    gross_amount: number;
    fee_amount: number | null;
    refunded_amount: number;
    net_amount: number | null;
    successful_payments: number;
  }>;
  subscriptions: {
    active: number;
    trial: number;
    paid: number;
    granted: number;
  };
  timeline: Array<{
    period: string;
    gross_amount: number;
    refunded_amount: number;
    net_amount: number | null;
    payments: number;
  }>;
  by_plan: Array<{
    id: string;
    name: string;
    currency: string | null;
    gross_amount: number;
    refunded_amount: number;
    net_amount: number | null;
    payments: number;
  }>;
  payments: FinancialPayment[];
};

type BillingSettings = {
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
  verifactu_enabled: boolean;
  verifactu_environment: "test" | "production";
};

type BillingInvoice = {
  id: string;
  invoice_code: string;
  invoice_type: string;
  status: string;
  issue_date: string;
  customer_name: string | null;
  customer_email: string | null;
  total: number;
  currency_code: string;
  verifactu_status: string;
  verifactu_qr_url: string | null;
  invoice_email_status: string;
  invoice_email_sent_at: string | null;
  invoice_email_error: string | null;
};

const VIGENTES = new Set(["trial", "active"]);

function tono(status: string) {
  if (VIGENTES.has(status)) return "success" as const;
  if (status === "paused" || status === "pending") return "warn" as const;
  return "neutral" as const;
}

function fecha(valor: string | null) {
  if (!valor) return "—";
  return new Date(valor).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dinero(valor: number | null, currency: string | null) {
  if (valor === null) return "—";
  if (!currency) return "Varias monedas";
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(valor);
}

function fechaHora(valor: string | null) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function estadoPago(payment: FinancialPayment) {
  if (payment.substatus === "succeeded" || payment.status === "paid") {
    return { label: "Cobrado", tone: "success" as const };
  }
  if (
    ["failed", "blocked", "uncollectible", "void", "canceled"].includes(
      payment.substatus ?? "",
    )
  ) {
    return { label: "Fallido", tone: "danger" as const };
  }
  return { label: "Pendiente", tone: "warn" as const };
}

function motivoCobro(value: string | null) {
  const labels: Record<string, string> = {
    subscription_create: "Alta",
    subscription_cycle: "Renovación",
    subscription_update: "Cambio de plan",
    one_time: "Pago único",
    manual: "Manual",
  };
  return value ? (labels[value] ?? value) : "—";
}

function estadoFactura(invoice: BillingInvoice) {
  if (["accepted", "accepted_with_errors"].includes(invoice.verifactu_status)) {
    return { label: "VERI*FACTU aceptada", tone: "success" as const };
  }
  if (invoice.verifactu_status === "not_configured") {
    return { label: "Pendiente de configurar", tone: "warn" as const };
  }
  if (["rejected", "error"].includes(invoice.verifactu_status)) {
    return { label: "Revisar envío", tone: "danger" as const };
  }
  return { label: invoice.verifactu_status, tone: "neutral" as const };
}

function estadoEmail(invoice: BillingInvoice) {
  if (invoice.invoice_email_status === "sent") {
    return { label: "Factura enviada", tone: "success" as const };
  }
  if (invoice.invoice_email_status === "not_sent") {
    return { label: "Sin email", tone: "warn" as const };
  }
  if (invoice.invoice_email_status === "failed") {
    return { label: "Email fallido", tone: "danger" as const };
  }
  if (invoice.invoice_email_status === "sending") {
    return { label: "Enviando email", tone: "warn" as const };
  }
  return { label: "Email pendiente", tone: "neutral" as const };
}

function FiscalInvoicingPanel() {
  const settingsQuery = useCachedQuery<BillingSettings>(
    "/v1/admin/billing-settings",
  );
  const invoicesQuery = useCachedQuery<{ invoices: BillingInvoice[] }>(
    "/v1/admin/invoices",
  );
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [email, setEmail] = useState("");
  const [series, setSeries] = useState("F");
  const [vatRate, setVatRate] = useState("21");
  const [enabled, setEnabled] = useState(false);
  const [environment, setEnvironment] = useState<"test" | "production">("test");
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const value = settingsQuery.data;
    if (!value) return;
    setLegalName(value.legal_name);
    setTaxId(value.tax_id);
    setAddress(value.address_line1);
    setPostalCode(value.postal_code);
    setCity(value.city);
    setRegion(value.region ?? "");
    setEmail(value.email ?? "");
    setSeries(value.invoice_series);
    setVatRate(String(value.default_vat_rate));
    setEnabled(value.verifactu_enabled);
    setEnvironment(value.verifactu_environment);
  }, [settingsQuery.data]);

  async function saveSettings() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch("/v1/admin/billing-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          legal_name: legalName.trim(),
          tax_id: taxId.trim().toUpperCase(),
          address_line1: address.trim(),
          postal_code: postalCode.trim(),
          city: city.trim(),
          region: region.trim() || null,
          email: email.trim() || null,
          invoice_series: series.trim().toUpperCase(),
          default_vat_rate: Number(vatRate),
          prices_include_vat: true,
          verifactu_enabled: enabled,
          verifactu_environment: environment,
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNotice("Configuración fiscal guardada.");
      settingsQuery.reload();
    } catch {
      setError("No se pudo guardar la configuración fiscal.");
    } finally {
      setBusy(false);
    }
  }

  async function retry(invoiceId: string) {
    setRetrying(invoiceId);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/admin/invoices/${invoiceId}/verifactu/retry`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNotice("Envío a VERI*FACTU reintentado.");
      invoicesQuery.reload();
    } catch {
      setError("No se pudo reintentar el envío.");
    } finally {
      setRetrying(null);
    }
  }

  async function retryEmail(invoiceId: string) {
    setRetrying(invoiceId);
    setError(null);
    try {
      const response = await apiFetch(
        `/v1/admin/invoices/${invoiceId}/email/retry`,
        { method: "POST" },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNotice("Email de factura reintentado.");
      invoicesQuery.reload();
    } catch {
      setError("No se pudo reintentar el email de factura.");
    } finally {
      setRetrying(null);
    }
  }

  const invoiceColumns: DataTableColumn<BillingInvoice>[] = [
    {
      key: "code",
      label: "Factura",
      render: (row) => <span className="font-medium">{row.invoice_code}</span>,
    },
    { key: "date", label: "Fecha", render: (row) => fecha(row.issue_date) },
    {
      key: "customer",
      label: "Cliente",
      render: (row) =>
        row.customer_name ?? row.customer_email ?? "Datos pendientes",
    },
    {
      key: "total",
      label: "Total",
      render: (row) => dinero(row.total, row.currency_code),
    },
    {
      key: "status",
      label: "Estado",
      render: (row) => (
        <Badge tone={estadoFactura(row).tone}>{estadoFactura(row).label}</Badge>
      ),
    },
    {
      key: "email",
      label: "Entrega",
      render: (row) => (
        <Badge tone={estadoEmail(row).tone}>{estadoEmail(row).label}</Badge>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) =>
        ["rejected", "error", "not_configured"].includes(
          row.verifactu_status,
        ) ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={retrying === row.id}
            onClick={() => void retry(row.id)}
          >
            {retrying === row.id ? "Enviando..." : "Reintentar"}
          </Button>
        ) : row.invoice_email_status !== "sent" ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={retrying === row.id}
            onClick={() => void retryEmail(row.id)}
          >
            {retrying === row.id ? "Enviando..." : "Reenviar factura"}
          </Button>
        ) : row.verifactu_qr_url ? (
          <a
            className="text-xs text-accent underline"
            href={row.verifactu_qr_url}
            target="_blank"
            rel="noreferrer"
          >
            QR
          </a>
        ) : null,
    },
  ];

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardKicker>Emisor fiscal</CardKicker>
          <CardTitle>Facturación propia y VERI*FACTU</CardTitle>
          <CardDescription>Stripe registra el cobro; esta configuración define la factura emitida por tu actividad como autónomo.</CardDescription>
        </CardHeader>
        <CardContent>
          {settingsQuery.error && !settingsQuery.data ? (
            <Banner tone="warn">
              Aún no hay configuración fiscal guardada. Completa los datos del
              emisor.
            </Banner>
          ) : null}
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre o razón social">
                <Input
                  value={legalName}
                  onChange={(event) => setLegalName(event.target.value)}
                  placeholder="Nombre completo"
                />
              </Field>
              <Field label="NIF">
                <Input
                  value={taxId}
                  onChange={(event) => setTaxId(event.target.value)}
                  placeholder="12345678A"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
              <Field label="Dirección">
                <Input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </Field>
              <Field label="Código postal">
                <Input
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                />
              </Field>
              <Field label="Ciudad">
                <Input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-4">
              <Field label="Provincia">
                <Input
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                />
              </Field>
              <Field label="Email fiscal">
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field label="Serie">
                <Input
                  value={series}
                  onChange={(event) => setSeries(event.target.value)}
                />
              </Field>
              <Field label="IVA por defecto (%)">
                <Input
                  inputMode="decimal"
                  value={vatRate}
                  onChange={(event) => setVatRate(event.target.value)}
                />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Checkbox checked={enabled} onCheckedChange={setEnabled}>
                Activar envío VERI*FACTU
              </Checkbox>
              <Field label="Entorno">
                <Select
                  value={environment}
                  onChange={(value) =>
                    setEnvironment(value as "test" | "production")
                  }
                  options={[
                    { value: "test", label: "Pruebas AEAT" },
                    { value: "production", label: "Producción" },
                  ]}
                />
              </Field>
              <Button disabled={busy} onClick={() => void saveSettings()}>
                {busy ? "Guardando..." : "Guardar configuración"}
              </Button>
            </div>
            <Banner tone="warn">
              El certificado PFX y su contraseña se configuran como secretos del
              servidor; no se guardan en esta pantalla ni en Supabase.
            </Banner>
            {notice ? <Banner tone="success">{notice}</Banner> : null}
            {error ? <ErrorBlock>{error}</ErrorBlock> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardKicker>Registro fiscal</CardKicker>
          <CardTitle>Facturas emitidas</CardTitle>
          <CardDescription>Cada pago confirmado de Stripe queda enlazado a su factura y a su estado de envío.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesQuery.error && !invoicesQuery.data ? (
            <ErrorBlock>{invoicesQuery.error}</ErrorBlock>
          ) : null}
          <DataTable
            ariaLabel="Facturas emitidas"
            columns={invoiceColumns}
            rows={invoicesQuery.data?.invoices ?? []}
            emptyLabel="Todavía no hay facturas emitidas."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function FinancialDashboard() {
  const [days, setDays] = useState(30);
  const { data, error, isLoading, isValidating, reload } =
    useCachedQuery<FinancialPayload>(
      `/v1/admin/financial-dashboard?days=${days}`,
    );

  if (isLoading) {
    return (
      <AsyncState
        status="loading"
        loadingLabel="Cargando datos financieros de Stripe..."
      />
    );
  }
  if (error && !data) {
    return (
      <Card>
        <CardHeader>
          <CardKicker>Ledger Stripe</CardKicker>
          <CardTitle>Dashboard financiero</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorBlock>{error}</ErrorBlock>
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const currency = data.currency;
  const hasMultipleCurrencies = !currency && data.by_currency.length > 1;
  const chartData = currency
    ? data.timeline.map((point) => ({
        period: new Date(`${point.period}T12:00:00Z`).toLocaleDateString(
          "es-ES",
          {
            day: "2-digit",
            month: "short",
          },
        ),
        gross: point.gross_amount,
        refunds: point.refunded_amount,
      }))
    : [];
  const planChartData = currency
    ? data.by_plan.slice(0, 6).map((plan) => ({
        name: plan.name,
        gross: plan.gross_amount,
      }))
    : [];

  const paymentColumns: DataTableColumn<FinancialPayment>[] = [
    {
      key: "paid_at",
      label: "Fecha",
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-muted">
          {fechaHora(row.paid_at ?? row.created_at)}
        </span>
      ),
    },
    {
      key: "customer",
      label: "Cliente",
      render: (row) => (
        <div>
          <div>{row.customer_name ?? row.customer_email ?? "Sin nombre"}</div>
          {row.customer_name && row.customer_email ? (
            <span className="text-xs text-muted">{row.customer_email}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "plan",
      label: "Plan",
      render: (row) =>
        row.plan_name ?? row.plan_code ?? row.product_name ?? "—",
    },
    {
      key: "reason",
      label: "Tipo",
      render: (row) => motivoCobro(row.billing_reason),
    },
    {
      key: "status",
      label: "Estado",
      render: (row) => {
        const status = estadoPago(row);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    {
      key: "amount",
      label: "Importe",
      render: (row) => (
        <div className="text-right">
          <div>{dinero(row.gross_amount, row.currency)}</div>
          {row.refunded_amount > 0 ? (
            <span className="text-xs text-danger">
              -{dinero(row.refunded_amount, row.currency)} reembolsado
            </span>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardKicker>Ledger Stripe</CardKicker>
          <CardTitle>Dashboard financiero</CardTitle>
          <CardDescription>{`Cobros reales de Stripe · últimos ${data.window_days} días${isValidating ? " · actualizando" : ""}`}</CardDescription>
          <CardAction><div className="flex items-center gap-2">
            <Select
              aria-label="Periodo financiero"
              value={String(days)}
              onChange={(value) => setDays(Number(value))}
              options={[
                { value: "7", label: "7 días" },
                { value: "30", label: "30 días" },
                { value: "90", label: "90 días" },
                { value: "365", label: "1 año" },
              ]}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={reload}
              disabled={isValidating}
            >
              Actualizar
            </Button>
          </div></CardAction>
        </CardHeader>
        <CardContent>
          {data.truncated ? (
            <Banner tone="warn">
              El periodo tiene más movimientos de los que se han cargado. Reduce
              el periodo para ver el detalle completo.
            </Banner>
          ) : null}
          {hasMultipleCurrencies ? (
            <Banner tone="warn">
              Stripe ha devuelto varias monedas. Se muestran los totales por
              moneda y no se convierten entre sí.
            </Banner>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              card
              label="Cobrado bruto"
              value={dinero(data.totals.gross_amount, currency)}
              hint={`${data.totals.successful_payments} pagos confirmados`}
            />
            <Metric
              card
              label="Comisiones Stripe"
              value={dinero(data.totals.fee_amount, currency)}
              hint="Según la transacción de saldo de Stripe"
              tone="warn"
            />
            <Metric
              card
              label="Reembolsos"
              value={dinero(data.totals.refunded_amount, currency)}
              hint={`${data.payments.filter((payment) => payment.refunded_amount > 0).length} pagos afectados`}
              tone="danger"
            />
            <Metric
              card
              label="Neto recibido"
              value={dinero(data.totals.net_amount, currency)}
              hint="Después de comisiones y reembolsos"
              tone="success"
            />
          </div>
          {data.totals.failed_payments || data.totals.pending_payments ? (
            <p className="mt-4 text-sm text-muted">
              {data.totals.failed_payments
                ? `${data.totals.failed_payments} pagos fallidos`
                : null}
              {data.totals.failed_payments && data.totals.pending_payments
                ? " · "
                : null}
              {data.totals.pending_payments
                ? `${data.totals.pending_payments} pagos pendientes`
                : null}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {data.by_currency.length > 1 ? (
        <Card>
          <CardHeader>
            <CardKicker>Conversión no aplicada</CardKicker>
            <CardTitle>Totales por moneda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.by_currency.map((row) => (
                <Card size="sm" key={row.currency} className="border-accent/30 bg-accent-soft/30"><CardContent>
                  <p className="text-sm font-semibold text-foreground">
                    {row.currency}
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {dinero(row.net_amount, row.currency)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {row.successful_payments} pagos · bruto{" "}
                    {dinero(row.gross_amount, row.currency)}
                  </p>
                </CardContent></Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
        <Card>
          <CardHeader>
            <CardKicker>Evolución</CardKicker>
            <CardTitle>Bruto y reembolsos</CardTitle>
            <CardDescription>Día de cobro según el ledger de Stripe.</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length ? (
              <AreaChart
                data={chartData}
                xKey="period"
                series={[
                  { key: "gross", label: "Bruto" },
                  {
                    key: "refunds",
                    label: "Reembolsos",
                    color: "var(--color-danger)",
                  },
                ]}
                valueFormatter={(value) => dinero(value, currency)}
                height={250}
              />
            ) : (
              <p className="text-sm text-muted">
                El gráfico necesita una sola moneda.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardKicker>Planes</CardKicker>
            <CardTitle>Qué se está vendiendo</CardTitle>
          </CardHeader>
          <CardContent>
            {planChartData.length ? (
              <BarChart
                data={planChartData}
                xKey="name"
                series={[{ key: "gross", label: "Bruto" }]}
                horizontal
                height={Math.min(260, Math.max(120, planChartData.length * 42))}
                valueFormatter={(value) => dinero(value, currency)}
              />
            ) : (
              <EmptyState size="sm" title="Todavía no hay cobros confirmados en el periodo" />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardKicker>Acceso comercial</CardKicker>
          <CardTitle>Suscripciones activas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <Metric
              label="Activas"
              value={data.subscriptions.active}
              hint="Membresías en vigor"
              tone="success"
            />
            <Metric
              label="En prueba"
              value={data.subscriptions.trial}
              hint="Trial vigente"
            />
            <Metric
              label="Pagadas"
              value={data.subscriptions.paid}
              hint="Origen Stripe"
            />
            <Metric
              label="Concedidas"
              value={data.subscriptions.granted}
              hint="Sin cobro en Stripe"
              tone="warn"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardKicker>Detalle</CardKicker>
          <CardTitle>Últimos movimientos</CardTitle>
          <CardDescription>Máximo 100 movimientos del periodo seleccionado.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            ariaLabel="Movimientos financieros de Stripe"
            columns={paymentColumns}
            rows={data.payments}
            emptyLabel="No hay movimientos en este periodo."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function BillingPanel() {
  const {
    data,
    error: loadError,
    isLoading,
    reload,
  } = useCachedQuery<SubscriptionsPayload>("/v1/admin/subscriptions");
  // Reutiliza el payload de consultores: ya trae las dos listas que hace falta
  // elegir aqui (personas y clientes) y evita dos endpoints nuevos.
  const { data: directorio } = useCachedQuery<ConsultantsPayload>(
    "/v1/admin/consultants",
  );

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function revocar(subscription: Subscription) {
    setBusyId(subscription.id);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch(
        `/v1/admin/subscriptions/${subscription.id}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setNotice("Plan retirado.");
      reload();
    } catch {
      setError("No se pudo retirar el plan. Revisa la conexión.");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return <AsyncState status="loading" loadingLabel="Cargando planes..." />;
  }
  if (loadError && !data) return <ErrorBlock>{loadError}</ErrorBlock>;
  if (!data) return null;

  const columns: DataTableColumn<Subscription>[] = [
    {
      key: "subject",
      label: "Quién",
      render: (row) => (
        <div>
          <div>
            {row.subject_name ?? row.user_id ?? row.organization_id ?? "—"}
          </div>
          <span className="text-xs text-muted">
            {row.subject_type === "user" ? "persona · consultor" : "cliente"}
          </span>
        </div>
      ),
    },
    { key: "plan_code", label: "Plan", render: (row) => row.plan_code },
    {
      key: "status",
      label: "Estado",
      render: (row) => <Badge tone={tono(row.status)}>{row.status}</Badge>,
    },
    {
      key: "store_limit",
      label: "Tiendas",
      render: (row) =>
        row.store_limit === null ? "sin límite" : String(row.store_limit),
    },
    {
      key: "member_limit",
      label: "Usuarios",
      render: (row) =>
        row.member_limit === null ? "sin límite" : String(row.member_limit),
    },
    {
      key: "source",
      label: "Origen",
      render: (row) => (
        <Badge tone={row.external_subscription_id ? "brand" : "neutral"}>
          {row.external_subscription_id ? "Stripe" : "concedido"}
        </Badge>
      ),
    },
    { key: "ends_at", label: "Caduca", render: (row) => fecha(row.ends_at) },
    {
      key: "actions",
      label: "",
      render: (row) =>
        row.external_subscription_id || !VIGENTES.has(row.status) ? null : (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === row.id}
              onClick={() => void revocar(row)}
            >
              Retirar
            </Button>
          </div>
        ),
    },
  ];

  const activeCount = data.subscriptions.filter((subscription) => VIGENTES.has(subscription.status)).length;
  const stripeCount = data.subscriptions.filter((subscription) => Boolean(subscription.external_subscription_id)).length;
  const grantedCount = data.subscriptions.length - stripeCount;

  return (
    <div className="admin-module-body">
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <div className="admin-data-summary">
        <Metric card label="Planes registrados" value={String(data.subscriptions.length)} />
        <Metric card label="Planes vigentes" value={String(activeCount)} tone="success" />
        <Metric card label="Gestionados por Stripe" value={String(stripeCount)} />
        <Metric card label="Concedidos manualmente" value={String(grantedCount)} />
      </div>

      <Card>
        <CardHeader>
          <CardKicker>Panel platform admin</CardKicker>
          <CardTitle>Suscripciones y acceso</CardTitle>
          <CardDescription>Los de Stripe llegan solos por webhook y se cancelan allí. Los concedidos se retiran aquí.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            ariaLabel="Suscripciones"
            columns={columns}
            rows={data.subscriptions}
            emptyLabel="Todavía no hay ningún plan."
          />
        </CardContent>
      </Card>

      <Collapsible className="admin-settings-disclosure">
        <CollapsibleTrigger>Configuración fiscal y acciones de facturación<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
        <CollapsibleContent>
        <div className="admin-settings-disclosure-content">
          <FiscalInvoicingPanel />
          <GrantForm
            consultants={directorio?.consultants ?? []}
            organizations={directorio?.organizations ?? []}
            onGranted={(mensaje) => {
              setNotice(mensaje);
              reload();
            }}
          />
        </div>
      </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function GrantForm({
  consultants,
  organizations,
  onGranted,
}: {
  consultants: { id: string; full_name: string | null }[];
  organizations: { id: string; display_name: string }[];
  onGranted: (mensaje: string) => void;
}) {
  const [subjectType, setSubjectType] = useState("user");
  const [subjectId, setSubjectId] = useState("");
  const [planCode, setPlanCode] = useState("consultor");
  const [storeLimit, setStoreLimit] = useState("");
  const [sinLimite, setSinLimite] = useState(false);
  const [memberLimit, setMemberLimit] = useState("");
  const [sinLimiteUsuarios, setSinLimiteUsuarios] = useState(true);
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opcionesSujeto =
    subjectType === "user"
      ? consultants.map((c) => ({ value: c.id, label: c.full_name ?? c.id }))
      : organizations.map((o) => ({ value: o.id, label: o.display_name }));

  const puedeEnviar =
    subjectId !== "" &&
    planCode.trim() !== "" &&
    (sinLimite || /^[1-9]\d*$/.test(storeLimit)) &&
    (sinLimiteUsuarios || /^[1-9]\d*$/.test(memberLimit));

  async function enviar() {
    setBusy(true);
    setError(null);
    try {
      const response = await apiFetch("/v1/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_type: subjectType,
          subject_id: subjectId,
          plan_code: planCode.trim(),
          store_limit: sinLimite ? null : Number.parseInt(storeLimit, 10),
          member_limit: sinLimiteUsuarios
            ? null
            : Number.parseInt(memberLimit, 10),
          ...(endsAt ? { ends_at: new Date(endsAt).toISOString() } : {}),
        }),
      });
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setSubjectId("");
      setEndsAt("");
      onGranted("Plan concedido.");
    } catch {
      setError("No se pudo conceder el plan. Revisa la conexión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardKicker>Panel platform admin</CardKicker>
        <CardTitle>Conceder un plan sin cobrar</CardTitle>
        <CardDescription>Para un socio, una prueba o una compensación. No pasa por Stripe.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="A quién">
              <Select
                value={subjectType}
                onChange={(value) => {
                  setSubjectType(value);
                  setSubjectId("");
                }}
                options={[
                  { value: "user", label: "Una persona (la hace consultora)" },
                  {
                    value: "organization",
                    label: "Un cliente (fija sus tiendas)",
                  },
                ]}
              />
            </Field>
            <Field label={subjectType === "user" ? "Persona" : "Cliente"}>
              <Select
                value={subjectId}
                onChange={setSubjectId}
                options={opcionesSujeto}
                placeholder="Seleccionar..."
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Código de plan">
              <Input
                value={planCode}
                onChange={(event) => setPlanCode(event.target.value)}
                placeholder="consultor"
              />
            </Field>
            <Field label="Tiendas incluidas">
              <Input
                value={storeLimit}
                onChange={(event) => setStoreLimit(event.target.value)}
                placeholder="3"
                disabled={sinLimite}
                inputMode="numeric"
              />
            </Field>
            <Field label="Usuarios incluidos">
              <Input
                value={memberLimit}
                onChange={(event) => setMemberLimit(event.target.value)}
                placeholder="5"
                disabled={sinLimiteUsuarios}
                inputMode="numeric"
              />
            </Field>
            <Field label="Caduca (opcional)">
              <DatePicker
                value={endsAt}
                onChange={(value) => setEndsAt(value)}
              />
            </Field>
          </div>

          <Checkbox checked={sinLimite} onCheckedChange={setSinLimite}>
            Sin límite de tiendas
          </Checkbox>
          <Checkbox checked={sinLimiteUsuarios} onCheckedChange={setSinLimiteUsuarios}>
            Sin límite de usuarios
          </Checkbox>

          {/* El aviso va aquí y no en un subtexto suelto: es la consecuencia de la
              acción, y de las dos opciones de arriba solo una cambia el rol. */}
          {subjectType === "user" ? (
            <Banner tone="warn">
              Un plan a nombre de una persona la convierte en consultora: verá su
              cartera de clientes, no solo una tienda.
            </Banner>
          ) : null}

          {error ? <ErrorBlock>{error}</ErrorBlock> : null}

          <div>
            <Button disabled={!puedeEnviar || busy} onClick={() => void enviar()}>
              {busy ? "Concediendo..." : "Conceder plan"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminFacturacionPage() {
  return (
    <PlatformAdminShell title="Facturación">
      {() => <BillingPanel />}
    </PlatformAdminShell>
  );
}
