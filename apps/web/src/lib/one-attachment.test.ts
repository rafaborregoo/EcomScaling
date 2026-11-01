import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileKind, fileMeta, formatBytes } from "./file-meta.js";

// Un solo adjunto en la app: components/ui/attachment.tsx, con el nombre, el
// tipo y el tamaño formateados por lib/file-meta.ts.
const SRC = join(import.meta.dirname, "..");

test("el tamaño y el tipo de un archivo se dicen igual en toda la app", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(820 * 1024), "820 KB");
  assert.equal(formatBytes(1.1 * 1024 * 1024), "1,1 MB");
  assert.equal(fileKind("plantilla.md"), "Markdown");
  assert.equal(fileKind("", "image/png"), "PNG");
  assert.equal(fileMeta("informe.pdf", 2.4 * 1024 * 1024), "PDF · 2,4 MB");
});

test("nadie formatea tamaños de archivo por su cuenta", () => {
  const offenders = readdirSync(SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts"))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.endsWith("file-meta.ts") && /function (formatBytes|formatFileSize|formatSize)\b/.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(SRC.length + 1));
  assert.deepEqual(offenders, [], `Usa formatBytes/fileMeta de @/lib/file-meta:\n${offenders.join("\n")}`);
});
