import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

export async function labImages(root: string, files: Array<{ path: string; sha256: string; mime_type: string }> = []) {
  assert.ok(files.length <= 4, "Too many laboratory images");
  return Promise.all(files.map(async (file) => {
    const path = resolve(root, file.path);
    assert.ok(path.toLowerCase().startsWith(`${resolve(root)}${sep}`.toLowerCase()), "Image outside laboratory directory");
    assert.ok(["image/png", "image/jpeg", "image/webp"].includes(file.mime_type));
    const bytes = await readFile(path); assert.ok(bytes.length > 0 && bytes.length <= 5 * 1024 * 1024);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), file.sha256, "Laboratory image changed");
    return { path, source: { type: "base64", media_type: file.mime_type, data: bytes.toString("base64") } };
  }));
}
