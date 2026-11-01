import { SOURCES } from "./audit-data";

// Tarifas Standard directas en USD/MTok. Escenario sin creación de caché ni tools de pago.
export const READING_MODELS = [
  {
    id: "claude-haiku-5-5",
    name: "Haiku 5.5",
    input: 0.1,
    output: 0.5,
    cached: 0.01,
    source: SOURCES.haiku,
  },
  {
    id: "claude-sonnet-5-5",
    name: "Sonnet 5.5",
    input: 2,
    output: 10,
    cached: 0.1,
    source: SOURCES.sonnet,
  },
  {
    id: "claude-opus-5-5",
    name: "Opus 5.5",
    input: 4,
    output: 20,
    cached: 0.2,
    source: SOURCES.opus,
  },
] as const;

export function readingCost(
  model: (typeof READING_MODELS)[number],
  input: number,
  output: number,
  cached: number,
) {
  if (
    ![input, output, cached].every(
      (n) => Number.isFinite(n) && n >= 0 && Number.isInteger(n),
    ) ||
    cached > input
  )
    return null;
  // El contexto incluye entrada y salida reservada. No simular una petición imposible.
  if (input + output > 1_000_000 || output > 128_000) return null;
  const longHaiku = model.id === "claude-haiku-5-5" && input > 100_000;
  const multiplier = longHaiku ? 5 : 1;
  return {
    usd:
      (((input - cached) * model.input +
        cached * model.cached +
        output * model.output) *
        multiplier) /
      1_000_000,
    longHaiku,
  };
}
