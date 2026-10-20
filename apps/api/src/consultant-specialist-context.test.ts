import assert from "node:assert/strict";
import test from "node:test";
import {
  summarizeRecentSpecialistOutputs,
  WEEKLY_PLAN_SPECIALIST_AGENT_CODES,
  type SpecialistRunCandidate,
} from "./consultant-specialist-context.js";

const now = new Date("2026-09-27T12:00:00.000Z");

test("el plan semanal consulta especialistas sin duplicar A02 ni contradecir el Camino activo", () => {
  assert.equal(WEEKLY_PLAN_SPECIALIST_AGENT_CODES.includes("a02_monitor_negocio"), false);
  assert.equal(WEEKLY_PLAN_SPECIALIST_AGENT_CODES.includes("a19_arquitecto_camino"), false);
  assert.equal(WEEKLY_PLAN_SPECIALIST_AGENT_CODES.includes("a12_analista_email"), true);
  assert.equal(WEEKLY_PLAN_SPECIALIST_AGENT_CODES.includes("a28_arquitecto_flujos"), true);
  assert.equal(WEEKLY_PLAN_SPECIALIST_AGENT_CODES.includes("a06_planificador_stock"), true);
});

function candidate(overrides: Partial<SpecialistRunCandidate> = {}): SpecialistRunCandidate {
  return {
    id: "run-1",
    organization_id: "org-1",
    store_id: "store-1",
    status: "succeeded",
    finished_at: "2026-09-26T12:00:00.000Z",
    time_range: { start: "2026-09-01", end: "2026-09-26", untrusted_extra: "must-not-pass" },
    lookback_days: 30,
    agent_versions: { version: "v4", agent_definitions: { code: "a12_analista_email" } },
    agent_outputs: {
      id: "output-1",
      status: "approved",
      output: {
        answer: "Lectura reciente",
        confidence: "medium",
        findings: [{ title: "Tasa de clics", severity: "medium", evidence: "2.1% en 30 días", area: "klaviyo" }],
        recommendations: [{ action: "Revisar segmento", priority: "high", expected_impact: "Mejorar relevancia", owner: "consultor" }],
        sources: [{ kind: "metric", reference: "klaviyo/email", period: "30d" }],
        warnings: [],
        internal_secret: "never include arbitrary output fields",
      },
    },
    ...overrides,
  };
}

test("solo ofrece la salida más reciente, aprobada y vigente del ámbito exacto", () => {
  const older = candidate({ id: "run-old", finished_at: "2026-09-20T12:00:00.000Z" });
  const latest = candidate({ id: "run-new", finished_at: "2026-09-26T12:00:00.000Z" });
  const rows = summarizeRecentSpecialistOutputs([
    older,
    latest,
    candidate({ id: "foreign-org", organization_id: "org-2" }),
    candidate({ id: "other-store", store_id: "store-2" }),
    candidate({ id: "failed", status: "failed" }),
    candidate({ id: "pending", agent_outputs: { ...candidate().agent_outputs as object, status: "pending_approval" } }),
    candidate({ id: "stale", finished_at: "2026-08-01T12:00:00.000Z" }),
    candidate({ id: "future", finished_at: "2026-09-28T12:00:00.000Z" }),
    candidate({ id: "unknown-agent", agent_versions: { version: "v1", agent_definitions: { code: "a28_nuevo" } } }),
  ], { organizationId: "org-1", storeId: "store-1", now });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.run_id, "run-new");
  assert.equal(rows[0]?.output_id, "output-1");
  assert.equal(rows[0]?.agent_code, "a12_analista_email");
  assert.equal((rows[0]?.summary as { answer: string }).answer, "Lectura reciente");
  assert.equal(JSON.stringify(rows).includes("internal_secret"), false);
  assert.deepEqual(rows[0]?.period, { start: "2026-09-01", end: "2026-09-26" });
});

test("A19 recibe oportunidades y alineación de A13, no solo el contador de propuestas", () => {
  const row = candidate({
    agent_versions: { version: "v2", agent_definitions: { code: "a13_operativa_shopify" } },
    agent_outputs: {
      id: "output-a13",
      status: "approved",
      output: {
        answer: "La conversión móvil es el principal bloqueo medido.",
        confidence: "medium",
        findings: [{ title: "Caída en checkout", severity: "high", evidence: "8% menos pedidos en 30 días", area: "shopify" }],
        recommendations: [],
        proposed_writes: [{
          title: "Probar checkout móvil",
          description: "Corregir el error de validación.",
          priority: "high",
          rationale: "Reduce el bloqueo observado en la métrica del Camino.",
          evidence: [{ label: "Conversión", value: "8% menos", period: "30 días", source: "shopify" }],
          phase: "Conversión",
          milestone_id: "83000000-0000-4000-8000-000000000013",
          alignment_rationale: "Avanza hacia la meta aprobada de pedidos rentables.",
        }],
        warnings: [],
        sources: [],
      },
    },
  });
  const [summary] = summarizeRecentSpecialistOutputs([row], {
    organizationId: "org-1",
    storeId: "store-1",
    now,
  });
  assert.ok(summary);
  assert.equal(summary.agent_code, "a13_operativa_shopify");
  assert.equal(summary.summary.answer, "La conversión móvil es el principal bloqueo medido.");
  const proposal = (summary.summary.operational_proposals as Array<Record<string, unknown>>)[0];
  assert.ok(proposal);
  assert.equal(proposal.title, "Probar checkout móvil");
  assert.equal(proposal.phase, "Conversión");
  assert.equal(proposal.alignment_rationale, "Avanza hacia la meta aprobada de pedidos rentables.");
});

test("sin tienda seleccionada, no mezcla diagnósticos que pertenecen a tiendas concretas", () => {
  const rows = summarizeRecentSpecialistOutputs([
    candidate({ id: "store-bound" }),
    candidate({
      id: "aggregate",
      store_id: null,
      agent_outputs: {
        id: "output-aggregate",
        status: "published",
        output: { answer: "Agregado de organización", findings: [], recommendations: [], sources: [], warnings: [], confidence: "low" },
      },
    }),
  ], { organizationId: "org-1", storeId: null, now });

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.run_id, "aggregate");
  assert.equal(rows[0]?.store_id, null);
});

test("A19 conserva objetivo y fases sin propagar el payload completo del plan", () => {
  const row = candidate({
    agent_versions: { version: "v9", agent_definitions: { code: "a19_arquitecto_camino" } },
    agent_outputs: {
      id: "camino-output",
      status: "approved",
      output: {
        plan_name: "Camino 90 días",
        diagnosis: "Margen por debajo del objetivo.",
        confidence: "medium",
        goal: { metric_key: "net_margin_pct", metric_label: "Margen", baseline: 22, target: 28, currency_code: "EUR", target_offset_days: 90, private_extra: "omit" },
        phases: [{ name: "Corregir oferta", rationale: "Hay evidencia", milestones: [{ name: "m1", description: "detalle privado" }] }],
        warnings: [],
      },
    },
  });
  const [result] = summarizeRecentSpecialistOutputs([row], { organizationId: "org-1", storeId: "store-1", now });
  const summary = result?.summary as { phase_count: number; phases: Array<{ name: string }>; goal: { target: number; private_extra?: string } };

  assert.equal(summary.phase_count, 1);
  assert.equal(summary.phases[0]?.name, "Corregir oferta");
  assert.equal(summary.goal.target, 28);
  assert.equal(summary.goal.private_extra, undefined);
  assert.equal(JSON.stringify(result).includes("detalle privado"), false);
});

test("A06 puede nutrir coordinación estratégica solo con una salida fresca, aprobada y de la misma tienda", () => {
  const row = candidate({
    id: "stock-run",
    agent_versions: { version: "v7", agent_definitions: { code: "a06_planificador_stock" } },
    agent_outputs: {
      id: "stock-output",
      status: "approved",
      output: {
        answer: "Hay riesgo de rotura en referencias de alta rotación.",
        findings: [{ title: "Riesgo de stock", severity: "high", evidence: "La cobertura cae bajo el umbral", area: "shopify" }],
        recommendations: [{ action: "Validar reposición prioritaria", priority: "high", expected_impact: "Reducir roturas", owner: "consultor" }],
        sources: [{ kind: "metric", reference: "shopify/stock", period: "14d" }],
        warnings: [],
        confidence: "medium",
      },
    },
  });
  const [fresh] = summarizeRecentSpecialistOutputs([row], { organizationId: "org-1", storeId: "store-1", now });
  assert.equal(fresh?.agent_code, "a06_planificador_stock");

  const [otherStore] = summarizeRecentSpecialistOutputs([candidate({
    ...row,
    store_id: "store-2",
  })], { organizationId: "org-1", storeId: "store-1", now });
  assert.equal(otherStore, undefined);

  const [pending] = summarizeRecentSpecialistOutputs([candidate({
    ...row,
    agent_outputs: { ...(row.agent_outputs as object), status: "pending_approval" },
  })], { organizationId: "org-1", storeId: "store-1", now });
  assert.equal(pending, undefined);
});

test("A19 recibe el diseno A28 aprobado de su tienda con evidencia acotada", () => {
  const row = candidate({
    agent_versions: { version: "v2", agent_definitions: { code: "a28_arquitecto_flujos" } },
    agent_outputs: {
      id: "flow-output",
      status: "approved",
      output: {
        answer: "Validar el evento antes de crear.", confidence: "low", findings: [], recommendations: [], sources: [], warnings: [],
        flow_architecture: {
          decision: "needs_validation", summary: "Falta medir perfiles elegibles.", candidates: [{
            action: "create", name: "Bienvenida", objective: "Primera compra", entry_trigger: "Suscripcion confirmada",
            trigger_verification: "unverified", entry_conditions: ["Consentimiento"], exit_conditions: ["Compra"],
            exclusions: ["Bajas"], sequence: [{ step: 1, channel: "email", delay: "1 dia", purpose: "Presentar producto" }],
            cadence: "Una vez", priority: "medium", primary_kpi: "Conversion", stop_rule: "Quejas altas",
            evidence: [{ source: "Klaviyo sync", period: "90d", sample_size: null, coverage: "partial" }],
            data_gaps: ["Perfiles elegibles"], conflicts: [], private_detail: "omit",
          }], private_architecture_note: "omit",
        },
      },
    },
  });
  const [result] = summarizeRecentSpecialistOutputs([row], { organizationId: "org-1", storeId: "store-1", now });
  const summary = result?.summary as { flow_architecture: { candidates: Array<{ name: string }> } };
  assert.equal(summary.flow_architecture.candidates[0]?.name, "Bienvenida");
  assert.doesNotMatch(JSON.stringify(result), /private_detail|private_architecture_note/);
});

test("los planificadores leen el análisis pendiente de aprobar, marcado como no revisado; un rechazado nunca", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const base = candidate({
    agent_versions: { version: "v10", agent_definitions: { code: "a06_planificador_stock" } },
    agent_outputs: { id: "out-1", status: "pending_approval", output: { answer: "Boreal se agota en 2 días", findings: [], recommendations: [], sources: [], warnings: [], confidence: "medium" } },
  });
  assert.equal(summarizeRecentSpecialistOutputs([base], { organizationId: "org-1", storeId: "store-1", now }).length, 0);
  const [pending] = summarizeRecentSpecialistOutputs([base], { organizationId: "org-1", storeId: "store-1", now, includePendingAnalysis: true });
  assert.equal(pending?.output_status, "pending_approval");
  assert.ok(pending?.approval_note);
  const rejected = candidate({ ...base, agent_outputs: { ...(base.agent_outputs as object), status: "rejected" } });
  assert.equal(summarizeRecentSpecialistOutputs([rejected], { organizationId: "org-1", storeId: "store-1", now, includePendingAnalysis: true }).length, 0);
});
