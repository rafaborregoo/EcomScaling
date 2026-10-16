"use client";

import { type ReactNode } from "react";
import {
  panelMoney,
  panelNumber,
  panelPct,
  type ProfitFlag,
  type ProfitTier,
} from "@e-nora/contracts";
import { monthLabel, monthlyChartScale } from "./panel-view-model";
import s from "./panel.module.css";

/**
 * Piezas compartidas por los tres alcances del panel (cartera, cliente,
 * tienda). Misma gramática visual que /dashboard: hero grafito, tira de KPIs
 * pegados, paneles blancos, mandarina como único acento.
 */

export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export const PERIODS = [
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 365, label: "1 año" },
] as const;

export const TIER_CLASS: Record<ProfitTier, string> = {
  pierde: s.tPierde ?? "",
  datos: s.tDatos ?? "",
  bajo: s.tBajo ?? "",
  ok: s.tOk ?? "",
};

export const TIER_LABEL: Record<ProfitTier, string> = {
  pierde: "Pierde dinero",
  datos: "Datos no fiables",
  bajo: "Bajo objetivo",
  ok: "En objetivo",
};

// ---------------------------------------------------------------------------
// Barra de alcance
// ---------------------------------------------------------------------------

/**
 * Sin migas: subir de nivel es cosa de los selectores de cliente y tienda del
 * shell. Solo queda el periodo, que cambia las cifras de todo el panel.
 */
export function ScopeBar({ days, onDays }: { days: number; onDays: (days: number) => void }) {
  return (
    <header className={s.top}>
      <span className={s.scopeTitle}>Rentabilidad · comparar periodos</span>
      <div className={s.ctl}>
        <div className={s.seg} role="group" aria-label="Periodo">
          {PERIODS.map((period) => (
            <button
              key={period.days}
              type="button"
              aria-pressed={days === period.days}
              onClick={() => onDays(period.days)}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export function Hero({
  id,
  tier,
  meta,
  title,
  lines,
  actions,
  side,
}: {
  id: string;
  tier?: ProfitTier;
  meta: ReactNode;
  title: string;
  lines: ReactNode[];
  actions: ReactNode;
  side: ReactNode;
}) {
  return (
    <section className={cx(s.hero, tier && TIER_CLASS[tier])} aria-labelledby={id}>
      <div className={s.heroTop}>
        <div>
          <h1 id={id} className={s.headline}>
            {title}
          </h1>
          <p className={s.meta}>{meta}</p>
          {lines.map((line, index) => (
            <p key={index} className={s.detail}>
              {line}
            </p>
          ))}
          <div className={s.actions}>{actions}</div>
        </div>
        {side}
      </div>
    </section>
  );
}

/** Lectura IA (A02, alcance del consultor) bajo el titular. */
export function AiLine({
  text,
  generatedAt,
  stale,
}: {
  text: string;
  generatedAt: string | null;
  stale?: boolean | undefined;
}) {
  return (
    <>
      <span className={s.ia}>A02</span>
      {text}
      {generatedAt ? (
        <span className={s.mut}>
          {" "}
          · {stale ? "lectura antigua, " : ""}
          {new Date(generatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
        </span>
      ) : null}
    </>
  );
}

export function IaTag() {
  return <span className={s.ia}>A02</span>;
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export type KpiItem = { label: string; value: ReactNode; foot: ReactNode };

export function Kpis({ items, label }: { items: KpiItem[]; label: string }) {
  return (
    <div className={s.kpis} aria-label={label}>
      {items.map((item) => (
        <div key={item.label} className={s.kpi}>
          <p className={s.kpiL}>{item.label}</p>
          <p className={s.kpiV}>{item.value}</p>
          <p className={s.kpiD}>{item.foot}</p>
        </div>
      ))}
    </div>
  );
}

/** Variación porcentual. Sin base de comparación no se pinta nada. */
export function Delta({
  value,
  suffix,
}: {
  value: number | null | undefined;
  suffix?: string;
}) {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return (
    <>
      <span className={cx(s.dl, up ? s.up : s.down)}>
        {up ? "▲" : "▼"} {panelPct(Math.abs(value))}
      </span>
      {suffix ? <span>{suffix}</span> : null}
    </>
  );
}

export function Chip({
  tone,
  children,
}: {
  tone?: "good" | "warn" | "bad" | "acc";
  children: ReactNode;
}) {
  return <span className={cx(s.chip, tone && s[tone])}>{children}</span>;
}

export function FlagChips({ flags }: { flags: ProfitFlag[] }) {
  if (flags.length === 0) return <Chip tone="good">Completo</Chip>;
  return (
    <>
      {flags.map((flag) => (
        <Chip key={flag.key} tone={flag.blocking ? "warn" : undefined}>
          {flag.label}
        </Chip>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------------

export function Section({
  id,
  title,
  lead,
  action,
  children,
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={s.sec} aria-labelledby={id}>
      <div className={s.secH}>
        <h2 id={id}>{title}</h2>
        <p>{lead}</p>
        {action ?? <span />}
      </div>
      {children}
    </section>
  );
}

export function Panel({
  title,
  sub,
  aside,
  children,
}: {
  title: string;
  sub?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={s.panel}>
      <div className={s.panelH}>
        <div>
          <h3>{title}</h3>
          {sub ? <p className={s.sub}>{sub}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ key: T; label: string; count?: number }>;
  onChange: (key: T) => void;
}) {
  return (
    <div className={s.seg} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
        >
          {option.label}
          {option.count !== undefined ? <b>{option.count}</b> : null}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gráficos
// ---------------------------------------------------------------------------

const CHART_HEIGHT = 190;

export function MonthlyChart({
  months,
  label,
  currency,
}: {
  months: Array<{ month: string; revenue: number; profit: number }>;
  label: string;
  currency: string | null;
}) {
  const max = Math.max(1, ...months.map((month) => month.revenue));
  const ceiling = max * 1.1;
  const scale = monthlyChartScale(max, currency);
  const fmt = (value: number) => panelNumber(value / scale.divisor, scale.digits);
  return (
    <>
      <p className={s.chartUnit}>{scale.label}</p>
      <div className={s.mb} role="group" aria-label={`${label}. ${scale.label}`}>
        {months.map((month, index) => (
          <div key={month.month} className={s.mbCol} role="img" aria-label={`${monthLabel(month.month)}: ingresos ${panelMoney(month.revenue, currency)}, beneficio ${panelMoney(month.profit, currency)}`}>
            <span className={s.mbM}>{fmt(month.revenue)}</span>
            <div
              className={cx(s.mbBar, index === months.length - 1 && s.last)}
              style={{ height: Math.max(2, Math.round((month.revenue / ceiling) * CHART_HEIGHT)) }}
            >
              <i style={{ height: Math.max(0, Math.round((month.profit / ceiling) * CHART_HEIGHT)) }} />
            </div>
            <span className={s.mbL}>{monthLabel(month.month)}</span>
            <span className={s.mbM}>
              {month.revenue > 0 ? panelPct((month.profit / month.revenue) * 100) : "—"}
            </span>
          </div>
        ))}
      </div>
      <div className={s.key}>
        <span>
          <i className={s.swRev} />
          Ingresos
        </span>
        <span>
          <i className={s.cProfit} />
          Beneficio
        </span>
        <span className={s.mut}>Bajo cada mes: margen neto</span>
      </div>
    </>
  );
}

export type CostParts = { cogs: number; shipping: number; fees: number; ads: number; fixed: number };

/** A dónde va cada euro facturado: costes de mayor a menor y, al final, el beneficio. */
export function CostStack({
  costs,
  revenue,
  profit,
  currency,
  profitTone,
}: {
  costs: CostParts;
  revenue: number;
  profit: number;
  currency: string | null;
  profitTone?: "est";
}) {
  const parts = [
    { key: "cogs", label: "Producto", amount: costs.cogs, cls: s.cProd },
    { key: "ads", label: "Publicidad", amount: costs.ads, cls: s.cAds },
    { key: "fixed", label: "Gastos fijos", amount: costs.fixed, cls: s.cFix },
    { key: "shipping", label: "Envíos", amount: costs.shipping, cls: s.cShip },
    { key: "fees", label: "Comisiones de pago", amount: costs.fees, cls: s.cFees },
  ]
    .filter((part) => part.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const share = (amount: number) => (revenue > 0 ? (amount / revenue) * 100 : 0);
  const alt = [...parts.map((part) => `${part.label} ${panelPct(share(part.amount))}`), `beneficio ${panelPct(share(profit))}`].join(", ");

  return (
    <>
      <div className={s.stk} role="img" aria-label={alt}>
        {parts.map((part) => (
          <i key={part.key} className={part.cls} style={{ width: `${share(part.amount)}%` }} />
        ))}
        {profit > 0 ? <i className={s.cProfit} style={{ width: `${share(profit)}%` }} /> : null}
      </div>
      <div className={s.lg}>
        {parts.map((part) => (
          <div key={part.key} className={s.lgR}>
            <i className={part.cls} />
            <span>{part.label}</span>
            <b>{panelMoney(part.amount, currency)}</b>
            <span className={s.cap}>{panelPct(share(part.amount))}</span>
          </div>
        ))}
        <div className={s.lgR}>
          <i className={s.cProfit} />
          <span>
            <strong>Beneficio neto</strong>
          </span>
          <b className={profit < 0 ? s.neg : profitTone === "est" ? s.est : s.pos}>
            {panelMoney(profit, currency)}
          </b>
          <span className={s.cap}>{panelPct(share(profit))}</span>
        </div>
      </div>
    </>
  );
}

/** Línea de ventas diarias de una tarjeta de tienda. */
export function Spark({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 300;
      const y = 40 - ((value - min) / span) * 34;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg className={s.spark} viewBox="0 0 300 44" preserveAspectRatio="none" role="img" aria-label={label}>
      <path d={path} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Barra con marca (margen / CAC contra su objetivo)
// ---------------------------------------------------------------------------

export function GoalBar({
  value,
  goal,
  tone,
  text,
  goalText,
}: {
  value: number;
  goal: number | null;
  tone: "ok" | "low" | "bad" | "est";
  text: string;
  goalText: string;
}) {
  const scale = Math.max(Math.abs(value), goal ?? 0) * 1.3 || 1;
  return (
    <div className={cx(s.gb, s[tone])}>
      <span className={s.gbT} aria-hidden="true">
        <i style={{ width: `${(Math.max(0, value) / scale) * 100}%` }} />
        {goal !== null ? <b style={{ left: `${(goal / scale) * 100}%` }} /> : null}
      </span>
      <span>
        <span className={s.gbV}>{text}</span>
        <span className={s.gbO}> {goalText}</span>
      </span>
    </div>
  );
}
