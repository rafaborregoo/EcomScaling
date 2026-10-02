"use client";

import { formatMoney } from "@/lib/money";
import { BarChart, ButtonLink, Card, EmptyState, Table } from "@/components/ui";
import { StatusStrip } from "@/components/trabajo-ui";
import { flowStatus, pct, ratio, type KWorkspace } from "./klaviyo-workspace";
import s from "./marketing-views.module.css";

/** Parte de email de Rendimiento: flows frente a campañas, por día. */
export function KlaviyoPerformance({ workspace }: { workspace: KWorkspace | undefined }) {
  if (!workspace?.connected) {
    return (
      <EmptyState
        title="Con Klaviyo verías aperturas, clics y EUR atribuidos por email"
        hint="Conecta la cuenta y NORA trae el histórico de campañas y flows."
        action={
          <ButtonLink href="/integraciones" variant="primary">
            Conectar Klaviyo
          </ButtonLink>
        }
      />
    );
  }
  const currency = workspace.account?.currency ?? "EUR";
  const money = (value: number) => formatMoney(value, currency);
  const totals = workspace.totals;
  const previous = workspace.previous;
  const revenue = totals?.revenue ?? 0;
  const delta = previous?.revenue ? revenue / previous.revenue - 1 : null;
  const chart = (workspace.daily ?? []).map((point) => ({
    day: new Date(`${point.day}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
    Flows: Math.round(point.flow),
    Campañas: Math.round(point.campaign),
  }));
  const flows = [...(workspace.flows ?? [])]
    .filter((flow) => flow.stats?.revenue || flowStatus(flow.status).key !== "live")
    .sort((a, b) => (b.stats?.revenue ?? 0) - (a.stats?.revenue ?? 0));
  const periodStart = Date.parse(workspace.period.start);
  const campaigns = (workspace.campaigns ?? [])
    .filter((campaign) => campaign.stats?.revenue && campaign.send_time && Date.parse(campaign.send_time) >= periodStart)
    .sort((a, b) => (b.stats?.revenue ?? 0) - (a.stats?.revenue ?? 0))
    .slice(0, 10);

  return (
    <div className={s.root}>
      <StatusStrip
        items={[
          {
            value: money(revenue),
            label: `EUR atribuidos por Klaviyo · ${workspace.period.days} d`,
            hint: delta == null ? undefined : `${delta >= 0 ? "+" : "−"}${Math.abs(Math.round(delta * 100))} % frente al periodo anterior`,
            tone: "good",
          },
          { value: money(workspace.totals_flow?.revenue ?? 0), label: "De flows", hint: revenue ? `${Math.round(100 * ratio(workspace.totals_flow?.revenue, revenue))} %` : undefined },
          { value: money(workspace.totals_campaign?.revenue ?? 0), label: "De campañas", hint: revenue ? `${Math.round(100 * ratio(workspace.totals_campaign?.revenue, revenue))} %` : undefined },
          {
            value: workspace.store_sales ? pct(ratio(revenue, workspace.store_sales)) : "—",
            label: "Sobre las ventas de la tienda",
            hint: workspace.store_sales ? `${money(workspace.store_sales)} en Shopify` : undefined,
          },
          { value: pct(ratio(totals?.opens_unique, totals?.delivered)), label: "Aperturas", hint: `Clics ${pct(ratio(totals?.clicks_unique, totals?.delivered))}` },
        ]}
      />
      <Card title="EUR atribuidos por Klaviyo, por día" description="Las campañas cuentan el día de envío con todo lo que atribuyeron.">
        {chart.some((point) => point.Flows || point.Campañas) ? (
          <div className={s.root} style={{ gap: 0 }}>
            <BarChart
              data={chart}
              xKey="day"
              stacked
              height={240}
              valueFormatter={money}
              axisValueFormatter={(value) =>
                value >= 1000
                  ? `${(value / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} k€`
                  : `${Math.round(value)} €`
              }
              series={[
                { key: "Flows", label: "Flows", color: "var(--mk-flow)" },
                { key: "Campañas", label: "Campañas", color: "var(--mk-camp)" },
              ]}
            />
            <div className={s.legend}>
              <span>
                <i className={s.swatch} style={{ background: "var(--mk-flow)" }} />
                Flows
              </span>
              <span>
                <i className={s.swatch} style={{ background: "var(--mk-camp)" }} />
                Campañas
              </span>
            </div>
          </div>
        ) : (
          <p className={s.muted}>La serie diaria se completa en la próxima sincronización de Klaviyo.</p>
        )}
      </Card>
      <div className={s.two}>
        <Card title="Flows" description={`${workspace.period.days} días`}>
          <Table
            ariaLabel="Rendimiento de flows"
            rows={flows}
            emptyLabel="Sin datos de flows en el periodo."
            columns={[
              { key: "name", label: "Flow", render: (flow) => <b>{flow.name}</b> },
              {
                key: "revenue",
                label: "EUR atrib.",
                render: (flow) =>
                  flowStatus(flow.status).key !== "live" && !flow.stats?.revenue ? (
                    <span style={{ color: "var(--mk-warn)" }}>{flowStatus(flow.status).label}</span>
                  ) : (
                    <span className={s.num}>{money(flow.stats?.revenue ?? 0)}</span>
                  ),
              },
              {
                key: "rpr",
                label: "Por destinatario",
                render: (flow) => <span className={s.num}>{flow.stats?.recipients ? money(ratio(flow.stats.revenue, flow.stats.recipients)) : "—"}</span>,
              },
            ]}
          />
        </Card>
        <Card title="Campañas" description="Enviadas en el periodo">
          <Table
            ariaLabel="Rendimiento de campañas"
            rows={campaigns}
            emptyLabel="Sin campañas enviadas en el periodo."
            columns={[
              { key: "name", label: "Campaña", render: (campaign) => <b>{campaign.name}</b> },
              { key: "revenue", label: "EUR atrib.", render: (campaign) => <span className={s.num}>{money(campaign.stats?.revenue ?? 0)}</span> },
              {
                key: "opens",
                label: "Aperturas",
                render: (campaign) => <span className={s.num}>{pct(ratio(campaign.stats?.opens_unique, campaign.stats?.delivered))}</span>,
              },
            ]}
          />
        </Card>
      </div>
      <p className={s.caveat}>
        Atribución de Klaviyo con su ventana de conversión. No se suma a Meta ni a las ventas de Shopify: son formas distintas de contar la misma venta.
      </p>
    </div>
  );
}
