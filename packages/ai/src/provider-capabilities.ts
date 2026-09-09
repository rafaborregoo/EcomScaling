/**
 * AI-30 (fase 1): catalogo unico de proveedores, capacidades y precios.
 *
 * Existe por dos motivos que estaban rotos antes:
 *
 * 1. `estimateCostUsd` devolvia 0 para un modelo desconocido. Coste cero
 *    silencioso significa presupuestos que no muerden y facturacion falsa. Aqui
 *    devuelve `null` = "no sabemos", que es un dato distinto de "es gratis".
 * 2. No habia ningun sitio donde constara que la cuantizacion y el KV cache los
 *    gestiona el proveedor. Sin eso, un campo vacio en el panel es ambiguo: no
 *    se distingue "no aplica" de "no medido".
 *
 * REGLA DE ESTE FICHERO: nunca se rellena un valor por conveniencia. Si no hay
 * fuente verificada, el valor es `null` o `"unknown"`. Un numero inventado aqui
 * se convierte en una cifra con aspecto de verdad en el panel de administracion.
 */

export const AI_PROVIDER_IDS = ["anthropic", "openai", "voyage"] as const;

export type AIProviderId = (typeof AI_PROVIDER_IDS)[number];

export function isAIProviderId(value: unknown): value is AIProviderId {
  return (
    typeof value === "string" &&
    (AI_PROVIDER_IDS as readonly string[]).includes(value)
  );
}

/**
 * Estado de una capacidad. `unknown` no es un fallo: es la respuesta correcta
 * mientras nadie haya verificado el dato contra la documentacion del proveedor.
 */
export type CapabilitySupport =
  "supported" | "unsupported" | "unknown" | "provider_managed";

export type ModelCapabilities = {
  provider: AIProviderId;
  /**
   * Tokens de ventana de contexto. `null` = no verificado contra la
   * documentacion del proveedor. No se rellena "de memoria": una ventana
   * inventada produce un porcentaje de utilizacion inventado.
   */
  contextWindowMax: number | null;
  /** El proveedor acepta que declaremos bloques cacheables en la request. */
  promptCachingControl: CapabilitySupport;
  /** El proveedor devuelve tokens leidos de cache en `usage`. */
  reportsCacheReadTokens: CapabilitySupport;
  /** El proveedor devuelve tokens de creacion de cache en `usage`. */
  reportsCacheCreationTokens: CapabilitySupport;
  /** El proveedor devuelve tokens de razonamiento en `usage`. */
  reportsReasoningTokens: CapabilitySupport;
  /** Control de esfuerzo de razonamiento (`reasoning_effort` o equivalente). */
  reasoningEffortControl: CapabilitySupport;
  /**
   * Cuantizacion. Con inferencia gestionada esto es SIEMPRE `provider_managed`:
   * no la controlamos y no vamos a decir que si.
   */
  quantizationControl: CapabilitySupport;
  /**
   * KV cache. NO es lo mismo que prompt caching (que si medimos, ver
   * `reportsCacheReadTokens`). El KV cache vive en la infraestructura del
   * proveedor y no tenemos ni control ni telemetria de el.
   */
  kvCacheControl: CapabilitySupport;
};

/** Base para inferencia gestionada por un tercero. */
const MANAGED_INFERENCE_BASE = {
  contextWindowMax: null,
  quantizationControl: "provider_managed",
  kvCacheControl: "provider_managed",
} as const satisfies Partial<ModelCapabilities>;

/**
 * Capacidades verificadas leyendo el codigo que ya llama a cada API
 * (`runAgentTurn` / `runAgentTurnOpenAI`): si el adaptador lee el campo y el
 * SDK lo tipa, es `supported`. Lo que no se ha comprobado queda en `unknown`.
 */
export const MODEL_CAPABILITIES: Readonly<Record<string, ModelCapabilities>> = {
  "claude-opus-4-8": anthropicModel(),
  "claude-sonnet-5": anthropicModel(),
  "claude-haiku-4-5": anthropicModel(),
  "gpt-4.1": openaiModel(),
  "gpt-4.1-mini": openaiModel(),
  "gpt-4.1-nano": openaiModel(),
};

function anthropicModel(): ModelCapabilities {
  return {
    ...MANAGED_INFERENCE_BASE,
    provider: "anthropic",
    // `cache_control: { type: "ephemeral" }` en el system prompt: index.ts.
    promptCachingControl: "supported",
    // `usage.cache_read_input_tokens`: index.ts.
    reportsCacheReadTokens: "supported",
    // `usage.cache_creation_input_tokens` existe en la API; el adaptador aun
    // no lo lee. Se declara `unknown` hasta que se lea y se vea un valor real.
    reportsCacheCreationTokens: "unknown",
    reportsReasoningTokens: "unknown",
    reasoningEffortControl: "unknown",
  };
}

function openaiModel(): ModelCapabilities {
  return {
    ...MANAGED_INFERENCE_BASE,
    provider: "openai",
    // El caching de OpenAI es automatico: no hay nada que declarar en la
    // request. Por eso `unsupported` (control), no `unsupported` (capacidad).
    promptCachingControl: "provider_managed",
    // `usage.prompt_tokens_details.cached_tokens`: index.ts.
    reportsCacheReadTokens: "supported",
    reportsCacheCreationTokens: "unsupported",
    reportsReasoningTokens: "unknown",
    reasoningEffortControl: "unknown",
  };
}

/** Capacidades de un modelo que no esta en el catalogo: todo desconocido. */
export function unknownModelCapabilities(
  provider: AIProviderId,
): ModelCapabilities {
  return {
    provider,
    contextWindowMax: null,
    promptCachingControl: "unknown",
    reportsCacheReadTokens: "unknown",
    reportsCacheCreationTokens: "unknown",
    reportsReasoningTokens: "unknown",
    reasoningEffortControl: "unknown",
    // Estos dos no dependen del modelo concreto sino de donde corre la
    // inferencia, y toda la que hacemos es gestionada.
    quantizationControl: "provider_managed",
    kvCacheControl: "provider_managed",
  };
}

export function getModelCapabilities(
  model: string,
  fallbackProvider: AIProviderId,
): ModelCapabilities {
  return (
    MODEL_CAPABILITIES[model] ?? unknownModelCapabilities(fallbackProvider)
  );
}

// ---------------------------------------------------------------------------
// Precios
// ---------------------------------------------------------------------------

/**
 * Version de la tabla de precios. Se guarda en cada ejecucion para poder
 * recalcular o auditar un coste historico despues de cambiar un precio: sin
 * esto, subir una tarifa reescribe implicitamente el pasado.
 *
 * Formato: fecha ISO del ultimo cambio de una tarifa.
 */
export const PRICING_VERSION = "2026-09-09";

export type ModelPricing = {
  inputPerMTok: number;
  outputPerMTok: number;
};

/**
 * USD por millon de tokens. Unica fuente de precios del sistema: no debe
 * aparecer ningun literal de tarifa en ningun otro fichero.
 *
 * Al anadir un modelo hay que anadirlo aqui Y en MODEL_CAPABILITIES, o su coste
 * quedara como `unknown` (que es el comportamiento seguro, pero visible como
 * incidente en el panel).
 */
export const MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-5": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
  // R-020: fallback OpenAI. Verificar contra https://openai.com/api/pricing
  // antes de confiar en estimated_cost_usd para presupuesto real.
  "gpt-4.1": { inputPerMTok: 2, outputPerMTok: 8 },
  "gpt-4.1-mini": { inputPerMTok: 0.4, outputPerMTok: 1.6 },
  "gpt-4.1-nano": { inputPerMTok: 0.1, outputPerMTok: 0.4 },
};

/** Por que el coste de una ejecucion vale lo que vale. */
export type CostBasis = "priced" | "unknown_model";

export function isModelPriced(model: string): boolean {
  return MODEL_PRICING[model] !== undefined;
}

/**
 * Coste estimado en USD, o `null` si no conocemos el precio del modelo.
 *
 * Devolver `null` en vez de `0` es deliberado y es el arreglo central de la
 * fase 1: con `0`, un modelo nuevo o un fallback a un id no tarifado producia
 * ejecuciones aparentemente gratuitas, los topes de presupuesto dejaban de
 * morder y el panel de costes mentia sin avisar. Quien llame a esto debe
 * decidir explicitamente que hacer con el desconocimiento.
 */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | null {
  const pricing = MODEL_PRICING[model];

  if (!pricing) {
    return null;
  }

  return (
    (inputTokens / 1_000_000) * pricing.inputPerMTok +
    (outputTokens / 1_000_000) * pricing.outputPerMTok
  );
}

export function costBasisFor(model: string): CostBasis {
  return isModelPriced(model) ? "priced" : "unknown_model";
}
