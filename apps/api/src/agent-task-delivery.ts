type ProposedDeliveryFields = {
  owner_role?: unknown;
  completion_criteria?: unknown;
  expected_metric?: unknown;
  due_hint?: unknown;
  milestone_id?: unknown;
  initiative_measurement?: unknown;
};

export type WeeklyDeliveryContract = {
  owner_role: "cliente" | "consultor" | null;
  completion_criteria: string | null;
  expected_metric: string | null;
  due_hint: string | null;
};

export type InitiativeMeasurement = {
  metric_name: string;
  unit: string | null;
  baseline: number | null;
  target: number | null;
  evaluation_window: string;
};

export type AiEffortEstimate = "low" | "medium" | "high" | "unknown";

export type A18InitiativeChange = {
  action: "replace" | "retire";
  previous_task_id: string;
  previous_task_title: string;
};

export function readA18InitiativeChange(value: unknown): A18InitiativeChange | null {
  if (!value || typeof value !== "object") return null;
  const change = value as Record<string, unknown>;
  if (
    (change.action !== "replace" && change.action !== "retire") ||
    typeof change.previous_task_id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(change.previous_task_id) ||
    typeof change.previous_task_title !== "string" ||
    !change.previous_task_title.trim() ||
    change.previous_task_title.length > 255
  ) return null;
  return {
    action: change.action,
    previous_task_id: change.previous_task_id.toLowerCase(),
    previous_task_title: change.previous_task_title,
  };
}

export function readAiEffortEstimate(value: unknown): AiEffortEstimate | null {
  return value === "low" || value === "medium" || value === "high" || value === "unknown"
    ? value
    : null;
}

export function readProposedMilestoneId(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : null;
}

export function shouldFallbackToCurrentMilestone(agentCode: string | null): boolean {
  return agentCode !== "a04_generador_tareas" && agentCode !== "a06_planificador_stock" && agentCode !== "a18_plan_mensual";
}

const trimBounded = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : null;

/**
 * Preserve A17's typed delivery contract in the durable task description.
 * The planner supplies relative due guidance only; it must not silently turn
 * that hint into a calendar date or a hard database deadline.
 */
export function appendWeeklyDeliveryDetails(
  description: unknown,
  fields: ProposedDeliveryFields,
  agentCode: string | null,
): string | null {
  const base = trimBounded(description, 4000);
  const contract = readWeeklyDeliveryContract(fields);
  if (agentCode !== "a17_plan_semanal") return base;
  const details = [
    contract.owner_role ? `Rol de ejecución: ${contract.owner_role}.` : null,
    contract.completion_criteria ? `Criterio de cierre: ${contract.completion_criteria}` : null,
    contract.expected_metric ? `Métrica y ventana de revisión: ${contract.expected_metric}` : null,
    contract.due_hint ? `Plazo orientativo: ${contract.due_hint}.` : null,
  ].filter((value): value is string => Boolean(value));

  if (!details.length) return base;
  return [base, details.join("\n")].filter(Boolean).join("\n\n");
}

export function readWeeklyDeliveryContract(
  fields: ProposedDeliveryFields,
): WeeklyDeliveryContract {
  return {
    owner_role: fields.owner_role === "cliente" || fields.owner_role === "consultor"
      ? fields.owner_role
      : null,
    completion_criteria: trimBounded(fields.completion_criteria, 500),
    expected_metric: trimBounded(fields.expected_metric, 240),
    due_hint: trimBounded(fields.due_hint, 100),
  };
}

export function readInitiativeMeasurement(
  fields: ProposedDeliveryFields,
): InitiativeMeasurement | null {
  if (!fields.initiative_measurement || typeof fields.initiative_measurement !== "object") return null;
  const value = fields.initiative_measurement as Record<string, unknown>;
  const metricName = trimBounded(value.metric_name, 120);
  const evaluationWindow = trimBounded(value.evaluation_window, 120);
  if (!metricName || !evaluationWindow) return null;
  const finiteNumber = (candidate: unknown) =>
    typeof candidate === "number" && Number.isFinite(candidate) ? candidate : null;
  return {
    metric_name: metricName,
    unit: value.unit === null ? null : trimBounded(value.unit, 40),
    baseline: finiteNumber(value.baseline),
    target: finiteNumber(value.target),
    evaluation_window: evaluationWindow,
  };
}

/** Persist the initiative's measurement contract as readable task context. */
export function appendMonthlyInitiativeDetails(
  description: unknown,
  fields: ProposedDeliveryFields,
  agentCode: string | null,
): string | null {
  const base = trimBounded(description, 4000);
  if (agentCode !== "a18_plan_mensual") return base;
  const measurement = readInitiativeMeasurement(fields);
  if (!measurement) return base;
  const valueLabel = (value: number | null) =>
    value === null ? "no disponible" : `${value}${measurement.unit ? ` ${measurement.unit}` : ""}`;
  const hasMilestone = readProposedMilestoneId(fields.milestone_id) !== null;
  const details = [
    `Medición de la iniciativa: ${measurement.metric_name}.`,
    `Línea base: ${valueLabel(measurement.baseline)}; objetivo: ${valueLabel(measurement.target)}.`,
    `Ventana de evaluación: ${measurement.evaluation_window}.`,
    hasMilestone ? "Vinculada al hito de Camino indicado en esta propuesta." : null,
  ].filter((value): value is string => Boolean(value));
  return [base, details.join("\n")].filter(Boolean).join("\n\n");
}
