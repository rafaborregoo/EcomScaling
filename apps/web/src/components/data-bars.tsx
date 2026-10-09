import type { CSSProperties, ReactNode } from "react";
import s from "./data-bars.module.css";

/**
 * Barras de datos compartidas por el panel del cliente y el del consultor.
 *
 * `Waterfall` es la cascada de ventas a beneficio; `BarRows` es cualquier lista
 * de "nombre, barra proporcional, cifra" (embudo, productos, atribución). Las
 * dos reciben el texto ya formateado: no saben de moneda ni de idioma, solo de
 * proporciones.
 */

export type WaterfallRow = {
  key: string;
  label: string;
  hint?: string;
  /** Con signo: los costes son negativos. */
  value: number;
  kind: "total" | "cost" | "profit";
  /** Cifra ya formateada. */
  display: string;
  /** Porcentaje ya formateado; sin él la columna queda vacía. */
  share?: string;
  /** Color de relleno propio (p. ej. publicidad). */
  color?: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const pct = (value: number) => `${(value * 100).toFixed(3)}%`;

export function Waterfall({
  rows,
  ariaLabel,
}: {
  rows: WaterfallRow[];
  ariaLabel: string;
}) {
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  // Cada coste cuelga del nivel que dejó el anterior; los totales reinician.
  const levels: number[] = [];
  rows.forEach((row, i) =>
    levels.push(row.kind === "cost" ? (levels[i - 1] ?? 0) + row.value : row.value),
  );

  return (
    <div className={cx(s.root, s.wf)} role="group" aria-label={ariaLabel}>
      {rows.map((row, i) => {
        const startsAt =
          row.kind === "cost"
            ? Math.min(levels[i - 1] ?? 0, levels[i])
            : Math.min(0, row.value);
        const left = Math.max(startsAt, 0) / max;
        const width = Math.abs(row.value) / max;
        const loss = row.kind === "profit" && row.value < 0;
        const style: CSSProperties = {
          left: pct(left),
          width: pct(width),
          ...(row.color ? { background: row.color } : null),
        };
        // El hilo baja desde el final del escalón anterior hasta este.
        const linkAt = i > 0 ? Math.max(levels[i - 1] ?? 0, 0) / max : null;

        return (
          <div
            key={row.key}
            role="img"
            aria-label={`${row.label}: ${row.display}${row.share ? `, ${row.share}` : ""}`}
            className={cx(
              s.wfRow,
              row.kind === "total" && s.total,
              row.kind === "profit" && s.profit,
              loss && s.loss,
            )}
          >
            <div className={s.wfLabel}>
              {row.label}
              {row.hint ? <small>{row.hint}</small> : null}
            </div>
            <div className={s.wfTrack}>
              {linkAt !== null ? (
                <span className={s.wfLink} style={{ left: pct(linkAt) }} aria-hidden="true" />
              ) : null}
              <span className={s.wfBar} style={style} />
            </div>
            <div className={s.wfValue}>{row.display}</div>
            <div className={s.wfShare}>{row.share ?? ""}</div>
          </div>
        );
      })}
    </div>
  );
}

export type BarRow = {
  key: string;
  label: ReactNode;
  /** Línea pequeña bajo el nombre (variante en línea). */
  hint?: ReactNode;
  /** Longitud de la barra, en la misma escala que `max`. */
  value: number;
  /** Cifra ya formateada. */
  display: ReactNode;
  /** Dato secundario en gris junto a la cifra (un porcentaje, p. ej.). */
  share?: ReactNode;
  /** Color de relleno propio. */
  color?: string;
  /** Posición de una marca (objetivo, equilibrio) en la misma escala. */
  marker?: number;
  markerTitle?: string;
  /** Barra hueca: una cifra que no se puede sumar (atribución cruzada). */
  dashed?: boolean;
  /** Nota al pie de la barra (variante apilada). */
  sub?: ReactNode;
  title?: string;
};

export function BarRows({
  rows,
  max,
  variant = "inline",
  size = "md",
  ariaLabel,
}: {
  rows: BarRow[];
  /** Escala común; por defecto, la mayor de las filas. */
  max?: number;
  /** `inline`: nombre | barra | cifra. `stack`: nombre y cifra arriba, barra debajo. */
  variant?: "inline" | "stack";
  size?: "md" | "sm";
  ariaLabel?: string;
}) {
  const scale = max ?? Math.max(...rows.map((row) => row.value), 1);

  return (
    <div
      className={cx(s.root, s.rows, size === "sm" && s.rowsSm)}
      role={ariaLabel ? "group" : undefined}
      aria-label={ariaLabel}
    >
      {rows.map((row) => {
        const ratio = scale > 0 ? Math.min(Math.max(row.value / scale, 0), 1) : 0;
        const track = (
          <div className={cx(s.track, row.dashed && s.dashed)} aria-hidden="true">
            <span
              className={s.fill}
              style={{
                width: pct(ratio),
                ...(row.color ? { background: row.color } : null),
              }}
            />
            {row.marker !== undefined ? (
              <span
                className={s.marker}
                style={{ left: pct(Math.min(Math.max(row.marker / scale, 0), 1)) }}
                title={row.markerTitle}
              />
            ) : null}
          </div>
        );
        const value = (
          <div className={s.value}>
            {row.display}
            {row.share ? <small>{row.share}</small> : null}
          </div>
        );

        return variant === "stack" ? (
          <div key={row.key} className={s.stack} title={row.title}>
            <div className={s.name}>{row.label}</div>
            {value}
            {track}
            {row.sub ? <div className={s.sub}>{row.sub}</div> : null}
          </div>
        ) : (
          <div key={row.key} className={s.row} title={row.title}>
            <div className={s.name}>
              {row.label}
              {row.hint ? <small>{row.hint}</small> : null}
            </div>
            {track}
            {value}
          </div>
        );
      })}
    </div>
  );
}
