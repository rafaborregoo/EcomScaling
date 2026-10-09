import { TRACK_LABELS, TRACK_ORDER, cadenceLabel, growthRoutines, type GrowthTask, type TaskTrack } from "./task-tracks";

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
    <section className="space-y-3" aria-label="Carriles de trabajo del Camino">
      <div>
        <h3 className="text-sm font-semibold">Tu trabajo, en tres carriles</h3>
        <p className="text-xs text-muted">Escalar la tienda no termina con una lista: se prepara, se aprovechan las fechas y se crece cada semana.</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {byTrack.map(({ track, total, done }) => (
          <li key={track} className="rounded-lg border border-separator bg-surface p-3 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <strong>{TRACK_LABELS[track]}</strong>
              <span className="text-xs text-muted">{done} de {total}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-default" aria-hidden="true">
              <div className="h-full rounded-full bg-accent" style={{ width: `${total ? Math.max(2, Math.round((done / total) * 100)) : 0}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">{TRACK_HINT[track]}</p>
          </li>
        ))}
      </ul>
      {routines.length ? (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">Ciclo de crecimiento</h4>
          <ul className="space-y-1.5">
            {routines.map((routine) => (
              <li key={routine.name} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg border border-separator bg-surface px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 break-words">{routine.name}</span>
                <span className="text-xs text-muted">
                  {[cadenceLabel(routine.cadence), `${routine.done} de ${routine.total} hechas`, routine.nextDue ? `siguiente ${dayLabel.format(new Date(routine.nextDue))}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
