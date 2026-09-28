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
