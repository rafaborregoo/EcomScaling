"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { useActiveOrganization } from "@/components/active-organization";
import { useActiveConnection } from "@/components/active-connection";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import { readApiError } from "@/lib/api-error";
import { formatMoney } from "@/lib/money";
import { StatusStrip, WorkPageHeader } from "@/components/trabajo-ui";
import s from "./tracking.module.css";
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Select,
  Sparkline,
  DataTable,
  toast,
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
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

/** 2026-10-12 → «12 oct 2026». */
const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
const range = (start: string, end: string) => `${day(start)} – ${day(end)}`;
const ratio = (value: number) => `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`;
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
  const router = useRouter();
  const isConsultant = ["consultant", "platform_admin"].includes(
    bootstrap.profile.platform_role,
  );
  // Vista interna del consultor: el cliente vuelve a su agenda.
  useEffect(() => {
    if (!isConsultant) router.replace("/planificacion/calendario");
  }, [isConsultant, router]);

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
      toast.success(`Periodo ${range(bounds.start, bounds.end)} registrado`);
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

  if (!isConsultant) return null;
  if (!organizationId)
    return (
      <Banner tone="warn">
        Selecciona un cliente para ver su seguimiento.
      </Banner>
    );
  if (loading) return <LoadingBlock label="Cargando tracking…" />;

  const withComparison = withDeltas(rows);
  const bounds = lastClosedPeriod(period);
  // Del más antiguo al más reciente: la línea se lee de izquierda a derecha.
  const latest = withComparison[0] ?? null;
  const salesSeries = withComparison
    .map((row) => row.net_sales)
    .filter((value): value is number => value != null)
    .reverse();

  return (
    <div className="portal-page space-y-6">
      <div className={s.header}>
        <WorkPageHeader title="Tracking">
          Una foto de cada semana cerrada de la tienda, para comparar contra la anterior. Se guarda sola cada lunes.
        </WorkPageHeader>
        {/* Capturar el mismo periodo lo actualiza, no lo duplica. */}
        <div className={s.capture}>
          <div className="w-40">
            <Select
              aria-label="Periodo a capturar"
              value={period}
              onChange={(value) => setPeriod(value as SnapshotPeriod)}
              options={[
                { value: "weekly", label: "Semana" },
                { value: "monthly", label: "Mes" },
              ]}
            />
          </div>
          <Button onClick={capture} disabled={capturing}>
            {capturing ? "Capturando…" : "Capturar"}
          </Button>
          <span className={s.range}>
            {range(bounds.start, bounds.end)}
          </span>
        </div>
      </div>
      {error ? <ErrorBlock>{error}</ErrorBlock> : null}

      {latest ? (
        <StatusStrip
          items={[
            {
              value: money(latest.net_sales),
              label: "Ventas netas",
              hint:
                latest.salesDelta != null
                  ? `${latest.salesDelta >= 0 ? "+" : ""}${latest.salesDelta.toFixed(0)} % vs anterior`
                  : range(latest.period_start, latest.period_end),
              tone: latest.salesDelta != null && latest.salesDelta < 0 ? "bad" : undefined,
            },
            { value: latest.orders_count?.toLocaleString("es-ES") ?? "—", label: "Pedidos" },
            {
              value: latest.roas == null ? "—" : ratio(Number(latest.roas)),
              label: "ROAS",
              hint: `Gasto ads ${money(latest.ad_spend)}`,
              tone: latest.roas != null && latest.roas < 1 ? "bad" : undefined,
            },
            {
              value: money(latest.net_profit),
              label: "Beneficio",
              tone: latest.net_profit != null && latest.net_profit < 0 ? "bad" : undefined,
            },
          ]}
        />
      ) : null}

      {salesSeries.length >= 2 ? (
        <Card>
          <CardHeader>
            <CardTitle>Ventas netas por periodo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={s.chartHead}>
              <span className={s.chartValue}>{money(salesSeries[salesSeries.length - 1] ?? null)}</span>
              <span className={s.chartHint}>último periodo · {salesSeries.length} registrados</span>
            </div>
            <Sparkline data={salesSeries} height={96} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
          <CardAction><Button
            variant="secondary"
            onClick={exportCsv}
            disabled={!rows.length}
          >
            Exportar CSV
          </Button></CardAction>
        </CardHeader>
        <CardContent>
          {rows.length ? (
            <DataTable
              ariaLabel="Snapshots de seguimiento"
              rows={withComparison}
              columns={[
                {
                  key: "periodo",
                  label: "Periodo",
                  render: (row) => range(row.period_start, row.period_end),
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
                        {ratio(Number(row.roas))}
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
        </CardContent>
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
