/**
 * El paso que devuelve `callStage` es lo que el consultor ve en la fila sin
 * desplegar. Si miente, la lista dice "listo para analizar" y dentro el boton
 * de la IA esta apagado -- que es exactamente el sintoma que tenia el modulo
 * antes de que el flujo fuera explicito.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { callStage } from "./call-stage";

const transcript = { id: "tx-2", version: 2 };

test("sin transcripcion el flujo empieza por transcribir, no por la IA", () => {
  const stage = callStage({ call_transcripts: [], call_ai_summaries: [] });
  assert.equal(stage.step, 1);
  assert.equal(stage.label, "Falta transcripción");
});

test("con transcripcion y sin resumen, toca analizar", () => {
  const stage = callStage({
    call_transcripts: [transcript],
    call_ai_summaries: [],
  });
  assert.equal(stage.step, 2);
  assert.equal(stage.tone, "brand");
});

test("un resumen pendiente de la transcripcion actual bloquea en aprobacion", () => {
  const stage = callStage({
    call_transcripts: [transcript],
    call_ai_summaries: [
      { status: "pending_approval", transcript_id: transcript.id },
    ],
  });
  assert.equal(stage.step, 3);
  assert.equal(stage.tone, "warn");
});

test("un pendiente de una transcripcion vieja no bloquea: describe otra cosa", () => {
  const stage = callStage({
    call_transcripts: [transcript],
    call_ai_summaries: [{ status: "pending_approval", transcript_id: "tx-1" }],
  });
  assert.equal(stage.step, 2, "hay que volver a analizar la transcripcion nueva");
});

test("lo pendiente manda sobre lo ya publicado", () => {
  const stage = callStage({
    call_transcripts: [transcript],
    call_ai_summaries: [
      { status: "published", transcript_id: transcript.id },
      { status: "pending_approval", transcript_id: transcript.id },
    ],
  });
  assert.equal(stage.step, 3, "si algo espera decision, ese es el paso actual");
});

test("publicado sobre la transcripcion actual cierra el flujo", () => {
  const stage = callStage({
    call_transcripts: [transcript],
    call_ai_summaries: [{ status: "published", transcript_id: transcript.id }],
  });
  assert.equal(stage.step, 4);
  assert.equal(stage.tone, "success");
});

test("reemplazar la transcripcion reabre el flujo aunque hubiera publicado", () => {
  const stage = callStage({
    call_transcripts: [{ id: "tx-3", version: 3 }],
    call_ai_summaries: [{ status: "published", transcript_id: "tx-2" }],
  });
  assert.equal(stage.step, 2, "el resumen publicado ya no describe lo que hay");
});
