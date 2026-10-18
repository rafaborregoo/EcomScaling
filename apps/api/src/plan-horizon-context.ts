type Row = Record<string, unknown>;

/** Resolve an explicit planner store without broadening to the organization. */
export function resolvePlanStoreScope(
  connectionId: string | null | undefined,
  result: { data: unknown; error: unknown },
) {
  if (!connectionId) {
    return {
      ok: true as const,
      storeId: null,
      storeLabel: "todas las tiendas de la organizacion",
    };
  }
  if (result.error) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "plan_store_scope_unavailable",
    };
  }
  const store = asRow(result.data);
  const storeId = text(store?.id, 64);
  const storeName = text(store?.shop_name, 180);
  if (!storeId) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "plan_store_not_found",
    };
  }
  return {
    ok: true as const,
    storeId,
    storeLabel: `la tienda "${storeName ?? storeId}"`,
  };
}

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

/** Only alerts with an explicit store_id belong in a store-specific plan. */
export function scopeAlertsForPlan(
  rawAlerts: unknown[],
  selectedStoreId: string | null,
) {
  if (selectedStoreId) {
    const alerts = rawAlerts.filter(
      (alert): alert is Record<string, unknown> =>
        Boolean(alert) &&
        typeof alert === "object" &&
        (alert as Record<string, unknown>).store_id === selectedStoreId,
    );
    return {
      status: "available" as const,
      scope: "store" as const,
      alerts,
      unscoped_omitted: rawAlerts.length - alerts.length,
    };
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

/**
 * Backlog abierto en un tamaño que cabe en el contexto. Un Camino aprobado
 * vuelca decenas de tareas con descripciones largas: enviadas enteras truncan
 * el contexto y el planificador concluía "ya está cubierto". Aquí lo cercano
 * (vencido, en curso, sin fecha o dentro de la ventana) va con detalle y lo
 * lejano solo como recuento y titulares con fecha.
 */
export function summarizeOpenTasksForPlan(
  rawTasks: unknown[],
  selectedStoreId: string | null,
  options: { now?: number; nearDays?: number; nearLimit?: number; laterLimit?: number; totalCount?: number | null } = {},
) {
  const now = options.now ?? Date.now();
  const nearDays = options.nearDays ?? 14;
  const nearMs = nearDays * 24 * 60 * 60 * 1000;
  const near: Array<Row & { due_ms: number }> = [];
  const later: Array<{ title: string | null; priority: string | null; due_at: string; due_ms: number }> = [];
  let total = 0;
  for (const rawTask of rawTasks) {
    const task = asRow(rawTask);
    if (!task || !taskBelongsToPlanStore(task.store_id, selectedStoreId)) continue;
    const status = text(task.status, 40);
    if (status !== "pending" && status !== "in_progress") continue;
    total += 1;
    const dueAt = text(task.due_at, 64);
    const dueMs = dueAt ? Date.parse(dueAt) : Number.NaN;
    if (dueAt && Number.isFinite(dueMs) && dueMs - now > nearMs && status === "pending") {
      later.push({ title: text(task.title, 140), priority: text(task.priority, 20), due_at: dueAt, due_ms: dueMs });
      continue;
    }
    near.push({
      id: text(task.id, 64),
      title: text(task.title, 140),
      priority: text(task.priority, 20),
      status,
      due_at: dueAt,
      overdue: Number.isFinite(dueMs) && dueMs < now,
      source: text(task.source, 40),
      description: text(task.description, 240),
      due_ms: Number.isFinite(dueMs) ? dueMs : Number.POSITIVE_INFINITY,
    });
  }
  const priorityRank = (value: unknown) => ({ urgent: 4, high: 3, medium: 2, low: 1 }[String(value)] ?? 0);
  near.sort((a, b) =>
    Number(b.status === "in_progress") - Number(a.status === "in_progress") ||
    Number(b.overdue) - Number(a.overdue) ||
    priorityRank(b.priority) - priorityRank(a.priority) ||
    a.due_ms - b.due_ms,
  );
  later.sort((a, b) => a.due_ms - b.due_ms);
  const nearLimit = options.nearLimit ?? 25;
  const laterLimit = options.laterLimit ?? 15;
  return {
    scope: selectedStoreId ? ("store_plus_unscoped" as const) : ("organization" as const),
    total_open: options.totalCount ?? total,
    sample_truncated: options.totalCount !== null && options.totalCount !== undefined && options.totalCount > rawTasks.length,
    query_omitted: Math.max(0, (options.totalCount ?? rawTasks.length) - rawTasks.length),
    near_term_window_days: nearDays,
    near_term: near.slice(0, nearLimit).map(({ due_ms: _drop, ...row }) => row),
    near_term_omitted: Math.max(0, near.length - nearLimit),
    later_count: later.length,
    later: later.slice(0, laterLimit).map(({ due_ms: _drop, ...row }) => row),
    note: "near_term trae detalle; later son tareas con fecha lejana y solo se listan para no duplicarlas. Una tarea lejana NO cubre una urgencia de hoy.",
  };
}

/**
 * Quantify the open commitments visible to A18 without pretending that task
 * counts are available work hours. The database has no effort estimate or
 * per-role monthly capacity field, so numeric free capacity stays unknown.
 */
export function summarizeMonthlyPlanCapacity(
  rawTasks: unknown[],
  selectedStoreId: string | null,
  options: { now?: number; horizonDays?: number } = {},
) {
  const now = options.now ?? Date.now();
  const horizonMs = Math.max(1, options.horizonDays ?? 30) * 24 * 60 * 60 * 1000;
  const commitments = rawTasks.flatMap((rawTask) => {
    const task = asRow(rawTask);
    if (!task || !taskBelongsToPlanStore(task.store_id, selectedStoreId)) return [];
    const status = text(task.status, 40);
    if (status !== "pending" && status !== "in_progress") return [];
    const dueAt = text(task.due_at, 64);
    const dueAtMs = dueAt ? Date.parse(dueAt) : Number.NaN;
    const hasDueDate = Number.isFinite(dueAtMs);
    const priority = text(task.priority, 40);
    const metadata = asRow(task.metadata);
    const effort = text(metadata?.ai_effort_estimate, 20);
    return [{
      status,
      priority,
      effort: effort === "low" || effort === "medium" || effort === "high" || effort === "unknown"
        ? effort
        : null,
      overdue: hasDueDate && dueAtMs < now,
      dueWithinHorizon: hasDueDate && dueAtMs >= now && dueAtMs <= now + horizonMs,
    }];
  });

  return {
    scope: selectedStoreId ? "store_plus_unscoped" as const : "organization" as const,
    observed_commitments: commitments.length,
    in_progress: commitments.filter((task) => task.status === "in_progress").length,
    pending: commitments.filter((task) => task.status === "pending").length,
    overdue: commitments.filter((task) => task.overdue).length,
    due_within_horizon: commitments.filter((task) => task.dueWithinHorizon).length,
    high_or_urgent: commitments.filter((task) => task.priority === "high" || task.priority === "urgent").length,
    effort_estimates: {
      low: commitments.filter((task) => task.effort === "low").length,
      medium: commitments.filter((task) => task.effort === "medium").length,
      high: commitments.filter((task) => task.effort === "high").length,
      unknown: commitments.filter((task) => task.effort === null || task.effort === "unknown").length,
    },
    effort_estimate_coverage: commitments.length
      ? commitments.filter((task) => task.effort && task.effort !== "unknown").length / commitments.length
      : null,
    estimated_effort_hours: null,
    available_capacity_hours: null,
    capacity_status: "not_quantifiable" as const,
    capacity_limit: "Las bandas cualitativas de esfuerzo describen solo tareas que las tienen; no hay capacidad mensual configurada ni equivalencia validada a horas, así que los datos no calculan disponibilidad.",
  };
}

/** A18 may replan only these exact, active monthly initiatives after approval. */
export function summarizeActiveMonthlyInitiatives(
  rawTasks: unknown[],
  selectedStoreId: string | null,
) {
  return rawTasks.flatMap((rawTask) => {
    const task = asRow(rawTask);
    const metadata = asRow(task?.metadata);
    const initiative = asRow(metadata?.ai_monthly_initiative);
    const status = text(task?.status, 40);
    const storeId = task?.store_id === null ? null : text(task?.store_id, 64);
    if (!task || task.source !== "ai_consultant" || !initiative || !text(task.id, 64) || !text(task.title, 255)) return [];
    if (status !== "pending" && status !== "in_progress") return [];
    if (!taskBelongsToPlanStore(storeId, selectedStoreId)) return [];
    // A store-specific plan cannot supersede organization-wide work or work
    // owned by another store; replacements must stay in the exact store.
    if (selectedStoreId && storeId !== selectedStoreId) return [];
    const lifecycle = text(initiative.lifecycle_status, 32);
    if (lifecycle === "superseded" || lifecycle === "retired") return [];
    return [{
      task_id: text(task.id, 64),
      title: text(task.title, 255),
      status,
      store_id: storeId,
      due_at: text(task.due_at, 64),
      milestone_id: text(initiative.milestone_id, 64),
      initiative_measurement: initiative.initiative_measurement ?? null,
      effort_estimate: text(metadata?.ai_effort_estimate, 20),
    }];
  }).slice(0, 30);
}

/** Bounded parent-goal context shared by daily/weekly/monthly task planning. */
export function summarizeActiveCaminoForPlan(rawPlan: unknown, selectedStoreId: string | null) {
  const plan = asRow(rawPlan);
  if (!plan) return { status: "unavailable", reason: "no_active_path" } as const;
  const phases = (Array.isArray(plan.strategic_plan_phases) ? plan.strategic_plan_phases : [])
    .slice()
    .sort((a, b) => (asRow(a)?.position as number ?? 0) - (asRow(b)?.position as number ?? 0));
  const milestones = phases.flatMap((rawPhase) => {
    const phase = asRow(rawPhase);
    if (!phase) return [];
    const phaseName = text(phase.name, 180);
    const rows = Array.isArray(phase.strategic_plan_milestones) ? phase.strategic_plan_milestones : [];
    return rows.slice().sort((a, b) => (asRow(a)?.position as number ?? 0) - (asRow(b)?.position as number ?? 0)).flatMap((rawMilestone) => {
      const milestone = asRow(rawMilestone);
      if (!milestone || !["locked", "pending", "active"].includes(String(milestone.status))) return [];
      const linkedRows = Array.isArray(milestone.milestone_task_links) ? milestone.milestone_task_links : [];
      const linkedTasks = linkedRows.flatMap((rawLink) => {
        const link = asRow(rawLink);
        const task = asRow(link?.tasks);
        return task && taskBelongsToPlanStore(task.store_id, selectedStoreId)
          && !["completed", "done", "cancelled"].includes(text(task.status, 40) ?? "")
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
    goal: (() => {
      if (typeof plan.goal === "string") return text(plan.goal, 500);
      const goal = asRow(plan.goal);
      if (!goal) return null;
      return {
        metric_key: text(goal.metric_key, 80),
        metric_label: text(goal.metric_label, 120),
        baseline: typeof goal.baseline === "number" && Number.isFinite(goal.baseline) ? goal.baseline : null,
        target: typeof goal.target === "number" && Number.isFinite(goal.target) ? goal.target : null,
        unit: text(goal.unit, 40),
        currency_code: text(goal.currency_code, 3),
        target_date: text(goal.target_date, 40),
        target_offset_days: typeof goal.target_offset_days === "number" && Number.isFinite(goal.target_offset_days) ? goal.target_offset_days : null,
        rationale: text(goal.rationale, 300),
      };
    })(),
    version: typeof plan.version === "number" ? plan.version : null,
    phases: phases.flatMap((rawPhase) => {
      const phase = asRow(rawPhase);
      return phase && ["locked", "pending", "active"].includes(String(phase.status))
        ? [{ name: text(phase.name, 180), status: text(phase.status, 40), position: typeof phase.position === "number" ? phase.position : 0 }]
        : [];
    }).sort((a, b) => a.position - b.position).slice(0, 8).map(({ position: _position, ...phase }) => phase),
    milestones,
  };
}

/**
 * Riesgo de stock por producto en tamaño de plan diario: primero lo que se
 * agota antes (cobertura fiable más baja), después los más vendidos sin
 * cobertura calculable. Recibe filas ya enriquecidas por enrichStockRiskEvidence.
 */
export function summarizeStockRiskForPlan(enrichedRows: unknown[], limit = 12) {
  const rows = enrichedRows.flatMap((raw) => {
    const row = asRow(raw);
    const title = text(row?.title, 120);
    if (!row || !title) return [];
    const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
    return [{
      title,
      available: num(row.available_quantity),
      sold_in_period: num(row.quantity_sold_in_period),
      average_daily_sales: num(row.average_daily_sales),
      days_of_cover: num(row.days_of_cover),
      inventory_sync_is_stale: row.inventory_sync_is_stale === true,
      sample_sufficient: row.stock_coverage_sample_sufficient === true,
    }];
  });
  const withCover = rows.filter((row) => row.days_of_cover !== null)
    .sort((a, b) => (a.days_of_cover ?? 0) - (b.days_of_cover ?? 0));
  const withoutCover = rows.filter((row) => row.days_of_cover === null)
    .sort((a, b) => (b.sold_in_period ?? 0) - (a.sold_in_period ?? 0));
  const items = [...withCover, ...withoutCover].slice(0, limit);
  return {
    status: rows.length ? "available" as const : "no_sales_in_period" as const,
    products_with_sales: rows.length,
    items,
    note: "days_of_cover solo existe con inventario sincronizado reciente y muestra suficiente; null no significa stock sano. Un producto con cobertura menor que el plazo de cualquier tarea abierta que lo trate es una urgencia de hoy.",
  };
}

/**
 * Conclusiones aprobadas de los especialistas (stock, email, Meta, retención,
 * postventa...) en tamaño de plan diario. El resumen general pesa ~2,5k por
 * agente y con una docena se cortaba a mitad del bloque; aquí cada uno deja su
 * conclusión, sus hallazgos y lo que recomienda, con fecha y procedencia.
 */
export function compactSpecialistOutputsForPlan(blockData: unknown, limit = 10) {
  const data = asRow(blockData);
  const outputs = Array.isArray(data?.outputs) ? data.outputs : [];
  return {
    status: text(data?.status, 40) ?? "unavailable",
    outputs: outputs.slice(0, limit).flatMap((raw) => {
      const run = asRow(raw);
      const summary = asRow(run?.summary);
      const code = text(run?.agent_code, 80);
      if (!run || !summary || !code) return [];
      const findings = Array.isArray(summary.findings) ? summary.findings : [];
      const recommendations = Array.isArray(summary.recommendations) ? summary.recommendations : [];
      return [{
        agent_code: code,
        output_id: text(run.output_id, 64),
        as_of: text(run.as_of, 40),
        valid_until: text(run.valid_until, 40),
        reviewed_by_consultant: run.output_status !== "pending_approval",
        conclusion: text(summary.answer ?? summary.diagnosis, 320),
        findings: findings.slice(0, 3).flatMap((rawFinding) => {
          const finding = asRow(rawFinding);
          const title = text(finding?.title, 160);
          return title ? [{ title, severity: text(finding?.severity, 24), evidence: text(finding?.evidence, 180) }] : [];
        }),
        recommendations: recommendations.slice(0, 2).flatMap((rawRecommendation) => {
          const recommendation = asRow(rawRecommendation);
          const action = text(recommendation?.action, 200);
          return action ? [{ action, priority: text(recommendation?.priority, 24) }] : [];
        }),
      }];
    }),
    interpretation: "Análisis recientes de otros agentes sobre esta tienda. Úsalos para decidir qué toca HOY (el primer paso concreto de lo que recomiendan), citando su output_id; no los copies como tarea ni los presentes como cifras actuales. Pasado valid_until son solo pistas. reviewed_by_consultant=false: análisis aún sin revisar, úsalo como indicio y dilo si apoyas una tarea en él.",
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

const PLAN_AGENT_FRESHNESS_MS: Record<string, number> = {
  a04_generador_tareas: 36 * 60 * 60 * 1000,
  a17_plan_semanal: 8 * 24 * 60 * 60 * 1000,
  a18_plan_mensual: 35 * 24 * 60 * 60 * 1000,
};

/** Give A19 the newest approved daily/weekly/monthly work for this exact scope. */
export function summarizeRecentPlanAgentRuns(
  rawRuns: unknown[],
  options: { organizationId: string; storeId: string | null; now?: number },
) {
  const now = options.now ?? Date.now();
  const latestByCode = new Map<string, Record<string, unknown>>();
  for (const rawRun of rawRuns) {
    const run = asRow(rawRun);
    const versions = run?.agent_versions;
    const version = Array.isArray(versions) ? asRow(versions[0]) : asRow(versions);
    const definitions = version?.agent_definitions;
    const definition = Array.isArray(definitions) ? asRow(definitions[0]) : asRow(definitions);
    const code = text(definition?.code, 80);
    if (!run || !code || !PLAN_AGENT_FRESHNESS_MS[code]) continue;
    if (run.organization_id !== options.organizationId || run.store_id !== options.storeId || run.status !== "succeeded") continue;
    const outputs = run.agent_outputs;
    const outputRow = Array.isArray(outputs) ? asRow(outputs[0]) : asRow(outputs);
    if (!outputRow || !["approved", "published"].includes(String(outputRow.status))) continue;
    const finishedAt = text(run.finished_at ?? run.started_at, 64);
    const finishedAtMs = finishedAt ? Date.parse(finishedAt) : Number.NaN;
    if (!Number.isFinite(finishedAtMs) || finishedAtMs > now || latestByCode.has(code)) continue;

    const output = asRow(outputRow.output);
    if (!output) continue;
    const findings = Array.isArray(output.findings) ? output.findings : [];
    const recommendations = Array.isArray(output.recommendations) ? output.recommendations : [];
    const writes = Array.isArray(output.proposed_writes)
      ? output.proposed_writes
      : Array.isArray(output.proposed_tasks) ? output.proposed_tasks : [];
    latestByCode.set(code, {
      agent_code: code,
      run_id: text(run.id, 64),
      output_id: text(outputRow.id, 64),
      as_of: finishedAt,
      freshness_ms: PLAN_AGENT_FRESHNESS_MS[code],
      stale: now - finishedAtMs > PLAN_AGENT_FRESHNESS_MS[code],
      summary: {
        answer: text(output.answer, 350),
        findings: findings.slice(0, 4).flatMap((rawFinding) => {
          const finding = asRow(rawFinding);
          const title = text(finding?.title, 180);
          return title ? [{ title, severity: text(finding?.severity, 24), evidence: text(finding?.evidence, 240) }] : [];
        }),
        recommendations: recommendations.slice(0, 3).flatMap((rawRecommendation) => {
          const recommendation = asRow(rawRecommendation);
          const action = text(recommendation?.action ?? recommendation?.description, 220);
          return action ? [{ action, priority: text(recommendation?.priority, 24) }] : [];
        }),
        proposed_tasks: writes.slice(0, 4).flatMap((rawWrite) => {
          const write = asRow(rawWrite);
          const title = text(write?.title, 180);
          if (!title || write?.kind === "note") return [];
          return [{
            title,
            description: text(write?.description, 240),
            rationale: text(write?.rationale, 200),
            priority: text(write?.priority, 24),
            milestone_id: text(write?.milestone_id, 64),
          }];
        }),
      },
    });
  }

  return ["a04_generador_tareas", "a17_plan_semanal", "a18_plan_mensual"].map((code) =>
    latestByCode.get(code) ?? { agent_code: code, status: "unavailable", reason: "no_recent_approved_output" },
  );
}

/** Reduce sibling planner runs to the newest useful, explicitly scoped context. */
export function summarizeSiblingPlanRuns(
  runs: unknown[],
  options: {
    currentAgentCode: string;
    horizonByAgent: Record<string, string>;
    staleAfterMsByAgent?: Record<string, number>;
    now?: number;
  },
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
    const staleAfterMs = options.staleAfterMsByAgent?.[code] ?? 14 * 24 * 60 * 60 * 1000;
    const decisions = Array.isArray(output.proposal_decisions) ? output.proposal_decisions : [];
    const proposals = rawWrites.slice(0, 5).flatMap((rawWrite, proposalIndex) => {
      const write = asRow(rawWrite);
      if (!write) return [];
      const decision = decisions.find((item) => asRow(item)?.index === proposalIndex);
      const effective = asRow(decision);
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
      const rawEvidence = write.evidence ?? write.source;
      const evidence = Array.isArray(rawEvidence)
        ? rawEvidence.slice(0, 4).flatMap((item) => {
            const evidenceRow = asRow(item);
            if (!evidenceRow) return [];
            return [{ label: text(evidenceRow.label, 100), value: text(evidenceRow.value, 120), period: text(evidenceRow.period, 80), source: text(evidenceRow.source, 80) }];
          })
        : text(rawEvidence, 300);
      return [{
        kind: write.kind === "task" || write.kind === "note" ? write.kind : null,
        title: text(effective?.title, 200) ?? title,
        description: text(effective?.description) ?? text(write.description),
        rationale: text(write.rationale ?? write.why_it_matters),
        priority: text(effective?.priority, 40) ?? text(write.priority, 40),
        ...(effective ? {
          decision: text(effective.decision, 40),
          status: text(effective.status, 40),
          task_id: text(effective.task_id, 64),
        } : {}),
        owner: text(write.owner, 80),
        owner_role: ownerRole,
        milestone_id: milestoneId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(milestoneId)
          ? milestoneId.toLowerCase()
          : null,
        completion_criteria: text(write.completion_criteria, 500),
        expected_metric: text(write.expected_metric, 240),
        initiative_measurement: initiativeMeasurement,
        evidence,
      }];
    });
    return [{
      horizon: options.horizonByAgent[code],
      agent_code: code,
      run_id: text(run.id, 64),
      output_id: text(outputRow?.id, 64),
      generated_at: startedAt,
      stale: ageMs === null || ageMs > staleAfterMs,
      output_status: text(outputRow?.status, 40),
      approval_required: typeof outputRow?.approval_required === "boolean"
        ? outputRow.approval_required
        : typeof output.approval_required === "boolean"
          ? output.approval_required
          : null,
      proposals,
    }];
  });
}
