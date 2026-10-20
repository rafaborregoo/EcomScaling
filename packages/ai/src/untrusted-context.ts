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
export type UntrustedContextResult = {
  text: string;
  blockedPatterns: number;
  truncated: boolean;
  /** Que bloques se cortaron y de cuantos caracteres venian: sin esto el corte es invisible. */
  truncatedBlocks: Array<{ label: string; chars: number }>;
};

export type UntrustedContextLimits = { maxBlockChars?: number; maxContextChars?: number };

export function serializeUntrustedContextBlocks(
  blocks: UntrustedContextBlock[],
  limits: UntrustedContextLimits = {},
): UntrustedContextResult {
  const maxBlockChars = limits.maxBlockChars ?? MAX_BLOCK_CHARS;
  let remaining = limits.maxContextChars ?? MAX_CONTEXT_CHARS;
  let blockedPatterns = 0;
  let truncated = false;
  const sections: string[] = [];
  const truncatedBlocks: Array<{ label: string; chars: number }> = [];
  for (const block of blocks) {
    if (remaining <= 0) {
      truncated = true;
      truncatedBlocks.push({ label: String(block.label ?? "contexto").slice(0, 80), chars: 0 });
      continue;
    }
    const safeLabel = neutralize(String(block.label ?? "contexto"));
    let serialized: string;
    try { serialized = JSON.stringify(block.data, null, 2) ?? "null"; } catch { serialized = "[dato_no_serializable]"; }
    const safeData = neutralize(serialized);
    blockedPatterns += safeLabel.blocked + safeData.blocked;
    const section = `FUENTE_NO_CONFIABLE: ${safeLabel.text}\n<datos_recuperados>\n${safeData.text}\n</datos_recuperados>`;
    const bounded = section.slice(0, Math.min(maxBlockChars, remaining));
    if (bounded.length < section.length) {
      truncated = true;
      truncatedBlocks.push({ label: safeLabel.text.slice(0, 80), chars: section.length });
    }
    sections.push(bounded);
    remaining -= bounded.length;
  }
  return { text: sections.join("\n\n"), blockedPatterns, truncated, truncatedBlocks };
}

export type UntrustedToolResult = { text: string; blockedPatterns: number };


/**
 * AI-30: devuelve tambien cuantos patrones se neutralizaron. Antes solo
 * devolvia el texto y el dato se perdia: un resultado de herramienta que
 * intentaba inyectar instrucciones se limpiaba en silencio y nadie se enteraba
 * de que habia pasado.
 */
export function serializeUntrustedToolResult(
  result: unknown,
  maxChars?: number,
): UntrustedToolResult {
  let serialized: string;
  try { serialized = JSON.stringify(result ?? null); } catch { serialized = "[tool_result_no_serializable]"; }
  const neutralized = neutralize(serialized);
  const truncated = maxChars !== undefined && neutralized.text.length > maxChars;
  const bounded = truncated
    ? `${neutralized.text.slice(0, Math.max(0, maxChars! - 180))}\n[RESULTADO_TRUNCADO: se excedió el límite de ${maxChars} caracteres; solicita una consulta más específica o una página posterior]`
    : neutralized.text;
  return {
    text: `<tool_result_no_confiable>\n${bounded}\n</tool_result_no_confiable>`,
    blockedPatterns: neutralized.blocked,
  };
}
