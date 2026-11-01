import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";

const dir = resolve(".e-nora-test-lab/ai-models");
const reportPath = resolve(dir, "report.json");
const report = aiModelLabReportSchema.parse(
  JSON.parse(await readFile(reportPath, "utf8")),
);
const evaluations = JSON.parse(
  await readFile(resolve(dir, "field-evaluations.json"), "utf8"),
) as Array<{ result_id: string; assessment: unknown }>;
const cases = report.cases.filter((item) =>
  item.id.includes("a02_monitor_negocio:real-store-history"),
);
if (cases.length !== 2) throw new Error("expected_two_history_cases");
let attached = 0;
for (const result of report.results.filter((item) =>
  cases.some((testCase) => testCase.id === item.case_id),
)) {
  const evaluation = evaluations.find((item) => item.result_id === result.id);
  if (!evaluation) throw new Error(`missing_field_evaluation:${result.id}`);
  result.field_assessment = evaluation.assessment as typeof result.field_assessment;
  attached++;
}
if (attached !== 12) throw new Error(`expected_12_reviews_got_${attached}`);
const backup = resolve(dir, `report.before-a02-history-review-${Date.now()}.json`);
await writeFile(backup, await readFile(reportPath, "utf8"));
await writeFile(
  `${reportPath}.tmp`,
  JSON.stringify(aiModelLabReportSchema.parse(report), null, 2),
);
await rename(`${reportPath}.tmp`, reportPath);
console.log(JSON.stringify({ attached, cases: cases.map((item) => item.id), backup }));
