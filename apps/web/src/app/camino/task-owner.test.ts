import assert from "node:assert/strict";
import test from "node:test";
import { taskOwnerLabel } from "./task-owner";

const task = (assigned_to: string | null, origin: "consultant" | "client" | null, name: string | null = null) => ({
  assigned_to,
  assignee_origin: origin,
  assignee_name: name,
});

test("a quién le toca cada tarea de la fase", () => {
  assert.equal(taskOwnerLabel(task(null, null), "me", true), null);
  assert.equal(taskOwnerLabel(task("me", "client"), "me", true), "Tú");
  assert.equal(taskOwnerLabel(task("c1", "consultant", "Rafa B"), "me", true), "Tu consultor");
  assert.equal(taskOwnerLabel(task("u2", "client", "Ana López"), "me", false), "Cliente");
  assert.equal(taskOwnerLabel(task("u3", "consultant", "Lucía  Pérez"), "me", false), "Lucía");
  assert.equal(taskOwnerLabel(task("u4", "client", null), "me", true), "Otra persona");
});
