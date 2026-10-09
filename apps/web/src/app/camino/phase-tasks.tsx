"use client";

import { Badge, Button, Card } from "@/components/ui";
import type { DiscussTopic } from "./camino-map";
import { taskOwnerLabel } from "./task-owner";
import type { PlanTaskMeta } from "./plan-task-meta";

type PhaseTask = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
  assigned_to?: string | null;
  assignee_name?: string | null;
  assignee_origin?: "consultant" | "client" | null;
  plan_meta?: PlanTaskMeta | null;
};

type PhaseMilestone = {
  id: string;
  name: string;
  position: number;
  status: string;
  target_date: string | null;
  milestone_task_links: Array<{ tasks: PhaseTask | null }>;
};

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

/**
 * «Para cerrar la fase»: los hitos de la fase activa con las tareas que los
 * cierran, en una sola lista. En el mapa se ven hito a hito; aquí se ve cuánto
 * falta para pasar de fase.
 */
export function PhaseTasks({
  phaseName,
  phaseIndex,
  milestones,
  canResolveTasks,
  onToggleTask,
  onDiscuss,
  viewerUserId,
  viewerIsClient,
}: {
  phaseName: string;
  /** Posición de la fase en el mapa, para el código 2.1, 2.2… */
  phaseIndex: number;
  milestones: PhaseMilestone[];
  canResolveTasks: boolean;
  onToggleTask: (task: PhaseTask) => void;
  onDiscuss: (topic: DiscussTopic) => void;
  viewerUserId: string;
  viewerIsClient: boolean;
}) {
  const ordered = milestones.slice().sort((a, b) => a.position - b.position);
  const all = ordered.flatMap((m) =>
    m.milestone_task_links.flatMap((link) => (link.tasks ? [link.tasks] : [])),
  );
  if (all.length === 0) return null;
  const done = all.filter((task) => task.status === "completed").length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card
      title={`Para cerrar la fase «${phaseName}»`}
      actions={
        <span className="text-sm tabular-nums text-muted">
          {done} de {all.length} tareas
        </span>
      }
    >
      <div className="grid gap-2.5">
        {ordered.map((milestone, mi) => {
          const tasks = milestone.milestone_task_links.flatMap((link) =>
            link.tasks ? [link.tasks] : [],
          );
          const code = `${phaseIndex + 1}.${mi + 1}`;
          const finished = milestone.status === "completed";
          const current = milestone.status === "in_progress";
          const late =
            !finished &&
            Boolean(milestone.target_date) &&
            (milestone.target_date as string) < today;
          const hitoDone = tasks.filter((t) => t.status === "completed").length;
          return (
            <section
              key={milestone.id}
              className={`grid gap-2 rounded-xl border p-3 ${
                current
                  ? "border-accent shadow-[inset_3px_0_0_var(--accent)]"
                  : "border-separator"
              } ${finished ? "bg-surface" : "bg-white"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={`inline-grid h-6 min-w-9 place-items-center rounded-md px-1.5 text-xs font-bold tabular-nums ${
                      current
                        ? "bg-accent text-accent-foreground"
                        : "bg-foreground text-white"
                    }`}
                  >
                    {code}
                  </span>
                  <p className="text-sm font-semibold">{milestone.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {finished ? (
                    <Badge tone="success">Conseguido</Badge>
                  ) : current ? (
                    <Badge tone="brand">En curso</Badge>
                  ) : null}
                  {milestone.target_date && !finished ? (
                    <Badge tone={late ? "danger" : "neutral"}>
                      {late ? "Venció" : "Vence"} {shortDate(milestone.target_date)}
                    </Badge>
                  ) : null}
                  <span className="text-xs tabular-nums text-muted">
                    {hitoDone}/{tasks.length}
                  </span>
                </div>
              </div>
              {tasks.length ? (
                <ul className="grid">
                  {tasks.map((task) => {
                    const isDone = task.status === "completed";
                    const overdue =
                      !isDone && Boolean(task.due_at) && (task.due_at as string).slice(0, 10) < today;
                    return (
                      <li
                        key={task.id}
                        className="flex items-start gap-2.5 border-t border-separator py-2 first:border-t-0"
                      >
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isDone}
                          aria-label={`${isDone ? "Reabrir" : "Completar"}: ${task.title}`}
                          disabled={!canResolveTasks}
                          onClick={() => onToggleTask(task)}
                          className={`mt-0.5 size-5 shrink-0 rounded-full border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            isDone
                              ? "border-success bg-success"
                              : "border-separator bg-white hover:border-accent"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm ${isDone ? "text-muted line-through" : "font-medium"}`}
                          >
                            {task.title}
                          </p>
                          {(() => {
                            const owner = taskOwnerLabel(task, viewerUserId, viewerIsClient);
                            const due = task.due_at && !isDone ? shortDate(task.due_at) : null;
                            if (!owner && !due) return null;
                            return (
                              <p className="text-xs text-muted">
                                {owner ? <span className="font-medium text-foreground">{owner}</span> : null}
                                {owner && due ? " · " : ""}
                                {due ? (
                                  <span className={overdue ? "text-danger" : undefined}>
                                    {overdue ? "Vencida · " : ""}
                                    {due}
                                  </span>
                                ) : null}
                              </p>
                            );
                          })()}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              {finished ? null : (
                <div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      onDiscuss({
                        code,
                        name: milestone.name,
                        targetDate: milestone.target_date,
                        doneTasks: hitoDone,
                        totalTasks: tasks.length,
                        late,
                      })
                    }
                  >
                    Escribir sobre este hito
                  </Button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </Card>
  );
}
