import type { AiModelLabResult } from "@e-nora/contracts";

type Rates = {
  input: number;
  output: number;
  cached: number;
  writeShort: number;
  writeLong: number;
};
// Standard direct USD/MTok, documentación oficial consultada el 28/10/2026.
const RATES: Record<string, Rates> = {
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cached: 0.01,
    writeShort: 0.125,
    writeLong: 0.2,
  },
  "claude-sonnet-5-5": {
    input: 2,
    output: 10,
    cached: 0.1,
    writeShort: 2.5,
    writeLong: 4,
  },
  "claude-opus-5-5": {
    input: 4,
    output: 20,
    cached: 0.2,
    writeShort: 5,
    writeLong: 8,
  },
  "gpt-6-luna": {
    input: 0.1,
    output: 0.5,
    cached: 0.01,
    writeShort: 0.125,
    writeLong: 0.25,
  },
  "gpt-6.1-sol": {
    input: 2,
    output: 10,
    cached: 0.1,
    writeShort: 2.5,
    writeLong: 5,
  },
  "gpt-6-astra": {
    input: 10,
    output: 50,
    cached: 1,
    writeShort: 12.5,
    writeLong: 25,
  },
  "gpt-6.1-terra": {
    input: 1,
    output: 5,
    cached: 0.05,
    writeShort: 1.25,
    writeLong: 2.5,
  },
};

export function calculateLabApiPrice(
  model: string,
  usage: AiModelLabResult["usage"],
) {
  const rate = RATES[model];
  const { input, output, cached, cache_creation: writes } = usage;
  if (
    !rate ||
    input === null ||
    output === null ||
    cached === null ||
    writes === null
  )
    return null;
  const anthropic = model.startsWith("claude-");
  const contextTokens = anthropic ? input + cached + writes : input;
  if (!anthropic && cached + writes > input) return null;
  let inputMultiplier = 1,
    outputMultiplier = 1;
  if (model === "claude-haiku-5-5" && contextTokens > 100000)
    inputMultiplier = outputMultiplier = 5;
  if (
    (model === "gpt-6.1-sol" || model === "gpt-6.1-terra") &&
    contextTokens > 272000
  ) {
    inputMultiplier = 2;
    outputMultiplier = 1.5;
  }
  // Anthropic informa categorías separadas. input_tokens de OpenAI YA incluye la caché.
  const fresh = anthropic ? input : input - cached - writes;
  const base =
    (fresh * rate.input + cached * rate.cached) * inputMultiplier +
    output * rate.output * outputMultiplier;
  return {
    low: (base + writes * rate.writeShort * inputMultiplier) / 1e6,
    high: (base + writes * rate.writeLong * inputMultiplier) / 1e6,
    inputTotal: contextTokens,
  };
}
export function formatUsd(value: number) {
  return value.toLocaleString("es-ES", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}
export function estimatedApiPrice(result: AiModelLabResult | undefined) {
  if (!result || result.status !== "completed") return "No disponible";
  const price = calculateLabApiPrice(result.model_id, result.usage);
  if (!price) return "Uso incompleto";
  return price.low === price.high
    ? formatUsd(price.low)
    : formatUsd(price.low) + "–" + formatUsd(price.high);
}
