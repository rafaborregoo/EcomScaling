import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { metaAdsJsonSchema, instagramPostJsonSchema } from "../packages/ai/src/index.js";
const previousDir = ".e-nora-test-lab/a11-real-2026-11-02-v2", dir = ".e-nora-test-lab/a11-real-2026-11-02-v3";
try { await readFile(`${dir}/report.json`); throw new Error("Comparison v3 already prepared; do not reset results"); } catch (error: any) { if (error.code !== "ENOENT") throw error; }
const report = JSON.parse(await readFile(`${previousDir}/report.json`, "utf8"));
assert.equal(report.results.length, 36); assert.equal(report.results.filter((row: any) => row.status === "failed").length, 5);
const total = (rows: any[]) => rows.reduce((sum, row) => ({ low: sum.low + (row.price?.low ?? 0), high: sum.high + (row.price?.high ?? 0) }), { low: 0, high: 0 });
const excluded = JSON.parse(await readFile(".e-nora-test-lab/a11-real-2026-11-02-v1/report.json", "utf8"));
report.prior_rounds = { baseline_contract: { executions: 36, valid: 31, rejected: 5, extra_social_cost: total(report.results.filter((row: any) => !row.case_id.startsWith("email"))), failures: report.results.filter((row: any) => row.status === "failed").map((row: any) => ({ case_id: row.case_id, model_id: row.model_id, error: row.error, raw_response: row.raw_response })), reason: "JSON Schema no comunicaba límites que Zod sí exigía. Se corrige en producción y se repiten las 24 piezas sociales; se conservan las doce respuestas email sin regenerar." }, excluded_preparation: { reason: excluded.exclusion_reason, known_cost: total(excluded.results), unknown_interrupted: excluded.results.filter((row: any) => row.status === "running").length } };
report.batch = "a11-real-2026-11-02-v3";
report.results = report.results.filter((row: any) => row.case_id.startsWith("email_klaviyo"));
await mkdir(dir, { recursive: true });
for (const c of report.cases) {
  const schema = c.channel === "email_klaviyo" ? JSON.parse(await readFile(`${previousDir}/${c.id}.schema.json`, "utf8")) : c.channel === "meta_ads" ? metaAdsJsonSchema : instagramPostJsonSchema;
  c.schema_hash = createHash("sha256").update(JSON.stringify(schema)).digest("hex");
  await writeFile(`${dir}/${c.id}.schema.json`, JSON.stringify(schema));
}
await writeFile(`${dir}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ retained_email_results: 12, social_reruns: 24, batch: report.batch }));
