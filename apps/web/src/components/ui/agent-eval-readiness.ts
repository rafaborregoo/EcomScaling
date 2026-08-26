import type { Tone } from "./badge";

export type AgentEvalReadinessPresentation = {
  offlineLabel: string;
  offlineTone: Tone;
  liveLabel: string;
  liveTone: Tone;
  coverageLabel: string;
};

export function getAgentEvalReadinessPresentation({
  coveredAgents,
  totalAgents,
  offlineRunRecorded,
  liveVerified,
}: {
  coveredAgents: number;
  totalAgents: number;
  offlineRunRecorded: boolean;
  liveVerified: boolean;
}): AgentEvalReadinessPresentation {
  const coverage = Math.max(0, Math.min(totalAgents, coveredAgents));
  return {
    offlineLabel: offlineRunRecorded
      ? "Evals offline registradas"
      : "Matriz offline preparada",
    offlineTone: offlineRunRecorded ? "success" : "brand",
    liveLabel: liveVerified ? "Evals live verificadas" : "Evals live pendientes",
    liveTone: liveVerified ? "success" : "warn",
    coverageLabel: `${coverage}/${Math.max(0, totalAgents)} agentes cubiertos`,
  };
}
