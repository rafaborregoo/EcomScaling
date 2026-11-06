import assert from "node:assert/strict";
import { readFile, writeFile, copyFile, rename } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult } from "./ai-model-lab-core.js";
const root = ".e-nora-test-lab/ai-models", path = `${root}/report.json`, caseId = "a15_analista_imagenes:real-store-runtime-2026-11-05-visual";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8"))); assert.ok(!report.active_batch);
const failed = report.results.filter((row) => row.case_id.startsWith("a15_analista_imagenes:real-store-runtime-2026-11-05-") && row.case_id.endsWith("-contract") && row.model_id.startsWith("claude-") && row.status === "failed");
assert.equal(failed.length, 6);
await writeFile(`${root}/a15-transport-dialect-failures.json`, JSON.stringify(failed, null, 2), { flag: "wx" });
for (const row of failed) {
  assert.equal(row.usage.input, null); assert.equal(row.raw_response, "");
  const receipt = `${root}/a15_analista_imagenes.${hash(row.case_id)}.${row.model_id}.receipt.json`;
  const original = JSON.parse(await readFile(receipt, "utf8")); assert.match(original.stderr, /no schema with key or ref/);
  await copyFile(receipt, receipt.replace(".receipt.json", ".pre-dialect-fix.receipt.json"));
  Object.assign(row, pendingResult(row.case_id, row.model_id));
}
for (const scenario of report.cases.filter(row => row.agent_code === "a15_analista_imagenes" && row.id.endsWith("-contract"))) scenario.limitations.push("Claude rechazó el identificador de dialecto JSON Schema antes del modelo; seis recibos pre-dialect-fix sin tokens conservados. Adaptador corregido, repetición explícita de Claude.");
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2)); await rename(`${path}.tmp`, path);
console.log(JSON.stringify({ reset_transport_failures: failed.length, preserved_originals: true }));
