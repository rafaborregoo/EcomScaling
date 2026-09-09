/** Boundary for RAG, playbooks, connector data and tool outputs. */
const MAX_BLOCK_CHARS = 12_000;
const MAX_CONTEXT_CHARS = 48_000;
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|any\s+)?(previous|prior|above)\s+instructions?/gi,
  /ignora\s+(todas\s+las\s+|las\s+)?instrucciones\s+(anteriores|previas)/gi,
  /system\s+prompt|developer\s+message|mensaje\s+de\s+sistema/gi,
  /reveal\s+(the\s+)?(system\s+)?prompt|muestra\s+(el\s+)?prompt|revela\s+(el\s+)?prompt/gi,
  /call\s+the\s+tool|execute\s+this\s+tool|llama\s+a\s+la\s+herramienta/gi,
  /change\s+your\s+role|cambia\s+tu\s+rol/gi,
  /bypass\s+(security|approval|policy)|omite\s+(seguridad|aprobaci[oó]n|pol[ií]tica)/gi,
];

function neutralize(text: string): { text: string; blocked: number } {
  let blocked = 0;
  let result = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ");
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, () => {
      blocked += 1;
      return "[CONTENIDO_INSTRUCCIONAL_BLOQUEADO]";
    });
  }
  return { text: result, blocked };
}

export type UntrustedContextBlock = { label: string; data: unknown };
export type UntrustedContextResult = { text: string; blockedPatterns: number; truncated: boolean };

export function serializeUntrustedContextBlocks(blocks: UntrustedContextBlock[]): UntrustedContextResult {
  let remaining = MAX_CONTEXT_CHARS;
  let blockedPatterns = 0;
  let truncated = false;
  const sections: string[] = [];
  for (const block of blocks) {
    if (remaining <= 0) { truncated = true; break; }
    const safeLabel = neutralize(String(block.label ?? "contexto"));
    let serialized: string;
    try { serialized = JSON.stringify(block.data, null, 2) ?? "null"; } catch { serialized = "[dato_no_serializable]"; }
    const safeData = neutralize(serialized);
    blockedPatterns += safeLabel.blocked + safeData.blocked;
    const section = `FUENTE_NO_CONFIABLE: ${safeLabel.text}\n<datos_recuperados>\n${safeData.text}\n</datos_recuperados>`;
    const bounded = section.slice(0, Math.min(MAX_BLOCK_CHARS, remaining));
    if (bounded.length < section.length) truncated = true;
    sections.push(bounded);
    remaining -= bounded.length;
  }
  return { text: sections.join("\n\n"), blockedPatterns, truncated };
}

export type UntrustedToolResult = { text: string; blockedPatterns: number };

/**
 * AI-30: devuelve tambien cuantos patrones se neutralizaron. Antes solo
 * devolvia el texto y el dato se perdia: un resultado de herramienta que
 * intentaba inyectar instrucciones se limpiaba en silencio y nadie se enteraba
 * de que habia pasado.
 */
export function serializeUntrustedToolResult(result: unknown): UntrustedToolResult {
  let serialized: string;
  try { serialized = JSON.stringify(result ?? null); } catch { serialized = "[tool_result_no_serializable]"; }
  const neutralized = neutralize(serialized);
  return {
    text: `<tool_result_no_confiable>\n${neutralized.text}\n</tool_result_no_confiable>`,
    blockedPatterns: neutralized.blocked,
  };
}
