import assert from "node:assert/strict";
import test from "node:test";
import {
  funnelMetric,
  hasFunnelMetrics,
  ShopifyReportsScopeError,
  toRecords,
} from "./shopify-sessions.js";

const columns = [
  { name: "day", dataType: "date" },
  { name: "sessions", dataType: "number" },
  { name: "online_store_visitors", dataType: "number" },
];

// Forma real devuelta por la API 2026-07 contra ecomscaling-dev: objetos, no
// arrays. Con el lector posicional daban 366 filas leidas y 0 escritas.
test("filas como objeto: se leen por nombre de columna", () => {
  const [row] = toRecords({
    columns,
    rows: [{ day: "2026-09-04", sessions: "12", online_store_visitors: "9" }],
  });
  assert.ok(row);
  assert.equal(row.day, "2026-09-04");
  assert.equal(row.sessions, "12");
  assert.equal(row.online_store_visitors, "9");
});

test("filas posicionales: sigue funcionando lo que dice la doc", () => {
  const [row] = toRecords({ columns, rows: [["2026-09-04", 12, 9]] });
  assert.ok(row);
  assert.equal(row.day, "2026-09-04");
  assert.equal(row.sessions, 12);
});

test("columna ausente en la fila queda a null, no undefined", () => {
  const [row] = toRecords({ columns, rows: [{ day: "2026-09-04" }] });
  assert.ok(row);
  assert.equal(row.sessions, null);
});

// Pasos del embudo. La regla que importa es la distinción entre "no lo
// sabemos" y "cero", porque un 0 mal puesto pinta una tienda donde nadie llega
// a pagar. Las tres métricas viajan juntas: o están las tres, o no hay embudo.

const conEmbudo = [
  ...columns,
  { name: "sessions_with_cart_additions", dataType: "number" },
  { name: "sessions_that_reached_checkout", dataType: "number" },
  { name: "sessions_that_completed_checkout", dataType: "number" },
];

test("sin las columnas del embudo, el día queda a null y no a cero", () => {
  assert.equal(hasFunnelMetrics(columns), false);
  assert.equal(
    funnelMetric({ sessions: 12 }, "sessions_with_cart_additions", false),
    null,
  );
});

test("si falta una sola métrica no se da el embudo por bueno", () => {
  // Medio embudo es peor que ninguno: la caída saldría donde no está.
  const incompleto = conEmbudo.filter(
    (column) => column.name !== "sessions_that_reached_checkout",
  );
  assert.equal(hasFunnelMetrics(incompleto), false);
});

test("con las columnas, un cero real se guarda como cero", () => {
  assert.equal(hasFunnelMetrics(conEmbudo), true);
  assert.equal(
    funnelMetric({ sessions_that_reached_checkout: 0 }, "sessions_that_reached_checkout", true),
    0,
    "ese día sí se preguntó y la respuesta fue que nadie llegó al pago",
  );
});

test("las métricas llegan como cadena y se guardan enteras", () => {
  // ShopifyQL devuelve los números como texto en la forma de objeto.
  assert.equal(
    funnelMetric({ sessions_that_completed_checkout: "37" }, "sessions_that_completed_checkout", true),
    37,
  );
});

test("si read_reports ya está concedido, el aviso dirige al acceso PCD y no a reinstalar", () => {
  const error = new ShopifyReportsScopeError(true);
  assert.match(error.message, /read_reports sí está concedido/);
  assert.match(error.message, /datos protegidos de cliente Nivel 2/);
  assert.match(error.message, /Dev Dashboard\/Partner Dashboard/);
  assert.match(error.message, /no sustituye esa aprobación/);
  assert.match(error.message, /el resto de la sincronización sigue disponible/);
});

test("si falta read_reports, el aviso pide renovar el permiso de informes", () => {
  const error = new ShopifyReportsScopeError(false);
  assert.match(error.message, /shopify_read_reports_scope_missing/);
  assert.match(error.message, /Reautoriza la tienda en Integraciones/);
});
