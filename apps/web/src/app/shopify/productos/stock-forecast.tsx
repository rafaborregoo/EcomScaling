"use client";

import s from "./stock-forecast.module.css";
import { fmtNum } from "../../dashboard/client-pulse-model";
import { forecastStockDemand, type StockDemandForecast } from "@e-nora/contracts";

type WeeklyValue = number | { units_ordered: number };

const qualityLabel: Record<StockDemandForecast["quality"], string> = {
  strong: "Señal consistente",
  medium: "Señal moderada",
  limited: "Señal limitada",
  none: "Sin historial suficiente",
};

const riskLabel: Record<StockDemandForecast["risk"], string> = {
  high: "Riesgo alto",
  watch: "Vigilar",
  covered: "Cobertura actual",
  unknown: "Stock sin seguimiento",
  no_demand: "Sin demanda observada",
};

export function StockForecastCard({
  history,
  available,
  tracked,
  compact = false,
}: {
  history: WeeklyValue[] | null | undefined;
  available: number | null;
  tracked: boolean;
  compact?: boolean;
}) {
  const weeklyUnits = (history ?? []).map((week) => typeof week === "number" ? week : week.units_ordered);
  const result = forecastStockDemand(weeklyUnits, available, tracked);
  const tone = result.risk === "high" ? s.high : result.risk === "watch" ? s.watch : result.risk === "covered" ? s.covered : "";

  if (compact) {
    return (
      <div className={`${s.compact} ${tone}`} aria-label="Previsión de demanda y cobertura de stock">
        <span className={s.compactLabel}>Demanda estimada · 30 d</span>
        <strong>{result.forecast30d == null ? "Sin señal" : `≈ ${fmtNum(result.forecast30d)} uds.`}</strong>
        <span>{result.coverageDays == null ? riskLabel[result.risk] : `${fmtNum(result.coverageDays, 0)} días de cobertura`}</span>
      </div>
    );
  }

  return (
    <section className={s.card} aria-labelledby="stock-forecast-title">
      <div className={s.header}>
        <div>
          <p className={s.eyebrow}>Agente de inventario</p>
          <h2 id="stock-forecast-title">Demanda prevista y cobertura</h2>
        </div>
        <span className={`${s.badge} ${tone}`}>{riskLabel[result.risk]}</span>
      </div>
      <div className={s.metrics}>
        <div className={s.metric}>
          <span>Demanda estimada · 30 días</span>
          <strong>{result.forecast30d == null ? "—" : `${fmtNum(result.forecast30d)} uds.`}</strong>
        </div>
        <div className={s.metric}>
          <span>Stock disponible</span>
          <strong>{tracked && available != null ? `${fmtNum(available)} uds.` : "Sin dato fiable"}</strong>
        </div>
        <div className={s.metric}>
          <span>Cobertura al ritmo previsto</span>
          <strong>{result.coverageDays == null ? "—" : `${fmtNum(result.coverageDays, 0)} días`}</strong>
        </div>
      </div>
      <div className={s.footer}>
        <span>{qualityLabel[result.quality]} · {result.weeks} semanas observadas ({result.sellingWeeks} con ventas)</span>
        {result.trend != null ? <span className={result.trend < -0.05 ? s.down : result.trend > 0.05 ? s.up : ""}>{result.trend > 0 ? "+" : ""}{fmtNum(result.trend * 100, 0)} % de tendencia</span> : null}
      </div>
      <p className={s.note}>
        Estimación basada en ventas semanales recientes, ponderadas por actualidad. La cobertura de 7/14 días es una señal operativa; no calcula pedido de reposición sin plazo de proveedor ni stock de seguridad configurados. No incorpora promociones ni estacionalidad anual.
      </p>
    </section>
  );
}
