import { readFile } from "node:fs/promises";
import { currentCampaignPlanOutputSchema, campaignPlanOutputSchema } from "../packages/ai/src/index.js";
import { parseOutput } from "./ai-model-lab-core.js";

const report = JSON.parse(await readFile(".e-nora-test-lab/ai-models/report.json", "utf8"));
const ids = new Set(report.cases.filter((item: any) => item.agent_code === "a05_estrategia_campanas").map((item: any) => item.id));
for (const row of report.results.filter((item: any) => ids.has(item.case_id) && item.status === "completed")) {
  const parsed = parseOutput(row.raw_response) as any;
  const current = currentCampaignPlanOutputSchema.safeParse(parsed);
  const legacy = campaignPlanOutputSchema.safeParse(parsed);
  console.log(JSON.stringify({ model: row.model_id, current: current.success, legacy: legacy.success, issues: current.success ? [] : current.error.issues.slice(0, 6).map((i: any) => ({ path: i.path, message: i.message })), keys: Object.keys(parsed ?? {}), usage: row.usage, duration_ms: row.duration_ms }));
}
