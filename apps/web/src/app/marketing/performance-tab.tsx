"use client";


import { formatMoney } from "@/lib/money";
import { channelStyle } from "@/components/marketing-channel";
import {
  num,
  type ShopifyFirstParty,
  type KlaviyoAttribution,
  type MetaAttribution,
} from "@/hooks/use-attribution-report";
import {
  Badge,
  Banner,
  EmptyState,
  EYEBROW,
  List,
  LoadingBlock,
  Metric,
  Select,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui";
import { fmtDate } from "./format";

const PERIODS = [
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
];

const pct = (value: number | null | undefined) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;

/** Variación contra el mismo periodo anterior, cuando la fuente la da. */
function delta(current: number, previous: number | null | undefined) {
  if (previous == null || previous === 0) return undefined;
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(0)}% vs periodo anterior`;
}

function KlaviyoBlock({ report, currency }: { report: KlaviyoAttribution | null; currency?: string | null }) {
  const style = channelStyle("Email");
  if (!report?.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email · Klaviyo</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Klaviyo sin conectar"
            hint="Conecta la cuenta para ver qué atribuye el email."
          />
        </CardContent>
      </Card>
    );
  }
  const { totals, previous, campaigns } = report;
  const money = (value: number) => currency ? formatMoney(value, currency) : value.toLocaleString("es-ES", { maximumFractionDigits: 2 });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Email · Klaviyo</CardTitle>
        <CardDescription>{`Ingresos atribuidos por Klaviyo en su propia ventana de conversión. No es venta Shopify.${currency ? "" : " Moneda no disponible."}`}</CardDescription>
        <CardAction><span className={`h-5 w-1 ${style.fill}`} aria-hidden /></CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric
            card
            label="Ingresos atribuidos por Klaviyo"
            value={money(totals.revenue)}
            delta={delta(totals.revenue, previous?.revenue)}
          />
          <Metric
            card
            label="Conversiones atribuidas"
            value={totals.conversions.toLocaleString("es-ES")}
            delta={delta(totals.conversions, previous?.conversions)}
          />
          <Metric
            card
            size="sm"
            label="Apertura / clic"
            value={`${pct(totals.open_rate)} · ${pct(totals.click_rate)}`}
            hint={`${totals.delivered.toLocaleString("es-ES")} entregados`}
          />
        </div>

        {campaigns.length > 0 ? (
          <div className="mt-4">
            <p className={EYEBROW}>Campañas con más ingreso atribuido</p>
            <List as="ul" className="text-sm">
              {campaigns.slice(0, 5).map((campaign) => (
                <Item key={campaign.id} size="xs" className="flex-nowrap" render={<li />}>
                  <ItemContent>
                    <ItemTitle className="block truncate font-normal">{campaign.name}</ItemTitle>
                    {campaign.send_time ? (
                      <ItemDescription>{fmtDate(campaign.send_time)}</ItemDescription>
                    ) : null}
                  </ItemContent>
                  <ItemActions className="tabular-nums">
                    {money(campaign.revenue)}
                  </ItemActions>
                </Item>
              ))}
            </List>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function MetaBlock({ report }: { report: MetaAttribution | null }) {
  const style = channelStyle("Meta");
  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Meta Ads</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="Meta sin conectar"
            hint="Conecta la cuenta publicitaria para ver gasto y retorno."
          />
        </CardContent>
      </Card>
    );
  }
  const spend = num(report.acquisition.spend);
  const value = num(report.acquisition.purchase_value);
  const roas = report.acquisition.roas;
  const actionType = report.acquisition.purchase_action_types?.[0];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Meta Ads</CardTitle>
        <CardDescription>Valor atribuido por Meta en su ventana de atribución. Moneda no disponible; se muestran los importes tal como los informa Meta.</CardDescription>
        <CardAction><span className={`h-5 w-1 ${style.fill}`} aria-hidden /></CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric card label="Gasto" value={spend.toLocaleString("es-ES", { maximumFractionDigits: 2 })} />
          <Metric
            card
            label="Valor atribuido por Meta"
            value={value.toLocaleString("es-ES", { maximumFractionDigits: 2 })}
            hint={actionType ? "Compras según el evento configurado en Meta" : undefined}
          />
          <Metric
            card
            label="ROAS"
            value={roas == null ? "—" : num(roas).toFixed(2)}
            tone={roas != null && num(roas) < 1 ? "danger" : "default"}
            hint={
              roas != null && num(roas) < 1
                ? "Gasta más de lo que Meta le atribuye"
                : undefined
            }
          />
        </div>

        {report.campaigns.length > 0 ? (
          <div className="mt-4">
            <p className={EYEBROW}>Campañas por gasto</p>
            <List as="ul" className="text-sm">
              {report.campaigns.slice(0, 5).map((campaign) => (
                <Item key={campaign.campaign_id} size="xs" className="flex-nowrap" render={<li />}>
                  <ItemContent>
                    <ItemTitle className="block truncate font-normal">
                      {campaign.campaign_name ?? "(sin nombre)"}
                    </ItemTitle>
                  </ItemContent>
                  <ItemActions className="flex-nowrap gap-3 tabular-nums">
                    <span className="text-muted">
                      {num(campaign.spend).toLocaleString("es-ES", { maximumFractionDigits: 2 })}
                    </span>
                    <Badge
                      tone={
                        campaign.roas == null
                          ? "neutral"
                          : num(campaign.roas) >= 1
                            ? "success"
                            : "danger"
                      }
                    >
                      {campaign.roas == null
                        ? "sin ROAS"
                        : `${num(campaign.roas).toFixed(2)}x`}
                    </Badge>
                  </ItemActions>
                </Item>
              ))}
            </List>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Rendimiento: el ultimo tramo del hilo (campaña -> pieza -> resultado).
 *
 * Antes solo sabia de Klaviyo, y ademas por el endpoint mas pobre de los dos
 * que existian: una lista de campañas sin comparacion contra el periodo
 * anterior ni tasas. Ahora estan las tres fuentes, y estan SEPARADAS por
 * contrato (ADR-0021): Klaviyo y Meta atribuyen cada uno por su cuenta y la
 * misma venta puede salir en los dos, asi que sumarlas da una cifra que no
 * existe. La venta de Shopify va al lado como lo unico first-party.
 */
export function PerformanceTab({
  days,
  onDaysChange,
  klaviyo,
  klaviyoCurrency,
  meta,
  shopify,
  isLoading,
}: {
  days: string;
  onDaysChange: (value: string) => void;
  klaviyo: KlaviyoAttribution | null;
  klaviyoCurrency?: string | null;
  meta: MetaAttribution | null;
  shopify: ShopifyFirstParty;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          className="w-56"
          aria-label="Periodo del informe"
          value={days}
          onChange={onDaysChange}
          options={PERIODS}
        />
        {shopify ? (
          <p className="text-sm text-muted">
            Venta Shopify del periodo:{" "}
            <strong className="text-ink">
              {shopify.currency_code
                ? formatMoney(shopify.sales.net_sales, shopify.currency_code)
                : "Moneda no informada"}
            </strong>{" "}
            en {shopify.sales.orders_count.toLocaleString("es-ES")} pedidos
          </p>
        ) : null}
      </div>

      <Banner tone="warn" className="text-sm">
        Las cifras de Klaviyo y de Meta son <strong>atribuidas</strong>, cada
        una en la ventana de su plataforma: la misma venta puede aparecer en las
        dos. No se suman entre sí ni con las ventas registradas en Shopify.
      </Banner>

      {isLoading ? (
        <LoadingBlock label="Cargando el rendimiento del periodo…" />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          <KlaviyoBlock report={klaviyo} currency={klaviyoCurrency} />
          <MetaBlock report={meta} />
        </div>
      )}
    </div>
  );
}
