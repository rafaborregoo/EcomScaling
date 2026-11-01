import { readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { normalizeOutput, parseOutput } from "./ai-model-lab-core.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";

const path = ".e-nora-test-lab/ai-models/report.json";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
if (report.results.some((row) => ["running", "pending"].includes(row.status))) throw new Error("active_batch");
const cases = report.cases.filter((row) => row.agent_code === "a05_estrategia_campanas" && row.schema_file);
for (const model of report.models) {
  const results = report.results.filter((row) => row.model_id === model.id && cases.some((item) => item.id === row.case_id));
  const prices = results.map((row) => {
    const usage = row.usage;
    const total = model.provider === "anthropic" ? (usage.input ?? 0) + (usage.cached ?? 0) + (usage.cache_creation ?? 0) : usage.input;
    return calculateLabApiPrice(model.id, { ...usage, input: total, cached: 0, cache_creation: 0 });
  });
  console.log(JSON.stringify({ model: model.id, valid: results.filter((row) => row.checks.native_contract).length, completed: results.length, monthly30: prices.every(Boolean) ? prices.reduce((sum, price) => sum + price!.low, 0) / prices.length * 30 : null, details: results.map((row) => ({ case: row.case_id.split(":")[1], status: row.status, initiatives: (parseOutput(row.raw_response) as any)?.initiatives?.length })) }));
}
await copyFile(path, path + ".before-a05-normalized");
for (const row of report.results) if (report.cases.some((item) => item.agent_code === "a05_estrategia_campanas" && item.id === row.case_id) && row.status === "completed") row.normalized = normalizeOutput(row.raw_response);
report.updated_at = new Date().toISOString();
await writeFile(path + ".tmp", JSON.stringify(aiModelLabReportSchema.parse(report), null, 2));
await rename(path + ".tmp", path);
