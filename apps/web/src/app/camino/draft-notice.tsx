"use client";

import { Button } from "@/components/ui";
import type { DraftReadiness } from "./draft-readiness";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Franja del borrador. Un camino recién creado nace en borrador y, hasta que se
 * activa, ninguna fase corre ni las tareas se pueden marcar. Antes el único
 * botón para activarlo vivía dentro del editor (y el cliente con permisos no lo
 * veía junto al mapa); ahora está aquí, con lo que hay y lo que falta.
 */
export function DraftNotice({
  readiness,
  canManage,
  isActivating,
  onActivate,
}: {
  readiness: DraftReadiness;
  canManage: boolean;
  isActivating: boolean;
  onActivate: () => void;
}) {
  const ok = [
    `${plural(readiness.phases, "fase", "fases")} y ${plural(readiness.milestones, "hito", "hitos")}`,
    plural(readiness.tasks, "tarea", "tareas"),
  ];
  const todo = [
    readiness.undated > 0 ? `${plural(readiness.undated, "hito sin fecha", "hitos sin fecha")}` : null,
    readiness.withoutTasks > 0 ? `${plural(readiness.withoutTasks, "hito sin tareas", "hitos sin tareas")}` : null,
    readiness.hasGoalTarget ? null : "La meta no tiene cifra",
  ].filter((item): item is string => item !== null);

  return (
    <section
      className="grid gap-3 rounded-xl border border-warning/30 bg-warning/10 px-5 py-4"
      aria-label="Estado del borrador"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="min-w-0 text-base font-semibold">
          Este camino es un borrador: todavía no hay nada en marcha
        </h2>
        {canManage ? (
          <Button type="button" disabled={isActivating} onClick={onActivate}>
            {isActivating ? "Activando…" : "Activar camino"}
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {ok.map((item) => (
          <li key={item} className="flex items-center gap-1.5">
            <span aria-hidden className="font-bold text-success">✓</span>
            {item}
          </li>
        ))}
        {todo.map((item) => (
          <li key={item} className="flex items-center gap-1.5">
            <span aria-hidden className="font-bold text-warning">!</span>
            {item}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">
        {canManage
          ? "Los hitos aparecen como «previstos». Al activarlo empieza la primera fase y las tareas se pueden marcar."
          : "Tu consultor lo revisará y lo activará. Hasta entonces puedes mirarlo, pero nada corre todavía."}
      </p>
    </section>
  );
}
