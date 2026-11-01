import { summarizeKlaviyoFlowArchitecture } from "./klaviyo-flow-architect-output.js";

export const SPECIALIST_FRESHNESS_DAYS: Readonly<Record<string, number>> = {
  a02_monitor_negocio: 14,
  a06_planificador_stock: 14,
  a12_analista_email: 30,
  a13_operativa_shopify: 30,
  a14_operativa_meta: 30,
  a15_analista_imagenes: 30,
  a16_texto_sobre_imagen: 30,
  a19_arquitecto_camino: 45,
  a20_retencion_clientes: 30,
  a21_adquisicion_shopify: 30,
  a22_postventa_shopify: 30,
  a23_creatividad_meta: 30,
  a24_medicion_meta: 30,
  a25_cambios_meta: 7,
  a26_contenido_email: 30,
  a28_arquitecto_flujos: 30,
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

  if (code === "a13_operativa_shopify" || code === "a14_operativa_meta") {
    const proposals = Array.isArray(output.proposed_writes) ? output.proposed_writes : [];
    const decisions = Array.isArray(output.proposal_decisions) ? output.proposal_decisions : [];
    const decisionByIndex = new Map<number, Record<string, unknown>>();
    decisions.forEach((entry, index) => {
      const decision = record(entry);
      const proposalIndex = typeof decision?.index === "number" ? decision.index : index;
      if (decision) decisionByIndex.set(proposalIndex, decision);
    });
    return {
      answer: shortText(output.answer, 650),
      findings: summarizeFindings(output.findings),
      recommendations: summarizeRecommendations(output.recommendations),
      operational_proposals: proposals.slice(0, 5).flatMap((entry, index) => {
        const proposal = record(entry);
        const title = shortText(proposal?.title, 180);
        if (!proposal || !title) return [];
        return [{
          title,
          description: shortText(proposal.description, 420),
          priority: shortText(proposal.priority, 24),
          rationale: shortText(proposal.rationale, 300),
          evidence: Array.isArray(proposal.evidence) ? proposal.evidence.slice(0, 3).flatMap((item) => {
            const source = record(item);
            const detail = shortText(source?.detail ?? source?.value ?? source?.reference, 180);
            return detail ? [detail] : [];
          }) : [],
          phase: shortText(proposal.phase, 100),
          milestone_id: shortText(proposal.milestone_id, 36),
          alignment_rationale: shortText(proposal.alignment_rationale, 240),
          owner_role: shortText(proposal.owner_role, 24),
          completion_criteria: shortText(proposal.completion_criteria, 240),
          expected_metric: shortText(proposal.expected_metric, 180),
          delivery_status: shortText(decisionByIndex.get(index)?.status, 24),
          task_id: shortText(decisionByIndex.get(index)?.task_id, 36),
        }];
      }),
      sources: summarizeSources(output.sources),
      confidence: shortText(output.confidence, 16),
      warnings: Array.isArray(output.warnings)
        ? output.warnings.slice(0, 3).flatMap((warning) => {
            const text = shortText(warning, 180);
            return text ? [text] : [];
          })
        : [],
    };
  }

  if (code === "a23_creatividad_meta") {
    const proposals = Array.isArray(output.proposed_writes) ? output.proposed_writes : [];
    const decisions = Array.isArray(output.creative_decisions) ? output.creative_decisions : [];
    const proposalDecisions = Array.isArray(output.proposal_decisions) ? output.proposal_decisions : [];
    const deliveryByIndex = new Map<number, Record<string, unknown>>();
    proposalDecisions.forEach((entry, index) => {
      const decision = record(entry);
      const proposalIndex = typeof decision?.index === "number" ? decision.index : index;
      if (decision) deliveryByIndex.set(proposalIndex, decision);
    });
    return {
      creative_decisions: decisions.slice(0, 5).flatMap((entry) => {
        const decision = record(entry);
        const decisionRef = shortText(decision?.decision_ref, 80);
        if (!decision || !decisionRef) return [];
        return [{
          decision_ref: decisionRef,
          action: shortText(decision.action, 40),
          store_id: shortText(decision.store_id, 36),
          account_id: shortText(decision.account_id, 36),
          ad_id: shortText(decision.ad_id, 36),
          creative_id: shortText(decision.creative_id, 36),
          signal: shortText(decision.signal, 300),
          window: shortText(decision.window, 120),
          spend_implicated: typeof decision.spend_implicated === "number" ? decision.spend_implicated : null,
          spend_currency: shortText(decision.spend_currency, 3),
          uncertainty: shortText(decision.uncertainty, 220),
          hypothesis: shortText(decision.hypothesis, 220),
          success_criterion: shortText(decision.success_criterion, 180),
          measurement_verdict: shortText(decision.measurement_verdict, 40),
        }];
      }),
      proposals: proposals.slice(0, 5).flatMap((entry, index) => {
        const proposal = record(entry);
        const title = shortText(proposal?.title, 180);
        if (!proposal || !title) return [];
        const delivery = deliveryByIndex.get(index);
        return [{
          decision_ref: shortText(proposal.decision_ref, 80),
          title,
          description: shortText(proposal.description, 350),
          priority: shortText(proposal.priority, 24),
          phase: shortText(proposal.phase, 100),
          plan_id: shortText(proposal.plan_id, 36),
          plan_version: typeof proposal.plan_version === "number" ? proposal.plan_version : null,
          milestone_id: shortText(proposal.milestone_id, 36),
          delivery_status: shortText(delivery?.status, 24),
          task_id: shortText(delivery?.task_id, 36),
          approval_status: shortText(delivery?.status, 24),
        }];
      }),
      sources: summarizeSources(output.sources),
      confidence: shortText(output.confidence, 16),
      warnings: Array.isArray(output.warnings)
        ? output.warnings.slice(0, 4).flatMap((warning) => {
            const text = shortText(warning, 180);
            return text ? [text] : [];
          })
        : [],
    };
  }

  if (code === "a24_medicion_meta") {
    const assessment = record(output.measurement_assessment);
    const expiresAt = shortText(assessment?.expires_at, 40);
    const expiryMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    const proposalDecisions = Array.isArray(output.proposal_decisions) ? output.proposal_decisions : [];
    const decisionByIndex = new Map<number, Record<string, unknown>>();
    proposalDecisions.forEach((entry, index) => {
      const decision = record(entry);
      const proposalIndex = typeof decision?.index === "number" ? decision.index : index;
      if (decision) decisionByIndex.set(proposalIndex, decision);
    });
    return {
      answer: shortText(output.answer, 650),
      measurement_assessment: assessment ? {
        status: shortText(assessment.status, 40),
        reason_codes: Array.isArray(assessment.reason_codes)
          ? assessment.reason_codes.slice(0, 8).flatMap((item) => typeof item === "string" ? [item.slice(0, 80)] : [])
          : [],
        evidence_counts: record(assessment.evidence_counts),
        store_id: shortText(record(assessment.scope)?.store_id, 36),
        window: record(assessment.window),
        evaluated_at: shortText(assessment.evaluated_at, 40),
        expires_at: expiresAt,
        valid_for_new_decisions: Number.isFinite(expiryMs) && expiryMs > Date.now(),
        capability_matrix: Array.isArray(assessment.capability_matrix) ? assessment.capability_matrix.slice(0, 6) : [],
        measurement_engine: record(assessment.measurement_engine),
        planes: record(assessment.planes),
        limitations: Array.isArray(assessment.limitations)
          ? assessment.limitations.slice(0, 3).flatMap((item) => typeof item === "string" ? [item.slice(0, 220)] : [])
          : [],
      } : { status: "unknown", valid_for_new_decisions: false },
      findings: summarizeFindings(output.findings),
      recommendations: summarizeRecommendations(output.recommendations),
      proposed_writes: Array.isArray(output.proposed_writes)
        ? output.proposed_writes.slice(0, 4).flatMap((value, index) => {
            const proposal = record(value);
            const title = shortText(proposal?.title, 160);
            const delivery = decisionByIndex.get(index);
            return title ? [{
              title,
              description: shortText(proposal?.description, 300),
              owner_role: shortText(proposal?.owner_role, 24),
              completion_criteria: shortText(proposal?.completion_criteria, 200),
              plan_id: shortText(proposal?.plan_id, 36),
              plan_version: Number.isInteger(proposal?.plan_version) ? proposal?.plan_version : null,
              milestone_id: shortText(proposal?.milestone_id, 36),
              delivery_status: shortText(delivery?.status, 24),
              task_id: shortText(delivery?.task_id, 36),
            }] : [];
          })
        : [],
      warnings: Array.isArray(output.warnings)
        ? output.warnings.slice(0, 3).flatMap((item) => typeof item === "string" ? [item.slice(0, 180)] : [])
        : [],
    };
  }

  if (code === "a25_cambios_meta") {
    const assessment = record(output.measurement_assessment);
    const assessmentProvenance = record(assessment?.provenance);
    const expiresAt = shortText(assessmentProvenance?.expires_at, 40);
    const expiryMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
    const evidenceByEventId = new Map<string, Record<string, unknown>>();
    (Array.isArray(output.change_evidence) ? output.change_evidence : []).forEach((entry) => {
      const event = record(entry);
      if (event && typeof event.event_id === "string") evidenceByEventId.set(event.event_id, event);
    });
    const observations = Array.isArray(output.change_observations) ? output.change_observations : [];
    const proposals = Array.isArray(output.proposed_writes) ? output.proposed_writes : [];
    const decisions = Array.isArray(output.proposal_decisions) ? output.proposal_decisions : [];
    const deliveryByIndex = new Map<number, Record<string, unknown>>();
    decisions.forEach((entry, index) => {
      const decision = record(entry);
      const proposalIndex = typeof decision?.index === "number" ? decision.index : index;
      if (decision) deliveryByIndex.set(proposalIndex, decision);
    });
    return {
      answer: shortText(output.answer, 650),
      measurement_gate: {
        status: shortText(assessment?.status, 40) ?? "unknown",
        evaluated_at: shortText(assessmentProvenance?.evaluated_at, 40),
        expires_at: expiresAt,
        valid_for_new_decisions: Number.isFinite(expiryMs) && expiryMs > Date.now(),
      },
      change_coverage: record(output.change_coverage),
      observations: observations.slice(0, 8).flatMap((entry) => {
        const observation = record(entry);
        if (!observation) return [];
        const event = typeof observation.event_ref === "string" ? evidenceByEventId.get(observation.event_ref) : null;
        return [{
          event_ref: shortText(observation.event_ref, 36),
          event_time: shortText(event?.event_time, 40),
          comparison_status: shortText(event?.comparison_status, 48),
          currency_code: shortText(event?.currency_code, 3),
          action: shortText(observation.action, 24),
          interpretation: shortText(observation.interpretation, 360),
          limitation: shortText(observation.limitation, 240),
          next_review_at: shortText(observation.next_review_at, 40),
        }];
      }),
      proposals: proposals.slice(0, 5).flatMap((entry, index) => {
        const proposal = record(entry);
        const title = shortText(proposal?.title, 180);
        if (!proposal || !title) return [];
        const delivery = deliveryByIndex.get(index);
        return [{
          event_ref: shortText(proposal.event_ref, 36),
          investigation_action: shortText(proposal.investigation_action, 24),
          title,
          description: shortText(proposal.description, 320),
          delivery_status: shortText(delivery?.status, 24),
          task_id: shortText(delivery?.task_id, 36),
        }];
      }),
      warnings: Array.isArray(output.warnings)
        ? output.warnings.slice(0, 3).flatMap((item) => typeof item === "string" ? [item.slice(0, 180)] : [])
        : [],
    };
  }

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

  if (code === "a26_contenido_email") {
    return {
      answer: shortText(output.answer, 650), findings: summarizeFindings(output.findings),
      content_reviews: Array.isArray(output.content_reviews) ? output.content_reviews.slice(0, 5).map((item) => {
        const review = record(item) ?? {};
        return { review_ref: review.review_ref, message_id: review.message_id, account_id: review.account_id,
          content_hash: review.content_hash, observation: shortText(review.observation, 350),
          permitted_change: shortText(review.permitted_change, 350), acceptance_criterion: shortText(review.acceptance_criterion, 250),
          destination: review.destination, limitation: shortText(review.limitation, 250) };
      }) : [],
      delivery: Array.isArray(output.proposal_delivery) ? output.proposal_delivery.slice(0, 4) : [],
      confidence: shortText(output.confidence, 16), sources: summarizeSources(output.sources),
    };
  }
  if (code === "a28_arquitecto_flujos") {
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
      flow_architecture: summarizeKlaviyoFlowArchitecture(output.flow_architecture),
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
/**
 * `includePendingAnalysis`: los planificadores leen también el ANÁLISIS de
 * salidas aún pendientes de aprobación. La aprobación protege lo que la IA
 * escribiría (sus tareas propuestas, que este resumen no incluye), no lo que
 * observa; sin esto nadie aprueba los especialistas y el plan no los ve nunca.
 */
export function summarizeRecentSpecialistOutputs(
  rows: readonly SpecialistRunCandidate[],
  options: { organizationId: string; storeId: string | null; now?: Date; includePendingAnalysis?: boolean },
) {
  const allowedStatuses = options.includePendingAnalysis
    ? ["approved", "published", "pending_approval"]
    : ["approved", "published"];
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
    if (!outputRow || !allowedStatuses.includes(String(outputRow.status))) return [];
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
        approval_note: outputRow.status === "pending_approval"
          ? "Análisis sin revisar por el consultor: úsalo como indicio, no como conclusión validada."
          : null,
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
