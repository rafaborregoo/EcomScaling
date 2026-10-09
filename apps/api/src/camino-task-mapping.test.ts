import assert from "node:assert/strict";
import test from "node:test";
import {
  assigneeForOwner,
  categoryForKind,
  normalizeKind,
  normalizeOwner,
  sortTaskLinks,
} from "./camino-task-mapping.js";

test("el tipo de tarea decide la categoría y solo salen categorías válidas", () => {
  assert.equal(categoryForKind("email"), "klaviyo");
  assert.equal(categoryForKind("ads"), "meta");
  assert.equal(categoryForKind("operaciones"), "shopify");
  assert.equal(categoryForKind("analisis"), "general");
  assert.equal(categoryForKind("inventado"), "general");
  assert.equal(categoryForKind(null), "general");
});

test("responsable: consultor recibe lo suyo, el resto queda al equipo del cliente", () => {
  const ids = { consultantId: "consultor-1", creatorId: "creador-1" };
  assert.equal(assigneeForOwner("consultant", ids), "consultor-1");
  assert.equal(assigneeForOwner("client", ids), null);
  assert.equal(assigneeForOwner("shared", ids), null);
  // Sin consultor asignado no se inventa uno.
  assert.equal(assigneeForOwner("consultant", { consultantId: null, creatorId: "creador-1" }), null);
});

test("sin owner (a mano o plantilla) se conserva: quien lo crea", () => {
  const ids = { consultantId: "consultor-1", creatorId: "creador-1" };
  assert.equal(assigneeForOwner(undefined, ids), "creador-1");
  assert.equal(assigneeForOwner("otro", ids), "creador-1");
});

test("normaliza valores desconocidos a null", () => {
  assert.equal(normalizeOwner("client"), "client");
  assert.equal(normalizeOwner("equipo"), null);
  assert.equal(normalizeKind("email"), "email");
  assert.equal(normalizeKind("x"), null);
});

test("las tareas de un hito salen en secuencia y las sin posición al final por alta", () => {
  const ordered = sortTaskLinks([
    { id: "c", position: null, created_at: "2026-10-02" },
    { id: "b", position: 2, created_at: "2026-10-01" },
    { id: "a", position: 1, created_at: "2026-10-03" },
    { id: "d", position: null, created_at: "2026-10-01" },
  ]);
  assert.deepEqual(ordered.map((link) => link.id), ["a", "b", "d", "c"]);
});
