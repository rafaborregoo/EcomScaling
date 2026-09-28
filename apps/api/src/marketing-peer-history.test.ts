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
  assert.deepEqual(summaries[0]?.recommendations, ["Diseñar bienvenida: Validar evento antes de crear el flow"]);
  assert.doesNotMatch(JSON.stringify(summaries), /no compartir|No debe pasar|Aún no aprobado|Otra tienda/);
});
