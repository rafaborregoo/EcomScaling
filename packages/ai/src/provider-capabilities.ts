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
  "claude-opus-5": anthropicModel(),
  "claude-sonnet-5": anthropicModel(),
  "claude-haiku-4-5": anthropicModel(),
  "gpt-5.5": openaiModel(),
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
export const PRICING_VERSION = "2026-09-25";

export type ModelPricing = {
  inputPerMTok: number;
  outputPerMTok: number;
};

/**
 * USD por millon de tokens: el RESPALDO. La tarifa vigente vive en la tabla
 * `ai_model_prices`, que el job `ai-pricing-sync` actualiza a diario desde
 * LiteLLM y el runtime carga con `setLiveModelPricing`. Esto solo cuenta si la
 * tabla no ha respondido todavia o no tiene el modelo. Verificado contra
 * platform.claude.com/docs/en/about-claude/pricing y la ficha de gpt-5.5 el
 * 2026-09-25.
 */
export const MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  "claude-opus-4-8": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-opus-5": { inputPerMTok: 5, outputPerMTok: 25 },
  "claude-sonnet-5": { inputPerMTok: 2, outputPerMTok: 10 },
  "claude-haiku-4-5": { inputPerMTok: 1, outputPerMTok: 5 },
  "gpt-5.5": { inputPerMTok: 5, outputPerMTok: 30 },
  "gpt-4.1": { inputPerMTok: 2, outputPerMTok: 8 },
  "gpt-4.1-mini": { inputPerMTok: 0.4, outputPerMTok: 1.6 },
  "gpt-4.1-nano": { inputPerMTok: 0.1, outputPerMTok: 0.4 },
};

/** Por que el coste de una ejecucion vale lo que vale. */
export type CostBasis = "priced" | "unknown_model";

let livePricing: { prices: Record<string, ModelPricing>; version: string } | null = null;

/** Sustituye la tarifa en memoria por la de `ai_model_prices`. */
export function setLiveModelPricing(prices: Record<string, ModelPricing>, version: string) {
  livePricing = { prices, version };
}

/** Version de la tarifa con la que se calcula ahora mismo. */
export function getPricingVersion(): string {
  return livePricing?.version ?? PRICING_VERSION;
}

/** El id fechado (`claude-haiku-4-5-20251001`, `gpt-5.5-2026-04-23`) cae en su alias. */
function modelAlias(model: string): string {
  return model.replace(/-(\d{8}|\d{4}-\d{2}-\d{2})$/, "");
}

export function pricingFor(model: string): ModelPricing | undefined {
  for (const id of [model, modelAlias(model)]) {
    const price = livePricing?.prices[id] ?? MODEL_PRICING[id];
    if (price) return price;
  }
  return undefined;
}

export function isModelPriced(model: string): boolean {
  return pricingFor(model) !== undefined;
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
  const pricing = pricingFor(model);

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
