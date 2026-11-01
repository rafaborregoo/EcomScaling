import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { aiModelLabReportSchema } from "../packages/contracts/src/ai-model-lab.js";
import { hash } from "./ai-model-lab-core.js";

const dir = resolve(".e-nora-test-lab/ai-models");
const report = aiModelLabReportSchema.parse(
  JSON.parse(await readFile(resolve(dir, "report.json"), "utf8")),
);
const rates: Record<string, { input: number; cached: number; output: number }> = {
  "gpt-6-luna": { input: 0.1, cached: 0.01, output: 0.5 },
  "gpt-6.1-sol": { input: 2, cached: 0.1, output: 10 },
  "gpt-6.1-terra": { input: 1, cached: 0.05, output: 5 },
};
for (const testCase of report.cases.filter(
  (item) =>
    item.agent_code === "a02_monitor_negocio" &&
    item.id.includes("real-store"),
)) {
  for (const row of report.results.filter((item) => item.case_id === testCase.id)) {
    if (row.status !== "completed") continue;
    const receiptPath = resolve(
      dir,
      `${testCase.agent_code}.${hash(testCase.id)}.${row.model_id}.receipt.json`,
    );
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    let inputTokens = row.usage.input ?? 0;
    let cachedTokens = row.usage.cached ?? 0;
    let outputTokens = row.usage.output ?? 0;
    let costUsd: number | null = null;
    let basis: string;
    const modelUsage = receipt.stdout
      .split(/\r?\n/)
      .map((line: string) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .find((item: any) => item?.type === "turn.completed")?.usage;

    if (row.model_id.startsWith("claude-")) {
      const cli = JSON.parse(receipt.stdout);
      const usage = cli.modelUsage?.[row.model_id];
      if (usage) {
        inputTokens =
          (usage.inputTokens ?? 0) +
          (usage.cacheReadInputTokens ?? 0) +
          (usage.cacheCreationInputTokens ?? 0);
        cachedTokens =
          (usage.cacheReadInputTokens ?? 0) +
          (usage.cacheCreationInputTokens ?? 0);
        outputTokens = usage.outputTokens ?? 0;
        costUsd = usage.costUSD ?? null;
      }
      basis = "Claude CLI reported list-price estimate";
    } else {
      if (modelUsage) {
        inputTokens = modelUsage.input_tokens ?? inputTokens;
        cachedTokens = modelUsage.cached_input_tokens ?? cachedTokens;
        outputTokens = modelUsage.output_tokens ?? outputTokens;
      }
      const rate = rates[row.model_id];
      if (!rate) throw new Error(`missing_rate:${row.model_id}`);
      costUsd =
        (Math.max(0, inputTokens - cachedTokens) * rate.input +
          cachedTokens * rate.cached +
          outputTokens * rate.output) /
        1_000_000;
      basis = "OpenAI published standard API list rates; CLI token usage";
    }
    console.log(
      JSON.stringify({
        case_id: testCase.id,
        model: row.model_id,
        input_tokens: inputTokens,
        cached_tokens: cachedTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        basis,
      }),
    );
  }
}
