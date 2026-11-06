import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { labImages } from "./ai-model-lab-images.mjs";
test("vision replay uses identical bytes and rejects tampering or paths outside its root", async () => {
  const root = await mkdtemp(join(tmpdir(), "enora-vision-test-"));
  try {
    const bytes = Buffer.from("immutable-test-asset"); await writeFile(join(root, "asset.png"), bytes);
    const file = { path: "asset.png", sha256: createHash("sha256").update(bytes).digest("hex"), mime_type: "image/png" };
    const [image] = await labImages(root, [file]); assert.equal(image!.source.data, bytes.toString("base64"));
    await assert.rejects(labImages(root, [{ ...file, sha256: "0".repeat(64) }]), /changed/);
    await assert.rejects(labImages(root, [{ ...file, path: "../outside.png" }]), /outside/);
    await assert.rejects(labImages(root, [{ ...file, mime_type: "text/html" }]));
  } finally { await rm(root, { recursive: true, force: true }); }
});
