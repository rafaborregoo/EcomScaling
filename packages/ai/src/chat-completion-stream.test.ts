import assert from "node:assert/strict";
import test from "node:test";
import type OpenAI from "openai";
import { collectChatCompletionStream } from "./index.js";

type Chunk = OpenAI.Chat.Completions.ChatCompletionChunk;

async function* chunks(parts: Array<Partial<Chunk> & { choices: Chunk["choices"] }>): AsyncGenerator<Chunk> {
  for (const part of parts) yield { id: "c1", object: "chat.completion.chunk", created: 1, model: "gpt-6-sol", ...part } as Chunk;
}

const delta = (d: Record<string, unknown>, finish: string | null = null) =>
  ({ choices: [{ index: 0, delta: d, finish_reason: finish, logprobs: null }] }) as { choices: Chunk["choices"] };

test("recompone el contenido, el motivo de fin y el uso", async () => {
  const completion = await collectChatCompletionStream(
    chunks([
      delta({ role: "assistant", content: "{\"a\":" }),
      delta({ content: "1}" }, "stop"),
      { choices: [], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } },
    ]),
    "gpt-6-sol",
  );
  assert.equal(completion.choices[0]!.message.content, "{\"a\":1}");
  assert.equal(completion.choices[0]!.finish_reason, "stop");
  assert.equal(completion.usage?.prompt_tokens, 100);
  assert.equal(completion.model, "gpt-6-sol");
});

test("une las llamadas a tools que llegan troceadas, en su orden", async () => {
  const completion = await collectChatCompletionStream(
    chunks([
      delta({ tool_calls: [{ index: 1, id: "t2", function: { name: "search_knowledge", arguments: "{\"q\":" } }] }),
      delta({ tool_calls: [{ index: 0, id: "t1", function: { name: "sql_select", arguments: "{}" } }] }),
      delta({ tool_calls: [{ index: 1, function: { arguments: "\"nieve\"}" } }] }, "tool_calls"),
    ]),
    "gpt-6-sol",
  );
  const calls = completion.choices[0]!.message.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }>;
  assert.deepEqual(calls.map((call) => [call.id, call.function.name, call.function.arguments]), [
    ["t1", "sql_select", "{}"],
    ["t2", "search_knowledge", "{\"q\":\"nieve\"}"],
  ]);
  assert.equal(completion.choices[0]!.message.content, null);
  assert.equal(completion.choices[0]!.finish_reason, "tool_calls");
});
