import assert from "node:assert/strict";
import { readFile, writeFile, rename } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";
import { buildAgentTools } from "../apps/api/src/ai-runtime.js";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash, pendingResult, redact } from "./ai-model-lab-core.js";
const env = loadApiEnv(process.env);
assert.ok(env.SUPABASE_URL.includes("kopcblejsxpkxoykldyh.supabase.co"));
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const dir = ".e-nora-test-lab/ai-models";
const path = `${dir}/report.json`;
const report = aiModelLabReportSchema.parse(JSON.parse(await readFile(path, "utf8")));
assert.ok(!report.active_batch);
const prior = report.cases.find((row) => row.id === "a05_estrategia_campanas:clean-runtime-2026-10-31");
assert.ok(prior?.source_run_id);
const caseId = "a05_estrategia_campanas:clean-runtime-v2-2026-10-31";
assert.ok(!report.cases.some((row) => row.id === caseId));
const original = JSON.parse(await readFile(`${dir}/${prior.agent_code}.${prior.context_hash}.${prior.prompt_hash}.input.json`, "utf8"));
const orgId = "5ebc7b02-ca86-402e-bd61-9abd22f1ee04";
const checked = async (query: any) => { const result = await query; assert.ifError(result.error); return result.data; };
const version = await checked(db.from("agent_versions").select("allowed_tools,approval_mode,agent_definitions!inner(code)").eq("agent_definitions.code", "a05_estrategia_campanas").eq("is_active", true).single());
const connections = await checked(db.from("integration_connections").select("provider").eq("organization_id", orgId).in("status", ["connected", "syncing"]));
const prepared = buildAgentTools(env, db, prior.source_run_id, orgId, version.allowed_tools, original.system, prior.store_id,
  ["core", ...connections.map((row: any) => row.provider === "meta_ads" ? "meta" : row.provider)], ["client_visible"], { actorUserId: "ead62983-1938-4da6-af8f-13cb64d8cd3e", approvalMode: version.approval_mode });
const tool = prepared.tools.find((row) => row.name === "get_shopify_product_catalog");
assert.ok(tool, "catalog must be available; do not run without it");
const blocks = original.input.context.snapshot.filter((row: any) => row.label !== "Lectura adicional no disponible: get_shopify_product_catalog");
let cursor: string | undefined;
let productRows = 0;
for (let page = 0; page < 4; page++) {
  const data = await tool.execute({ limit: 30, ...(cursor ? { cursor } : {}) }) as any;
  assert.ok(!data.error && data.ok !== false, JSON.stringify(data.error ?? data));
  productRows += data.data?.products?.length ?? data.rows?.length ?? data.data?.rows?.length ?? 0;
  blocks.push({ label: `Catálogo Shopify actual · página ${page + 1} · lectura real del arnés ${new Date().toISOString()}`, data: redact(data) });
  cursor = data.next_cursor ?? data.data?.next_cursor;
  if (!cursor) break;
}
assert.ok(productRows > 0, "must have observed catalog products");
original.input.context.snapshot = blocks;
original.prompt = JSON.stringify(original.input);
const contextHash = hash(original.input);
const nextCase = { ...prior, id: caseId, label: "A05 · tras limpieza NORA · contexto runtime y catálogo completo · 31/10/2026", context_hash: contextHash,
  allowed_tools: prepared.tools.map((row) => row.name), context_labels: blocks.map((row: any) => row.label),
  snapshot_at: new Date().toISOString(), input_characters: original.system.length + original.prompt.length,
  limitations: [...prior.limitations, "Revisión v2: incorpora catálogo actual mediante lecturas reales. La primera captura se detuvo porque el arnés filtraba conexiones syncing; se corrigió para igualar el runtime. El resto de bloques conserva su corte identificado."],
};
for (const row of report.results.filter((row) => row.case_id === prior.id && ["pending", "running"].includes(row.status))) {
  row.status = "skipped"; row.error = "Ejecución detenida: el arnés excluyó temporalmente el catálogo durante sincronización. Sustituida por v2 con catálogo leído.";
}
await writeFile(`${dir}/${nextCase.agent_code}.${nextCase.context_hash}.${nextCase.prompt_hash}.input.json`, JSON.stringify(original, null, 2));
report.cases.push(nextCase);
report.results.push(pendingResult(caseId, "gpt-6.1-sol"));
report.updated_at = new Date().toISOString();
await writeFile(`${path}.tmp`, JSON.stringify(aiModelLabReportSchema.parse(report), null, 2));
await rename(`${path}.tmp`, path);
console.log(JSON.stringify({ case_id: caseId, products_observed: productRows, input_characters: nextCase.input_characters }));
