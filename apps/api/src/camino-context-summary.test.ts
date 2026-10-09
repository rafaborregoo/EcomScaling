import assert from "node:assert/strict";
import { test } from "node:test";
import { contextBlockStatus, summarizeCaminoContext } from "./camino-context-summary.js";

test("clasifica el estado de cada bloque", () => {
  assert.equal(contextBlockStatus({ status: "available", data: { total: 1 } }), "ok");
  assert.equal(contextBlockStatus({ status: "available", data: [] }), "empty");
  assert.equal(contextBlockStatus({ status: "available", fragmentos: [{ documento: "Guía" }] }), "ok");
  assert.equal(contextBlockStatus({ status: "available", mer: 12.21 }), "ok");
  assert.equal(contextBlockStatus({ status: "available", fragmentos: [] }), "empty");
  assert.equal(contextBlockStatus({ status: "unavailable", reason: "query_error" }), "unavailable");
  assert.equal(contextBlockStatus({ status: "not_provided" }), "not_provided");
  assert.equal(contextBlockStatus(null), "empty");
  assert.equal(contextBlockStatus({ total_abiertas: 0, enviadas: 0, tareas: { status: "available", data: [] } }), "empty");
});

test("una fuente sin bloque cuenta como no disponible y las criticas se marcan", () => {
  const sources = summarizeCaminoContext([
    { label: "Ventas Shopify (180 dias)", data: { status: "available", data: { orders: 4 } } },
    { label: "Meta Ads: gasto y resultados", data: { status: "unavailable", reason: "query_error" } },
  ]);
  const byKey = Object.fromEntries(sources.map((s) => [s.key, s]));
  assert.equal(byKey.sales?.status, "ok");
  assert.equal(byKey.sales?.critical, true);
  assert.equal(byKey.meta?.status, "unavailable");
  assert.equal(byKey.klaviyo?.status, "unavailable");
  assert.equal(summarizeCaminoContext(undefined).length, sources.length);
});
