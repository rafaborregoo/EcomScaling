import {
  validateAcquisitionPlaybookTemplate,
  type PlaybookTriState,
  type PlaybookFrameworkInputLike,
  type PlaybookTemplate,
} from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import {
  buildPlaybookContext,
  parseActivePlaybookTemplates,
  runPlaybookFrameworkEngine,
  runPlaybookFrameworkEngineForAllOrganizations,
} from "./playbook-engine.js";

const ACQUISITION_SOURCE_VERSION = "f5-p01.v1";

export function buildAcquisitionPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  const unknown: PlaybookTriState = "UNKNOWN";
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "acquisition-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f5-p01"),
    source_versions: [
      ...(base.source_versions ?? []),
      ACQUISITION_SOURCE_VERSION,
    ],
    facts: {
      ...base.facts,
      "acquisition.priority.compatible": unknown,
      "acquisition.target_population.identifiable": unknown,
      "acquisition.channel.context.available": unknown,
      "acquisition.measurement.sufficient": unknown,
      "acquisition.economics.compatible": unknown,
      "acquisition.operational.capacity.available": unknown,
      "acquisition.inventory.capacity.available": unknown,
      "acquisition.channel.fit.supported": unknown,
    },
  };
}

function acquisitionTemplateFilter(template: PlaybookTemplate): boolean {
  if (template.domain !== "ACQUISITION") return false;
  return validateAcquisitionPlaybookTemplate(template).valid;
}

const acquisitionOptions = {
  domain: "ACQUISITION",
  contextBuilder: buildAcquisitionPlaybookContext,
  templateFilter: acquisitionTemplateFilter,
};

export async function runAcquisitionPlaybookEngine(
  env: LoadedApiEnv,
  organizationId: string,
) {
  return runPlaybookFrameworkEngine(env, organizationId, acquisitionOptions);
}

export async function runAcquisitionPlaybookEngineForAllOrganizations(
  env: LoadedApiEnv,
) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, acquisitionOptions);
}

export { parseActivePlaybookTemplates };
