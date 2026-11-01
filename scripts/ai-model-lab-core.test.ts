import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hash,
  isUsageLimitFailure,
  normalizeOutput,
  parseOutput,
  pendingResult,
  requeueBlocked,
  redact,
} from "./ai-model-lab-core.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";

test("una respuesta sobre cuotas no se interpreta como un error del proveedor", () => {
  assert.equal(
    isUsageLimitFailure(false, "Has alcanzado la cuota comercial del producto"),
    false,
  );
  assert.equal(isUsageLimitFailure(false, "usage limit"), false);
  assert.equal(
    isUsageLimitFailure(true, "API error: rate_limit_exceeded"),
    true,
  );
  assert.equal(isUsageLimitFailure(true, "invalid_json"), false);
});
test("normalizar conserva las afirmaciones y no inventa notas de calidad", () => {
  const raw =
    '```json\n{"answer":"Faltan datos","findings":["No hay stock"],"warnings":["Sin herramientas"]}\n```';
  assert.equal((parseOutput(raw) as { answer: string }).answer, "Faltan datos");
  assert.deepEqual(normalizeOutput(raw), {
    summary: "Faltan datos",
    findings: ["No hay stock"],
    recommendations: [],
    warnings: ["Sin herramientas"],
  });
  assert.equal(pendingResult("case", "model").review.status, "pending");
  assert.equal(pendingResult("case", "model").actual_model, null);
  assert.equal(pendingResult("case", "model").checks.native_contract, null);
});
test("el monitor muestra headline y secciones sin perder hallazgos o recomendaciones", () => {
  const data = {
    headline: "Costes incompletos",
    sections: [
      {
        key: "finanzas",
        label: "Finanzas",
        findings: [{ title: "Cobertura 30%", evidence: "Costes: 30%" }],
        recommendations: [{ action: "Completar costes", owner: "consultor" }],
      },
    ],
    warnings: ["Beneficio no verificado"],
  };
  const result = normalizeOutput(JSON.stringify(data));
  assert.equal(result.summary, "Costes incompletos");
  assert.deepEqual(JSON.parse(result.findings[0]!), {
    section: "Finanzas",
    title: "Cobertura 30%",
    evidence: "Costes: 30%",
  });
  assert.deepEqual(JSON.parse(result.recommendations[0]!), {
    section: "Finanzas",
    action: "Completar costes",
    owner: "consultor",
  });
  assert.deepEqual(result.warnings, ["Beneficio no verificado"]);
});
test("el planificador muestra las propuestas incluso si recommendations está vacío", () => {
  const output = normalizeOutput(
    JSON.stringify({
      answer: "Una tarea",
      recommendations: [],
      proposed_writes: [
        {
          kind: "task",
          title: "Comprobar existencias",
          description: "Consultar stock",
        },
      ],
    }),
  );
  assert.equal(output.summary, "Una tarea");
  assert.equal(
    JSON.parse(output.recommendations[0]!).title,
    "Comprobar existencias",
  );
});
test("redacta contactos y credenciales sin cambiar cifras de negocio", () => {
  assert.deepEqual(
    redact({
      email: "a@example.com",
      sales: 123.45,
      data: "escribe a a@example.com",
      token: "secret",
      link: "https://example.com/file?token=secret",
    }),
    {
      email: "[omitido]",
      sales: 123.45,
      data: "escribe a [correo omitido]",
      token: "[omitido]",
      link: "[URL con parámetros omitida]",
    },
  );
  assert.notEqual(hash({ sales: 1 }), hash({ sales: 2 }));
});
test("no se acepta un informe arbitrario sin contexto, procedencia y estados", () => {
  assert.equal(
    aiModelLabReportSchema.safeParse({ version: 1, results: [] }).success,
    false,
  );
});

test("reanudar no repite respuestas terminadas ni borra fallos técnicos", () => {
  const completed = {
    ...pendingResult("a", "m"),
    status: "completed" as const,
    raw_response: "original",
  };
  const failed = {
    ...pendingResult("b", "m"),
    status: "failed" as const,
    error: "timeout",
  };
  const blocked = {
    ...pendingResult("c", "m"),
    status: "blocked" as const,
    error: "usage limit",
  };
  const retry = requeueBlocked([completed, failed, blocked]);
  assert.equal(retry[0], completed);
  assert.equal(retry[1], failed);
  assert.equal(retry[2]!.status, "pending");
  assert.equal(blocked.status, "blocked");
});
