import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const promptSources = [
  "supabase/migrations/20260824120000_ai_13_canonical_prompt_sections.sql",
  "supabase/migrations/20260824170000_ai_18_a08_canonical_prompt.sql",
  "supabase/migrations/20260826120000_ai_22_prepared_agent_prompts.sql",
  "supabase/migrations/20260905140000_ai_a19_arquitecto_camino.sql",
  "supabase/migrations/20260907180000_ai_agentes_shopify_especialistas.sql",
  "supabase/migrations/20260908150000_ai_agentes_meta_especialistas.sql",
];

const promptCodes = [
  "a01_analista_llamadas_system",
  "a02_monitor_negocio_system",
  "a03_analista_adquisicion_system",
  "a04_generador_tareas_system",
  "a05_estrategia_campanas_system",
  "a06_planificador_stock_system",
  "a07_rendimiento_contenido_system",
  "a08_gestor_conocimiento_system",
  "a09_copiloto_consultor_system",
  "a11_generador_marketing_system",
  "a19_arquitecto_camino_system",
  "a20_retencion_clientes_system",
  "a21_adquisicion_shopify_system",
  "a22_postventa_shopify_system",
  "a23_creatividad_meta_system",
  "a24_medicion_meta_system",
  "a25_cambios_meta_system",
];

const requiredSections = [
  "1. ROLE",
  "2. GOAL",
  "3. CONTEXT",
  "4. INPUT",
  "5. RULES / CONSTRAINTS",
  "6. TOOLS",
  "7. OUTPUT",
  "8. FAILURE BEHAVIOUR",
  "9. EXAMPLES",
];

test("cada agente del catálogo tiene un prompt canónico completo de nueve secciones", () => {
  const migrations = promptSources.map((source) =>
    fs.readFileSync(path.resolve(process.cwd(), source), "utf8"),
  );

  for (const promptCode of promptCodes) {
    const source = migrations.find((migration) =>
      migration.includes(`'${promptCode}'`),
    );
    assert.ok(source, `missing canonical prompt ${promptCode}`);

    const match = source.match(
      new RegExp(`\\n  '${promptCode}',\\n  'v\\d+',\\n  \\\$\\$([\\s\\S]*?)\\$\\$,`),
    );
    assert.ok(match, `missing prompt body ${promptCode}`);
    const promptBody = match[1];
    assert.ok(promptBody, `empty prompt body ${promptCode}`);
    for (const section of requiredSections) {
      assert.ok(promptBody.includes(section), `${promptCode} missing ${section}`);
    }
  }
});
