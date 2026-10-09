/**
 * Ruta económica mes a mes del Camino: lo que el cliente ve cada mes que sigue
 * el plan (objetivo del mes, cuánto sube sobre hoy, por qué y qué hitos lo
 * mueven). Sin esto el Camino parece una sola cifra a siete meses y no se nota
 * la ayuda que recibe mes a mes.
 */

export type MonthlyTarget = { month: number; target_value: number | null; rationale: string; seasonal_baseline?: number | null };
export type RouteMilestone = { name: string; date: string | null };

function calendarMonth(startDate: string, month: number) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  if (!Number.isFinite(start)) return null;
  const date = new Date(start);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + month - 1, 1));
}

const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

/** Hitos del mes natural que usa la revisión del objetivo del Camino. */
export function milestonesInMonth(startDate: string, month: number, milestones: RouteMilestone[]): RouteMilestone[] {
  const period = calendarMonth(startDate, month);
  if (!period) return [];
  const from = period.getTime();
  const to = new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 1)).getTime();
  return milestones.filter((milestone) => {
    const at = milestone.date ? Date.parse(`${milestone.date.slice(0, 10)}T00:00:00Z`) : NaN;
    return Number.isFinite(at) && at >= from && at < to;
  });
}

export function MonthlyRoute({
  targets,
  baseline,
  baselineLabel,
  format,
  startDate,
  endDate,
  milestones,
  goalTarget,
}: {
  targets: MonthlyTarget[];
  baseline: number | null;
  baselineLabel?: string;
  format: (value: number) => string;
  startDate: string;
  endDate?: string;
  milestones: RouteMilestone[];
  goalTarget: number | null;
}) {
  const max = Math.max(1, ...targets.map((target) => target.target_value ?? 0), baseline ?? 0);
  const startDay = Date.parse(`${startDate}T00:00:00Z`);
  return (
    <section className="space-y-3" aria-label="Ruta económica mes a mes">
      <div>
        <h3 className="text-sm font-semibold">Ruta económica mes a mes</h3>
      </div>
      {baseline !== null ? (
        <p className="text-xs text-muted">
          Punto de partida: <strong className="text-foreground">{format(baseline)}</strong> al mes{baselineLabel ? ` (${baselineLabel})` : ""}.
        </p>
      ) : null}
      <ol className="space-y-2">
        {targets.map((target) => {
          const value = target.target_value;
          const period = calendarMonth(startDate, target.month);
          const isFirstPartial = target.month === 1 && Number.isFinite(startDay) && new Date(startDay).getUTCDate() !== 1;
          const endDay = endDate ? Date.parse(`${endDate}T00:00:00Z`) : NaN;
          const isLastPartial = period && Number.isFinite(endDay)
            && new Date(endDay).getUTCFullYear() === period.getUTCFullYear()
            && new Date(endDay).getUTCMonth() === period.getUTCMonth()
            && new Date(endDay).getUTCDate() < new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth() + 1, 0)).getUTCDate();
          const isPartial = isFirstPartial || isLastPartial;
          const change = value !== null && baseline && !isPartial ? Math.round((value / baseline - 1) * 100) : null;
          const seasonalChange = value !== null && target.seasonal_baseline && !isPartial
            ? Math.round((value / target.seasonal_baseline - 1) * 100) : null;
          const inMonth = milestonesInMonth(startDate, target.month, milestones);
          const isGoal = goalTarget !== null && value === goalTarget;
          return (
            <li key={target.month} className="rounded-lg border border-separator bg-surface p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <strong>
                  Mes {target.month}
                  {period ? <span className="font-normal text-muted"> · {monthLabel.format(period)}</span> : null}
                  {isPartial ? <span className="ml-2 text-xs font-medium text-muted">Tramo parcial</span> : null}
                </strong>
                <span className="flex items-center gap-2">
                  {isGoal ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[0.7rem] font-semibold text-accent">Meta del Camino</span> : null}
                  <strong>{value === null ? "pendiente de medir" : format(value)}</strong>
                  {change !== null ? (
                    <span className={change >= 0 ? "text-xs text-success" : "text-xs text-danger"}>
                      {change >= 0 ? "+" : ""}
                      {change} % vs. ritmo reciente
                    </span>
                  ) : null}
                </span>
              </div>
              {value !== null ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-default" aria-hidden="true">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(2, Math.round((value / max) * 100))}%` }} />
                </div>
              ) : null}
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer font-medium">Ver estrategia del mes</summary>
                <div className="mt-2 space-y-1 text-muted">
                  <p>{target.rationale}</p>
                  {seasonalChange !== null ? (
                    <p>Mismo mes anterior: {format(target.seasonal_baseline!)} · {seasonalChange >= 0 ? "+" : ""}{seasonalChange} %.</p>
                  ) : null}
                  {isPartial ? (
                    <p>Del {isFirstPartial ? new Date(startDay).getUTCDate() : 1} al {isLastPartial ? new Date(endDay).getUTCDate() : new Date(Date.UTC(period!.getUTCFullYear(), period!.getUTCMonth() + 1, 0)).getUTCDate()}.</p>
                  ) : null}
                  {inMonth.length ? <p>Hitos: {inMonth.map((milestone) => milestone.name).join(" · ")}</p> : null}
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
