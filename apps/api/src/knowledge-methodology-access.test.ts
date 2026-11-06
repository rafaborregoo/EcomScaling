import assert from "node:assert/strict";
import { test } from "node:test";
import {
  audienceWithMethodology,
  keepAllowedKnowledgeRows,
} from "./knowledge-methodology-access.js";

test("un agente automatico lee la metodologia global pero no las notas privadas de la organizacion", () => {
  const audience = ["client_visible"];
  assert.deepEqual(audienceWithMethodology(audience), [
    "client_visible",
    "consultant_only",
  ]);
  const rows = [
    { id: 1, audience: "consultant_only", visibility: "global" },
    { id: 2, audience: "consultant_only", visibility: "organization" },
    { id: 3, audience: "client_visible", visibility: "organization" },
  ];
  assert.deepEqual(
    keepAllowedKnowledgeRows(rows, audience).map((row) => row.id),
    [1, 3],
  );
});

test("quien ya puede leer consultant_only lo sigue leyendo todo", () => {
  const audience = ["client_visible", "consultant_only"];
  assert.deepEqual(audienceWithMethodology(audience), audience);
  assert.equal(
    keepAllowedKnowledgeRows(
      [{ audience: "consultant_only", visibility: "organization" }],
      audience,
    ).length,
    1,
  );
});

test("la excepcion de metodologia global no abre system_only ni audiencias desconocidas", () => {
  const rows = [
    { id: 1, audience: "system_only", visibility: "global" },
    { id: 2, audience: "unknown", visibility: "global" },
    { id: 3, audience: "consultant_only", visibility: "global" },
  ];
  assert.deepEqual(
    keepAllowedKnowledgeRows(rows, ["client_visible"]).map((row) => row.id),
    [3],
  );
});
