import assert from "node:assert/strict";
import test from "node:test";
import { parseA01BriefHandoff, serializeA01BriefHandoff } from "./a01-call-handoff.js";

test("el brief de llamada solo se recupera para la misma organizacion", () => {
  const payload = serializeA01BriefHandoff("org-1", "  cita privada  ");
  assert.equal(parseA01BriefHandoff(payload, "org-1"), "cita privada");
  assert.equal(parseA01BriefHandoff(payload, "org-2"), null);
});

test("rechaza payload malformado, sin brief o vacio", () => {
  assert.equal(parseA01BriefHandoff("not-json", "org-1"), null);
  assert.equal(parseA01BriefHandoff(JSON.stringify({ organizationId: "org-1" }), "org-1"), null);
  assert.equal(parseA01BriefHandoff(serializeA01BriefHandoff("org-1", "  "), "org-1"), null);
});

test("limita los briefs a 2000 caracteres al escribir y al leer", () => {
  const tooLong = "x".repeat(2400);
  assert.equal(parseA01BriefHandoff(serializeA01BriefHandoff("org-1", tooLong), "org-1")?.length, 2000);
  assert.equal(parseA01BriefHandoff(JSON.stringify({ organizationId: "org-1", brief: tooLong }), "org-1")?.length, 2000);
});
