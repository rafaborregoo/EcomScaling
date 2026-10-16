import assert from "node:assert/strict";
import test from "node:test";
import { rejectToolInputWithReceipt } from "./agent-tool-input-receipt.js";

test("rejected model tool input keeps a sanitized error receipt", async () => {
  const calls: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
    isError: boolean;
    durationMs: number;
  }> = [];

  const result = await rejectToolInputWithReceipt(
    "meta_creative_diagnostics",
    { period_start: "not-a-date" },
    async (toolName, input, output, isError, durationMs) => {
      calls.push({ toolName, input, output, isError, durationMs });
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.error.error, "invalid_tool_input");
  assert.deepEqual(calls, [{
    toolName: "meta_creative_diagnostics",
    input: { period_start: "not-a-date" },
    output: result.error,
    isError: true,
    durationMs: 0,
  }]);
});
