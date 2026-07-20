/**
 * AI-06: tests de la guarda de calidad estructural (checkOutputSanity).
 * Puros, sin I/O: reproducen los dos glitches reales observados en
 * produccion (answer vacio en A06, texto corrupto repetido en A02) para que
 * no puedan volver a colarse como pending_approval sin que nadie se de cuenta.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkOutputSanity } from "./index.js";

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

test("ignora campos que no son string/array (no revienta con tipos inesperados)", () => {
  assertOk({ answer: "ok", confidence: "high", warnings: ["x"], findings: [] });
});
