import assert from "node:assert/strict";
import { readFile, writeFile, copyFile, rename } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult } from "./ai-model-lab-core.js";
const root = ".e-nora-test-lab/ai-models", path = `${root}/report.json`, caseId = "a15_analista_imagenes:real-store-runtime-2026-11-05-visual";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8"))); assert.ok(!report.active_batch);
const failed = report.results.filter((row) => row.case_id === caseId && row.model_id.startsWith("claude-") && row.status === "failed");
assert.equal(failed.length, 3);
await writeFile(`${root}/a15-transport-failed-before-vision.json`, JSON.stringify(failed, null, 2), { flag: "wx" });
for (const row of failed) {
  assert.equal(row.usage.input, null); assert.equal(row.raw_response, "");
  const receipt = `${root}/a15_analista_imagenes.${hash(caseId)}.${row.model_id}.receipt.json`;
  const original = JSON.parse(await readFile(receipt, "utf8")); assert.match(original.stderr, /requires output-format=stream-json/);
  await copyFile(receipt, receipt.replace(".receipt.json", ".pre-vision-fix.receipt.json"));
  Object.assign(row, pendingResult(caseId, row.model_id));
}
report.cases.find((row) => row.id === caseId)!.limitations.push("Los tres intentos iniciales Claude fallaron antes del modelo por formato de transporte CLI. Recibos sin tokens conservados como pre-vision-fix; se corrige stream-json y se repiten explícitamente.");
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
console.log(JSON.stringify({ reset_transport_failures: failed.length, preserved_originals: true }));
