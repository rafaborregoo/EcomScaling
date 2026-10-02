// Lógica pura de la pestaña Reglas: estado de vigencia, peso en el contexto y
// sugerencias que salen del cuestionario. Sin imports del navegador para poder
// probarla en Node.

export type RuleLike = {
  status: string;
  valid_until: string | null;
};

export type RuleState = "live" | "soon" | "expired" | "off";

/** Una regla que caduca en este número de días o menos se marca como "pronto". */
export const SOON_DAYS = 14;

/** Por encima de esto, las reglas pesan demasiado en cada turno. */
export const CONTEXT_BUDGET_CHARS = 2000;

const DAY_MS = 86_400_000;

export function daysUntil(date: string, today: string) {
  return Math.round((Date.parse(date) - Date.parse(today)) / DAY_MS);
}

export function ruleState(rule: RuleLike, today: string): RuleState {
  if (rule.status !== "active") return "off";
  if (!rule.valid_until) return "live";
  if (rule.valid_until < today) return "expired";
  return daysUntil(rule.valid_until, today) <= SOON_DAYS ? "soon" : "live";
}

export const isInUse = (state: RuleState) => state === "live" || state === "soon";

export function addDays(today: string, days: number) {
  return new Date(Date.parse(today) + days * DAY_MS).toISOString().slice(0, 10);
}

export type RuleSuggestion = { key: string; from: string; category: string; text: string };

// Respuestas del cuestionario que, como regla, el copiloto tendría siempre
// delante en vez de solo cuando la conversación las saca. `numeric` coge el
// primer número del contenido guardado ("35 %" -> "35").
const SUGGESTION_TEMPLATES: Array<{
  questionId: string;
  from: string;
  category: string;
  numeric: boolean;
  text: (value: string) => string;
}> = [
  {
    questionId: "margen_minimo",
    from: "Margen mínimo",
    category: "pricing",
    numeric: true,
    text: (value) => `El margen nunca puede bajar del ${value} % en ninguna propuesta.`,
  },
  {
    questionId: "envio_gratis_desde",
    from: "Envío gratis desde",
    category: "pricing",
    numeric: true,
    text: (value) => `El envío es gratis a partir de ${value} €: tenlo en cuenta al proponer packs y precios.`,
  },
  {
    questionId: "descuentos_prohibidos",
    from: "Descuentos prohibidos",
    category: "discounts",
    numeric: false,
    text: (value) => `No propongas estos descuentos ni promociones: ${value}`,
  },
  {
    questionId: "lineas_rojas_marca",
    from: "Líneas rojas de la marca",
    category: "brand",
    numeric: false,
    text: (value) => `La marca nunca haría ni diría esto: ${value}`,
  },
];

export const SUGGESTION_QUESTION_IDS = SUGGESTION_TEMPLATES.map((template) => template.questionId);

/**
 * @param answers contenido guardado por id de pregunta (solo las respondidas)
 * @param existing textos de las reglas que ya están en uso, para no repetirlas
 * @param maxLength límite de una regla; una respuesta que no cabe se descarta
 */
export function ruleSuggestions(
  answers: Record<string, string>,
  existing: string[],
  maxLength: number,
): RuleSuggestion[] {
  const used = new Set(existing.map((text) => text.trim()));
  const suggestions: RuleSuggestion[] = [];
  for (const template of SUGGESTION_TEMPLATES) {
    const raw = answers[template.questionId]?.trim();
    if (!raw) continue;
    const value = template.numeric ? raw.match(/-?\d+(\.\d+)?/)?.[0] : raw;
    if (!value) continue;
    const text = template.text(value);
    if (text.length > maxLength || used.has(text)) continue;
    suggestions.push({ key: template.questionId, from: template.from, category: template.category, text });
  }
  return suggestions;
}
