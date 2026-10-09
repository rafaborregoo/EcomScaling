import assert from "node:assert/strict";
import test from "node:test";
import { summarizeMarketingPeerHistory, type MarketingPeerHistoryRow } from "./marketing-peer-history.js";

function row({
  code = "a26_contenido_email",
  storeId = "store-1",
  runStatus = "succeeded",
  outputStatus = "approved",
  createdAt = "2026-09-27T10:00:00Z",
  answer = "Hallazgo vigente",
}: {
  code?: string;
  storeId?: string | null;
  runStatus?: string;
  outputStatus?: string;
  createdAt?: string;
  answer?: string;
} = {}): MarketingPeerHistoryRow {
  return {
    created_at: createdAt,
    status: outputStatus,
    output: { answer, findings: [{ title: "CTA poco claro" }] },
    agent_runs: {
      store_id: storeId,
      status: runStatus,
      agent_versions: {
        agent_definitions: { code, name: "Contenido del email" },
      },
    },
  };
}

test("solo comparte la salida aprobada más reciente de A26 del mismo alcance", () => {
  const summaries = summarizeMarketingPeerHistory([
    row({ answer: "Reciente" }),
    row({ answer: "Antigua", createdAt: "2026-09-26T10:00:00Z" }),
    row({ answer: "Otra tienda", storeId: "store-2" }),
    row({ answer: "Pendiente", outputStatus: "pending_approval" }),
    row({ answer: "Run fallido", runStatus: "failed" }),
  ], "store-1");

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.code, "a26_contenido_email");
  assert.equal(summaries[0]?.conclusion, "Reciente");
  assert.deepEqual(summaries[0]?.findings, ["CTA poco claro"]);
});

test("el alcance agregado solo acepta runs agregados, nunca runs de tiendas", () => {
  const summaries = summarizeMarketingPeerHistory([
    row({ storeId: "store-1" }),
    row({ storeId: null, answer: "Agregado" }),
  ], null);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.conclusion, "Agregado");
});

test("A05 descarta paquetes Meta fuera de su ventana de frescura", () => {
  const summaries = summarizeMarketingPeerHistory([
    row({
      code: "a23_creatividad_meta",
      createdAt: "2026-08-01T10:00:00Z",
      answer: "Meta antiguo",
    }),
    row({
      code: "a23_creatividad_meta",
      createdAt: "2026-09-20T10:00:00Z",
      answer: "Meta vigente",
    }),
  ], "store-1", 12, {
    now: new Date("2026-10-06T10:00:00Z"),
    maxAgeDaysByCode: { a23_creatividad_meta: 30 },
  });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.conclusion, "Meta vigente");
});

test("devuelve como máximo un resumen breve por agente relevante", () => {
  const summaries = summarizeMarketingPeerHistory([
    row({ code: "a26_contenido_email" }),
    row({ code: "a12_analista_email", answer: "Resultado Klaviyo" }),
    row({ code: "a26_contenido_email", answer: "Duplicado" }),
    row({ code: "agente_no_relevante" }),
  ], "store-1", 2);

  assert.deepEqual(summaries.map((item) => item.code), ["a26_contenido_email", "a12_analista_email"]);
  assert.ok(summaries.every((item) => item.findings.length <= 4 && item.warnings.length <= 3));
});

test("A05 reutiliza el plan aprobado de A27 como brief compacto del mismo scope", () => {
  const base = row({ code: "a27_planificador_mailing", answer: "Diagnóstico A27" });
  const summaries = summarizeMarketingPeerHistory([
    {
      ...base,
      output: {
        plan_name: "Preventa de temporada",
        strategy_decision: "Usar una secuencia educativa antes de la oferta.",
        objective_rationale: "Preparar demanda sin descontar sin margen.",
        audience_rationale: "Suscriptoras activas con interés en nieve.",
        cadence: {
          recommendation: "Tres impactos separados.",
          requested_schedule_assessment: "La cadencia admite tres semanas.",
        },
        confidence: "medium",
        sources: [{ kind: "metric", reference: "klaviyo_email_report", period: "90d" }],
        emails: [{
          sequence_number: 1,
          title: "Guía para elegir equipo",
          sequence_role: "Educación",
          angle: "Ayudar a elegir según nivel y clima.",
          subject_direction: "Una guía para preparar la temporada",
          cta: "Ver la guía",
          copy_brief: "Explicar tres criterios de elección.",
          evidence: [{ label: "Clics en guías", value: "3.2%", period: "2026-06", source: "klaviyo" }],
          email_body: "No pasar el cuerpo del email anterior.",
        }],
        warnings: ["La oferta no está confirmada."],
        private_blob: "No incluir datos ajenos al contrato.",
      },
    },
    {
      ...base,
      created_at: "2026-09-28T10:00:00Z",
      status: "pending_approval",
      output: { strategy_decision: "Aún no aprobado" },
    },
    {
      ...base,
      created_at: "2026-09-29T10:00:00Z",
      agent_runs: { ...(base.agent_runs as object), store_id: "store-2" },
      output: { strategy_decision: "Otra tienda" },
    },
  ], "store-1", 12);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.code, "a27_planificador_mailing");
  assert.equal(summaries[0]?.conclusion, "Usar una secuencia educativa antes de la oferta.");
  assert.equal(summaries[0]?.mailing_strategy?.email_angles[0]?.cta, "Ver la guía");
  assert.equal(summaries[0]?.mailing_strategy?.email_angles[0]?.evidence[0]?.source, "klaviyo");
  assert.equal(summaries[0]?.mailing_strategy?.sources[0]?.reference, "klaviyo_email_report");
  assert.deepEqual(summaries[0]?.warnings, ["La oferta no está confirmada."]);
  assert.doesNotMatch(JSON.stringify(summaries), /email_body|private_blob|Aún no aprobado|Otra tienda/);
});

test("A27/A11/A26 solo reciben la arquitectura A28 aprobada, acotada y del mismo scope", () => {
  const base = row({ code: "a28_arquitecto_flujos", answer: "Diseño de bienvenida" });
  const summaries = summarizeMarketingPeerHistory([
    {
      ...base,
      output: {
        answer: "Diseño de bienvenida",
        findings: [{ title: "Evento de lista presente" }],
        proposed_writes: [
          { kind: "task", title: "Diseñar bienvenida", description: "Validar evento antes de crear el flow" },
          { kind: "publish", title: "No debe pasar" },
        ],
        flow_architecture: {
          decision: "needs_validation",
          summary: "Validar perfil elegible antes de disenar.",
          candidates: [{
            action: "create", name: "Bienvenida", objective: "Orientar primera compra",
            entry_trigger: "Suscripcion confirmada", trigger_verification: "unverified",
            entry_conditions: ["Consentimiento vigente"], exit_conditions: ["Compra completada"],
            exclusions: ["Baja de marketing"], sequence: [{ step: 1, channel: "email", delay: "1 dia", purpose: "Presentar la tienda" }],
            cadence: "Una vez por suscripcion", priority: "medium", primary_kpi: "Conversion a primera compra",
            stop_rule: "Parar si suben quejas o bajas", evidence: [{ source: "Inventario Klaviyo", period: "sync actual", sample_size: null, coverage: "partial" }],
            data_gaps: ["Volumen elegible"], conflicts: [], private_detail: "no compartir",
          }],
        },
        private_blob: "no compartir",
      },
    },
    {
      ...base,
      created_at: "2026-09-28T10:00:00Z",
      status: "pending_approval",
      output: { answer: "Aún no aprobado" },
    },
    {
      ...base,
      created_at: "2026-09-29T10:00:00Z",
      agent_runs: { ...(base.agent_runs as object), store_id: "store-2" },
      output: { answer: "Otra tienda" },
    },
  ], "store-1");

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.code, "a28_arquitecto_flujos");
  assert.equal(summaries[0]?.flow_architecture?.candidates[0]?.name, "Bienvenida");
  assert.doesNotMatch(JSON.stringify(summaries), /private_detail/);
  assert.deepEqual(summaries[0]?.recommendations, ["Diseñar bienvenida: Validar evento antes de crear el flow"]);
  assert.doesNotMatch(JSON.stringify(summaries), /no compartir|No debe pasar|Aún no aprobado|Otra tienda/);
});
