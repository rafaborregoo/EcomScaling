import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCaminoProposalActionAllowed } from "./camino-proposal-decision.js";

describe("decisiones de propuestas de Mi Camino", () => {
  it("aceptar y rechazar solo desde pendiente; rechazada es terminal", () => {
    assert.equal(isCaminoProposalActionAllowed("accept", "pending"), true);
    assert.equal(isCaminoProposalActionAllowed("reject", "pending"), true);
    assert.equal(isCaminoProposalActionAllowed("accept", "rejected"), false);
    assert.equal(isCaminoProposalActionAllowed("edit", "rejected"), false);
  });

  it("permite editar antes o después de aceptar y completar solo una aceptada/editada", () => {
    assert.equal(isCaminoProposalActionAllowed("edit", "pending"), true);
    assert.equal(isCaminoProposalActionAllowed("edit", "accepted"), true);
    assert.equal(isCaminoProposalActionAllowed("complete", "accepted"), true);
    assert.equal(isCaminoProposalActionAllowed("complete", "edited"), true);
    assert.equal(isCaminoProposalActionAllowed("complete", "pending"), false);
  });

  it("no permite acciones después de marcar como aplicada", () => {
    for (const action of ["accept", "reject", "edit", "complete"] as const) {
      assert.equal(isCaminoProposalActionAllowed(action, "completed"), false);
    }
  });
});
