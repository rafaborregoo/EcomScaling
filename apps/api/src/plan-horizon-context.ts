type Row = Record<string, unknown>;

/** Preserve the difference between an empty result and a failed context read. */
export function planQueryEvidence<T>(data: T, error: unknown) {
  return error
    ? { status: "unavailable" as const, reason: "query_error" as const }
    : { status: "available" as const, data };
}

/** Unscoped tasks are organization-wide; scoped tasks belong only to their store. */
export function taskBelongsToPlanStore(taskStoreId: unknown, selectedStoreId: string | null) {
  return selectedStoreId === null || taskStoreId === null || taskStoreId === undefined || taskStoreId === selectedStoreId;
}

/** Organization-wide alerts cannot safely inform a single-store plan. */
export function scopeAlertsForPlan(rawAlerts: unknown[], selectedStoreId: string | null) {
  if (selectedStoreId) {
    return { status: "omitted_unscoped" as const, scope: "organization" as const };
  }
  return {
    status: "available" as const,
    scope: "organization" as const,
    alerts: rawAlerts.slice(0, 30),
  };
}

/** Recent task dispositions are execution feedback, not proof of business impact. */
export function summarizeRecentPlanTaskOutcomes(
  rawTasks: unknown[],
  selectedStoreId: string | null,
  options: { now?: number; lookbackDays?: number; limit?: number } = {},
) {
  const now = options.now ?? Date.now();
  const lookbackMs = Math.max(1, options.lookbackDays ?? 60) * 24 * 60 * 60 * 1000;
  const limit = Math.min(30, Math.max(1, options.limit ?? 12));
  return rawTasks.flatMap((rawTask) => {
    const task = asRow(rawTask);
    if (!task || !taskBelongsToPlanStore(task.store_id, selectedStoreId)) return [];
    const status = text(task.status, 40);
    if (!status || !["completed", "ignored", "cancelled"].includes(status)) return [];
    const updatedAt = text(task.updated_at, 64);
    const updatedMs = updatedAt ? Date.parse(updatedAt) : Number.NaN;
    if (!Number.isFinite(updatedMs) || updatedMs > now || now - updatedMs > lookbackMs) return [];
    const title = text(task.title, 180);
    if (!title) return [];
    const metricName = text(task.outcome_metric_name, 120);
    const measuredAt = text(task.outcome_measured_at, 40);
    const finiteNumber = (value: unknown) => {
      if (typeof value !== "number" && typeof value !== "string") return null;
      if (typeof value === "string" && !value.trim()) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return [{
      title,
      status,
      source: text(task.source, 40),
      completed_at: text(task.completed_at, 64),
      updated_at: updatedAt,
      ignored_reason: status === "ignored" ? text(task.ignored_reason, 240) : null,
      ...(status === "completed" && metricName && measuredAt ? {
        measured_outcome: {
          metric_name: metricName,
          evidence_status: "user_reported_unverified",
          before_value: finiteNumber(task.outcome_before_value),
          after_value: finiteNumber(task.outcome_after_value),
          unit: text(task.outcome_unit, 40),
          summary: text(task.outcome_summary, 500),
          measured_at: measuredAt,
        },
      } : {}),
    }];
  }).slice(0, limit);
}

/** Bounded parent-goal context shared by daily/weekly/monthly task planning. */
export function summarizeActiveCaminoForPlan(rawPlan: unknown, selectedStoreId: string | null) {
  const plan = asRow(rawPlan);
  if (!plan) return { status: "unavailable", reason: "no_active_path" } as const;
  const phases = Array.isArray(plan.strategic_plan_phases) ? plan.strategic_plan_phases : [];
  const milestones = phases.flatMap((rawPhase) => {
    const phase = asRow(rawPhase);
    if (!phase) return [];
    const phaseName = text(phase.name, 180);
    const rows = Array.isArray(phase.strategic_plan_milestones) ? phase.strategic_plan_milestones : [];
    return rows.flatMap((rawMilestone) => {
      const milestone = asRow(rawMilestone);
      if (!milestone || !["pending", "in_progress"].includes(String(milestone.status))) return [];
      const linkedRows = Array.isArray(milestone.milestone_task_links) ? milestone.milestone_task_links : [];
      const linkedTasks = linkedRows.flatMap((rawLink) => {
        const link = asRow(rawLink);
        const task = asRow(link?.tasks);
        return task && taskBelongsToPlanStore(task.store_id, selectedStoreId)
          && text(task.status, 40) !== "done" && text(task.status, 40) !== "cancelled"
          ? [{ title: text(task.title, 180), status: text(task.status, 40) }]
          : [];
      }).slice(0, 3);
      return [{
        id: text(milestone.id, 64),
        phase: phaseName,
        name: text(milestone.name, 180),
        description: text(milestone.description, 350),
        status: text(milestone.status, 40),
        target_date: text(milestone.target_date, 40),
        linked_tasks: linkedTasks,
      }];
    });
  }).slice(0, 12);
  return {
    status: "available" as const,
    plan: text(plan.name, 180),
    goal: text(plan.goal, 500),
    version: typeof plan.version === "number" ? plan.version : null,
    phases: phases.flatMap((rawPhase) => {
      const phase = asRow(rawPhase);
      return phase && ["pending", "in_progress"].includes(String(phase.status))
        ? [{ name: text(phase.name, 180), status: text(phase.status, 40) }]
        : [];
    }).slice(0, 8),
    milestones,
  };
}

function asRow(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;
}

function text(value: unknown, max = 500): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : null;
}

/** Reduce sibling planner runs to the newest useful, explicitly scoped context. */
export function summarizeSiblingPlanRuns(
  runs: unknown[],
  options: { currentAgentCode: string; horizonByAgent: Record<string, string>; now?: number },
) {
  const now = options.now ?? Date.now();
  const latest = new Map<string, Row>();

  for (const rawRun of runs) {
    const run = asRow(rawRun);
    const versions = run?.agent_versions;
    const version = Array.isArray(versions) ? asRow(versions[0]) : asRow(versions);
    const definition = asRow(version?.agent_definitions);
    const code = text(definition?.code, 80);
    if (!run || !code || code === options.currentAgentCode || !options.horizonByAgent[code]) continue;
    if (!latest.has(code)) latest.set(code, run);
  }

  return [...latest.entries()].flatMap(([code, run]) => {
    const outputs = run.agent_outputs;
    const outputRow = Array.isArray(outputs) ? asRow(outputs[0]) : asRow(outputs);
    const output = asRow(outputRow?.output);
    if (!output) return [];
    const rawWrites = Array.isArray(output.proposed_writes)
      ? output.proposed_writes
      : Array.isArray(output.proposed_tasks)
        ? output.proposed_tasks
        : [];
    const startedAt = text(run.started_at, 64);
    const ageMs = startedAt && Number.isFinite(Date.parse(startedAt))
      ? Math.max(0, now - Date.parse(startedAt))
      : null;
    const proposals = rawWrites.slice(0, 5).flatMap((rawWrite) => {
      const write = asRow(rawWrite);
      if (!write) return [];
      const title = text(write.title, 200);
      if (!title) return [];
      const measurement = asRow(write.initiative_measurement);
      const metricName = text(measurement?.metric_name, 120);
      const evaluationWindow = text(measurement?.evaluation_window, 120);
      const finiteNumber = (value: unknown) =>
        typeof value === "number" && Number.isFinite(value) ? value : null;
      const initiativeMeasurement = metricName && evaluationWindow
        ? {
            metric_name: metricName,
            unit: text(measurement?.unit, 40),
            baseline: finiteNumber(measurement?.baseline),
            target: finiteNumber(measurement?.target),
            evaluation_window: evaluationWindow,
          }
        : null;
      const milestoneId = text(write.milestone_id, 64);
      const ownerRole = write.owner_role === "cliente" || write.owner_role === "consultor"
        ? write.owner_role
        : null;
      return [{
        kind: write.kind === "task" || write.kind === "note" ? write.kind : null,
        title,
        description: text(write.description),
        rationale: text(write.rationale ?? write.why_it_matters),
        priority: text(write.priority, 40),
        owner: text(write.owner, 80),
        owner_role: ownerRole,
        milestone_id: milestoneId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(milestoneId)
          ? milestoneId.toLowerCase()
          : null,
        completion_criteria: text(write.completion_criteria, 500),
        expected_metric: text(write.expected_metric, 240),
        initiative_measurement: initiativeMeasurement,
        evidence: text(write.evidence ?? write.source, 300),
      }];
    });
    return [{
      horizon: options.horizonByAgent[code],
      agent_code: code,
      generated_at: startedAt,
      stale: ageMs === null || ageMs > 14 * 24 * 60 * 60 * 1000,
      output_status: text(outputRow?.status, 40),
      approval_required: typeof output.approval_required === "boolean" ? output.approval_required : null,
      proposals,
    }];
  });
}
