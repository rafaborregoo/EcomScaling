"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { formatMoney } from "@/lib/money";
import { AiDiagnosticSection } from "@/components/ai-diagnostic-section";
import {
  BarChart,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBlock,
  EYEBROW,
  LoadingBlock,
  Metric,
  Table,
  type TableColumnDef,
} from "@/components/ui";

// Panel de rendimiento de email marketing (Klaviyo). Reutilizable: `variant`
// decide qué ve el cliente (resultado: cuánto genera el email, qué asuntos
// funcionan) frente al consultor (además: entregabilidad, asuntos a revisar,
// flows sin datos). Datos de GET /klaviyo/email-report, que agrega a nivel de
// organización (todas las tiendas): Klaviyo es una cuenta por marca, sin
// vínculo con una tienda Shopify concreta.

type Totals = {
  revenue: number;
  campaign_revenue: number;
  flow_revenue: number;
  conversions: number;
  recipients: number;
  delivered: number;
  opens_unique: number;
  clicks_unique: number;
  unsubscribes: number;
  bounced: number;
  spam_complaints: number;
  flow_share_pct: number | null;
  open_rate: number | null;
  click_rate: number | null;
  ctor: number | null;
  conversion_rate: number | null;
  revenue_per_recipient: number | null;
  unsub_rate: number | null;
  bounce_rate: number | null;
  spam_rate: number | null;
};

type Entity = {
  id: string;
  name: string;
  subject: string | null;
  trigger_type: string | null;
  send_time: string | null;
  revenue: number;
  conversions: number;
  recipients: number;
  delivered: number;
  opens_unique: number;
  clicks_unique: number;
  open_rate: number | null;
  click_rate: number | null;
  ctor: number | null;
  revenue_per_recipient: number | null;
};

type EmailReport = {
  connected: boolean;
  period: { days: number; start: string; end: string };
  totals: Totals;
  previous: Totals | null;
  trend: Array<{
    month: string;
    campaign_revenue: number;
    flow_revenue: number;
  }>;
  campaigns: Entity[];
  flows: Entity[];
};

const PERIODS = ["7", "30", "90", "all"] as const;
type Period = (typeof PERIODS)[number];

const pct = (value: number | null, digits = 1): string =>
  value == null ? "—" : `${(value * 100).toFixed(digits)}%`;
const money = (value: number | null): string =>
  value == null ? "—" : formatMoney(value);
const monthLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString("es-ES", {
    month: "short",
    year: "2-digit",
  });

function deltaPct(current: number, previous: number | null | undefined) {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function Delta({
  current,
  previous,
}: {
  current: number;
  previous: number | null | undefined;
}) {
  const value = deltaPct(current, previous);
  if (value == null) return null;
  const up = value > 0;
  const flat = Math.abs(value) < 0.05;
  const color = flat ? "text-muted" : up ? "text-success" : "text-danger";
  return (
    <p className={`text-xs ${color}`} title="vs. el periodo anterior">
      <span aria-hidden="true">{flat ? "→" : up ? "↑" : "↓"}</span>{" "}
      {Math.abs(value).toFixed(1)}%
      <span className="text-muted"> periodo anterior</span>
    </p>
  );
}

// Umbrales de referencia DTC para las tasas "malas" (cuanto más bajo mejor).
function healthTone(
  value: number | null,
  warn: number,
  danger: number,
): "default" | "warn" | "danger" {
  if (value == null) return "default";
  if (value >= danger) return "danger";
  if (value >= warn) return "warn";
  return "default";
}

export function KlaviyoEmailPanel({
  organizationId,
  variant,
}: {
  organizationId: string;
  variant: "client" | "consultant";
}) {
  const [period, setPeriod] = useState<Period>("90");
  const [data, setData] = useState<EmailReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    apiFetch(
      `/v1/organizations/${organizationId}/klaviyo/email-report?days=${period}`,
    )
      .then(async (response) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(`No se pudo cargar Klaviyo (HTTP ${response.status}).`);
          setData(null);
          return;
        }
        setData((await response.json()) as EmailReport);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setError("No se pudo cargar Klaviyo por un error de red.");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, period]);

  const isConsultant = variant === "consultant";

  if (isLoading && !data) return <LoadingBlock label="Cargando Klaviyo..." />;
  if (error) return <ErrorBlock>{error}</ErrorBlock>;
  if (!data || !data.connected) {
    return (
      <EmptyState
        title="Klaviyo sin conectar"
        hint={
          isConsultant
            ? "Conecta la cuenta de Klaviyo del cliente para ver ingresos atribuidos, reparto flujos/campañas, entregabilidad y rendimiento de asuntos."
            : "Conecta tu cuenta de Klaviyo para ver cuánto genera tu email marketing y qué asuntos funcionan mejor."
        }
        action={<ButtonLink href="/integraciones">Conectar Klaviyo</ButtonLink>}
      />
    );
  }

  const { totals, previous, trend, campaigns, flows } = data;
  const revenueSeries = trend.map(
    (row) => row.campaign_revenue + row.flow_revenue,
  );

  const subjectColumns: TableColumnDef<Entity & { id: string }>[] = [
    {
      key: "subject",
      label: "Asunto",
      render: (row) => (
        <span className="block max-w-[22rem] truncate">
          {row.subject || row.name}
        </span>
      ),
    },
    {
      key: "revenue",
      label: "Ingresos",
      render: (row) => (
        <span className="tabular-nums">{money(row.revenue)}</span>
      ),
    },
    {
      key: "open_rate",
      label: "Apertura",
      render: (row) => (
        <span className="tabular-nums">{pct(row.open_rate)}</span>
      ),
    },
    {
      key: "click_rate",
      label: "Clic",
      render: (row) => (
        <span className="tabular-nums">{pct(row.click_rate)}</span>
      ),
    },
    {
      key: "revenue_per_recipient",
      label: "€/dest.",
      render: (row) => (
        <span className="tabular-nums">
          {money(row.revenue_per_recipient)}
        </span>
      ),
    },
  ];

  const flowColumns: TableColumnDef<Entity & { id: string }>[] = [
    {
      key: "name",
      label: "Flujo",
      render: (row) => (
        <span className="block max-w-[18rem] truncate">{row.name}</span>
      ),
    },
    {
      key: "trigger_type",
      label: "Disparador",
      render: (row) => (
        <span className="text-muted">{row.trigger_type || "—"}</span>
      ),
    },
    {
      key: "revenue",
      label: "Ingresos",
      render: (row) => (
        <span className="tabular-nums">{money(row.revenue)}</span>
      ),
    },
    {
      key: "open_rate",
      label: "Apertura",
      render: (row) =>
        row.recipients > 0 ? (
          <span className="tabular-nums">{pct(row.open_rate)}</span>
        ) : (
          <span className="text-warn-deep">sin datos</span>
        ),
    },
  ];

  const subjectsToReview = campaigns
    .filter((row) => row.recipients > 0 && row.open_rate != null)
    .sort((a, b) => (a.open_rate ?? 0) - (b.open_rate ?? 0))
    .slice(0, 5);

  return (
    <Card
      title="Klaviyo · email marketing"
      description={`Rendimiento atribuido de los últimos ${data.period.days} días · todas las tiendas de la organización.`}
      actions={
        <div className="flex flex-wrap gap-2" role="group" aria-label="Periodo">
          {PERIODS.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={period === option ? "primary" : "ghost"}
              onClick={() => setPeriod(option)}
            >
              {option === "all" ? "Todo" : `${option}d`}
            </Button>
          ))}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Metric
          card
          label="Ingresos atribuidos"
          value={money(totals.revenue)}
          trend={revenueSeries}
          delta={
            previous ? (
              <Delta
                current={totals.revenue}
                previous={previous.revenue}
              />
            ) : undefined
          }
        />
        <Metric
          card
          label="% ingresos de flujos"
          value={pct(totals.flow_share_pct)}
          hint={`${money(totals.flow_revenue)} flujos · ${money(
            totals.campaign_revenue,
          )} campañas`}
        />
        <Metric
          card
          label="Ingresos por destinatario"
          value={money(totals.revenue_per_recipient)}
          delta={
            previous ? (
              <Delta
                current={totals.revenue_per_recipient ?? 0}
                previous={previous.revenue_per_recipient}
              />
            ) : undefined
          }
        />
        <Metric
          card
          label="Tasa de apertura"
          value={pct(totals.open_rate)}
          delta={
            previous ? (
              <Delta
                current={totals.open_rate ?? 0}
                previous={previous.open_rate}
              />
            ) : undefined
          }
        />
        <Metric
          card
          label="Tasa de clic"
          value={pct(totals.click_rate)}
          delta={
            previous ? (
              <Delta
                current={totals.click_rate ?? 0}
                previous={previous.click_rate}
              />
            ) : undefined
          }
        />
        <Metric
          card
          label="Clic sobre apertura"
          value={pct(totals.ctor)}
          hint="CTOR · calidad del contenido"
        />
      </div>

      {isConsultant ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Metric
            card
            size="sm"
            label="Tasa de baja"
            value={pct(totals.unsub_rate, 2)}
            tone={healthTone(totals.unsub_rate, 0.003, 0.005)}
            hint="objetivo < 0,3%"
          />
          <Metric
            card
            size="sm"
            label="Tasa de rebote"
            value={pct(totals.bounce_rate, 2)}
            tone={healthTone(totals.bounce_rate, 0.02, 0.04)}
            hint="objetivo < 2%"
          />
          <Metric
            card
            size="sm"
            label="Quejas de spam"
            value={pct(totals.spam_rate, 3)}
            tone={healthTone(totals.spam_rate, 0.0008, 0.001)}
            hint="objetivo < 0,08%"
          />
        </div>
      ) : null}

      {trend.length >= 2 ? (
        <div className="mt-6">
          <p className={EYEBROW}>Ingresos por mes · flujos vs campañas</p>
          <div className="mt-2">
            <BarChart
              data={trend.map((row) => ({
                month: monthLabel(row.month),
                Flujos: Math.round(row.flow_revenue),
                Campañas: Math.round(row.campaign_revenue),
              }))}
              xKey="month"
              series={[
                { key: "Flujos", label: "Flujos" },
                { key: "Campañas", label: "Campañas" },
              ]}
              height={200}
              valueFormatter={(value) => formatMoney(value)}
            />
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <p className={EYEBROW}>Mejores asuntos · campañas por ingresos</p>
        <Table
          className="mt-2"
          ariaLabel="Mejores asuntos de campaña"
          columns={subjectColumns}
          rows={campaigns.slice(0, 8)}
          emptyLabel="Aún no hay campañas con datos en este periodo."
        />
      </div>

      {isConsultant ? (
        <>
          <div className="mt-6">
            <p className={EYEBROW}>Asuntos a revisar · menor apertura</p>
            <Table
              className="mt-2"
              ariaLabel="Asuntos con menor apertura"
              columns={subjectColumns}
              rows={subjectsToReview}
              emptyLabel="Sin campañas con envíos suficientes para evaluar."
            />
          </div>
          <div className="mt-6">
            <p className={EYEBROW}>Flujos automáticos</p>
            <Table
              className="mt-2"
              ariaLabel="Rendimiento de flujos"
              columns={flowColumns}
              rows={flows}
              emptyLabel="No hay flujos sincronizados con datos."
            />
          </div>
        </>
      ) : null}

      <div className="mt-6">
        <AiDiagnosticSection
          organizationId={organizationId}
          title="Análisis de email"
          getPath="/ai/email-analyst"
          runPath="/ai/email-analyst-run"
          loadingLabel="Analizando el rendimiento de email..."
          tasksLabelSingular="tarea de email"
          variant={isConsultant ? "full" : "summary"}
        />
      </div>
    </Card>
  );
}
