import { createHash } from "node:crypto";
import type { AgentToolDefinition } from "@e-nora/ai";

export type AgentReleaseToolReplay = {
  sequence: number;
  tool_name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  result_sha256: string;
  side_effect_free: true;
  is_error: boolean;
};

type ReplayReceipt = {
  sequence: number;
  tool_name: string;
  arguments_sha256: string;
  result_sha256: string;
  is_error: boolean;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function exactObjectSchema(value: Record<string, unknown>): Record<string, unknown> {
  const properties = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, { const: item }]));
  return {
    type: "object",
    properties,
    required: Object.keys(value),
    additionalProperties: false,
  };
}

export class AgentReleaseReplayMismatch extends Error {
  constructor(readonly reason: string) {
    super(`agent_release_tool_replay_mismatch:${reason}`);
    this.name = "AgentReleaseReplayMismatch";
  }
}

/**
 * Builds model-callable tools backed only by immutable fixture results.
 * There is deliberately no environment, database client, or network dependency
 * in this module, so a replay can never fall through to a real tool executor.
 */
export function createAgentReleaseToolReplay(input: {
  allowedToolNames: readonly string[];
  replays: readonly AgentReleaseToolReplay[];
}) {
  const allowed = new Set(input.allowedToolNames);
  const ordered = [...input.replays].sort((a, b) => a.sequence - b.sequence);
  const seenSequences = new Set<number>();
  const seenNames = new Set<string>();

  for (const replay of ordered) {
    if (replay.side_effect_free !== true) throw new AgentReleaseReplayMismatch("side_effect_tool_forbidden");
    if (!allowed.has(replay.tool_name)) throw new AgentReleaseReplayMismatch("tool_not_allowed_by_candidate");
    if (seenSequences.has(replay.sequence) || replay.sequence !== seenSequences.size) {
      throw new AgentReleaseReplayMismatch("sequence_invalid");
    }
    if (sha256(replay.result) !== replay.result_sha256) throw new AgentReleaseReplayMismatch("result_hash_mismatch");
    seenSequences.add(replay.sequence);
    seenNames.add(replay.tool_name);
  }

  const schemaByName = new Map<string, Record<string, unknown>>();
  for (const toolName of seenNames) {
    const variants = ordered.filter((replay) => replay.tool_name === toolName).map((replay) => exactObjectSchema(replay.arguments));
    schemaByName.set(toolName, variants.length === 1 ? variants[0]! : { oneOf: variants });
  }

  let cursor = 0;
  const receipts: ReplayReceipt[] = [];
  const mismatches: string[] = [];
  const tools: AgentToolDefinition[] = [...seenNames].map((toolName) => ({
    name: toolName,
    description: `Replay inmutable de evaluación. Solo acepta los argumentos exactos registrados para este caso.`,
    inputSchema: schemaByName.get(toolName)!,
    execute: async (arguments_) => {
      const expected = ordered[cursor];
      if (!expected) {
        mismatches.push("unexpected_tool_call");
        throw new AgentReleaseReplayMismatch("unexpected_tool_call");
      }
      if (expected.tool_name !== toolName) {
        mismatches.push("tool_order_mismatch");
        throw new AgentReleaseReplayMismatch("tool_order_mismatch");
      }
      if (sha256(arguments_) !== sha256(expected.arguments)) {
        mismatches.push("arguments_mismatch");
        throw new AgentReleaseReplayMismatch("arguments_mismatch");
      }
      cursor += 1;
      receipts.push({
        sequence: expected.sequence,
        tool_name: expected.tool_name,
        arguments_sha256: sha256(arguments_),
        result_sha256: expected.result_sha256,
        is_error: expected.is_error,
      });
      return structuredClone(expected.result);
    },
  }));

  return {
    tools,
    getSummary() {
      return {
        expected_calls: ordered.length,
        consumed_calls: receipts.length,
        complete: mismatches.length === 0 && cursor === ordered.length,
        mismatches: [...mismatches],
        receipts: [...receipts],
      };
    },
  };
}
