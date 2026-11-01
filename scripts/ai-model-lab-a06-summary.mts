import { readFile } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { parseOutput } from "./ai-model-lab-core.js";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(".e-nora-test-lab/ai-models/report.json", "utf8")));
const cases = report.cases.filter((c) => c.stock_benchmark && !c.stock_benchmark.scenario.startsWith("event_"));
const modelIds = new Set(cases.flatMap((c) => c.model_ids ?? []));
const assessments = JSON.parse(await readFile(".e-nora-test-lab/ai-models/field-evaluations.json", "utf8"));
for (const model of report.models.filter((candidate) => modelIds.has(candidate.id))) {
  const rows = report.results.filter((r) => r.model_id === model.id && cases.some((c) => c.id === r.case_id));
  const checks = rows.flatMap((r) => assessments.find((a: any) => a.result_id === r.id && a.assessment.output_hash)?.assessment.checks ?? []);
  const prices = rows.map((row) => {
    const u = row.usage;
    if (u.input === null || u.cached === null || u.cache_creation === null) return null;
    return calculateLabApiPrice(model.id, { ...u, input: model.provider === "anthropic" ? u.input + u.cached + u.cache_creation : u.input, cached: 0, cache_creation: 0 });
  });
  console.log(JSON.stringify({ model: model.id, valid: rows.filter((r) => r.checks.native_contract === true).length, completed: rows.filter((r) => r.status === "completed").length, fields: { pass: checks.filter((c: any) => c.status === "pass").length, fail: checks.filter((c: any) => c.status === "fail").length, uncertain: checks.filter((c: any) => c.status === "uncertain").length }, monthly30: prices.length === 4 && prices.every(Boolean) ? prices.reduce((sum, p) => sum + p!.low, 0) / 4 * 30 : null, details: rows.map((r) => ({ scenario: cases.find((c) => c.id === r.case_id)?.stock_benchmark?.scenario, tasks: (parseOutput(r.raw_response) as any)?.proposed_writes?.length, valid: r.checks.native_contract })) }));
}
