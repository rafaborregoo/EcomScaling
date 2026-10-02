import assert from "node:assert/strict";
import test from "node:test";
import { metaRpcEvidenceStatus } from "./meta-diagnostic-evidence.js";

test("Meta query availability distinguishes useful rows, empty coverage, and RPC failure", () => {
  assert.deepEqual(metaRpcEvidenceStatus([{ id: "ad-1" }], null), {
    availability: "available",
    row_count: 1,
    error_code: null,
  });
  assert.deepEqual(metaRpcEvidenceStatus([], null), {
    availability: "no_data_returned",
    row_count: 0,
    error_code: null,
  });
  const rpcError = { code: "PGRST202", message: "schema cache details" };
  assert.deepEqual(metaRpcEvidenceStatus(null, rpcError), {
    availability: "unavailable",
    row_count: null,
    error_code: "PGRST202",
  });
});
