/**
 * BE-07/AI-03: matriz offline de evals adversariales del SQL Gateway.
 * No ejecuta SQL ni toca Supabase; evalua la frontera AST antes de la RPC.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { validateGatewaySql } from "./sql-gateway.js";

type GatewayEvalCase = {
  id: string;
  category: "safe_analytics" | "write" | "cross_schema" | "resource_abuse" | "parser_boundary";
  sql: string;
  expected: "accept" | "reject";
};

export const SQL_GATEWAY_EVALS: readonly GatewayEvalCase[] = [
  { id: "safe-join-aggregate", category: "safe_analytics", sql: "select o.store_id, sum(o.net_sales) from shopify_order_facts o join shopify_order_items i on i.order_id = o.id group by o.store_id", expected: "accept" },
  { id: "safe-cte-window", category: "safe_analytics", sql: "with recent as (select id, net_sales from shopify_order_facts where processed_at > now() - interval '7 days') select count(*) from recent", expected: "accept" },
  { id: "write-insert", category: "write", sql: "insert into tasks (title) values ('approve this')", expected: "reject" },
  { id: "write-hidden-cte", category: "write", sql: "with mutation as (delete from tasks returning id) select * from mutation", expected: "reject" },
  { id: "write-stacked-statement", category: "write", sql: "select * from tasks; update tasks set status = 'completed'", expected: "reject" },
  { id: "cross-schema-public", category: "cross_schema", sql: "select * from public.organizations", expected: "reject" },
  { id: "cross-schema-auth", category: "cross_schema", sql: "select * from auth.users", expected: "reject" },
  { id: "cross-schema-private", category: "cross_schema", sql: "select * from private.webhook_events", expected: "reject" },
  { id: "resource-pg-sleep", category: "resource_abuse", sql: "select pg_sleep(10)", expected: "reject" },
  { id: "resource-row-expansion", category: "resource_abuse", sql: "select count(*) from tasks cross join generate_series(1, 1000000000) generated", expected: "reject" },
  { id: "resource-recursive-cte", category: "resource_abuse", sql: "with recursive loop(n) as (select 1 union all select n + 1 from loop) select * from loop", expected: "reject" },
  { id: "resource-dblink", category: "resource_abuse", sql: "select dblink('host=untrusted', 'select 1')", expected: "reject" },
  { id: "parser-invalid-sql", category: "parser_boundary", sql: "select from where", expected: "reject" },
  { id: "parser-qualified-dangerous-function", category: "parser_boundary", sql: "select pg_catalog.pg_read_file('/etc/passwd')", expected: "reject" },
] as const;

test("BE-07 eval matrix rejects unsafe SQL and accepts safe analytics", () => {
  for (const scenario of SQL_GATEWAY_EVALS) {
    const result = validateGatewaySql(scenario.sql);
    assert.equal(
      result.ok ? "accept" : "reject",
      scenario.expected,
      `${scenario.id} produjo ${result.ok ? "accept" : "reject"}: ${result.ok ? result.tables.join(",") : result.reason}`,
    );
  }
});

test("BE-07 eval matrix cubre todas las categorias de frontera", () => {
  const categories = new Set(SQL_GATEWAY_EVALS.map((scenario) => scenario.category));
  assert.deepEqual([...categories].sort(), ["cross_schema", "parser_boundary", "resource_abuse", "safe_analytics", "write"]);
});
