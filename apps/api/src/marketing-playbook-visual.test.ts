import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Fastify from "fastify";
import { internalMailingVisualAnalysisSchema, registerInternalMailingVisualImageBodyParser } from "./marketing-playbook-visual.js";

const valid = {
  detected_text: [{ text: "Descubre la colección", role: "headline", position_percent: 8, confidence: "medium" }],
  layout_blocks: [{ type: "hero", position_percent: 0, approximate_height_percent: 34, description: "Imagen de producto con titular" }],
  visual_hierarchy: ["Titular", "Imagen", "CTA"],
  typography: [{ role: "headline", approximate_size: "display", weight_or_emphasis: "negrita", confidence: "low" }],
  ctas: [{ visible_text: "Comprar ahora", position_percent: 76, treatment: "Botón contrastado", prominence: "high" }],
  composition_notes: ["El CTA aparece después del bloque principal."],
  persuasion_cues: ["Presenta una novedad sin afirmar escasez."],
  limitations: ["La captura no permite medir conversiones ni áreas con precisión."],
  confidence: "medium",
};

test("accepts bounded, structured private visual analysis", () => {
  assert.deepEqual(internalMailingVisualAnalysisSchema.parse(valid), valid);
});

test("rejects unsupported positions, excessive arrays, and undeclared fields", () => {
  assert.equal(internalMailingVisualAnalysisSchema.safeParse({ ...valid, ctas: [{ ...valid.ctas[0], position_percent: 101 }] }).success, false);
  assert.equal(internalMailingVisualAnalysisSchema.safeParse({ ...valid, detected_text: Array(31).fill(valid.detected_text[0]) }).success, false);
  assert.equal(internalMailingVisualAnalysisSchema.safeParse({ ...valid, raw_image: "must never persist" }).success, false);
});

test("Fastify parses supported image MIME bodies as raw buffers and rejects other types", async () => {
  const app = Fastify({ logger: false });
  registerInternalMailingVisualImageBodyParser(app);
  app.post("/image", async (request, reply) => reply.send({ isBuffer: Buffer.isBuffer(request.body), bytes: Buffer.isBuffer(request.body) ? request.body.length : 0 }));
  try {
    for (const mime of ["image/png", "image/jpeg", "image/webp"]) {
      const response = await app.inject({ method: "POST", url: "/image", headers: { "content-type": mime }, payload: Buffer.from([1, 2, 3]) });
      assert.equal(response.statusCode, 200);
      assert.deepEqual(response.json(), { isBuffer: true, bytes: 3 });
    }
    const unsupported = await app.inject({ method: "POST", url: "/image", headers: { "content-type": "image/gif" }, payload: Buffer.from([1, 2, 3]) });
    assert.equal(unsupported.statusCode, 415);
  } finally {
    await app.close();
  }
});

test("platform-run migration keeps SECURITY DEFINER private and the public RPC invoker-only", async () => {
  const migrationPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../supabase/migrations/20261115350000_a27_platform_ai_runs.sql");
  const sql = await readFile(migrationPath, "utf8");
  const privateFunction = sql.match(/create or replace function private\.start_platform_ai_run_internal\([\s\S]*?\n\$\$;/i)?.[0] ?? "";
  const publicFunction = sql.match(/create or replace function public\.start_platform_ai_run\([\s\S]*?\n\$\$;/i)?.[0] ?? "";
  assert.match(privateFunction, /security definer\s+set search_path\s*=\s*''/i);
  assert.match(publicFunction, /security invoker\s+set search_path\s*=\s*''/i);
  assert.match(publicFunction, /select private\.start_platform_ai_run_internal\(/i);
  assert.match(sql, /revoke all on function private\.start_platform_ai_run_internal\([\s\S]*?from public, anon, authenticated;/i);
  assert.match(sql, /grant execute on function private\.start_platform_ai_run_internal\([\s\S]*?to service_role;/i);
  assert.match(sql, /revoke all on function public\.start_platform_ai_run\([\s\S]*?from public, anon, authenticated;/i);
  assert.match(sql, /grant execute on function public\.start_platform_ai_run\([\s\S]*?to service_role;/i);
});
