import { readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { LAB_MODELS, pendingResult } from "./ai-model-lab-core.js";

const path = resolve(".e-nora-test-lab/ai-models/report.json");
const report = aiModelLabReportSchema.parse(
  JSON.parse(await readFile(path, "utf8")),
);
assert.ok(
  !report.results.some((row) => ["pending", "running"].includes(row.status)),
  "finish_active_batch_first",
);
assert.ok(
  !report.models.some((model) => model.id === "gpt-6.1-terra"),
  "terra_already_added",
);
await copyFile(path, path + ".before-terra");
const originalModels = report.models.map((model) => model.id);
for (const testCase of report.cases) testCase.model_ids ??= [...originalModels];
const cases = report.cases.filter(
  (item) => item.agent_code === "a02_monitor_negocio" && item.monitor_benchmark,
);
assert.equal(cases.length, 5);
const model = LAB_MODELS.find((model) => model.id === "gpt-6.1-terra")!;
report.models.push(model);
for (const testCase of cases) {
  testCase.model_ids!.push(model.id);
  report.results.push(pendingResult(testCase.id, model.id));
}
report.updated_at = new Date().toISOString();
await writeFile(
  path + ".tmp",
  JSON.stringify(aiModelLabReportSchema.parse(report), null, 2),
);
await rename(path + ".tmp", path);
console.log(
  JSON.stringify({
    added: model.id,
    cases: cases.length,
    combinations: report.results.length,
    previous_results_unchanged: true,
  }),
);
