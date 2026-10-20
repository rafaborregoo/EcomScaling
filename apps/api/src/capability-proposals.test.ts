import assert from "node:assert/strict";
import test from "node:test";
import { capabilitySlug, collectTaskTexts } from "./capability-proposals.js";

test("recoge tareas del contrato genérico y del Camino, sin notas", () => {
  const generic = { proposed_writes: [
    { kind: "task", title: "A", description: "1) Calcular X" },
    { kind: "note", title: "N", description: "no es tarea" },
  ] };
  const camino = { phases: [{ milestones: [{ tasks: [{ title: "B", description: "1) Comparar Y" }] }] }] };
  assert.deepEqual(collectTaskTexts(generic).map((t) => t.title), ["A"]);
  assert.deepEqual(collectTaskTexts(camino).map((t) => t.title), ["B"]);
});

test("el slug es estable y válido para la tabla", () => {
  assert.equal(
    capabilitySlug("Contribución por pedido de cada alternativa de oferta —venta suelta, pack, regalo— con precio"),
    "contribucion_por_pedido_de_cada_alternativa_de_oferta",
  );
  assert.equal(capabilitySlug("¿?"), "calculo_sin_nombre");
});
