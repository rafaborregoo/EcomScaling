import assert from "node:assert/strict";
import test from "node:test";
import { readInsightNumber } from "./meta-sync.js";

test("una cadena numerica se lee como numero", () => {
  assert.equal(readInsightNumber("1234"), 1234);
  assert.equal(readInsightNumber("0.0271"), 0.0271);
});

test("una lista de acciones se suma, que es como llega el video", () => {
  assert.equal(
    readInsightNumber([
      { action_type: "video_view", value: "800" },
      { action_type: "video_view", value: "200" },
    ]),
    1000,
  );
});

test("una lista de un solo elemento devuelve su valor, no el array", () => {
  assert.equal(
    readInsightNumber([{ action_type: "outbound_click", value: "412" }]),
    412,
  );
});

test("lo que no viene es null y no cero", () => {
  // Un anuncio de imagen no tiene cero reproducciones de video: no tiene
  // video. El indice parcial de creatividad depende de esta diferencia.
  assert.equal(readInsightNumber(undefined), null);
  assert.equal(readInsightNumber(null), null);
  assert.equal(readInsightNumber([]), null);
  assert.equal(readInsightNumber(""), null);
});

test("un cero de verdad se conserva", () => {
  assert.equal(readInsightNumber("0"), 0);
  assert.equal(readInsightNumber(0), 0);
  assert.equal(
    readInsightNumber([{ action_type: "video_view", value: "0" }]),
    0,
  );
});

test("un valor ilegible no se cuela como NaN", () => {
  assert.equal(readInsightNumber("n/a"), null);
  assert.equal(readInsightNumber(Number.NaN), null);
  assert.equal(readInsightNumber({ value: "5" }), null);
});

test("una lista mezclada suma solo lo legible", () => {
  assert.equal(
    readInsightNumber([
      { action_type: "video_view", value: "10" },
      { action_type: "video_view" },
      { action_type: "video_view", value: "x" },
      { action_type: "video_view", value: "5" },
    ]),
    15,
  );
});
