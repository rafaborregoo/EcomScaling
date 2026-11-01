import { Badge } from "./badge";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "./card";
import { getAgentEvalReadinessPresentation } from "./agent-eval-readiness";

export function AgentEvalReadinessPanel({
  coveredAgents,
  totalAgents,
  offlineRunRecorded,
  liveVerified,
}: {
  coveredAgents: number;
  totalAgents: number;
  offlineRunRecorded: boolean;
  liveVerified: boolean;
}) {
  const presentation = getAgentEvalReadinessPresentation({
    coveredAgents,
    totalAgents,
    offlineRunRecorded,
    liveVerified,
  });

  return (
    <Card>
      <CardHeader>
        <CardKicker>Calidad IA</CardKicker>
        <CardTitle>Estado de evaluaciones</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={presentation.offlineTone}>{presentation.offlineLabel}</Badge>
          <Badge tone={presentation.liveTone}>{presentation.liveLabel}</Badge>
        </div>
        <p className="mt-3 text-sm text-muted">{presentation.coverageLabel}.</p>
        <p className="mt-1 text-xs text-muted">
          La preparación offline no se presenta como validación de proveedor real.
        </p>
      </CardContent>
    </Card>
  );
}
