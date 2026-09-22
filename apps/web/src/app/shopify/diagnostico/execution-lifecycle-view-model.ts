export type ExecutionLifecycleState = {
  intervention_id: string;
  state: string;
  why?: string;
  plan_version?: number;
  last_event_at?: string | null;
  allowed_commands?: string[];
  prohibited_commands?: string[];
  blocking_conditions?: string[];
  next_states?: string[];
  material_write_allowed?: boolean;
  inconsistencies?: string[];
  evaluated_at?: string;
};

const list = (value: string[] | undefined) => value?.filter(Boolean) ?? [];

/** States in which the intervention is stopped waiting on a person. */
const WAITING_ON_HUMAN = ["WAITING_APPROVAL", "ESCALATED", "HANDOFF_PENDING", "BLOCKED"];

export function executionLifecycleTone(state: ExecutionLifecycleState) {
  if (list(state.inconsistencies).length) return "danger" as const;
  if (state.state === "FAILED" || state.state === "VERIFICATION_FAILED") return "danger" as const;
  if (WAITING_ON_HUMAN.includes(state.state)) return "warn" as const;
  if (state.state === "CLOSED" || state.state === "VERIFIED") return "success" as const;
  return "neutral" as const;
}

export function executionLifecycleViewModel(states: ExecutionLifecycleState[] | null | undefined) {
  const rows = (states ?? []).map((state) => ({
    interventionId: state.intervention_id,
    state: state.state,
    why: state.why || "Sin explicacion registrada.",
    allowed: list(state.allowed_commands),
    prohibited: list(state.prohibited_commands),
    blocking: list(state.blocking_conditions),
    nextStates: list(state.next_states),
    inconsistencies: list(state.inconsistencies),
    materialWriteAllowed: Boolean(state.material_write_allowed),
    planVersion: state.plan_version ?? 0,
    tone: executionLifecycleTone(state),
  }));

  return {
    rows,
    total: rows.length,
    // Lo que el consultor necesita ver primero: lo roto y lo que le espera a el.
    inconsistent: rows.filter((row) => row.inconsistencies.length),
    waitingOnHuman: rows.filter((row) => WAITING_ON_HUMAN.includes(row.state)),
    writing: rows.filter((row) => row.materialWriteAllowed),
  };
}
