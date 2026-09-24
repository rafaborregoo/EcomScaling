/**
 * F8: de las filas de `execution_supervision_runs` a lo que se lee.
 *
 * Una seccion por bloque, cada una con su ancla y con lo que ESE bloque sabe
 * decir: 8.01 el modo de ejecucion y si es candidata, 8.06 el hueco de
 * capacidad, 8.09 que guardrail salto, 8.14 con quien choca... Pintar los doce
 * con la misma plantilla de "decision + bloqueos" era lo que los hacia
 * indistinguibles.
 */

export type SupervisionCheck = { id: string; status: string; hard: boolean; detail: string };

export type ExecutionSupervisionRun = {
  stage?: string;
  decision?: string;
  evaluated_at?: string;
  result?: {
    block?: string;
    stage?: string;
    block_decision?: string;
    decision?: string;
    why?: string;
    checks?: SupervisionCheck[];
    next_actions?: string[];
    payload?: Record<string, unknown>;
  };
};

export type SupervisionBlockView = {
  stage: string;
  block: string;
  label: string;
  anchor: string;
  blockDecision: string;
  decision: string;
  why: string;
  highlights: string[];
  failedChecks: SupervisionCheck[];
  next: string[];
};

export const SUPERVISION_BLOCKS: { stage: string; block: string; label: string; anchor: string }[] = [
  { stage: "UNIVERSAL", block: "8.00", label: "Flujo universal", anchor: "insight-f8-universal" },
  { stage: "EXECUTABILITY_AUTHORIZATION", block: "8.01", label: "Ejecutabilidad y autorización", anchor: "insight-f8-executability" },
  { stage: "CAPABILITIES", block: "8.06", label: "Capacidades y tools", anchor: "insight-f8-capabilities" },
  { stage: "SAFE_EXECUTION", block: "8.07", label: "Ejecución segura", anchor: "insight-f8-safe-execution" },
  { stage: "MONITORING", block: "8.08", label: "Supervisión en curso", anchor: "insight-f8-monitoring" },
  { stage: "GUARDRAILS", block: "8.09", label: "Guardrails", anchor: "insight-f8-guardrails" },
  { stage: "INCIDENTS", block: "8.11", label: "Fallos e incidentes", anchor: "insight-f8-incidents" },
  { stage: "ROLLBACK_RECOVERY", block: "8.12", label: "Rollback y recovery", anchor: "insight-f8-rollback-recovery" },
  { stage: "OVERRIDE_ESCALATION", block: "8.13", label: "Override y escalado", anchor: "insight-f8-override-escalation" },
  { stage: "CONCURRENCY", block: "8.14", label: "Concurrencia", anchor: "insight-f8-concurrency" },
  { stage: "VERIFICATION", block: "8.15", label: "Verificación", anchor: "insight-f8-verification" },
  { stage: "REPORTING", block: "8.17", label: "Comunicación", anchor: "insight-f8-reporting" },
];

const arr = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown) => (typeof value === "string" ? value : "");

/** Lo propio de cada bloque, en frases. Solo lo que cambia una decision. */
export function blockHighlights(block: string, payload: Record<string, unknown>): string[] {
  switch (block) {
    case "8.00": {
      const skipped = arr(payload.skipped_steps).map(String);
      return [
        `Etapa alcanzada: ${str(payload.reached_stage) || "—"}`,
        skipped.length ? `Pasos saltados: ${skipped.join(", ")}` : payload.missing_step ? `Falta: ${str(payload.missing_step)}` : "",
        payload.context_drift ? "El contexto cambió desde la aprobación" : "",
      ];
    }
    case "8.01":
      return [
        `Modo de ejecución: ${str(payload.execution_mode)}`,
        payload.may_prepare ? "Se puede preparar" : "No se puede ni preparar",
        payload.may_execute ? "Candidata a ejecución" : "No ejecutable por el sistema",
        payload.handoff_required ? "Requiere que lo aplique una persona" : "",
      ];
    case "8.06":
      return [
        `Tools de escritura: ${Number(payload.write_tools_implemented ?? 0)} implementadas, ${Number(payload.write_tools_planned ?? 0)} planeadas`,
        ...arr(payload.gaps).map(String),
      ];
    case "8.07":
      return [
        payload.provider_operation_available ? "Hay operación de proveedor para el commit" : "El commit es manual: no hay operación de proveedor",
        ...arr(payload.changes).flatMap((c) => {
          const change = c as { action_id?: string; missing?: string[] };
          return change.missing?.length ? [`${change.action_id}: falta ${change.missing.join(", ")}`] : [];
        }),
      ];
    case "8.08":
      return [
        `Respuesta: ${str(payload.response)}`,
        ...arr(payload.plan_gaps).map((g) => `Plan: ${String(g)}`),
        ...arr(payload.signals).map(String),
      ];
    case "8.09":
      return arr(payload.guardrails)
        .map((g) => g as { id?: string; state?: string })
        .filter((g) => g.state !== "CLEAR")
        .map((g) => `${g.id}: ${g.state}`);
    case "8.11":
      return [
        payload.incident_required ? `Incidente ${str(payload.severity)}, contención: ${str(payload.containment)}` : "Sin incidente",
        ...arr(payload.problems).map((p) => {
          const problem = p as { class?: string; detail?: string };
          return `${problem.class}: ${problem.detail}`;
        }),
      ];
    case "8.12":
      return [
        `Estrategia: ${str(payload.strategy)}`,
        arr(payload.rollback_order).length ? `Orden de vuelta: ${arr(payload.rollback_order).join(" → ")}` : "",
        payload.restore_capability ? "" : "Deshacer también sería manual",
      ];
    case "8.13":
      return [
        str(payload.target) ? `Destino: ${str(payload.target)}` : "",
        `Urgencia: ${str(payload.urgency)}`,
        arr(payload.available_overrides).length ? `Overrides ahora: ${arr(payload.available_overrides).join(", ")}` : "",
        ...arr(payload.reasons).map(String),
      ];
    case "8.14":
      return arr(payload.overlaps).map((o) => {
        const overlap = o as { plan_id?: string; interaction?: string; shared_targets?: string[] };
        return `${overlap.plan_id}: ${overlap.interaction} en ${overlap.shared_targets?.join(", ")}`;
      });
    case "8.15":
      return [
        `Puerta de cierre: ${str(payload.gate)}`,
        str(payload.expected_state) ? `Esperado: ${str(payload.expected_state)}` : "",
        str(payload.actual_state) ? `Real: ${str(payload.actual_state)}` : "",
      ];
    case "8.17": {
      const consultant = arr(payload.reports).find((r) => (r as { audience?: string }).audience === "consultant") as
        | { summary?: string; decision_request?: string | null }
        | undefined;
      return [consultant?.summary ?? "", consultant?.decision_request ? `Se pide: ${consultant.decision_request}` : "", ...arr(payload.not_claimed).map(String)];
    }
    default:
      return [];
  }
}

export function executionSupervisionViewModel(runs: ExecutionSupervisionRun[]): SupervisionBlockView[] {
  // Llegan de la mas reciente a la mas antigua: la primera de cada etapa manda.
  const latest = new Map<string, ExecutionSupervisionRun>();
  for (const run of runs) {
    const stage = run.stage ?? run.result?.stage;
    if (stage && !latest.has(stage)) latest.set(stage, run);
  }
  return SUPERVISION_BLOCKS.map((meta) => {
    const run = latest.get(meta.stage);
    const result = run?.result ?? {};
    return {
      ...meta,
      blockDecision: result.block_decision ?? run?.decision ?? "SIN_EVALUACION",
      decision: run?.decision ?? result.decision ?? "UNKNOWN",
      why: result.why ?? (run ? "Evaluación anterior al motor por bloques." : "Todavía no hay evaluación."),
      highlights: blockHighlights(meta.block, result.payload ?? {}).filter(Boolean),
      failedChecks: (result.checks ?? []).filter((c) => c.status === "FAIL" || c.status === "UNKNOWN"),
      next: result.next_actions ?? [],
    };
  });
}

export function supervisionTone(value: string) {
  return value === "READY" || value === "COMPLETED"
    ? ("success" as const)
    : value === "BLOCKED"
      ? ("danger" as const)
      : ["CONDITIONAL", "WAITING", "UNKNOWN"].includes(value)
        ? ("warn" as const)
        : ("neutral" as const);
}
