/**
 * Qué toca ahora en el camino, para el cliente.
 *
 * El árbol de fases e hitos es la herramienta del consultor: para asesorar hace
 * falta verlo entero. El cliente entra a saber una sola cosa -- qué hace hoy --
 * y hoy tiene que deducirla leyendo el árbol.
 *
 * Los estados que engañan si nadie los nombra:
 *   - un plan en borrador pinta el árbol completo y parece que va en marcha;
 *   - un plan activo sin ninguna fase activa parece que avanza y no avanza;
 *   - una fase con todos sus hitos cerrados parece terminada y sigue siendo la
 *     activa hasta que alguien pasa a la siguiente.
 *
 * `today` entra por parámetro a propósito: una función que lee el reloj por su
 * cuenta no se puede comprobar, y "va tarde" es justo lo que hay que acertar.
 */

export type StepTask = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
};

export type StepMilestone = {
  id: string;
  name: string;
  position: number;
  status: string;
  target_date: string | null;
  milestone_task_links: Array<{ tasks: StepTask | null }>;
};

export type StepPhase = {
  id: string;
  name: string;
  status: string;
  strategic_plan_milestones: StepMilestone[];
};

export type NextStep = {
  tone: "brand" | "warn" | "success";
  headline: string;
  detail: string;
  milestoneName: string | null;
  tasks: StepTask[];
};

const CLOSED_MILESTONE = ["completed", "skipped"];
const OPEN_TASK = ["pending", "in_progress"];

export function clientNextStep(
  planStatus: string,
  phases: StepPhase[],
  today: string,
): NextStep {
  // El borrador va primero: por debajo el plan puede estar entero, con fases e
  // hitos con fecha, y no estar corriendo. Sin decirlo, el cliente cree que su
  // camino arrancó.
  if (planStatus === "draft") {
    return {
      tone: "warn",
      headline: "Tu camino todavía no ha arrancado",
      detail:
        "Está en borrador: revísalo y actívalo para empezar a seguirlo desde aquí.",
      milestoneName: null,
      tasks: [],
    };
  }

  if (phases.length === 0) {
    return {
      tone: "warn",
      headline: "Tu camino todavía no tiene fases",
      detail: "Cuando tenga fases e hitos, aquí verás qué toca en cada momento.",
      milestoneName: null,
      tasks: [],
    };
  }

  const activePhase = phases.find((phase) => phase.status === "active") ?? null;

  if (!activePhase) {
    const allDone = phases.every((phase) => phase.status === "completed");
    return allDone
      ? {
          tone: "success",
          headline: "Has recorrido tu camino entero",
          detail: "Todas las fases están cerradas. Toca dibujar el siguiente.",
          milestoneName: null,
          tasks: [],
        }
      : {
          tone: "warn",
          headline: "Ninguna fase está en marcha",
          detail: `Tienes ${phases.length} ${phases.length === 1 ? "fase preparada" : "fases preparadas"} y ninguna activa: el camino está parado.`,
          milestoneName: null,
          tasks: [],
        };
  }

  const ordered = activePhase.strategic_plan_milestones
    .slice()
    .sort((a, b) => a.position - b.position);
  const open = ordered.filter(
    (milestone) => !CLOSED_MILESTONE.includes(milestone.status),
  );

  // Fase activa con todo cerrado: terminada de hecho, activa de derecho. Nadie
  // ha pasado a la siguiente, y sin decirlo el cliente no sabe que espera a eso.
  if (open.length === 0) {
    return {
      tone: "success",
      headline: `Has terminado la fase ${activePhase.name}`,
      detail: "Queda arrancar la siguiente fase para seguir avanzando.",
      milestoneName: null,
      tasks: [],
    };
  }

  const focus =
    open.find((milestone) => milestone.status === "in_progress") ?? open[0]!;

  const tasks = focus.milestone_task_links
    .map((link) => link.tasks)
    .filter((task): task is StepTask => task !== null)
    .filter((task) => OPEN_TASK.includes(task.status));

  const late = Boolean(focus.target_date && focus.target_date < today);

  return {
    tone: late ? "warn" : "brand",
    headline: late
      ? `Vas tarde en ${focus.name}`
      : focus.status === "in_progress"
        ? `Estás en ${focus.name}`
        : `Lo siguiente es ${focus.name}`,
    detail:
      tasks.length > 0
        ? `${tasks.length} ${tasks.length === 1 ? "tarea abierta" : "tareas abiertas"} para cerrarlo.`
        : "No hay ninguna tarea anotada para este hito todavía.",
    milestoneName: focus.name,
    tasks,
  };
}

// A19 guarda el criterio de éxito dentro de la descripción del hito
// ("...\n\nCriterio de exito: ..."). Se separa para enseñarlo como lo que es.
export function splitCriterion(description: string | null) {
  if (!description) return { text: "", criterion: null as string | null };
  const match = description.match(/\n*\s*Criterio de [eé]xito:\s*([\s\S]+)$/i);
  if (!match || match.index === undefined) return { text: description.trim(), criterion: null };
  return { text: description.slice(0, match.index).trim(), criterion: match[1].trim() };
}
