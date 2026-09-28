const SPECIALIST_FRESHNESS_DAYS: Record<string, number> = {
  a02_monitor_negocio: 14,
  a06_planificador_stock: 14,
  a12_analista_email: 30,
  a13_operativa_shopify: 30,
  a14_operativa_meta: 30,
  a19_arquitecto_camino: 45,
  a20_retencion_clientes: 30,
  a21_adquisicion_shopify: 30,
  a22_postventa_shopify: 30,
  a23_creatividad_meta: 30,
  a24_medicion_meta: 30,
  a25_cambios_meta: 30,
  a26_contenido_email: 30,
  a28_arquitecto_flujos: 14,
};

export const RECENT_SPECIALIST_AGENT_CODES = Object.keys(SPECIALIST_FRESHNESS_DAYS);

// A17 already receives the active Camino and A02 separately. The weekly
// planner gets only other approved specialist outputs, not an old A19 draft
// that could conflict with the current path or a duplicate A02 diagnostic.
export const WEEKLY_PLAN_SPECIALIST_AGENT_CODES = RECENT_SPECIALIST_AGENT_CODES.filter(
  (code) => code !== "a02_monitor_negocio" && code !== "a19_arquitecto_camino",
);

type JsonRecord = Record<string, unknown>;

export type SpecialistRunCandidate = {
  id: string;
  organization_id: string;
  store_id: string | null;
  status: string;
  finished_at: string | null;
  time_range: unknown;
  lookback_days: number | null;
  agent_versions: unknown;
  agent_outputs: unknown;
};

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function related(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function shortText(value: unknown, limit = 500): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

function summarizePeriod(value: unknown) {
  const period = record(value);
  if (!period) return null;
  return {
    start: shortText(period.start ?? period.from, 40),
    end: shortText(period.end ?? period.to, 40),
  };
}

function summarizeFindings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).flatMap((entry) => {
    const item = record(entry);
    if (!item) return [];
    const title = shortText(item.title, 180);
    if (!title) return [];
    return [{
      title,
      severity: shortText(item.severity, 24),
      evidence: shortText(item.evidence, 260),
      area: shortText(item.area, 80),
    }];
  });
}

function summarizeRecommendations(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 2).flatMap((entry) => {
    const item = record(entry);
    if (!item) return [];
    const action = shortText(item.action ?? item.description, 260);
    if (!action) return [];
    return [{
      action,
      priority: shortText(item.priority, 24),
      expected_impact: shortText(item.expected_impact, 180),
      owner: shortText(item.owner, 24),
    }];
  });
}

function summarizeSources(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).flatMap((sourceValue) => {
    const source = record(sourceValue);
    const reference = shortText(source?.reference, 120);
    if (!reference) return [];
    return [{
      kind: shortText(source?.kind, 24),
      reference,
      period: shortText(source?.period, 60),
    }];
  });
}

function summarizeSpecialistOutput(code: string, value: unknown) {
  const output = record(value);
  if (!output) return null;

  if (code === "a19_arquitecto_camino") {
    const goal = record(output.goal);
    const phases = Array.isArray(output.phases) ? output.phases : [];
    return {
      plan_name: shortText(output.plan_name, 120),
      diagnosis: shortText(output.diagnosis, 650),
      confidence: shortText(output.confidence, 16),
      goal: goal ? {
        metric_key: shortText(goal.metric_key, 50),
        metric_label: shortText(goal.metric_label, 100),
        baseline: typeof goal.baseline === "number" ? goal.baseline : null,
        target: typeof goal.target === "number" ? goal.target : null,
        currency_code: shortText(goal.currency_code, 8),
        target_offset_days: typeof goal.target_offset_days === "number" ? goal.target_offset_days : null,
      } : null,
      phase_count: phases.length,
      phases: phases.slice(0, 8).flatMap((entry) => {
        const phase = record(entry);
        const name = shortText(phase?.name, 100);
        return name ? [{
          name,
          rationale: shortText(phase?.rationale, 240),
          milestone_count: Array.isArray(phase?.milestones) ? phase.milestones.length : 0,
        }] : [];
      }),
      sources: summarizeSources(output.sources),
      confidence_notes: Array.isArray(output.warnings)
        ? output.warnings.slice(0, 2).flatMap((warning) => {
            const text = shortText(warning, 180);
            return text ? [text] : [];
          })
        : [],
    };
  }

  return {
    answer: shortText(output.answer, 650),
    findings: summarizeFindings(output.findings),
    recommendations: summarizeRecommendations(output.recommendations),
    sources: summarizeSources(output.sources),
    confidence: shortText(output.confidence, 16),
    warnings: Array.isArray(output.warnings)
      ? output.warnings.slice(0, 2).flatMap((warning) => {
          const text = shortText(warning, 180);
          return text ? [text] : [];
        })
      : [],
  };
}

/**
 * Keep only approved/published, successful, fresh specialist outputs for the
 * exact store scope. The model receives a bounded summary and provenance, not
 * the full stored output or any run from another store/organization.
 */
export function summarizeRecentSpecialistOutputs(
  rows: readonly SpecialistRunCandidate[],
  options: { organizationId: string; storeId: string | null; now?: Date },
) {
  const now = options.now ?? new Date();
  const candidates = rows.flatMap((row) => {
    if (row.organization_id !== options.organizationId || row.status !== "succeeded") return [];
    if (row.store_id !== options.storeId) return [];
    const finishedAtMs = typeof row.finished_at === "string" ? Date.parse(row.finished_at) : NaN;
    if (!Number.isFinite(finishedAtMs) || finishedAtMs > now.getTime()) return [];
    const version = record(related(row.agent_versions));
    const definition = record(related(version?.agent_definitions));
    const code = typeof definition?.code === "string" ? definition.code : "";
    const freshnessDays = SPECIALIST_FRESHNESS_DAYS[code];
    if (!freshnessDays || now.getTime() - finishedAtMs > freshnessDays * 24 * 60 * 60 * 1000) return [];
    const outputRow = record(related(row.agent_outputs));
    if (!outputRow || !["approved", "published"].includes(String(outputRow.status))) return [];
    const summary = summarizeSpecialistOutput(code, outputRow.output);
    if (!summary) return [];
    return [{
      code,
      freshnessDays,
      finishedAtMs,
      run: {
        run_id: row.id,
        output_id: typeof outputRow.id === "string" ? outputRow.id : null,
        agent_code: code,
        agent_version: shortText(version?.version, 32),
        run_status: "succeeded",
        output_status: outputRow.status,
        store_id: row.store_id,
        as_of: new Date(finishedAtMs).toISOString(),
        valid_until: new Date(finishedAtMs + freshnessDays * 24 * 60 * 60 * 1000).toISOString(),
        lookback_days: typeof row.lookback_days === "number" ? row.lookback_days : null,
        period: summarizePeriod(row.time_range),
        summary,
      },
    }];
  }).sort((a, b) => b.finishedAtMs - a.finishedAtMs);

  const latestByCode = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    if (!latestByCode.has(candidate.code)) latestByCode.set(candidate.code, candidate);
  }
  return [...latestByCode.values()]
    .sort((a, b) => b.finishedAtMs - a.finishedAtMs)
    .map(({ run }) => run);
}
