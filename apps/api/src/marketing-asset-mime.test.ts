import assert from "node:assert/strict";
import test from "node:test";

import { sniffImageMime } from "./ai-runtime.js";

test("sniffImageMime reconoce PNG/JPEG/GIF/WebP por magic bytes", () => {
  assert.equal(
    sniffImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])),
    "image/png",
  );
  assert.equal(
    sniffImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])),
    "image/jpeg",
  );
  assert.equal(
    sniffImageMime(Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0])),
    "image/gif",
  );
  assert.equal(
    sniffImageMime(
      Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
    ),
    "image/webp",
  );
});

test("sniffImageMime rechaza lo que no es imagen (p.ej. HTML/SVG/PDF)", () => {
  assert.equal(sniffImageMime(Buffer.from("<svg xmlns=", "utf8")), null);
  assert.equal(sniffImageMime(Buffer.from("<!DOCTYPE html>", "utf8")), null);
  assert.equal(sniffImageMime(Buffer.from("%PDF-1.7", "utf8")), null);
  assert.equal(sniffImageMime(Buffer.from([0x01, 0x02])), null);
});
