import { readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash } from "./ai-model-lab-core.js";
import { A05_FIELD_RUBRIC } from "./ai-model-lab-a05-rubric.js";

const dir = resolve(".e-nora-test-lab/ai-models"), path = resolve(dir, "report.json");
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
const cases = report.cases.filter((c) => c.agent_code === "a05_estrategia_campanas" && c.schema_file);
assert.equal(cases.length, 3);
assert.ok(cases.every((c) => !c.campaign_benchmark));
assert.ok(!report.results.some((r) => ["pending", "running"].includes(r.status)));
await copyFile(path, path + ".before-a05-rubric");
for (const c of cases) {
  const file = resolve(dir, `${c.id.replaceAll(":", ".")}.reference.json`);
  let original: any = null;
  try { original = JSON.parse(await readFile(file, "utf8")); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  if (original) await copyFile(file, file + ".before-field-rubric");
  const reference = { case_id: c.id, provenance: "Rúbrica fijada después de generar las salidas y antes de la revisión; riesgo de sesgo retrospectivo.", requirements: original?.expected ?? "Snapshot histórico: inventario obsoleto, información insuficiente y ventana parcialmente pasada; no inventar campañas ni consultas y conservar fecha y zona solicitadas.", criteria: Object.entries(A05_FIELD_RUBRIC).map(([id, expected]) => ({ id, expected, quote: "Rúbrica de " + id })) };
  await writeFile(file, JSON.stringify(reference, null, 2));
  c.campaign_benchmark = { scenario: c.id.split(":")[1]!, reference_hash: hash(reference) };
  c.limitations.push("Rúbrica de revisión definida después de generar resultados; posible sesgo retrospectivo.");
}
report.updated_at = new Date().toISOString();
await writeFile(path + ".tmp", JSON.stringify(aiModelLabReportSchema.parse(report), null, 2));
await rename(path + ".tmp", path);
console.log(JSON.stringify({ cases: cases.length, criteria: Object.keys(A05_FIELD_RUBRIC).length }));
