import assert from "node:assert/strict";
import test from "node:test";
import { createCopilotAnswerStream } from "./copilot-answer-stream.js";

test("emits the answer across JSON chunks without exposing proposal fields", () => {
  const deltas: string[] = [];
  const stream = createCopilotAnswerStream((delta) => deltas.push(delta));
  for (const part of [
    '{"answer":"Hola \\',
    'u00f1',
    'o\\nlisto","proposed_writes":[{"title":"private"}]}',
  ]) stream.push(part);
  assert.equal(deltas.join(""), "Hola ño\nlisto");
  assert.equal(deltas.join("").includes("private"), false);
});

test("resets the preview when a model request is retried", () => {
  const deltas: string[] = [];
  const stream = createCopilotAnswerStream((delta) => deltas.push(delta));
  stream.push('{"answer":"Old');
  stream.reset();
  deltas.length = 0;
  stream.push('{"answer":"New"}');
  assert.deepEqual(deltas, ["New"]);
});
