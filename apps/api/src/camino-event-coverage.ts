import type { CaminoPlanOutput } from "@e-nora/ai";
import type { CommercialEvent } from "./commercial-calendar.js";

/**
 * Garantía de cobertura del calendario: un Camino de consultor no puede dejar
 * fuera Black Friday, Navidad, las rebajas ni la temporada de la tienda. A19
 * recibe la lista de fechas clave como obligación; esto comprueba, por nombre de
 * fase o hito, que cada una tiene preparación en el plan y, si no, la inserta.
 */

type Milestone = CaminoPlanOutput["phases"][number]["milestones"][number];

/** Fechas que exigen preparación propia en el Camino (el resto son oportunidades opcionales). */
const KEY_EVENT_KEYS = new Set([
  "black_friday",
  "navidad",
  "reyes",
  "rebajas_invierno",
  "rebajas_verano",
  "buen_fin",
  "campana_juguete",
  "temporada_regalo",
  "cestas_navidad",
]);

export function keyEvents(events: CommercialEvent[]): CommercialEvent[] {
  return events.filter((event) => KEY_EVENT_KEYS.has(event.key) || event.scope === "category");
}

const NAME_PATTERNS: Record<string, RegExp> = {
  black_friday: /black\s*friday|cyber|ciberlunes|blackfriday/i,
  navidad: /navidad|navide|christmas|regalos?\s+de\s+fin/i,
  reyes: /reyes|epifan/i,
  rebajas_invierno: /rebajas|liquidaci|sales\b/i,
  rebajas_verano: /rebajas|liquidaci|sales\b/i,
  buen_fin: /buen\s*fin/i,
  temporada_nieve: /nieve|temporada|esqu|snow|ski/i,
};

/** Palabras con las que el plan debería nombrar el evento; sin patrón propio, la primera palabra larga del nombre. */
function patternFor(event: CommercialEvent): RegExp {
  const known = NAME_PATTERNS[event.key];
  if (known) return known;
  const word = event.name.split(/[\s(]/).find((part) => part.length > 4) ?? event.name;
  return new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

/**
 * Eventos clave sin un hito que los prepare: el nombre del hito (o de su fase)
 * nombra el evento Y su fecha cae en la ventana de preparacion, entre el
 * inicio de la preparacion menos un margen y unos dias despues del evento.
 * Nombrarlo solo en una descripcion, o preparar otro evento parecido (las
 * rebajas de verano frente a las de invierno), no cuenta.
 */
export function uncoveredEvents(proposal: CaminoPlanOutput, events: CommercialEvent[]): CommercialEvent[] {
  const anchors = proposal.phases.flatMap((phase) =>
    phase.milestones.map((milestone) => ({ text: `${phase.name} ${milestone.name}`, day: milestone.target_offset_days })),
  );
  return keyEvents(events).filter((event) => {
    const pattern = patternFor(event);
    const from = event.offset_days - event.prep_weeks * 7 - 28;
    const to = event.offset_days + 3;
    return !anchors.some((anchor) => pattern.test(anchor.text) && anchor.day >= from && anchor.day <= to);
  });
}

/**
 * Coloca un hito de preparación en la fase que cubre su fecha (la última fase
 * que empieza antes o ese mismo día) y mantiene los hitos ordenados. Las
 * tareas se recortan a la fecha del hito.
 */
export function insertEventMilestones(
  proposal: CaminoPlanOutput,
  additions: Milestone[],
  maxDays: number,
): CaminoPlanOutput {
  if (!additions.length || !proposal.phases.length) return proposal;
  const phases = proposal.phases.map((phase) => ({ ...phase, milestones: [...phase.milestones] }));
  const phaseStart = (phase: (typeof phases)[number]) => phase.milestones[0]?.target_offset_days ?? Number.POSITIVE_INFINITY;
  for (const addition of additions) {
    const day = Math.max(1, Math.min(maxDays, Math.trunc(addition.target_offset_days)));
    const milestone: Milestone = {
      ...addition,
      target_offset_days: day,
      tasks: addition.tasks.map((task) => ({ ...task, target_offset_days: Math.max(1, Math.min(day, Math.trunc(task.target_offset_days))) })),
    };
    let target = phases[0]!;
    for (const phase of phases) if (phaseStart(phase) <= day) target = phase;
    target.milestones.push(milestone);
    target.milestones.sort((a, b) => a.target_offset_days - b.target_offset_days);
  }
  // Una fase no puede empezar antes de que acabe la anterior: se reordena por su primer hito.
  phases.sort((a, b) => phaseStart(a) - phaseStart(b));
  return { ...proposal, phases };
}
