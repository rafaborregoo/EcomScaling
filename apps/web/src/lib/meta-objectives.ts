export type MetaObjectiveOption = {
  value:
    | "OUTCOME_AWARENESS"
    | "OUTCOME_TRAFFIC"
    | "OUTCOME_ENGAGEMENT"
    | "OUTCOME_LEADS"
    | "OUTCOME_APP_PROMOTION"
    | "OUTCOME_SALES";
  label: string;
};

/** Objetivos nativos de Meta reutilizables en formularios y revisiones. */
export const META_OBJECTIVE_OPTIONS: readonly MetaObjectiveOption[] = [
  { value: "OUTCOME_AWARENESS", label: "Reconocimiento" },
  { value: "OUTCOME_TRAFFIC", label: "Tr\u00E1fico" },
  { value: "OUTCOME_ENGAGEMENT", label: "Interacci\u00F3n" },
  { value: "OUTCOME_LEADS", label: "Clientes potenciales" },
  { value: "OUTCOME_APP_PROMOTION", label: "Promoci\u00F3n de app" },
  { value: "OUTCOME_SALES", label: "Ventas" },
];

export type MetaCampaignObjective = MetaObjectiveOption["value"];

export function isMetaCampaignObjective(value: string): value is MetaCampaignObjective {
  return META_OBJECTIVE_OPTIONS.some((option) => option.value === value);
}
