"use client";

import { useCachedQuery } from "@/lib/use-cached-query";
import { Badge, Card, LoadingBlock, ProgressBar, type Tone } from "@/components/ui";

/**
 * Dónde está hoy cada objetivo. Compara con los últimos 30 días, el mismo dato
 * que ya pinta Inicio, así que solo tiene sentido para objetivos mensuales o
 * para cifras que no se acumulan (margen, ticket medio, CAC, ROAS): un objetivo
 * trimestral de ingresos no se puede medir contra 30 días.
 */

export type ObjectiveTarget = {
  id: string;
  metric_key: string;
  target_value: number;
  period: string;
};

type ShopifyMetrics = {
  financial_currency_coverage?: { status?: string };
  sales: { orders_count: number };
  financial: {
    net_revenue_ex_tax: number;
    net_profit: number;
    net_margin_pct: number;
    aov_ex_tax: number;
    cac_blended: number | null;
  };
  funnel?: { conversion_rate_own: number | null } | null;
};

type MetaMetrics = { acquisition?: { roas: number | null } };

type Reading = {
  value: number | null;
  /** Se acumula en el periodo: solo comparable con un objetivo mensual. */
  cumulative: boolean;
  /** Menos es mejor (CAC). */
  lowerIsBetter?: boolean;
  /** Importe en moneda: exige que la cobertura de moneda sea compatible. */
  money?: boolean;
};

function readingFor(
  key: string,
  shopify: ShopifyMetrics,
  meta: MetaMetrics | null,
): Reading {
  const f = shopify.financial;
  switch (key) {
    case "net_revenue_ex_tax":
      return { value: f.net_revenue_ex_tax, cumulative: true, money: true };
    case "net_profit":
      return { value: f.net_profit, cumulative: true, money: true };
    case "net_margin_pct":
      return { value: f.net_margin_pct, cumulative: false };
    case "aov_ex_tax":
      return { value: f.aov_ex_tax, cumulative: false, money: true };
    case "orders_count":
      return { value: shopify.sales.orders_count, cumulative: true };
    case "conversion_rate":
      return { value: shopify.funnel?.conversion_rate_own ?? null, cumulative: false };
    case "cac_blended":
      return { value: f.cac_blended, cumulative: false, lowerIsBetter: true, money: true };
    case "roas":
      return { value: meta?.acquisition?.roas ?? null, cumulative: false };
    default:
      return { value: null, cumulative: false };
  }
}

export function formatMetric(key: string, value: number) {
  const unit =
    ["net_margin_pct", "conversion_rate", "recurrence_pct", "email_attributed_pct"].includes(key)
      ? "pct"
      : ["net_revenue_ex_tax", "net_profit", "aov_ex_tax", "cac_blended"].includes(key)
        ? "eur"
        : "num";
  const number = new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: unit === "num" && Number.isInteger(value) ? 0 : 2,
  }).format(value);
  return unit === "pct" ? `${number} %` : unit === "eur" ? `${number} €` : number;
}

const PERIOD: Record<string, string> = {
  monthly: "al mes",
  quarterly: "al trimestre",
  yearly: "al año",
};

export function ObjectivesProgress({
  organizationId,
  targets,
  labelFor,
}: {
  organizationId: string;
  targets: ObjectiveTarget[];
  labelFor: (key: string) => string;
}) {
  const base = `/v1/organizations/${organizationId}`;
  const shopify = useCachedQuery<ShopifyMetrics>(`${base}/shopify/metrics?days=30`);
  const meta = useCachedQuery<MetaMetrics>(`${base}/meta/metrics?days=30`);

  if (targets.length === 0) return null;

  return (
    <Card
      title="Cómo vas"
      description="Últimos 30 días frente a cada objetivo."
    >
      {!shopify.data && !shopify.error ? (
        <LoadingBlock label="Calculando..." />
      ) : (
        <ul className="divide-y divide-separator">
          {targets.map((target) => {
            const reading = shopify.data
              ? readingFor(target.metric_key, shopify.data, meta.data ?? null)
              : { value: null, cumulative: false };
            const currencyOk =
              !reading.money ||
              shopify.data?.financial_currency_coverage?.status === "compatible";
            const comparable =
              reading.value !== null &&
              currencyOk &&
              (!reading.cumulative || target.period === "monthly");
            const goal = Number(target.target_value);
            const value = reading.value ?? 0;
            const met = reading.lowerIsBetter ? value <= goal : value >= goal;
            // Para "menos es mejor" la barra mide qué tan dentro del tope estás.
            const progress = !comparable || goal <= 0
              ? 0
              : reading.lowerIsBetter
                ? Math.min(100, (goal / Math.max(value, 0.0001)) * 100)
                : Math.min(100, (value / goal) * 100);
            const status: { label: string; tone: Tone } = !comparable
              ? { label: "Sin dato comparable", tone: "neutral" }
              : met
                ? { label: "Cumplido", tone: "success" }
                : progress >= 70
                  ? { label: "Cerca", tone: "warn" }
                  : { label: "Por debajo", tone: "danger" };

            return (
              <li key={target.id} className="grid gap-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                  <p className="text-sm font-medium">{labelFor(target.metric_key)}</p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm">
                      {comparable ? `${formatMetric(target.metric_key, value)} / ` : ""}
                      {formatMetric(target.metric_key, goal)}{" "}
                      {PERIOD[target.period] ?? target.period}
                    </span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                </div>
                {comparable ? (
                  <ProgressBar
                    value={progress}
                    aria-label={`Progreso de ${labelFor(target.metric_key)}`}
                  >
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
