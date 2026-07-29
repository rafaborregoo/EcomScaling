/**
 * AI-06: tests de la guarda de calidad estructural (checkOutputSanity).
 * Puros, sin I/O: reproducen los dos glitches reales observados en
 * produccion (answer vacio en A06, texto corrupto repetido en A02) para que
 * no puedan volver a colarse como pending_approval sin que nadie se de cuenta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkOutputSanity, estimateCostUsd, evaluateAgentBudget } from "./index.js";

function assertOk(output: unknown) {
  const result = checkOutputSanity(output);
  assert.equal(result.ok, true, `deberia aceptarse: ${JSON.stringify(output)}`);
}

function assertRejected(output: unknown, reason: string) {
  const result = checkOutputSanity(output);
  assert.equal(result.ok, false, `deberia rechazarse: ${JSON.stringify(output)}`);
  if (!result.ok) {
    assert.equal(result.reason, reason);
  }
}

test("acepta una salida normal con answer y proposed_writes validos", () => {
  assertOk({
    answer: "El backlog cubre las alertas activas.",
    proposed_writes: [{ kind: "task", title: "Subir costes", description: "Cargar 52 items.", priority: "high" }],
  });
});

test("acepta una salida de chat sin proposed_writes (A09)", () => {
  assertOk({ answer: "El AOV de los ultimos 30 dias es 28.7 EUR.", sources: [] });
});

test("acepta una salida de resumen de llamada con proposed_tasks (A01)", () => {
  assertOk({ summary: "Se acordo subir costes.", proposed_tasks: [{ title: "Subir costes", description: "x" }] });
});

test("rechaza answer vacio (glitch real observado en A06 pre-fix)", () => {
  assertRejected({ answer: "", proposed_writes: [] }, "answer_vacio");
});

test("rechaza answer solo con espacios", () => {
  assertRejected({ answer: "   \n  " }, "answer_vacio");
});

test("rechaza summary vacio", () => {
  assertRejected({ summary: "" }, "summary_vacio");
});

test("rechaza texto corrupto con fragmento repetido (glitch real observado en A02)", () => {
  assertRejected(
    { answer: "C ConfigC Configfigcostiguration financn financiera del negocio, repetido repetido repetido repetido repetido" },
    "answer_con_texto_corrupto",
  );
});

test("no confunde repeticion legitima de palabras cortas con gibberish", () => {
  assertOk({
    answer:
      "Muy bien, muy bien, muy bien: las ventas van muy bien este mes. El margen mejora cada semana que pasa.",
  });
});

test("rechaza proposed_writes con titulo vacio (glitch real observado en A06 pre-fix)", () => {
  assertRejected(
    { answer: "diagnostico normal", proposed_writes: [{ kind: "task", title: "", description: "algo", priority: "high" }] },
    "proposed_writes_con_titulo_vacio",
  );
});

test("rechaza proposed_writes con titulo solo espacios", () => {
  assertRejected(
    { answer: "diagnostico normal", proposed_writes: [{ title: "   ", description: "algo" }] },
    "proposed_writes_con_titulo_vacio",
  );
});

test("rechaza proposed_tasks con titulo vacio (A01)", () => {
  assertRejected(
    { summary: "resumen normal", proposed_tasks: [{ title: "", description: "algo" }] },
    "proposed_tasks_con_titulo_vacio",
  );
});

test("rechaza proposed_writes con descripcion corrupta aunque el titulo este bien", () => {
  assertRejected(
    {
      answer: "diagnostico normal",
      proposed_writes: [
        { title: "Reponer FUSION", description: "abcabcabcabcabcabcabcabcabcabc sin sentido", priority: "high" },
      ],
    },
    "proposed_writes_con_texto_corrupto",
  );
});

test("acepta proposed_writes vacio (sin hallazgos que proponer)", () => {
  assertOk({ answer: "Todo en orden, sin tareas nuevas.", proposed_writes: [] });
});

test("rechaza un output que no es un objeto", () => {
  assertRejected(null, "output_no_es_objeto");
  assertRejected("texto suelto", "output_no_es_objeto");
});

// AI-06 (hallazgo real 2026-07-23, eval de A08 -- ver eval-a08-knowledge-manager.ts
// y AI-06-evaluaciones-calidad.md): dos glitches nuevos observados contra el
// LLM real que pasaban checkOutputSanity porque no eran ni vacios ni
// repeticion.
test("rechaza un answer casi sin letras reales (glitch real observado en A08)", () => {
  assertRejected({ answer: ", ecd" }, "answer_con_apertura_incoherente");
});

test("rechaza un answer con salto de linea partiendo una palabra al inicio (glitch real observado en A08)", () => {
  assertRejected(
    { answer: "El catlogo del catos c\ntene tres documentos y ninguno cubre las areas centrales." },
    "answer_con_apertura_incoherente",
  );
});

test("acepta un answer corto pero real", () => {
  assertOk({ answer: "Sin hallazgos nuevos." });
});

test("no confunde un salto de linea legitimo (tras puntuacion, en un parrafo) con apertura incoherente", () => {
  assertOk({
    answer: "El catalogo esta vacio.\nNo hay documentos que revisar todavia, hace falta sincronizar la fuente.",
  });
});

// AI-06 (hallazgo 2026-07-28): hasIncoherentOpening solo cubria el primer
// salto de linea cerca del inicio -- el mismo glitch de palabra partida a
// mitad de un answer largo, en una linea posterior, pasaba sin deteccion.
test("rechaza un answer con palabra partida a mitad de texto, no solo al inicio", () => {
  assertRejected(
    {
      answer:
        "El diagnostico esta listo. Hay tres alertas activas de stock bajo.\nContinua man\nana con la revision del margen por producto, que sigue sin cerrarse.",
    },
    "answer_con_texto_partido",
  );
});

test("no confunde varios parrafos legitimos (todos con punto de cierre) con texto partido", () => {
  assertOk({
    answer:
      "Primer hallazgo: el stock de FUSION esta roto.\nSegundo hallazgo: el margen de PADEL bajo del 20%.\nTercer hallazgo: sin alertas nuevas esta semana.",
  });
});

test("no confunde una lista con guiones (mayuscula tras salto) con texto partido", () => {
  assertOk({
    answer: "Hallazgos de la semana\n- Stock roto en FUSION\n- Margen bajo en PADEL",
  });
});

test("ignora campos que no son string/array (no revienta con tipos inesperados)", () => {
  assertOk({ answer: "ok", confidence: "high", warnings: ["x"], findings: [] });
});

/**
 * AI-00/AI-06 (R-011): el presupuesto se registraba pero no se aplicaba.
 * `evaluateAgentBudget` es la decision pura que ahora corta un turno; se
 * prueba aislada de la API de Anthropic (runAgentTurn solo la invoca).
 */

test("sin budget declarado, nunca corta el turno", () => {
  const verdict = evaluateAgentBudget(undefined, 999, 999);
  assert.equal(verdict.exceeded, false);
});

test("corta el turno cuando el coste estimado supera maxCostUsd", () => {
  const verdict = evaluateAgentBudget({ maxCostUsd: 1 }, 1.01, 0);
  assert.equal(verdict.exceeded, true);
  if (verdict.exceeded) {
    assert.match(verdict.message, /cost \$1\.0100 > max \$1/);
  }
});

test("no corta el turno cuando el coste esta justo en el limite (estricto: solo > corta)", () => {
  const verdict = evaluateAgentBudget({ maxCostUsd: 1 }, 1, 0);
  assert.equal(verdict.exceeded, false);
});

test("corta el turno cuando las tool calls superan maxToolCalls", () => {
  const verdict = evaluateAgentBudget({ maxToolCalls: 10 }, 0, 11);
  assert.equal(verdict.exceeded, true);
  if (verdict.exceeded) {
    assert.match(verdict.message, /11 tool calls > max 10/);
  }
});

test("el limite de coste corta incluso con pocas tool calls (glitch de exploracion cara, ver A02)", () => {
  const verdict = evaluateAgentBudget({ maxCostUsd: 0.5, maxToolCalls: 20 }, 0.6, 2);
  assert.equal(verdict.exceeded, true);
  if (verdict.exceeded) {
    assert.match(verdict.message, /cost/);
  }
});

test("estimateCostUsd calcula coste real por modelo conocido", () => {
  // claude-opus-4-8: $5/1M input, $25/1M output (packages/ai/src/index.ts MODEL_PRICING)
  const cost = estimateCostUsd("claude-opus-4-8", 1_000_000, 1_000_000);
  assert.equal(cost, 30);
});

test("estimateCostUsd devuelve 0 para un modelo desconocido en vez de reventar", () => {
  const cost = estimateCostUsd("modelo-inexistente", 1_000_000, 1_000_000);
  assert.equal(cost, 0);
});
