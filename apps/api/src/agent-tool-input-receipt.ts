export type InvalidToolInput = {
  error: "invalid_tool_input";
  why: string;
  how_to_fix: string;
  retry_after: null;
};

export async function rejectToolInputWithReceipt(
  toolName: string,
  input: Record<string, unknown>,
  recordToolCall: (
    toolName: string,
    input: unknown,
    output: unknown,
    isError: boolean,
    durationMs: number,
  ) => Promise<void>,
): Promise<{ ok: false; error: InvalidToolInput }> {
  const error: InvalidToolInput = {
    error: "invalid_tool_input",
    why: `Los argumentos de ${toolName} no cumplen su contrato versionado`,
    how_to_fix: "Enviar los campos requeridos y respetar sus tipos",
    retry_after: null,
  };

  // A rejected tool_use still counts in provider usage. Record its sanitized
  // input and rejection so the judge can account for every attempted call.
  await recordToolCall(toolName, input, error, true, 0);
  return { ok: false, error };
}
