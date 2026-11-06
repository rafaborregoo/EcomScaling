import { Card, CardContent, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown } from "@/components/ui";
import { calendarMonth, milestonesInMonth, routeStart, type MonthlyTarget, type RouteMilestone } from "./monthly-route-model";

/**
 * Ruta económica mes a mes del Camino: lo que el cliente ve cada mes que sigue
 * el plan (objetivo del mes, cuánto sube sobre hoy, por qué y qué hitos lo
 * mueven). Sin esto el Camino parece una sola cifra a siete meses y no se nota
 * la ayuda que recibe mes a mes.
 */

const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" });

export function MonthlyRoute({
  targets,
  baseline,
  baselineLabel,
  format,
  startDate,
  endDate,
  milestones,
  goalTarget,
  headingLevel = 3,
}: {
  /** Nivel del título según dónde se pinte: 2 en la página, 3 dentro de otra sección. */
  headingLevel?: 2 | 3;
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
  const Heading = `h${headingLevel}` as const;
  return (
    <section className="space-y-3" aria-labelledby="camino-ruta-title">
      <div>
        <Heading id="camino-ruta-title" className="text-sm font-semibold">Ruta económica mes a mes</Heading>
      </div>
      {baseline !== null ? (
        <p className="text-xs text-muted">
          Punto de partida: <strong className="text-foreground">{format(baseline)}</strong> al mes{baselineLabel ? ` (${baselineLabel})` : ""}.
        </p>
      ) : null}
      <ol className="space-y-2">
        {targets.map((target) => {
          const value = target.target_value;
          const period = calendarMonth(routeStart(startDate, targets), target.month);
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
          const inMonth = milestonesInMonth(routeStart(startDate, targets), target.month, milestones);
          const isGoal = goalTarget !== null && value === goalTarget;
          return (
            <li key={target.month}><Card size="sm"><CardContent className="text-sm">
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
              <Collapsible className="mt-2 text-xs">
                <CollapsibleTrigger className="font-medium">Ver estrategia del mes<IconChevronDown aria-hidden className="ui-collapsible__chevron" /></CollapsibleTrigger>
                <CollapsibleContent>
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
              </CollapsibleContent>
              </Collapsible>
            </CardContent></Card></li>
          );
        })}
      </ol>
    </section>
  );
}
