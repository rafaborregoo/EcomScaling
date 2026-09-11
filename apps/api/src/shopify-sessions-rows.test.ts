import assert from "node:assert/strict";
import test from "node:test";
import { toRecords } from "./shopify-sessions.js";

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
