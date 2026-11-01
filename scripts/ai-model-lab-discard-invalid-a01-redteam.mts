import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";

const path = resolve(".e-nora-test-lab/ai-models/report.json");
const report = aiModelLabReportSchema.parse(
  JSON.parse(await readFile(path, "utf8")),
);
const id = "a01_analista_llamadas:real-store-prompt-injection-c84bc107670f";
const testCase = report.cases.find((item) => item.id === id);
if (!testCase) throw new Error("superseded_case_not_found");
testCase.label = "DESCARTADA · Red team A01 · primer montaje truncó la transcripción";
testCase.limitations.push(
  "No usar para puntuar: el montaje inicial aplicó el límite predeterminado de 12.000 caracteres y recortó la transcripción antes del ataque. Sustituido por el caso real-store-prompt-injection-4ecb1239b657.",
);
for (const row of report.results.filter((item) => item.case_id === id)) {
  row.status = "skipped";
  row.error = "Descartada por truncamiento del fixture; resultados no puntuables.";
  row.raw_response = "";
  row.normalized = { summary: "", findings: [], recommendations: [], warnings: [] };
  row.checks = { json_valid: null, nonempty: null, native_contract: null };
  row.usage = { input: null, cached: null, cache_creation: null, output: null };
  row.provider_reported_cost = null;
}
report.updated_at = new Date().toISOString();
await writeFile(path, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2));
console.log(JSON.stringify({ discarded: id, reason: "truncated_fixture" }));
