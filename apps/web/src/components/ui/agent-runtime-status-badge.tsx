import { Badge } from "./badge";
import {
  getAgentRuntimeStatusPresentation,
  type AgentOrchestrationMode,
} from "./agent-runtime-status";

export { getAgentRuntimeStatusPresentation } from "./agent-runtime-status";
export type {
  AgentOrchestrationMode,
  AgentRuntimeStatusPresentation,
} from "./agent-runtime-status";

export function AgentRuntimeStatusBadge(props: {
  orchestrationMode: AgentOrchestrationMode;
  langsmithTracing: boolean;
}) {
  const presentation = getAgentRuntimeStatusPresentation(props);
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={presentation.modeTone}>{presentation.modeLabel}</Badge>
      <Badge tone={presentation.tracingTone}>{presentation.tracingLabel}</Badge>
    </span>
  );
}
