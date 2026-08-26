import type { Tone } from "./badge";

export type AgentOrchestrationMode = "direct" | "langgraph";

export type AgentRuntimeStatusPresentation = {
  modeLabel: string;
  modeTone: Tone;
  tracingLabel: string;
  tracingTone: Tone;
};

export function getAgentRuntimeStatusPresentation({
  orchestrationMode,
  langsmithTracing,
}: {
  orchestrationMode: AgentOrchestrationMode;
  langsmithTracing: boolean;
}): AgentRuntimeStatusPresentation {
  return {
    modeLabel:
      orchestrationMode === "langgraph"
        ? "LangGraph · piloto"
        : "Runtime directo",
    modeTone: orchestrationMode === "langgraph" ? "brand" : "neutral",
    tracingLabel: langsmithTracing
      ? "LangSmith · tracing activo"
      : "LangSmith · apagado",
    tracingTone: langsmithTracing ? "success" : "neutral",
  };
}
