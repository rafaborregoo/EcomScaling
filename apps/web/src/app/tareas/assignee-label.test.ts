import assert from "node:assert/strict";
import test from "node:test";
import { assigneeLabel } from "./assignee-label";

const YO = "usuario-yo";

test("una tarea mía no se etiqueta", () => {
  // Sin esto, "la lleva Rafa" saldría en cada fila de la lista de Rafa.
  assert.equal(assigneeLabel(YO, "Rafa Borrego", YO), null);
});

test("sin responsable no se etiqueta", () => {
  assert.equal(assigneeLabel(null, null, YO), null);
  assert.equal(assigneeLabel(undefined, "Ana Ruiz", YO), null);
});

test("de otra persona: solo el nombre de pila", () => {
  assert.equal(assigneeLabel("ana", "Ana Ruiz Pérez", YO), "la lleva Ana");
});

test("responsable sin nombre puesto sigue diciendo que la lleva alguien", () => {
  // Callarse la convertiría en una tarea que parece esperar al cliente.
  assert.equal(assigneeLabel("ana", null, YO), "la lleva otra persona");
  assert.equal(assigneeLabel("ana", "   ", YO), "la lleva otra persona");
});
