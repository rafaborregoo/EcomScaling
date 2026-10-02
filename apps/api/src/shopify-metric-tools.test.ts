import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { combineMetricRpcs } from "./ai-runtime.js";

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const fails = (message: string) =>
  Promise.resolve({ data: null, error: { message } });

test("una funcion de fila unica se desenvuelve del array", async () => {
  const result = await combineMetricRpcs({
    recurrencia: ok([{ new_orders: 3 }]),
  });

  assert.deepEqual(result.data.recurrencia, { new_orders: 3 });
  assert.equal(result.error, null);
});

test("una funcion de varias filas se deja como lista", async () => {
  const result = await combineMetricRpcs({
    cohortes: ok([{ mes: "2026-06" }, { mes: "2026-07" }]),
  });

  assert.equal((result.data.cohortes as unknown[]).length, 2);
});

test("una metrica rota no se lleva por delante a las que funcionan", async () => {
  const result = await combineMetricRpcs({
    recurrencia: ok([{ new_orders: 3 }]),
    cohortes: fails("relation does not exist"),
  });

  assert.deepEqual(result.data.recurrencia, { new_orders: 3 });
  assert.equal(result.data.cohortes, "no_disponible");
  // Con algo util que devolver, el modelo recibe los datos y la marca, no un
  // error opaco que le haria decir que no sabe nada.
  assert.equal(result.error, null);
});

test("si fallan todas, el error se propaga", async () => {
  const result = await combineMetricRpcs({
    recurrencia: fails("permission denied"),
    cohortes: fails("timeout"),
  });

  assert.notEqual(result.error, null);
  assert.match(result.error!.message, /recurrencia: permission denied/);
});

test("el error que se propaga es el primero, no el ultimo", async () => {
  const result = await combineMetricRpcs({
    entregas: fails("primero"),
    devoluciones: fails("segundo"),
  });

  assert.match(result.error!.message, /primero/);
});

test("una funcion sin filas es un resultado valido, no un fallo", async () => {
  const result = await combineMetricRpcs({
    devoluciones: ok([]),
  });

  assert.deepEqual(result.data.devoluciones, []);
  assert.equal(result.error, null);
});

test("data null se trata como lista vacia y no revienta", async () => {
  const result = await combineMetricRpcs({
    entregas: Promise.resolve({ data: null, error: null }),
  });

  assert.deepEqual(result.data.entregas, []);
  assert.equal(result.error, null);
});

// --- Contrato estatico entre la capa de tools, el runtime y el esquema ------
//
// Estos tres no se ejecutan contra Supabase, asi que nada los comprobaba. El
// resultado fue una familia de bugs silenciosos: nombres que no existen no dan
// error, devuelven undefined y el agente responde "no lo se" con el dato
// delante. Parsear los ficheros es feo, pero es el unico chequeo que corre en
// CI sin base de datos.
const RUNTIME = readFileSync(new URL("./ai-runtime.ts", import.meta.url), "utf8");
const TOOL_LAYER = readFileSync(
  new URL("../../../packages/ai/src/tool-layer.ts", import.meta.url),
  "utf8",
);

function toolsRegistradas() {
  const nombres = new Set<string>();
  for (const m of RUNTIME.matchAll(/register[A-Za-z]*ReadTool\(\s*"([a-z_0-9]+)"/g)) {
    if (m[1]) nombres.add(m[1]);
  }
  return nombres;
}

function toolsDeclaradas() {
  const bloque = TOOL_LAYER.slice(
    TOOL_LAYER.indexOf("const readTools"),
    TOOL_LAYER.indexOf("const proposedTools"),
  );
  return new Set([...bloque.matchAll(/"([a-z_0-9]+)"/g)].map((m) => m[1]));
}

function funcionesSql() {
  const dir = new URL("../../../supabase/migrations/", import.meta.url);
  const nombres = new Set<string>();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".sql")) continue;
    const src = readFileSync(new URL(f, dir), "utf8");
    for (const m of src.matchAll(/create (?:or replace )?function public\.([a-z_0-9]+)\s*\(/gi)) {
      if (m[1]) nombres.add(m[1]);
    }
  }
  return nombres;
}

test("las tools nuevas de embudo, margen y gasto estan registradas y declaradas", () => {
  const registradas = toolsRegistradas();
  const declaradas = toolsDeclaradas();
  for (const tool of ["shopify_funnel_health", "shopify_margin_health", "meta_spend_detail", "shopify_return_delay_comparison"]) {
    assert.ok(registradas.has(tool), `${tool} no esta registrada en ai-runtime.ts`);
    assert.ok(declaradas.has(tool), `${tool} no esta en readTools de tool-layer.ts`);
  }
});

// Estar en readTools NO basta: registerScopedReadTool solo la monta si su
// definicion esta en estado `implemented_partial`. Una tool declarada pero en
// `planned` se concede al agente y luego no existe en el runtime -- fallo mudo
// que casi se cuela con estas tres.
test("las tools nuevas estan en estado implemented_partial, no planned", async () => {
  const { getToolDefinition } = await import("@e-nora/ai");
  for (const tool of ["shopify_funnel_health", "shopify_margin_health", "meta_spend_detail"]) {
    assert.equal(getToolDefinition(tool)?.status, "implemented_partial", tool);
  }
});

test("toda tool registrada en el runtime esta declarada en la capa de tools", () => {
  const declaradas = toolsDeclaradas();
  const huerfanas = [...toolsRegistradas()].filter((t) => !declaradas.has(t));
  assert.deepEqual(huerfanas, [], "registradas sin declarar: el runtime las rechaza");
});

// El que habria cazado `shopify_funnel_summary.conversion_rate`, que se leia en
// seis motores y no existe. Aqui cubre el nombre de la funcion; el de las
// columnas lo lleva scripts/auditar-columnas-motores.mjs.
test("toda tool llama a funciones SQL que existen en las migraciones", () => {
  const sql = funcionesSql();
  const rotas: string[] = [];
  const marcas = [...RUNTIME.matchAll(/register[A-Za-z]*\(\s*"([a-z_0-9]+)"/g)];
  marcas.forEach((marca, i) => {
    const siguiente = marcas[i + 1];
    const hasta = siguiente?.index ?? RUNTIME.length;
    const cuerpo = RUNTIME.slice(marca.index ?? 0, hasta);
    for (const llamada of cuerpo.matchAll(/\.rpc\(\s*"([a-z_0-9]+)"/g)) {
      const fn = llamada[1];
      if (fn && !sql.has(fn)) rotas.push(`${marca[1]} -> ${fn}`);
    }
  });
  assert.deepEqual(rotas, [], "tools llamando a funciones SQL inexistentes");
});

test("el embudo expone dias completos dentro de la ventana y dias solicitados", () => {
  const dir = new URL("../../../supabase/migrations/", import.meta.url);
  const migration = readFileSync(
    new URL("20261115710000_a21_funnel_window_coverage.sql", dir),
    "utf8",
  );
  assert.match(migration, /days_with_funnel_data bigint/);
  assert.match(migration, /requested_days bigint/);
  assert.match(migration, /count\(distinct d\.bucket_date\) filter/s);
  assert.match(migration, /sessions_that_completed_checkout is not null/s);
  assert.match(migration, /revoke execute .* from public, anon/s);
  assert.match(migration, /grant execute .* to authenticated, service_role/s);
});

test("A22 delivery diagnostics sigue siendo read-only y expone cobertura/eventos versionados", () => {
  const dir = new URL("../../../supabase/migrations/", import.meta.url);
  const migration = readFileSync(
    new URL("20261115730000_a22_fulfillment_events_routes.sql", dir),
    "utf8",
  );
  assert.match(migration, /security invoker/i);
  assert.match(migration, /revoke execute .* from public, anon/s);
  assert.match(migration, /grant execute .* to authenticated, service_role/s);
  assert.match(migration, /event_sync_partial/);
  assert.match(migration, /destination_region_code/);
  assert.match(migration, /count\(\*\) >= 30 as sample_reliable/);
});
