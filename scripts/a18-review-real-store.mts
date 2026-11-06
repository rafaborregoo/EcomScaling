import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { buildLeanOutputContract } from "../packages/ai/src/index.js";
import { serializeUntrustedContextBlocks } from "../packages/ai/src/untrusted-context.js";
import { calculateLabApiPrice } from "../apps/web/src/app/admin/laboratorio-ia/lab-price.js";
import { parseOutput } from "./ai-model-lab-core.js";
const dir = ".e-nora-test-lab/ai-models", caseId = "a18_plan_mensual:real-store-runtime-2026-11-06-monthly-v3";
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(`${dir}/report.json`, "utf8")));
const scenario = report.cases.find((row) => row.id === caseId)!; assert.ok(scenario);
const source = JSON.parse(await readFile(`${dir}/${scenario.agent_code}.${scenario.context_hash}.${scenario.prompt_hash}.input.json`, "utf8"));
const limits = { maxBlockChars: 64000, maxContextChars: 300000 };
const context = serializeUntrustedContextBlocks(source.input.context.snapshot, limits);
assert.equal(context.truncated, false, JSON.stringify(context.truncatedBlocks));
const history = source.input.context.snapshot.find((block: any) => block.label.startsWith("Histórico mensual Shopify")).data;
assert.equal(history.status, "available"); assert.equal(history.data.months.length, 24);
const summaries = report.results.filter((row) => row.case_id === caseId).map((row) => {
  const raw = parseOutput(row.raw_response) as any;
  const parsed = buildLeanOutputContract(["findings", "recommendations"]).schema.safeParse(raw);
  const u = row.usage;
  const total = u.input === null ? null : row.model_id.startsWith("claude-") ? u.input + (u.cached ?? 0) + (u.cache_creation ?? 0) : u.input;
  const price = total === null ? null : calculateLabApiPrice(row.model_id, { input: total, cached: 0, cache_creation: 0, output: u.output });
  return { model: row.model_id, status: row.status, native_contract: parsed.success, validation_errors: parsed.success ? [] : parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })), tasks: raw?.proposed_writes?.length ?? null, input_total: total, output_tokens: u.output, cli_ms: row.duration_ms, cold_usd_per_run: price?.low ?? null, monthly_30_days_usd: price ? price.low * 30 / 27 : null, answer: raw?.answer ?? null, proposals: raw?.proposed_writes ?? [], warnings: raw?.warnings ?? [], error: row.error };
});
await mkdir(".e-nora-test-lab/a18-real-2026-11-06", { recursive: true });
await writeFile(".e-nora-test-lab/a18-real-2026-11-06/review.json", JSON.stringify({ case_id: caseId, context_limits: limits, context_chars: context.text.length, context_not_truncated: true, months: history.data.months, summaries, price_basis: "Equivalente API en frío, catálogo local 28/10 y sobrecarga CLI; no factura ni tarifas actuales verificadas. 30/27 ejecuciones por treinta días por tienda, compartidas entre roles. Manuales, tools, juez, reintentos y fallback se suman." }, null, 2));
console.log(JSON.stringify(summaries.map(({ proposals, answer, warnings, ...summary }) => summary), null, 2));

