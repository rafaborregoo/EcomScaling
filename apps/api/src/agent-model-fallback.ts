/** Dispatch a configured fallback to its provider; never send a Claude ID to OpenAI. */
export async function runConfiguredModelFallback<T>(options: {
  model: string;
  anthropicAvailable: boolean;
  openaiAvailable: boolean;
  runAnthropic: (model: string) => Promise<T>;
  runOpenAI: (model: string) => Promise<T>;
}): Promise<T> {
  if (options.model.startsWith("claude-") && options.anthropicAvailable) return options.runAnthropic(options.model);
  if (options.model.startsWith("gpt-") && options.openaiAvailable) return options.runOpenAI(options.model);
  throw new Error("configured_model_fallback_unavailable");
}
