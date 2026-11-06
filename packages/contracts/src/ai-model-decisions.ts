/** Asignaciones de plataforma compartidas por runtime y administración; cada una declara su estado. */
export const A01_MODEL_DECISION = {
  agentCode: "a01_analista_llamadas",
  model: "gpt-6.1-sol",
  label: "GPT-6.1 Sol",
  provider: "openai",
  status: "closed",
  closedAt: "2026-10-29",
  reasoningEffort: "medium",
  endpoint: "responses",
  contextLimits: { maxBlockChars: 600_000, maxContextChars: 800_000 },
  resilience: { timeoutMs: 300_000, maxRetries: 1 },
  // GPT-6.1 Terra es la alternativa de OpenAI evaluada en las 18 pruebas sintéticas.
  fallbackModel: "gpt-6.1-terra",
  // Perfil de tokens CLI; la ID servida por OpenAI no queda verificada en Codex CLI.
  benchmarks: [
    { minutes: 30, inputTokens: 40716, cacheReadTokens: 40576, outputTokens: 3581 },
    { minutes: 60, inputTokens: 46667, cacheReadTokens: 0, outputTokens: 3396 },
    { minutes: 120, inputTokens: 59293, cacheReadTokens: 12544, outputTokens: 3770 },
  ],
} as const;

export const A02_MODEL_DECISION = {
  agentCode: "a02_monitor_negocio",
  model: "gpt-6.1-terra",
  label: "GPT-6.1 Terra",
  provider: "openai",
  status: "closed",
  closedAt: "2026-10-29",
  reasoningEffort: "medium",
  endpoint: "responses",
  contextLimits: undefined,
  resilience: { timeoutMs: 180_000, maxRetries: 1 },
  // Media de Overview y Panel con historico real TEST (29/10/2026). Para
  // Costes se presupuesta en frío: una lectura CLI cacheada no es garantía de
  // que la API conserve la caché entre las pasadas programadas.
  fallbackModel: "gpt-6.1-sol",
  benchmarkProfile: { input_total: 33655, cache_read: 0, output: 1711.5 },
} as const;

export const A04_MODEL_DECISION = {
  agentCode: "a04_generador_tareas",
  model: "gpt-6.1-terra",
  label: "GPT-6.1 Terra",
  provider: "openai",
  status: "closed",
  closedAt: "2026-10-28",
  reasoningEffort: "medium",
  endpoint: "responses",
  contextLimits: undefined,
  resilience: { timeoutMs: 180_000, maxRetries: 1 },
  // Media de cuatro respuestas CLI, sin aplicar descuentos de caché.
  benchmarkProfile: { input_total: 29351.25, cache_read: 0, output: 651.75 },
  alternative: "gpt-6.1-sol",
} as const;

export const A05_MODEL_DECISION = {
  agentCode: "a05_estrategia_campanas",
  model: "gpt-6.1-sol",
  label: "GPT-6.1 Sol",
  provider: "openai",
  status: "closed",
  closedAt: "2026-10-29",
  reasoningEffort: "medium",
  endpoint: "responses",
  contextLimits: undefined,
  resilience: { timeoutMs: 180_000, maxRetries: 1 },
  // Media equiponderada de tres pruebas CLI, sin descuentos de caché.
  benchmarkProfile: { input_total: (54815 + 27157 + 27699) / 3, cache_read: 0, output: (1208 + 1719 + 644) / 3 },
  fallbackModel: "gpt-6.1-terra",
} as const;

export const A06_MODEL_DECISION = {
  agentCode: "a06_planificador_stock",
  model: "claude-haiku-5-5",
  label: "Claude Haiku 5.5",
  provider: "anthropic",
  status: "closed",
  closedAt: "2026-10-31",
  reasoningEffort: undefined,
  contextLimits: undefined,
  resilience: { timeoutMs: 180_000, maxRetries: 1 },
  // Revalidado con el snapshot runtime de E-NORA Demo del 31/10 y seis modelos.
  // Perfil CLI orientativo sin asumir caché; no equivale a consumo API medido.
  // Sol queda como respaldo de mayor capacidad vía OpenAI.
  benchmarkProfile: { input_total: 31165, cache_read: 0, output: 23334 },
  fallbackModel: "gpt-6.1-sol",
} as const;

export const A08_MODEL_DECISION = {
  agentCode: "a08_gestor_conocimiento",
  model: "gpt-6.1-terra",
  label: "GPT-6.1 Terra",
  provider: "openai",
  status: "closed",
  closedAt: "2026-10-31",
  reasoningEffort: undefined,
  contextLimits: undefined,
  resilience: { timeoutMs: 180_000, maxRetries: 1 },
  // Contraste del catálogo real: Terra mantiene alcance y cautelas con menos
  // coste que Sol. Sonnet aporta respaldo de mayor capacidad en otro proveedor.
  fallbackModel: "claude-sonnet-5-5",
  alternativeModel: "gpt-6.1-sol",
  // Tokens CLI orientativos, sin descuento de caché ni factura API real.
  benchmarkProfile: { input_total: 37831, cache_read: 0, output: 1458 },
} as const;

export const A12_MODEL_DECISION = {
  agentCode: "a12_analista_email",
  model: "gpt-6.1-sol",
  label: "GPT-6.1 Sol",
  provider: "openai",
  status: "closed",
  closedAt: "2026-11-02",
  reasoningEffort: "medium",
  contextLimits: undefined,
  resilience: { timeoutMs: 180_000, maxRetries: 1 },
  fallbackModel: "claude-sonnet-5-5",
  alternativeModel: "gpt-6.1-terra",
  // Six-model replay of TEST history, October vs September. Cold CLI estimate,
  // not production API billing; missing coverage retained as a separate case.
  benchmarkProfile: { input_total: 38075, cache_read: 0, output: 2069 },
} as const;

export const A13_MODEL_DECISION = {
  agentCode: "a13_operativa_shopify",
  model: "gpt-6.1-sol",
  label: "GPT-6.1 Sol",
  provider: "openai",
  status: "closed",
  closedAt: "2026-11-03",
  reasoningEffort: "medium",
  contextLimits: undefined,
  resilience: { timeoutMs: 180_000, maxRetries: 1 },
  fallbackModel: "gpt-6.1-terra",
  benchmarkProfile: { input_total: 43639, cache_read: 0, output: 1555 },
} as const;

// Two six-model TEST replays validate diagnosis/abstention, not investment performance.
export const A14_MODEL_DECISION = {
  agentCode: "a14_operativa_meta",
  model: "gpt-6.1-sol",
  label: "GPT-6.1 Sol",
  provider: "openai",
  status: "closed",
  closedAt: "2026-11-05",
  reasoningEffort: "medium",
  contextLimits: undefined,
  resilience: { timeoutMs: 180_000, maxRetries: 1 },
  fallbackModel: "gpt-6.1-terra",
  benchmarkProfile: { input_total: 40713, cache_read: 0, output: 1122 },
} as const;

// Provisional: una sola tienda. Comparación de seis modelos en la replanificación
// real del 05/11: Opus tiene el mejor diagnóstico; Sol, segundo, cuesta 7 veces menos.
export const A19_MODEL_DECISION = {
  agentCode: "a19_arquitecto_camino",
  model: "claude-opus-5-5",
  label: "Claude Opus 5.5",
  provider: "anthropic",
  status: "provisional",
  closedAt: undefined,
  // El esfuerzo lo fija cada llamada: alto en la estrategia, medio al detallar.
  reasoningEffort: undefined,
  contextLimits: undefined,
  // Prevalece sobre el del runtime; la prueba por CLI tardó 15 minutos.
  resilience: { timeoutMs: 30 * 60_000, maxRetries: 1 },
  fallbackModel: "gpt-6.1-sol",
  // Ejecución real por API del 05/11, estrategia y detalle sumados (6,71 USD estimados).
  benchmarkProfile: { input_total: 706849, cache_read: 41050, output: 180358 },
} as const;

export const A15_MODEL_DECISION = {
  agentCode: "a15_analista_imagenes", model: "gpt-6.1-terra", label: "GPT-6.1 Terra", provider: "openai",
  status: "closed", closedAt: "2026-11-05", reasoningEffort: "medium", contextLimits: undefined,
  resilience: { timeoutMs: 180_000, maxRetries: 1 }, fallbackModel: "gpt-6.1-sol",
  // Two image replays; CLI overhead/vision included, not API billing.
  benchmarkProfile: { input_total: 25604, cache_read: 0, output: 585 },
} as const;

export const A16_MODEL_DECISION = {
  agentCode: "a16_texto_sobre_imagen",
  model: "claude-opus-5-5",
  label: "Claude Opus 5.5",
  provider: "anthropic",
  status: "closed",
  closedAt: "2026-11-06",
  reasoningEffort: undefined,
  contextLimits: undefined,
  resilience: { timeoutMs: 180_000, maxRetries: 1 },
  fallbackModel: "gpt-6.1-sol",
  // Dos imágenes de TEST, con producto Shopify, pixeles adjuntos y salida de coordenadas.
  // Coste conservador equivalente API en frío; no es medición de factura real.
  benchmarkProfile: { input_total: 6897.5, cache_read: 0, output: 1308.5 },
} as const;

// Una comparación corregida de seis modelos en TEST; no prueba superioridad universal.
export const A17_MODEL_DECISION = {
  agentCode: "a17_plan_semanal", model: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", provider: "anthropic",
  status: "closed", closedAt: "2026-11-06", reasoningEffort: undefined,
  // El snapshot semanal y su índice de tareas deben llegar completos al modelo.
  contextLimits: { maxBlockChars: 64_000, maxContextChars: 300_000 },
  resilience: { timeoutMs: 180_000, maxRetries: 1 }, fallbackModel: "gpt-6.1-terra",
  // CLI, equivalente API en frío; no factura real ni consumo con herramientas.
  benchmarkProfile: { input_total: 62726, cache_read: 0, output: 1233 },
} as const;

export function getAgentModelDecision(agentCode: string) {
  if (agentCode === A17_MODEL_DECISION.agentCode) return A17_MODEL_DECISION;
  return agentCode === A19_MODEL_DECISION.agentCode
    ? A19_MODEL_DECISION
    : agentCode === A01_MODEL_DECISION.agentCode
    ? A01_MODEL_DECISION
    : agentCode === A02_MODEL_DECISION.agentCode
      ? A02_MODEL_DECISION
      : agentCode === A04_MODEL_DECISION.agentCode
        ? A04_MODEL_DECISION
        : agentCode === A05_MODEL_DECISION.agentCode
          ? A05_MODEL_DECISION
          : agentCode === A06_MODEL_DECISION.agentCode
            ? A06_MODEL_DECISION
            : agentCode === A08_MODEL_DECISION.agentCode
              ? A08_MODEL_DECISION
              : agentCode === A12_MODEL_DECISION.agentCode
                ? A12_MODEL_DECISION
                : agentCode === A13_MODEL_DECISION.agentCode
                  ? A13_MODEL_DECISION
                  : agentCode === A14_MODEL_DECISION.agentCode
                    ? A14_MODEL_DECISION
                    : agentCode === A15_MODEL_DECISION.agentCode
                      ? A15_MODEL_DECISION
                      : agentCode === A16_MODEL_DECISION.agentCode
                        ? A16_MODEL_DECISION
          : null;
}
