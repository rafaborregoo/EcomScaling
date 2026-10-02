import assert from "node:assert/strict";
import test from "node:test";
import { agendaWriteDecision } from "./campaign-planning.js";

test("la agenda de un cliente con consultor la escribe solo el consultor", () => {
  assert.equal(agendaWriteDecision(true, true), true);
  assert.equal(agendaWriteDecision(false, true), false);
});

test("un cliente sin consultor sigue llevando su agenda", () => {
  assert.equal(agendaWriteDecision(false, false), true);
});
