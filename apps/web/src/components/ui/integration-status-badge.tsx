import { Badge } from "./badge";
import {
  getIntegrationStatusPresentation,
  type IntegrationConfigurationStatus,
} from "./integration-status";

export { getIntegrationStatusPresentation } from "./integration-status";
export type {
  IntegrationConfigurationStatus,
  IntegrationStatusPresentation,
} from "./integration-status";

export function IntegrationStatusBadge(props: {
  available: boolean;
  configurationStatus: IntegrationConfigurationStatus;
  connectionStatus?: string | null;
  healthStatus?: string | null;
}) {
  const presentation = getIntegrationStatusPresentation(props);
  return <Badge tone={presentation.tone}>{presentation.label}</Badge>;
}
