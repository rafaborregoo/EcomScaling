import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// AI-30: raiz del repo desde este fichero, no desde `process.cwd()` -- ver
// agent-canonical-prompts.test.ts.
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
import {
  ACTIVE_AGENT_CODES,
  AGENT_EVAL_MATRIX,
  runOfflineAgentEvalSuite,
} from "./agent-evals.js";

const EXPECTED_ACTIVE_AGENT_CODES = [
  "a01_analista_llamadas", "a02_monitor_negocio", "a04_generador_tareas",
  "a05_estrategia_campanas", "a06_planificador_stock", "a08_gestor_conocimiento",
  "a09_copiloto_consultor", "a11_generador_marketing", "a12_analista_email",
  "a13_operativa_shopify", "a14_operativa_meta", "a15_analista_imagenes",
  "a16_texto_sobre_imagen", "a17_plan_semanal", "a18_plan_mensual",
  "a19_arquitecto_camino", "a19_revision_camino", "a20_retencion_clientes",
  "a21_adquisicion_shopify", "a22_postventa_shopify", "a23_creatividad_meta",
  "a24_medicion_meta", "a25_cambios_meta", "a26_contenido_email",
  "a27_planificador_mailing", "a28_arquitecto_flujos", "a29_analista_metrica",
];

test("la matriz cubre todos los agentes activos", () => {
  assert.deepEqual(
    Object.keys(AGENT_EVAL_MATRIX).sort(),
    [...ACTIVE_AGENT_CODES].sort(),
  );
  const results = runOfflineAgentEvalSuite();
  assert.equal(results.length, ACTIVE_AGENT_CODES.length);
  assert.ok(
    results.every((result) => result.passed),
    JSON.stringify(results),
  );
});

test("cada agente tiene calidad, abstención, seguridad, tenant y performance", () => {
  for (const agentCode of ACTIVE_AGENT_CODES) {
    const categories = new Set(
      AGENT_EVAL_MATRIX[agentCode].map((item) => item.category),
    );
    for (const category of [
      "quality",
      "abstention",
      "security",
      "tenant",
      "performance",
    ] as const) {
      assert.ok(categories.has(category), `${agentCode} missing ${category}`);
    }
  }
});

test("el registro offline cubre la unión de agentes activos en test y producción", () => {
  assert.deepEqual([...ACTIVE_AGENT_CODES], EXPECTED_ACTIVE_AGENT_CODES);
});

test("A23-A25 tienen gates especializados para scope y fallos de evidencia Meta", () => {
  const matrix = AGENT_EVAL_MATRIX as Record<string, readonly { id: string }[]>;
  assert.ok(matrix.a23_creatividad_meta?.some((item) => item.id === "meta_multi_store_needs_explicit_scope"));
  assert.ok(matrix.a23_creatividad_meta?.some((item) => item.id === "meta_rpc_failure_is_not_zero"));
  assert.ok(matrix.a24_medicion_meta?.some((item) => item.id === "measurement_unknown_fails_closed"));
  assert.ok(matrix.a25_cambios_meta?.some((item) => item.id === "change_history_failure_is_not_quiet_account"));
});

test("A08 no queda fuera de la activación canónica", () => {
  const migration = fs.readFileSync(
    path.resolve(
      REPO_ROOT,
      "supabase/migrations/20260824170000_ai_18_a08_canonical_prompt.sql",
    ),
    "utf8",
  );
  assert.match(migration, /a08_gestor_conocimiento_system/);
  assert.match(migration, /'v3'/);
  assert.match(migration, /is_active = false/);
});
