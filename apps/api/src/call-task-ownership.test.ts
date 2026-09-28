import assert from "node:assert/strict";
import test from "node:test";
import { resolveCallTaskOwnership } from "./call-task-ownership.js";

test("una tarea para el cliente entra en su backlog sin asignarse al consultor", () => {
  assert.deepEqual(resolveCallTaskOwnership("cliente", "consultant-1"), {
    owner: "cliente",
    isVisibleToClient: true,
    assignedTo: null,
  });
});

test("una tarea del consultor queda interna y asignada al consultor", () => {
  assert.deepEqual(resolveCallTaskOwnership("consultor", "consultant-1"), {
    owner: "consultor",
    isVisibleToClient: false,
    assignedTo: "consultant-1",
  });
});

test("un owner desconocido conserva el comportamiento seguro de cliente", () => {
  assert.equal(
    resolveCallTaskOwnership(undefined, "consultant-1").owner,
    "cliente",
  );
});
