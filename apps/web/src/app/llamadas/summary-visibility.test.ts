import assert from "node:assert/strict";
import test from "node:test";
import { isSummaryCurrentForTranscript } from "./summary-visibility";

const transcript = { id: "tx-current", version: 2 };

test("acepta un resumen publicado ligado a la transcripcion actual", () => {
  assert.equal(
    isSummaryCurrentForTranscript(
      { status: "published", transcript_id: transcript.id },
      transcript,
    ),
    true,
  );
});

test("oculta un resumen publicado de una transcripcion antigua", () => {
  assert.equal(
    isSummaryCurrentForTranscript(
      { status: "published", transcript_id: "tx-old" },
      transcript,
    ),
    false,
  );
});

test("conserva compatibilidad historica solo para la primera transcripcion", () => {
  assert.equal(
    isSummaryCurrentForTranscript(
      { status: "published", transcript_id: null },
      { id: "tx-v1", version: 1 },
    ),
    true,
  );
  assert.equal(
    isSummaryCurrentForTranscript(
      { status: "published", transcript_id: null },
      transcript,
    ),
    false,
  );
});

test("no considera borradores como publicados", () => {
  assert.equal(
    isSummaryCurrentForTranscript(
      { status: "pending_approval", transcript_id: transcript.id },
      transcript,
    ),
    false,
  );
});
