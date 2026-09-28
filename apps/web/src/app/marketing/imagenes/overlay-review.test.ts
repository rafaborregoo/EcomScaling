import assert from "node:assert/strict";
import test from "node:test";
import { getOverlayReviewWarnings } from "./overlay-review.js";

const block = {
  text: "Nueva colección",
  xPct: 10,
  yPct: 20,
  widthPct: 80,
  fontSize: 64,
  lineHeight: 1.1,
  bgColor: "#111111",
};

test("advierte sobre la zona reservada de Stories y el texto OCR de origen", () => {
  const warnings = getOverlayReviewWarnings({
    blocks: [{ ...block, yPct: 4 }],
    format: "story",
    ratio: "9:16",
    sourceHasOcr: true,
  });
  assert.ok(warnings.some((warning) => warning.code === "unsafe_position"));
  assert.ok(warnings.some((warning) => warning.code === "source_ocr"));
});

test("detecta solapamiento aproximado, falta de contraste medible y texto pequeño", () => {
  const warnings = getOverlayReviewWarnings({
    blocks: [
      { ...block, fontSize: 30, bgColor: null },
      { ...block, text: "Oferta", yPct: 21 },
    ],
    format: "single",
    ratio: "4:5",
    sourceHasOcr: false,
  });
  assert.ok(warnings.some((warning) => warning.code === "possible_overlap"));
  assert.ok(warnings.some((warning) => warning.code === "contrast_unknown"));
  assert.ok(warnings.some((warning) => warning.code === "small_mobile_text"));
  assert.ok(warnings.some((warning) => warning.code === "manual_visual_check"));
});

test("no declara legible una pieza vacía y alerta sobre exceso de copy", () => {
  const empty = getOverlayReviewWarnings({ blocks: [], format: "single", ratio: "1:1", sourceHasOcr: false });
  assert.deepEqual(empty.map((warning) => warning.code), ["empty"]);
  const long = getOverlayReviewWarnings({
    blocks: [{ ...block, text: "a".repeat(180) }],
    format: "carousel",
    ratio: "1:1",
    sourceHasOcr: false,
  });
  assert.ok(long.some((warning) => warning.code === "long_copy"));
});
