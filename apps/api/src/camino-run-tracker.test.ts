import assert from "node:assert/strict";
import { test } from "node:test";
import { beginCaminoRun, CAMINO_RUN_STALE_MS, caminoRunKey, finishCaminoRun, getCaminoRun, resetCaminoRuns } from "./camino-run-tracker.js";

test("no se lanza dos veces el mismo alcance y se puede relanzar al terminar o caducar", () => {
  resetCaminoRuns();
  const key = caminoRunKey("org", null);
  assert.equal(beginCaminoRun(key, 1000), true);
  assert.equal(beginCaminoRun(key, 2000), false);
  finishCaminoRun(key, { error: "client_ai_agent_not_selected", message: "No activado" });
  assert.deepEqual(getCaminoRun(key, 3000)?.status, "failed");
  assert.equal(beginCaminoRun(key, 4000), true);
  assert.equal(getCaminoRun(key, 4000 + CAMINO_RUN_STALE_MS + 1), null);
  assert.equal(beginCaminoRun(key, 4000 + CAMINO_RUN_STALE_MS + 1), true);
});

test("alcances distintos no se bloquean entre si", () => {
  resetCaminoRuns();
  assert.equal(beginCaminoRun(caminoRunKey("org", "store-a"), 1), true);
  assert.equal(beginCaminoRun(caminoRunKey("org", "store-b"), 1), true);
  assert.equal(beginCaminoRun(caminoRunKey("org", null), 1), true);
});
