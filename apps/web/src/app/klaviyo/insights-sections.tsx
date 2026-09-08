"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/bootstrap";
import { formatMoney } from "@/lib/money";
import {
  Badge,
  Banner,
  Card,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Metric,
  Table,
  type TableColumnDef,
} from "@/components/ui";

export type KlaviyoEmail = {
  source: "flow" | "campaign";
  parent_id: string;
  parent_name: string;
  parent_status: string | null;
  trigger_type: string | null;
  send_time: string | null;
  message_id: string;
  external_message_id: string;
  position_in_parent: number;
  subject: string | null;
  preview_text: string | null;
  external_template_id: string | null;
  template_name: string | null;
  body_chars: number | null;
  tracks_opens: boolean | null;
  tracks_clicks: boolean | null;
  adds_utm: boolean;
  custom_utm_params: number;
};

export type KlaviyoHealth = {
  emails_total: number;
  emails_sin_asunto: number;
  emails_sin_cuerpo: number;
  emails_sin_utm: number;
  emails_sin_seguimiento_clics: number;
  flujos_activos: number;
  campanas_enviadas: number;
  listas: number;
  segmentos: number;
  metrica_conversion: string | null;
  ultimo_sync: string | null;
  ultimo_sync_estado: string | null;
  recursos_no_traidos: string | null;
};

export type KlaviyoPerformance = {
  bucket_month: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  subject: string | null;
  revenue: number;
  conversions: number;
  recipients: number;
  delivered: number;
  opens_unique: number;
  clicks_unique: number;
  unsubscribes: number;
  bounced: number;
  spam_complaints: number;
};

type KlaviyoInsights = {
  connected: boolean;
  performance_bucket: string;
  health: KlaviyoHealth | null;
  emails: KlaviyoEmail[];
  performance: KlaviyoPerformance[];
  unavailable: string[];
};

const count = (value: number | null | undefined) =>
  value == null ? "—" : value.toLocaleString("es-ES");

const rate = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";

function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

/** Un bloque que no se ha podido calcular no se dibuja como un bloque vacío. */
function Unavailable({ what }: { what: string }) {
  return (
    <Banner tone="warn" className="text-sm">
      No se ha podido calcular {what}. El resto de la página sí es fiable.
    </Banner>
  );
}

/**
 * Medición primero, igual que en Meta: si los emails no llevan UTM o no siguen
 * clics, las cifras de más abajo describen otra cosa.
 */
function MeasurementSection({ health }: { health: KlaviyoHealth | null }) {
  if (!health) return <Unavailable what="el estado de la medición" />;

  const sinUtm = health.emails_sin_utm;
  const total = health.emails_total;

  return (
    <Card
      title="Medición"
      description="Si esto está roto, lo de abajo mide otra cosa."
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <Metric card label="Emails" value={count(total)} />
        <Metric card label="Flujos activos" value={count(health.flujos_activos)} />
        <Metric card label="Listas" value={count(health.listas)} />
        <Metric card label="Segmentos" value={count(health.segmentos)} />
      </div>

      {total > 0 && sinUtm > 0 ? (
        <Banner tone={sinUtm === total ? "danger" : "warn"} className="mt-4 text-sm">
          {sinUtm === total
            ? "Ninguno de estos emails añade parámetros UTM a sus enlaces."
            : `${sinUtm} de ${total} emails no añaden parámetros UTM a sus enlaces.`}{" "}
          Su tráfico llega a Shopify y a Analytics sin atribuir: la venta existe,
          pero nadie sabe que la trajo el email. Se activa en Klaviyo, en las
          opciones de seguimiento de cada campaña o flujo.
        </Banner>
      ) : null}

      {health.emails_sin_cuerpo > 0 ? (
        <Banner tone="warn" className="mt-3 text-sm">
          {health.emails_sin_cuerpo} email(s) sin cuerpo descargado. Suele
          significar que su plantilla se borró en Klaviyo.
        </Banner>
      ) : null}

      {health.recursos_no_traidos ? (
        <Banner tone="warn" className="mt-3 text-sm">
          El último sync dejó recursos sin traer ({health.recursos_no_traidos}).
          El inventario de abajo puede estar incompleto: que algo no aparezca no
          prueba que no exista.
        </Banner>
      ) : null}

      <p className="mt-3 text-xs text-muted">
        Métrica de conversión: {health.metrica_conversion ?? "sin elegir"}.
        {health.ultimo_sync
          ? ` Última sincronización ${new Date(health.ultimo_sync).toLocaleString("es-ES")}.`
          : " Sin sincronizar todavía."}
      </p>
    </Card>
  );
}

/** El inventario: qué emails existen, con su asunto y su cuerpo. */
function InventorySection({ emails }: { emails: KlaviyoEmail[] }) {
  const flows = emails.filter((email) => email.source === "flow");
  const campaigns = emails.filter((email) => email.source === "campaign");

  const columns: TableColumnDef<KlaviyoEmail & { id: string }>[] = [
    {
      key: "subject",
      label: "Asunto",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.subject ?? "sin asunto"}
          </p>
          {row.preview_text ? (
            <p className="truncate text-xs text-muted">{row.preview_text}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: "position_in_parent",
      label: "Orden",
      render: (row) =>
        row.source === "flow" ? `${row.position_in_parent}º` : "—",
    },
    {
      key: "body_chars",
      label: "Cuerpo",
      render: (row) =>
        row.body_chars
          ? `${Math.round(row.body_chars / 1024)} KB`
          : "sin cuerpo",
    },
    {
      key: "adds_utm",
      label: "UTM",
      render: (row) =>
        row.adds_utm ? (
          <Badge tone="success">sí</Badge>
        ) : (
          <Badge tone="danger">no</Badge>
        ),
    },
  ];

  const withId = (rows: KlaviyoEmail[]) =>
    rows.map((row) => ({ ...row, id: row.message_id }));

  return (
    <Card
      title="Qué emails hay"
      description="Lo que reciben tus clientes, con su asunto y su contenido."
    >
      {emails.length === 0 ? (
        <EmptyState
          title="Todavía no hay emails sincronizados."
          hint="Aparecerán tras la primera sincronización con contenido en Klaviyo."
        />
      ) : (
        <div className="grid gap-6">
          {flows.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium">
                Flujos ({new Set(flows.map((f) => f.parent_id)).size})
              </p>
              {[...new Set(flows.map((f) => f.parent_id))].map((parentId) => {
                const rows = flows.filter((f) => f.parent_id === parentId);
                const first = rows[0];
                if (!first) return null;
                return (
                  <div key={parentId} className="mb-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="font-medium">{first.parent_name}</span>
                      <Badge
                        tone={
                          first.parent_status === "live" ? "success" : "neutral"
                        }
                      >
                        {first.parent_status ?? "sin estado"}
                      </Badge>
                      {first.trigger_type ? (
                        <span className="text-xs text-muted">
                          se dispara con: {first.trigger_type}
                        </span>
                      ) : null}
                    </div>
                    <Table
                      ariaLabel={`Emails del flujo ${first.parent_name}`}
                      columns={columns}
                      rows={withId(rows)}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          {campaigns.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-medium">
                Campañas ({campaigns.length})
              </p>
              <Table
                ariaLabel="Emails de campaña"
                columns={[
                  {
                    key: "parent_name",
                    label: "Campaña",
                    render: (row) => (
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {row.parent_name}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {row.parent_status ?? "sin estado"}
                        </p>
                      </div>
                    ),
                  },
                  ...columns.filter(
                    (column) => column.key !== "position_in_parent",
                  ),
                ]}
                rows={withId(campaigns)}
              />
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}

/** Rendimiento: existe solo si hubo envíos reales y los informes corrieron. */
function PerformanceSection({
  performance,
  bucket,
}: {
  performance: KlaviyoPerformance[];
  bucket: string;
}) {
  const totals = performance.reduce(
    (acc, row) => ({
      revenue: acc.revenue + Number(row.revenue ?? 0),
      recipients: acc.recipients + Number(row.recipients ?? 0),
      delivered: acc.delivered + Number(row.delivered ?? 0),
      opens: acc.opens + Number(row.opens_unique ?? 0),
      clicks: acc.clicks + Number(row.clicks_unique ?? 0),
    }),
    { revenue: 0, recipients: 0, delivered: 0, opens: 0, clicks: 0 },
  );

  const columns: TableColumnDef<KlaviyoPerformance & { id: string }>[] = [
    {
      key: "entity_name",
      label: "Envío",
      render: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.subject ?? row.entity_name ?? "sin nombre"}
          </p>
          <p className="truncate text-xs text-muted">
            {row.entity_type === "flow" ? "flujo" : "campaña"} ·{" "}
            {monthLabel(row.bucket_month)}
          </p>
        </div>
      ),
    },
    {
      key: "delivered",
      label: "Entregados",
      render: (row) => count(row.delivered),
    },
    {
      key: "opens_unique",
      label: "Apertura",
      render: (row) => rate(row.opens_unique, row.delivered),
    },
    {
      key: "clicks_unique",
      label: "Clic",
      render: (row) => rate(row.clicks_unique, row.delivered),
    },
    {
      key: "revenue",
      label: "EUR atribuidos",
      render: (row) => formatMoney(Number(row.revenue ?? 0), "EUR"),
    },
  ];

  return (
    <Card
      title="Rendimiento"
      description="EUR atribuidos por Klaviyo en su propia ventana de conversión. No es venta Shopify."
    >
      {performance.length === 0 ? (
        <EmptyState
          title="Todavía no hay rendimiento que enseñar."
          hint="Aparece cuando hay envíos entregados y los informes de Klaviyo han corrido."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Metric
              card
              label="EUR atribuidos por Klaviyo"
              value={formatMoney(totals.revenue, "EUR")}
            />
            <Metric card label="Entregados" value={count(totals.delivered)} />
            <Metric
              card
              label="Apertura"
              value={rate(totals.opens, totals.delivered)}
            />
            <Metric
              card
              label="Clic"
              value={rate(totals.clicks, totals.delivered)}
            />
          </div>
          <div className="mt-4">
            <Table
              ariaLabel="Rendimiento por envío"
              columns={columns}
              rows={performance.map((row, index) => ({
                ...row,
                id: `${row.entity_id ?? row.entity_name ?? "x"}-${row.bucket_month}-${index}`,
              }))}
            />
          </div>
          {bucket === "month" ? (
            <p className="mt-3 text-xs text-muted">
              Klaviyo devuelve estas cifras agrupadas por mes, así que una
              ventana más corta que un mes incluye envíos de fuera de la
              ventana.
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}

export function KlaviyoInsightsSections({
  organizationId,
  connectionId,
  periodDays,
}: {
  organizationId: string;
  // Tienda activa. La cuenta de Klaviyo cuelga de ella, así que sin esto un
  // cliente con dos tiendas vería los emails de las dos mezclados.
  connectionId: string | null;
  periodDays: number | "all";
}) {
  const [data, setData] = useState<KlaviyoInsights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setData(null);
    setError(null);

    void (async () => {
      try {
        const query = new URLSearchParams({ days: String(periodDays) });
        if (connectionId) query.set("connectionId", connectionId);
        const response = await apiFetch(
          `/v1/organizations/${organizationId}/klaviyo/insights?${query}`,
        );
        if (!current) return;

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          setError(body?.error ?? `HTTP ${response.status}`);
          return;
        }

        setData((await response.json()) as KlaviyoInsights);
      } catch {
        if (!current) return;
        setError("No se pudo cargar el módulo de Klaviyo.");
      }
    })();

    return () => {
      current = false;
    };
  }, [organizationId, connectionId, periodDays]);

  if (error) {
    return (
      <Card>
        <ErrorBlock>{error}</ErrorBlock>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <LoadingBlock label="Cargando el email de este cliente..." />
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <MeasurementSection health={data.health} />
      {data.unavailable.includes("emails") ? (
        <Unavailable what="el inventario de emails" />
      ) : (
        <InventorySection emails={data.emails} />
      )}
      {data.unavailable.includes("rendimiento") ? (
        <Unavailable what="el rendimiento" />
      ) : (
        <PerformanceSection
          performance={data.performance}
          bucket={data.performance_bucket}
        />
      )}
    </div>
  );
}
