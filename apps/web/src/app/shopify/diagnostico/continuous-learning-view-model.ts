/**
 * F9: de las filas de `continuous_learning_runs` a lo que se lee.
 *
 * Cuatro secciones por tema, cada una con su ancla, y en cada bloque lo suyo:
 * su decision en su propio vocabulario, por que, y que evidencia falta. Antes
 * se pintaban los 40 con estado/outcome/confianza, que era lo mismo en todos.
 */

export type ContinuousLearningCheck = { id: string; status: string; detail: string };

export type ContinuousLearningRun = {
  block_code?: string;
  experience_id?: string;
  evaluated_at?: string;
  status?: string;
  classification?: string;
  confidence?: string;
  gate?: boolean;
  rationale?: string[];
  next_evidence_needed?: string[];
  result?: {
    block?: string;
    title?: string;
    block_decision?: string;
    why?: string;
    checks?: ContinuousLearningCheck[];
    next_evidence?: string[];
  };
};

export type LearningBlockView = {
  block: string;
  title: string;
  decision: string;
  status: string;
  why: string;
  failedChecks: ContinuousLearningCheck[];
  next: string[];
};

export const F9_SECTIONS: { id: string; anchor: string; title: string; blocks: string[] }[] = [
  { id: "evidence", anchor: "insight-f9-evidence", title: "Experiencia y evidencia", blocks: ["9.00", "9.01", "9.03", "9.04", "9.05", "9.06", "9.07", "9.08", "9.09", "9.12"] },
  { id: "domains", anchor: "insight-f9-domains", title: "Aprendizaje por dominio", blocks: ["9.13", "9.14", "9.15", "9.16", "9.17", "9.18", "9.19", "9.20"] },
  { id: "knowledge", anchor: "insight-f9-knowledge", title: "Ciclo de vida del conocimiento", blocks: ["9.10", "9.11", "9.22", "9.23", "9.24", "9.25", "9.26", "9.27", "9.28", "9.29", "9.33", "9.38"] },
  { id: "governance", anchor: "insight-f9-governance", title: "Gobernanza, trazabilidad y capas", blocks: ["9.30", "9.31", "9.32", "9.34", "9.35", "9.36", "9.37", "9.39", "9.40", "9.41"] },
];

export function continuousLearningViewModel(runs: ContinuousLearningRun[]) {
  // Llegan de la mas reciente a la mas antigua: la primera de cada bloque manda.
  const latest = new Map<string, ContinuousLearningRun>();
  for (const run of runs) {
    const block = run.block_code ?? run.result?.block;
    if (block && !latest.has(block)) latest.set(block, run);
  }
  const view = (block: string): LearningBlockView => {
    const run = latest.get(block);
    const result = run?.result ?? {};
    return {
      block,
      title: result.title ?? "",
      decision: result.block_decision ?? (run ? run.status ?? "UNKNOWN" : "SIN_EVALUACION"),
      status: run?.status ?? "WAITING_FOR_EVIDENCE",
      why: result.why ?? run?.rationale?.[0] ?? "Todavía no hay evaluación.",
      failedChecks: (result.checks ?? []).filter((c) => c.status !== "PASS"),
      next: result.next_evidence ?? run?.next_evidence_needed ?? [],
    };
  };
  const sections = F9_SECTIONS.map((section) => ({ ...section, items: section.blocks.map(view) }));
  const items = sections.flatMap((s) => s.items);
  return {
    sections,
    evaluated: items.filter((i) => i.decision !== "SIN_EVALUACION").length,
    ready: items.filter((i) => i.status === "READY").length,
    waiting: items.filter((i) => i.status === "WAITING_FOR_EVIDENCE").length,
    review: items.filter((i) => i.status === "REVIEW_REQUIRED").length,
    blocked: items.filter((i) => i.status === "BLOCKED").length,
  };
}

export function continuousLearningTone(status: string) {
  return status === "READY"
    ? ("success" as const)
    : status === "BLOCKED"
      ? ("danger" as const)
      : status === "REVIEW_REQUIRED"
        ? ("warn" as const)
        : ("neutral" as const);
}
