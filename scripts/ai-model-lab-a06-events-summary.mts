import { readFile } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { parseOutput } from "./ai-model-lab-core.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
const dir = ".e-nora-test-lab/ai-models";
const report = aiModelLabReportSchema.parse(
  JSON.parse(await readFile(`${dir}/report.json`, "utf8")),
);
const assessments = JSON.parse(
  await readFile(`${dir}/field-evaluations.json`, "utf8"),
);
for (const result of report.results.filter((result) =>
  report.cases.some(
    (item) =>
      item.id === result.case_id &&
      item.stock_benchmark?.scenario.startsWith("event_"),
  ),
)) {
  const c = report.cases.find((item) => item.id === result.case_id)!;
  const output = parseOutput(result.raw_response) as Record<string, any> | null;
  const checks =
    assessments.find((row: any) => row.result_id === result.id)?.assessment
      ?.checks ?? [];
  const u = result.usage;
  const price =
    u.input !== null && u.cached !== null && u.cache_creation !== null
      ? calculateLabApiPrice(result.model_id, {
          ...u,
          input: result.model_id.startsWith("claude")
            ? u.input + u.cached + u.cache_creation
            : u.input,
          cached: 0,
          cache_creation: 0,
        })
      : null;
  console.log(
    JSON.stringify({
      scenario: c.stock_benchmark!.scenario,
      model: result.model_id,
      status: result.status,
      valid: result.checks.native_contract,
      fields: {
        pass: checks.filter((c: any) => c.status === "pass").length,
        fail: checks.filter((c: any) => c.status === "fail").length,
        uncertain: checks.filter((c: any) => c.status === "uncertain").length,
      },
      concerns: checks.filter((c: any) => c.status !== "pass"),
      cold_cost_usd: price?.low,
      answer: output?.answer,
      tasks: output?.proposed_writes,
      warnings: output?.warnings,
    }),
  );
}
