"use client";

import { useCallback, useEffect, useState } from "react";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/money";
import {
  Badge,
  Banner,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorBlock,
  Heading,
  LoadingBlock,
  Select,
  Table,
  toast,
} from "@/components/ui";
import {
  lastClosedPeriod,
  periodDays,
  withDeltas,
  type SnapshotPeriod,
} from "./snapshot-period";

type Snapshot = {
  id: string;
  period_start: string;
  period_end: string;
  net_sales: number | null;
  orders_count: number | null;
  aov: number | null;
  ad_spend: number | null;
  roas: number | null;
  cac: number | null;
  net_profit: number | null;
  notes: string | null;
};

const money = (value: number | null) =>
  value == null ? "—" : formatMoney(value, "EUR");
const num = (value: unknown): number | null => {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
};

function TrackingContent({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const { organizationId } = useActiveOrganization();
  const { connectionId } = useActiveConnection();
  const [rows, setRows] = useState<Snapshot[]>([]);
  const [period, setPeriod] = useState<SnapshotPeriod>("weekly");
  const [loading, setLoading] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch(
        `/v1/organizations/${organizationId}/kpi-snapshots${connectionId ? `?storeId=${encodeURIComponent(connectionId)}` : ""}`,
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      setRows(
        ((await response.json()) as { snapshots?: Snapshot[] }).snapshots ?? [],
      );
    } catch {
      setError("No se pudo cargar el tracking. Reintenta.");
    } finally {
      setLoading(false);
    }
  }, [connectionId, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Captura el periodo cerrado con las cifras que ya están conectadas.
   *
   * La pantalla decía "el consultor puede registrar el primer seguimiento
   * desde el resumen" y el resumen no registraba nada: no había forma de crear
   * un snapshot en toda la aplicación. Y teclear ocho cifras a mano cada
   * semana, teniéndolas sincronizadas, no es seguimiento: es transcripción.
   */
  async function capture() {
    if (!organizationId) return;
    setCapturing(true);
    setError(null);
    try {
      const bounds = lastClosedPeriod(period);
      const days = periodDays(bounds);
      const scope = connectionId
        ? `&connectionId=${encodeURIComponent(connectionId)}`
        : "";
      const [shopifyResponse, metaResponse] = await Promise.all([
        apiFetch(
          `/v1/organizations/${organizationId}/shopify/metrics?days=${days}${scope}`,
        ),
        apiFetch(
          `/v1/organizations/${organizationId}/meta/metrics?days=${days}`,
        ),
      ]);
      const shopify = shopifyResponse.ok
        ? ((await shopifyResponse.json()) as {
            sales?: { net_sales?: number; orders_count?: number; aov?: number };
            financial?: { net_profit?: number };
          })
        : null;
      const meta = metaResponse.ok
        ? ((await metaResponse.json()) as {
            acquisition?: { spend?: unknown; roas?: unknown; cac?: unknown };
          })
        : null;

      if (!shopify) {
        setError(
          "Sin datos de Shopify para ese periodo: conecta la tienda antes de capturar.",
        );
        return;
      }

      const response = await apiFetch(
        `/v1/organizations/${organizationId}/kpi-snapshots`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeId: connectionId || null,
            period,
            periodStart: bounds.start,
            periodEnd: bounds.end,
            netSales: num(shopify.sales?.net_sales),
            ordersCount: num(shopify.sales?.orders_count),
            aov: num(shopify.sales?.aov),
            netProfit: num(shopify.financial?.net_profit),
            adSpend: num(meta?.acquisition?.spend),
            roas: num(meta?.acquisition?.roas),
            cac: num(meta?.acquisition?.cac),
          }),
        },
      );
      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }
      toast.success(`Periodo ${bounds.start} → ${bounds.end} registrado`);
      await load();
    } catch {
      setError(
        "No se pudo capturar el periodo por un error de red. Reintenta.",
      );
    } finally {
      setCapturing(false);
    }
  }

  function exportCsv() {
    const headers = [
      "inicio",
      "fin",
      "ventas_netas",
      "pedidos",
      "aov",
      "gasto_ads",
      "roas",
      "cpa_atribuido_meta",
      "beneficio_neto",
      "notas",
    ];
    const quote = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const csv = [
      headers,
      ...rows.map((row) => [
        row.period_start,
        row.period_end,
        row.net_sales,
        row.orders_count,
        row.aov,
        row.ad_spend,
        row.roas,
        row.cac,
        row.net_profit,
        row.notes,
      ]),
    ]
      .map((row) => row.map(quote).join(","))
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = "tracking-kpi.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (
    bootstrap.profile.platform_role !== "consultant" &&
    bootstrap.profile.platform_role !== "platform_admin"
  )
    return (
      <Card title="Tracking del consultor">
        <ButtonLink href="/dashboard">Volver al dashboard</ButtonLink>
      </Card>
    );
  if (!organizationId)
    return (
      <Banner tone="warn">
        Selecciona un cliente para ver su seguimiento.
      </Banner>
    );
  if (loading) return <LoadingBlock label="Cargando tracking…" />;

  const withComparison = withDeltas(rows);
  const bounds = lastClosedPeriod(period);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Seguimiento de resultados</Heading>
          <p className="mt-1 text-sm text-muted">
            Cada snapshot congela un periodo cerrado. Es contra esto contra lo
            que se mide si un plan funcionó.
          </p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/planificacion" variant="secondary">
            Resumen
          </ButtonLink>
          <ButtonLink href="/planificacion/calendario" variant="secondary">
            Calendario
          </ButtonLink>
        </div>
      </div>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      <Card
        title="Capturar el último periodo cerrado"
        description="Toma las cifras ya sincronizadas de Shopify y Meta. Volver a capturar el mismo periodo lo actualiza, no lo duplica."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Select
            className="w-48"
            aria-label="Periodo a capturar"
            value={period}
            onChange={(value) => setPeriod(value as SnapshotPeriod)}
            options={[
              { value: "weekly", label: "Semana" },
              { value: "monthly", label: "Mes" },
            ]}
          />
          <Button onClick={capture} disabled={capturing}>
            {capturing ? "Capturando…" : "Capturar"}
          </Button>
          <span className="text-sm text-muted">
            {bounds.start} → {bounds.end}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">
          Se cierra el periodo anterior, no el que está en curso: una foto a
          medias cambia mañana y deja de servir para comparar.
        </p>
      </Card>

      <Card
        title="Histórico"
        description={`${rows.length} periodos registrados en el alcance seleccionado.`}
        actions={
          <Button
            variant="secondary"
            onClick={exportCsv}
            disabled={!rows.length}
          >
            Exportar CSV
          </Button>
        }
      >
        {rows.length ? (
          <Table
            ariaLabel="Snapshots de seguimiento"
            rows={withComparison}
            columns={[
              {
                key: "periodo",
                label: "Periodo",
                render: (row) => `${row.period_start} → ${row.period_end}`,
              },
              {
                key: "net_sales",
                label: "Ventas netas",
                render: (row) => (
                  <span className="flex items-center gap-2 tabular-nums">
                    {money(row.net_sales)}
                    {row.salesDelta != null ? (
                      <Badge tone={row.salesDelta >= 0 ? "success" : "danger"}>
                        {row.salesDelta >= 0 ? "+" : ""}
                        {row.salesDelta.toFixed(0)}%
                      </Badge>
                    ) : null}
                  </span>
                ),
              },
              {
                key: "orders_count",
                label: "Pedidos",
                render: (row) =>
                  row.orders_count?.toLocaleString("es-ES") ?? "—",
              },
              {
                key: "ad_spend",
                label: "Gasto ads",
                render: (row) => money(row.ad_spend),
              },
              {
                key: "roas",
                label: "ROAS",
                render: (row) =>
                  row.roas == null ? (
                    "—"
                  ) : (
                    <Badge tone={row.roas >= 1 ? "success" : "danger"}>
                      {Number(row.roas).toFixed(2)}x
                    </Badge>
                  ),
              },
              {
                key: "net_profit",
                label: "Beneficio",
                render: (row) => (
                  <span
                    className={
                      row.net_profit != null && row.net_profit < 0
                        ? "text-danger tabular-nums"
                        : "tabular-nums"
                    }
                  >
                    {money(row.net_profit)}
                  </span>
                ),
              },
            ]}
          />
        ) : (
          <EmptyState
            title="Todavía no hay periodos registrados"
            hint="Captura el último periodo cerrado con el botón de arriba: hasta que no haya dos, no hay contra qué comparar."
          />
        )}
      </Card>
    </div>
  );
}

export default function TrackingPage() {
  return (
    <PortalShell title="Tracking">
      {(bootstrap) => <TrackingContent bootstrap={bootstrap} />}
    </PortalShell>
  );
}
