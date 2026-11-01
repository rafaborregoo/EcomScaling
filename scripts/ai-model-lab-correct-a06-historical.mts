import { copyFile, readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult } from "./ai-model-lab-core.js";

const dir = resolve(".e-nora-test-lab/ai-models");
const reportPath = resolve(dir, "report.json");
const evaluationsPath = resolve(dir, "field-evaluations.json");
const report = aiModelLabReportSchema.parse(
  JSON.parse(await readFile(reportPath, "utf8")),
);
assert.ok(!report.results.some((row) => ["pending", "running"].includes(row.status)));
const oldCase = report.cases.find(
  (item) => item.stock_benchmark?.scenario === "historico",
);
assert.ok(oldCase);
const inputPath = resolve(
  dir,
  `${oldCase.agent_code}.${oldCase.context_hash}.${oldCase.prompt_hash}.input.json`,
);
const input = JSON.parse(await readFile(inputPath, "utf8"));
const aggregate = input.input.context.snapshot.find((block: any) =>
  block.label.startsWith("Stock actual agregado"),
);
const products = input.input.context.snapshot.find((block: any) =>
  block.label.startsWith("Productos con demanda"),
);
assert.ok(aggregate && products);
aggregate.label = "Stock del 19/10 · no sincronizado desde hace 10 días";
aggregate.data = {
  status: "unavailable",
  reason: "inventory_not_synced",
  snapshot_at: "2026-10-19T19:19:24.030Z",
};
products.label =
  "Demanda histórica y previsión semanal · inventario del 19/10 sin sincronizar";
products.data.items = products.data.items.map((item: Record<string, any>) => ({
  ...item,
  inventory_status: "inventory_not_synced",
  inventory_sync_is_stale: true,
  inventory_sync_age_hours: 240,
  available_quantity: null,
  days_of_cover: null,
  stock_coverage_sample_sufficient: false,
  demand_forecast: { ...item.demand_forecast, coverageDays: null, risk: "unknown" },
}));
input.input.context.benchmark_protocol = "a06-native-historico-v2";
input.prompt =
  "LABORATORIO A06: evaluación 2026-10-29. El stock es del 19/10, tiene 240 horas y Shopify figura en error. No lo trates como actual. Sin herramientas ni escrituras; solo JSON del contrato.\n" +
  JSON.stringify(input.input);

const contextHash = hash(input.input.context);
const newId = `${oldCase.agent_code}:native-historico-${contextHash.slice(0, 12)}`;
assert.ok(!report.cases.some((item) => item.id === newId));
const referencePath = resolve(
  dir,
  `${oldCase.id.replaceAll(":", ".")}.reference.json`,
);
const reference = JSON.parse(await readFile(referencePath, "utf8"));
reference.case_id = newId;
reference.requirements = [
  "El inventario del 19/10 tiene diez días de antigüedad y Shopify figura en error; no afirmar stock ni cobertura actual ni proponer compras basadas en esos valores.",
  "Es útil proponer la restauración/verificación de sincronización. Seguimientos de producto solo si son condicionales, priorizados por demanda y sin duplicar propuestas anteriores pendientes; usar UUID exactos.",
];
const referenceHash = hash(reference);
const promptHash = oldCase.prompt_hash;
const newInputPath = resolve(
  dir,
  `${oldCase.agent_code}.${contextHash}.${promptHash}.input.json`,
);
const newReferencePath = resolve(dir, `${newId.replaceAll(":", ".")}.reference.json`);
await writeFile(newInputPath, JSON.stringify(input, null, 2));
await writeFile(newReferencePath, JSON.stringify(reference, null, 2));

const resultsPath = resolve(dir, "field-evaluations.json");
const evaluations = JSON.parse(await readFile(evaluationsPath, "utf8"));
const previousIds = new Set(
  report.results.filter((row) => row.case_id === oldCase.id).map((row) => row.id),
);
const updatedCase = {
  ...oldCase,
  id: newId,
  label: "Snapshot histórico · inventario de 10 días sin sincronizar",
  context_hash: contextHash,
  input_characters: input.system.length + input.prompt.length,
  context_labels: input.input.context.snapshot.map((block: any) => block.label),
  stock_benchmark: { scenario: "historico", reference_hash: referenceHash },
  limitations: [
    ...oldCase.limitations,
    "La primera versión mezclaba ventas del 19/10 con stock marcado como reciente; quedó archivada y no cuenta en la comparación corregida.",
  ],
};
report.cases = report.cases.map((item) =>
  item.id === oldCase.id ? updatedCase : item,
);
report.results = report.results.filter((row) => row.case_id !== oldCase.id);
report.results.push(
  ...oldCase.model_ids!.map((modelId) => pendingResult(newId, modelId)),
);
await copyFile(reportPath, `${reportPath}.before-a06-task-review.json`);
await copyFile(evaluationsPath, `${evaluationsPath}.before-a06-task-review.json`);
await writeFile(resultsPath, JSON.stringify(evaluations.filter((item: any) => !previousIds.has(item.result_id)), null, 2) + "\n");
await writeFile(`${reportPath}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2) + "\n");
await rename(`${reportPath}.tmp`, reportPath);
console.log(JSON.stringify({ case: newId, models: oldCase.model_ids?.length, archivedResponses: previousIds.size, removedAssessments: evaluations.length - JSON.parse(await readFile(evaluationsPath, "utf8")).length }));
