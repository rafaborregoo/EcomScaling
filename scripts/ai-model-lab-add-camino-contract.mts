import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { caminoPlanJsonSchema } from "../packages/ai/src/index.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult } from "./ai-model-lab-core.js";

const dir = resolve(".e-nora-test-lab/ai-models");
const path = resolve(dir, "report.json");
const report = aiModelLabReportSchema.parse(
  JSON.parse(await readFile(path, "utf8")),
);
if (report.results.some((r) => ["running", "pending"].includes(r.status)))
  throw new Error("finish_current_batch_first");
const code = "a19_arquitecto_camino";
const base = report.cases.find((c) => c.agent_code === code && !c.schema_file)!;
const original = JSON.parse(
  await readFile(
    resolve(dir, `${code}.${base.context_hash}.${base.prompt_hash}.input.json`),
    "utf8",
  ),
);
const schemaHash = hash(caminoPlanJsonSchema);
const file = `camino-${schemaHash}.schema.json`;
const input = {
  ...original.input,
  context: {
    ...original.input.context,
    lab_protocol: {
      timeout_ms: 420_000,
      output_schema_sha256: schemaHash,
      tools: "unavailable",
    },
  },
};
const contextHash = hash(input.context);
const id = `${code}:contract-${contextHash.slice(0, 12)}`;
if (report.cases.some((c) => c.id === id))
  throw new Error("camino_contract_case_already_exists");
const prompt =
  original.prompt.replace(
    JSON.stringify(original.input),
    JSON.stringify(input),
  ) +
  "\nCONDICIÓN DE ESTA TANDA: devuelve el plan completo según el contrato nativo de Mi camino indicado por la CLI. No lo sustituyas por una explicación del trabajo pendiente ni declares que creaste archivos. No hay herramientas de consulta disponibles; identifica lo desconocido y respeta el periodo histórico. No puntúes tu resultado.";
await writeFile(
  resolve(dir, file),
  JSON.stringify(caminoPlanJsonSchema, null, 2),
);
await writeFile(
  resolve(dir, `${code}.${contextHash}.${base.prompt_hash}.input.json`),
  JSON.stringify({ system: original.system, prompt, input }, null, 2),
);
report.cases.push({
  ...base,
  id,
  label: "Contrato nativo de Mi camino · hasta 7 minutos",
  context_hash: contextHash,
  schema_file: file,
  schema_hash: schemaHash,
  timeout_ms: 420_000,
  input_characters: prompt.length + original.system.length,
  limitations: [
    ...base.limitations,
    "Tanda distinta: 420 segundos y contrato JSON nativo. No comparar su duración directamente con la tanda libre de 150 segundos.",
    "El contrato se valida localmente; siguen sin ejecutarse las herramientas ni la persistencia del runtime.",
  ],
});
report.results.push(...report.models.map((m) => pendingResult(id, m.id)));
report.updated_at = new Date().toISOString();
report.issues.push({
  id: "camino-contract-trial",
  severity: "medium",
  title: "Mi camino: segunda tanda con contrato y tiempo adecuados",
  detail:
    "Se conserva la tanda original y se preparan seis ejecuciones con el contrato nativo y hasta 420 segundos. Esto comprueba si el límite y la ausencia de contrato impedían completar el entregable, sin atribuir el fallo automáticamente al modelo.",
  status: "limited",
  agent_code: code,
  evidence: id,
  resolution:
    "Revisar ambas tandas por separado. Validación de contrato local y revisión automática provisional, sin promoción a producción.",
});
await writeFile(
  path,
  JSON.stringify(aiModelLabReportSchema.parse(report), null, 2),
);
console.log(
  JSON.stringify({
    added: id,
    pending: 6,
    schema_characters: JSON.stringify(caminoPlanJsonSchema).length,
    system_characters: original.system.length,
  }),
);
