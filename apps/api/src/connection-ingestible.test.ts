import assert from "node:assert/strict";
import test from "node:test";
import { assertConnectionIngestible } from "./operational-organization.js";

test("una conexion en pending_deletion no se sincroniza (no se resucita su estado)", () => {
  assert.throws(() => assertConnectionIngestible("pending_deletion"), /connection_not_ingestible/);
  assert.throws(() => assertConnectionIngestible("revoked"));
  assert.throws(() => assertConnectionIngestible("disconnected"));
});

test("las conexiones vivas, incluida una recien creada, si se sincronizan", () => {
  for (const status of ["pending", "connected", "error", "syncing", null]) {
    assert.doesNotThrow(() => assertConnectionIngestible(status));
  }
});
