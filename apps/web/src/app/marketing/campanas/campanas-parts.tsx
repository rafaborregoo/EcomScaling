"use client";

import { buttonVariants } from "@/components/ui/button";
import { Banner as SharedBanner } from "@/components/ui/banner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type ReactNode } from "react";
import { cx, type Tone } from "./campaign-format";
import s from "./campanas.module.css";

/**
 * Piezas compartidas por todas las pantallas de Campañas (cartera, cliente,
 * tienda, campaña abierta y vista del cliente). Misma gramática visual que el
 * panel: hero oscuro, tira de KPIs pegados, paneles blancos, un único acento.
 * El contenido usa directamente el marco común de la página.
 */

export { s as css };

export function Stage({ children }: { client?: boolean; children: ReactNode }) {
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Barra de alcance
// ---------------------------------------------------------------------------

/**
 * Sin migas ni pestañas: subir de nivel es cosa de los selectores de cliente y
 * tienda del shell. Solo queda el botón de volver cuando la pantalla lo pide.
 */
export function ScopeBar({ right }: { right?: ReactNode }) {
  return right ? <div className={s.ctl}>{right}</div> : null;
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export function Hero({
  id,
  meta,
  title,
  lines,
  actions,
  side,
}: {
  id: string;
  meta: ReactNode[];
  title: string;
  lines: ReactNode[];
  actions: ReactNode;
  side: ReactNode;
}) {
  return (
    <section className={s.hero} aria-labelledby={id}>
      <div className={s.heroTop}>
        <div>
          <h1 id={id} className={s.headline}>
            {title}
          </h1>
          <p className={s.meta}>
            {meta.map((item, index) => (
              <span key={index}>{item}</span>
            ))}
          </p>
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

export function IaTag({ code = "A05" }: { code?: string }) {
  return <span className={s.ia}>{code}</span>;
}

export type CounterItem = { n: number; label: string; hot?: boolean; onPick?: () => void };

/** Contadores del hero. Con `onPick` filtran lo de debajo; sin él son solo lectura. */
export function Counters({ items }: { items: CounterItem[] }) {
  return (
    <div className={s.counters}>
      {items.map((item) =>
        item.onPick ? (
          <button key={item.label} type="button" className={cx(s.counter, item.hot && item.n > 0 && s.hot)} onClick={item.onPick}>
            <b>{item.n}</b>
            <span>{item.label}</span>
          </button>
        ) : (
          <div key={item.label} className={cx(s.counter, item.hot && item.n > 0 && s.hot)} style={{ cursor: "default" }}>
            <b>{item.n}</b>
            <span>{item.label}</span>
          </div>
        ),
      )}
    </div>
  );
}

export type StepItem = { title: string; sub: string; state: "ok" | "now" | "" };

/** «Dónde está esta campaña»: los pasos desde que nace hasta que sale. */
export function Steps({ title, steps }: { title: string; steps: StepItem[] }) {
  return (
    <div className={s.nextBox}>
      <h3>{title}</h3>
      {steps.map((step, index) => (
        <div key={step.title} className={cx(s.step, step.state === "ok" && s.ok, step.state === "now" && s.now)} style={{ color: "var(--hero-ink)" }}>
          <i>{step.state === "ok" ? "✓" : index + 1}</i>
          <div>
            {step.title}
            <span style={{ color: "var(--hero-muted)" }}>{step.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPIs
// ---------------------------------------------------------------------------

export type KpiItem = { label: string; value: ReactNode; foot: ReactNode };

export function Kpis({ items, label }: { items: KpiItem[]; label: string }) {
  return (
    <div className={s.kpis} aria-label={label} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
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

// ---------------------------------------------------------------------------
// Secciones, paneles y marcas
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
    <section className={s.sec} id={id} aria-labelledby={`${id}-h`}>
      <div className={s.secH}>
        <div className={s.secT}>
          <h2 id={`${id}-h`}>{title}</h2>
          {lead ? <p>{lead}</p> : null}
        </div>
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
  title?: string;
  sub?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={s.panel}>
      {title ? (
        <div className={s.panelH}>
          <div>
            <h3>{title}</h3>
            {sub ? <p className={s.sub}>{sub}</p> : null}
          </div>
          {aside}
        </div>
      ) : null}
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
    // Más de 4 opciones: sueltas para que salten de línea en móvil.
    <ToggleGroup aria-label={label} spacing={options.length > 4 ? 1.5 : 0} value={value} onValueChange={onChange}>
      {options.map((option) => (
        <ToggleGroupItem key={option.key} value={option.key}>
          {option.label}
          {option.count !== undefined ? <span className="text-xs text-muted tabular-nums">{option.count}</span> : null}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function Chip({ tone, children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx(s.chip, tone && s[tone])}>{children}</span>;
}

/** Marca de origen: lo creó el cliente. */
export function Who({ children = "Creada por el cliente", cli }: { children?: ReactNode; cli?: boolean }) {
  return <span className={cx(s.who, cli && s.cli)}>{children}</span>;
}

export function Btn({
  variant,
  size,
  icon,
  className,
  ...props
}: {
  variant?: "acc" | "ghost" | "danger" | "dangerSolid";
  size?: "sm";
  icon?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={buttonVariants({
        // Vocabulario antiguo de campañas -> botón único (primario/secundario morado).
        variant: variant === "acc" ? "default" : variant === "ghost" ? "secondary" : variant ? "destructive" : "default",
        size: icon ? "icon-sm" : size,
        className,
      })}
    />
  );
}

/** Aviso de campañas sobre el Banner compartido: confirmación (por defecto) o información. */
export function Banner({ children, onClose, info }: { children: ReactNode; onClose?: () => void; info?: boolean }) {
  return (
    <SharedBanner
      tone={info ? "info" : "success"}
      action={onClose ? <Btn size="sm" variant="ghost" onClick={onClose}>Cerrar</Btn> : null}
    >
      {children}
    </SharedBanner>
  );
}

export function MonthNav({
  label,
  onPrev,
  onNext,
  onToday,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <div className={s.mnav}>
      <Btn variant="ghost" icon aria-label="Mes anterior" onClick={onPrev}>
        <svg className={s.ic} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </Btn>
      <strong aria-live="polite">{label}</strong>
      <Btn variant="ghost" icon aria-label="Mes siguiente" onClick={onNext}>
        <svg className={s.ic} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Btn>
      <Btn variant="ghost" size="sm" onClick={onToday}>
        Hoy
      </Btn>
    </div>
  );
}
