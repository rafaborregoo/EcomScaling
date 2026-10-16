/**
 * Saldo de tokens del copiloto y eleccion de modelo.
 *
 * Aqui solo vive la aritmetica y las reglas: nada de Supabase, nada de red.
 * El que habla con la base de datos es `copilot-saldo.ts`; esto es lo que se
 * puede probar sin levantar nada, y es donde estan las decisiones que duelen
 * si se equivocan (a quien se le cobra, que modelo corre, que se le enseña).
 *
 * Ver docs/PLAN_ORGANIZACION_CONSULTORA_Y_SALDO_COPILOTO.md, fases 4 y 5.
 */

/**
 * Coste medio de un mensaje del copiloto, en tokens facturables (entrada +
 * salida). No es una estimacion: es la media de los runs reales de
 * `agent_runs` con `trigger_type = 'chat'` (3.358 de entrada + 1.940 de
 * salida). Sirve para traducir el saldo a "mensajes que te quedan", que es lo
 * unico que el numero significa para quien lo lee.
 */
export const TOKENS_POR_MENSAJE = 5300;

export type CopilotModelId = "sonnet" | "opus" | "haiku" | "luna" | "sol";

export type CopilotModel = {
  id: CopilotModelId;
  label: string;
  /** Para que sirve, en una linea. Si hace falta un parrafo, sobra el modelo. */
  description: string;
  /** Id del modelo en su proveedor (el nombre del campo es historico: tambien guarda los de OpenAI). */
  anthropicModel: string;
  provider?: "openai";
  /** Si el usuario puede elegirlo, o solo lo pone el sistema. */
  selectable: boolean;
};

/**
 * Dos modelos elegibles, no tres.
 *
 * Haiku no es una opcion: nadie elige a sabiendas el modelo peor, y ponerlo en
 * la lista obliga a explicar tres cosas en vez de dos. Existe como modo
 * degradado cuando se agota el saldo -- un copiloto que deja de responder es
 * un motivo de baja, uno que responde peor es un motivo para subir de plan.
 */
export const COPILOT_MODELS: readonly CopilotModel[] = [
  {
    id: "sonnet",
    label: "Sonnet 5",
    description: "El de siempre. Rápido y suficiente para casi todo.",
    anthropicModel: "claude-sonnet-5",
    selectable: true,
  },
  {
    id: "opus",
    label: "Opus 5",
    description: "Para pensar más: diagnósticos largos y decisiones difíciles.",
    anthropicModel: "claude-opus-5",
    selectable: true,
  },
  {
    id: "luna",
    label: "GPT Luna",
    description: "OpenAI económico. Respuestas rápidas.",
    anthropicModel: "gpt-6-luna",
    provider: "openai",
    selectable: true,
  },
  {
    id: "sol",
    label: "GPT Sol",
    description: "OpenAI avanzado, para razonar más.",
    anthropicModel: "gpt-6-sol",
    provider: "openai",
    selectable: true,
  },
  {
    id: "haiku",
    label: "Haiku 4.5",
    description: "Modo reducido mientras no haya saldo.",
    anthropicModel: "claude-haiku-4-5-20251001",
    selectable: false,
  },
] as const;

export type CopilotModelTier = "sonnet" | "opus";

/** Los de OpenAI solo se ofrecen si hay OPENAI_API_KEY; Opus y Sol, solo en el plan avanzado. */
export function modelosDelPlan(
  tier: CopilotModelTier,
  openai = false,
): CopilotModel[] {
  return COPILOT_MODELS.filter(
    (model) =>
      model.selectable &&
      (openai || model.provider !== "openai") &&
      (tier === "opus" || (model.id !== "opus" && model.id !== "sol")),
  );
}

export type ResolveModelInput = {
  /** Lo que pidio el usuario. `undefined` = lo que traiga el plan por defecto. */
  requested?: string | undefined;
  tier: CopilotModelTier;
  /** Tokens que quedan en el banco. <= 0 significa agotado. */
  remainingTokens: number;
  /** Hay OPENAI_API_KEY: solo entonces se atienden los modelos de OpenAI. */
  openai?: boolean;
};

export type ResolvedCopilotModel = {
  model: CopilotModel;
  /** true cuando NO es el que pidio el usuario, sino el degradado por saldo. */
  degraded: boolean;
};

/**
 * Que modelo corre este turno.
 *
 * Tres reglas, por orden:
 *  1. Sin saldo se cae a Haiku, pida lo que pida. No se corta el servicio.
 *  2. Un modelo que su plan no incluye no es un error: se atiende con el que
 *     si incluye. Devolver 403 aqui castiga al usuario por una pantalla vieja
 *     en una pestaña abierta, y el resultado util es el mismo.
 *  3. Lo que no reconozcamos cae al de por defecto del plan.
 */
export function resolveCopilotModel(
  input: ResolveModelInput,
): ResolvedCopilotModel {
  if (input.remainingTokens <= 0) {
    return { model: modeloPorId("haiku"), degraded: true };
  }

  const permitidos = modelosDelPlan(input.tier, input.openai);
  const pedido = permitidos.find((model) => model.id === input.requested);

  return { model: pedido ?? permitidos[0]!, degraded: false };
}

function modeloPorId(id: CopilotModelId): CopilotModel {
  const model = COPILOT_MODELS.find((item) => item.id === id);
  if (!model) throw new Error(`modelo de copiloto desconocido: ${id}`);
  return model;
}

export type CopilotBalance = {
  granted: number;
  used: number;
  remaining: number;
  /** Mensajes que salen aproximadamente con lo que queda. */
  approx_messages_left: number;
  /** ISO del dia en que se renueva (el 1 del mes siguiente). */
  renews_at: string;
  days_to_renewal: number;
  exhausted: boolean;
  tier: CopilotModelTier;
};

/**
 * El saldo tal y como se enseña.
 *
 * `remaining` nunca baja de 0: un numero negativo en pantalla no significa
 * nada para quien lo lee, y el consumo por encima del tope ya se ve en
 * `used` para quien tenga que mirarlo.
 */
export function describeBalance(input: {
  granted: number;
  used: number;
  tier: CopilotModelTier;
  now?: Date;
}): CopilotBalance {
  const now = input.now ?? new Date();
  const remaining = Math.max(0, input.granted - input.used);
  const renewal = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  const dayMs = 24 * 60 * 60 * 1000;

  return {
    granted: input.granted,
    used: input.used,
    remaining,
    approx_messages_left: Math.floor(remaining / TOKENS_POR_MENSAJE),
    renews_at: renewal.toISOString(),
    days_to_renewal: Math.max(
      0,
      Math.ceil((renewal.getTime() - now.getTime()) / dayMs),
    ),
    exhausted: remaining <= 0,
    tier: input.tier,
  };
}

/** Inicio del mes en curso en UTC: el periodo del saldo es el mes natural. */
export function inicioDelPeriodo(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Fin exclusivo del periodo: el 1 del mes siguiente. */
export function finDelPeriodo(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}
