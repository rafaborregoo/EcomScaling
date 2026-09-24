import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { NIGHTLY_CHAIN } from "./nightly-chain-once.js";

test("cada paso de la cadena nocturna existe como job, una sola vez", () => {
  const missing = NIGHTLY_CHAIN.filter((job) => !existsSync(new URL(`./${job}-once.ts`, import.meta.url)));
  assert.deepEqual(missing, []);
  assert.equal(new Set(NIGHTLY_CHAIN).size, NIGHTLY_CHAIN.length);
});
