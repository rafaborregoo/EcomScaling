/**
 * AI-15: las dos piezas del analisis de llamadas que, si fallan, fallan en
 * silencio y con consecuencias reales.
 *
 *  1. `redactConsultantOnly` es un limite de confianza. `key_points` viaja
 *     entero al cliente por RLS (los resumenes publicados son suyos), y ahi
 *     dentro van ahora el analisis del desempeno de su consultor y lo que el
 *     agente dice de su motivacion. Si el recorte deja de funcionar nadie se
 *     entera: la respuesta sigue siendo 200 y el resumen se ve bien.
 *  2. `selectProposedTasks` conserva el indice original. Es la clave con la
 *     que el consultor dijo en que hito de Mi Camino entra cada tarea; si se
 *     reindexa al filtrar, la tarea se crea en el hito de otra y el resultado
 *     parece correcto salvo que mires el plan.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { redactConsultantOnly, selectProposedTasks } from "./calls.js";

const keyPoints = {
  facts: ["Cerraron 120 pedidos en julio"],
  proposed_tasks: [{ title: "Cargar costes", owner: "cliente" }],
  sources: [{ kind: "document", reference: "Guía de margen", period: null }],
  consultant_gaps: [
    {
      topic: "Roturas de stock del top de facturacion",
      why_it_matters: "Se acordo subir inversion sobre productos sin stock",
      evidence: "12 productos sin stock, 3 en el top 10",
      severity: "high",
    },
  ],
  conversation_signals: [
    {
      label: "Reparto de la palabra",
      value: "el consultor ~75%",
      about: "consultor",
      reading: "Abrir con preguntas antes de presentar",
      trend: "empeora",
    },
  ],
  confidence: "medium",
  warnings: ["La transcripcion no menciona el margen"],
  risks: ["Rotura de stock antes de noviembre"],
  recommendations: [{ action: "Subir umbral de envio", priority: "high", rationale: "" }],
  proposed_campaign_ideas: [{ objective: "Reposicion", audience: "Compradores", timing_hint: null, evidence_quote: "" }],
  proposed_camino_changes: [{ change: "Adelantar retencion", rationale: "", evidence_quote: "" }],
  campo_nuevo_del_agente: "no deberia filtrarse",
};

test("el cliente no recibe el coaching interno del consultor", () => {
  const redacted = redactConsultantOnly(keyPoints) as Record<string, unknown>;

  assert.equal(redacted.consultant_gaps, undefined);
  assert.equal(redacted.conversation_signals, undefined);
});

test("el cliente recibe solo lo que lee en su resumen", () => {
  const redacted = redactConsultantOnly(keyPoints) as Record<string, unknown>;

  assert.deepEqual(Object.keys(redacted).sort(), ["facts", "recommendations", "risks"]);
  assert.deepEqual(redacted.facts, keyPoints.facts);
  assert.deepEqual(redacted.risks, keyPoints.risks);
  assert.deepEqual(redacted.recommendations, keyPoints.recommendations);
});

test("el material de trabajo del consultor no llega al cliente", () => {
  const redacted = redactConsultantOnly(keyPoints) as Record<string, unknown>;

  // Tareas sin filtrar (las internas y las descartadas), propuestas sin
  // revisar, y lo que el modelo dice de si mismo.
  for (const key of [
    "proposed_tasks",
    "proposed_campaign_ideas",
    "proposed_camino_changes",
    "sources",
    "confidence",
    "warnings",
    "campo_nuevo_del_agente",
  ]) {
    assert.equal(redacted[key], undefined, key);
  }
});

test("el recorte aguanta key_points que no es el objeto de A01", () => {
  // Un resumen manual guarda key_points como string[] o null.
  assert.equal(redactConsultantOnly(null), null);
  assert.equal(redactConsultantOnly(undefined), undefined);
  assert.deepEqual(redactConsultantOnly(["punto uno"]), ["punto uno"]);
});

test("la seleccion conserva el indice original de cada tarea", () => {
  const tasks = ["t0", "t1", "t2", "t3"];

  assert.deepEqual(selectProposedTasks(tasks, [1, 3]), [
    { index: 1, task: "t1" },
    { index: 3, task: "t3" },
  ]);
});

test("sin seleccion se materializan todas, indexadas de cero", () => {
  assert.deepEqual(selectProposedTasks(["t0", "t1"], undefined), [
    { index: 0, task: "t0" },
    { index: 1, task: "t1" },
  ]);
});

test("los indices invalidos o repetidos del cliente no cuelan", () => {
  const tasks = ["t0", "t1"];

  assert.deepEqual(
    selectProposedTasks(tasks, [5, -1, 1.5, 0, 0]),
    [{ index: 0, task: "t0" }],
    "fuera de rango, negativos, no enteros y duplicados se descartan",
  );
  assert.deepEqual(selectProposedTasks(tasks, []), []);
});
