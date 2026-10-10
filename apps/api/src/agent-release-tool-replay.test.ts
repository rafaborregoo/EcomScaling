import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { AgentReleaseReplayMismatch, createAgentReleaseToolReplay } from "./agent-release-tool-replay.js";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function hash(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function replay(overrides: Record<string, unknown> = {}) {
  const result = { rows: [{ revenue: 1200 }] };
  return {
    sequence: 0,
    tool_name: "shopify_sales",
    arguments: { period: "30d" },
    result,
    result_sha256: hash(result),
    side_effect_free: true as const,
    is_error: false,
    ...overrides,
  };
}

test("reproduce solo el resultado capturado y emite recibo hash sin acceso externo", async () => {
  const recorded = replay();
  const broker = createAgentReleaseToolReplay({ allowedToolNames: ["shopify_sales"], replays: [recorded] });
  assert.equal(broker.tools.length, 1);
  const returned = await broker.tools[0]!.execute({ period: "30d" });
  assert.deepEqual(returned, { rows: [{ revenue: 1200 }] });
  assert.notEqual(returned, recorded.result);
  assert.deepEqual(broker.getSummary(), {
    expected_calls: 1,
    consumed_calls: 1,
    complete: true,
    mismatches: [],
    receipts: [{ sequence: 0, tool_name: "shopify_sales", arguments_sha256: hash({ period: "30d" }), result_sha256: hash({ rows: [{ revenue: 1200 }] }), is_error: false }],
  });
});

test("rechaza herramientas fuera de allowlist y hashes de resultado adulterados", () => {
  assert.throws(() => createAgentReleaseToolReplay({ allowedToolNames: [], replays: [replay()] }), AgentReleaseReplayMismatch);
  assert.throws(() => createAgentReleaseToolReplay({ allowedToolNames: ["shopify_sales"], replays: [replay({ result_sha256: "0".repeat(64) })] }), /result_hash_mismatch/);
});

test("falla cerrado ante secuencia o argumentos distintos y no marca replay completo", async () => {
  const broker = createAgentReleaseToolReplay({ allowedToolNames: ["shopify_sales"], replays: [replay()] });
  await assert.rejects(broker.tools[0]!.execute({ period: "90d" }), /arguments_mismatch/);
  assert.equal(broker.getSummary().complete, false);
  assert.deepEqual(broker.getSummary().mismatches, ["arguments_mismatch"]);
  const badSequence = replay({ sequence: 1 });
  assert.throws(() => createAgentReleaseToolReplay({ allowedToolNames: ["shopify_sales"], replays: [badSequence] }), /sequence_invalid/);
});

test("replay sin ejecutar todas las llamadas registradas queda incompleto", () => {
  const first = replay();
  const secondResult = { rows: [] };
  const second = { ...replay(), sequence: 1, arguments: { period: "7d" }, result: secondResult, result_sha256: hash(secondResult) };
  const broker = createAgentReleaseToolReplay({ allowedToolNames: ["shopify_sales"], replays: [first, second] });
  assert.equal(broker.getSummary().complete, false);
  assert.equal(broker.getSummary().consumed_calls, 0);
});
