import { TRACK_LABELS, TRACK_ORDER, cadenceLabel, growthRoutines, type GrowthTask, type TaskTrack } from "./task-tracks";
import { Card, CardContent, Collapsible, CollapsibleContent, CollapsibleTrigger, IconChevronDown, Progress, ProgressLabel, ProgressValue } from "@/components/ui";

const dayLabel = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });

const TRACK_HINT: Record<TaskTrack, string> = {
  puesta_a_punto: "Se hace una vez para dejar la tienda lista para escalar.",
  temporada: "La preparación de cada fecha clave: creativos, mailings, stock y ofertas.",
  crecimiento: "El ciclo que se repite para hacer crecer la tienda con margen.",
};

type TrackTask = GrowthTask & { plan_meta?: { track?: string | null; cadence?: string | null } | null };

/**
 * El trabajo del Camino en sus tres carriles y, dentro del ciclo de crecimiento,
 * cada rutina con cuántas vueltas lleva hechas y cuándo toca la siguiente. Sin
 * esto el Camino parece una lista que se acaba; escalar una tienda es continuo.
 */
export function GrowthCycle({ tasks }: { tasks: TrackTask[] }) {
  const byTrack = TRACK_ORDER.map((track) => {
    const list = tasks.filter((task) => task.plan_meta?.track === track);
    return { track, total: list.length, done: list.filter((task) => task.status === "completed").length };
  });
  if (byTrack.every((entry) => entry.total === 0)) return null;
  const routines = growthRoutines(tasks);
  return (
    <section className="space-y-3" aria-labelledby="camino-carriles-title">
      <div>
        <h2 id="camino-carriles-title" className="text-sm font-semibold">Tu trabajo, en tres carriles</h2>
        <p className="text-xs text-muted">Escalar la tienda no termina con una lista: se prepara, se aprovechan las fechas y se crece cada semana.</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {byTrack.map(({ track, total, done }) => (
          <li key={track}><Card size="sm"><CardContent className="text-sm">
            <Progress value={done} max={total || 1} aria-valuetext={`${done} de ${total}`}>
              <ProgressLabel className="font-semibold">{TRACK_LABELS[track]}</ProgressLabel>
              <ProgressValue>{() => `${done} de ${total}`}</ProgressValue>
            </Progress>
            <p className="mt-2 text-xs text-muted">{TRACK_HINT[track]}</p>
          </CardContent></Card></li>
        ))}
      </ul>
      {routines.length ? (
        <Collapsible className="space-y-1.5">
          <CollapsibleTrigger className="text-sm font-semibold">
            Ciclo de crecimiento <span className="font-normal text-muted">· {routines.length} rutinas que se repiten</span>
            <IconChevronDown aria-hidden className="ui-collapsible__chevron" />
          </CollapsibleTrigger>
          <CollapsibleContent>
          <ul className="mt-2 space-y-1.5">
            {routines.map((routine) => (
              <li key={routine.name}><Card size="sm"><CardContent className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                <span className="min-w-0 flex-1 break-words">{routine.name}</span>
                <span className="text-xs text-muted">
                  {[cadenceLabel(routine.cadence), `${routine.done} de ${routine.total} hechas`, routine.nextDue ? `siguiente ${dayLabel.format(new Date(routine.nextDue))}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </CardContent></Card></li>
            ))}
          </ul>
        </CollapsibleContent>
        </Collapsible>
      ) : null}
    </section>
  );
}
