import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { reviewMarketingModelOutput } from "../apps/api/src/marketing-model-review.js";
const dir = ".e-nora-test-lab/a11-real-2026-11-02-v4";
const report = JSON.parse(await readFile(`${dir}/report.json`, "utf8"));
assert.equal(report.results.length, 36); assert.ok(report.results.every((row: any) => ["completed", "failed"].includes(row.status)));
const summaries = [];
for (const model of report.models) {
  const results = report.results.filter((row: any) => row.model_id === model.id);
  const details = [];
  for (const result of results) {
    const c = report.cases.find((item: any) => item.id === result.case_id);
    const output = JSON.parse(result.raw_response || "{}");
    const products = c.blocks.find((block: any) => block.label === "Productos de la tienda verificados").data.items;
    const audit = reviewMarketingModelOutput(c.channel, output, products);
    details.push({ case: c.id, status: result.status, issues: audit.issues, text: c.channel === "email_klaviyo" ? output.plain_text : output.primary_text ?? output.caption, subject: output.subject ?? output.headline ?? output.title, html_chars: output.html?.length, brief_chars: output.creative_brief?.length, price: result.price });
  }
  summaries.push({ model: model.id, valid: results.filter((row: any) => row.status === "completed").length, low: results.reduce((sum: number, row: any) => sum + (row.price?.low ?? 0), 0), high: results.reduce((sum: number, row: any) => sum + (row.price?.high ?? 0), 0), cases: details });
}
await writeFile(`${dir}/audit-evidence.json`, JSON.stringify(summaries, null, 2));
console.log(JSON.stringify(summaries.map((summary) => ({ model: summary.model, valid: summary.valid, low: summary.low, high: summary.high, cases: summary.cases.map((c: any) => ({ case: c.case, issues: c.issues, brief_chars: c.brief_chars })) })), null, 2));
