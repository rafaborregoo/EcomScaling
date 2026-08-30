export type MarketingBriefInput = {
  channel: string;
  objective: string;
  audience: string;
  offer: string;
  tone: string;
  cta: string;
  instructions: string;
};

/**
 * Keeps the campaign form contract explicit while the API continues to accept
 * one brief string. Empty optional values become safe instructions for Claude,
 * never implicit facts about the business.
 */
export function buildMarketingBrief(input: MarketingBriefInput): string {
  return [
    `Canal de destino: ${input.channel}`,
    `Objetivo: ${input.objective}`,
    `Audiencia: ${input.audience.trim() || "No especificada; identificar supuestos"}`,
    `Oferta o producto: ${input.offer.trim() || "No especificada; no inventar condiciones"}`,
    `Tono: ${input.tone}`,
    `CTA preferido: ${input.cta.trim() || "Proponer uno coherente con el objetivo"}`,
    `Indicaciones adicionales: ${input.instructions.trim()}`,
  ].join("\n");
}
