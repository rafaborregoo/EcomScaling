import {
  type PlaybookFrameworkInputLike,
  type PlaybookTriState,
  type PlaybookTemplate,
} from "@e-nora/contracts";
import { type LoadedApiEnv } from "@e-nora/config";
import {
  buildPlaybookContext,
  parseActivePlaybookTemplates,
  runPlaybookFrameworkEngine,
  runPlaybookFrameworkEngineForAllOrganizations,
} from "./playbook-engine.js";

const PAID_MEDIA_SOURCE_VERSION = "f5-p02.v1";

export function buildPaidMediaPlaybookContext(
  organizationId: string,
  diagnostics: Parameters<typeof buildPlaybookContext>[1],
  latestDecision: Parameters<typeof buildPlaybookContext>[2],
  now?: string,
): PlaybookFrameworkInputLike["context"] {
  const base = buildPlaybookContext(organizationId, diagnostics, latestDecision, now);
  const unknown: PlaybookTriState = "UNKNOWN";
  return {
    ...base,
    context_id: base.context_id.replace("playbook-context", "paid-media-context"),
    decision_cycle_id: base.decision_cycle_id.replace("f5-p00", "f5-p02"),
    source_versions: [...(base.source_versions ?? []), PAID_MEDIA_SOURCE_VERSION],
    facts: {
      ...base.facts,
      "paid_media.measurement.sufficient": unknown,
      "paid_media.distribution.cost.changed": unknown,
      "paid_media.ad.response.changed": unknown,
      "paid_media.traffic.quality.sufficient": unknown,
      "paid_media.post_click.conversion.sufficient": unknown,
      "paid_media.economics.compatible": unknown,
      "paid_media.incrementality.supported": unknown,
      "paid_media.inventory.available": unknown,
      "paid_media.operations.capacity.available": unknown,
      "paid_media.cash_flow.compatible": unknown,
    },
  };
}

function paidMediaTemplateFilter(template: PlaybookTemplate): boolean {
  return template.domain === "PAID_MEDIA";
}

const paidMediaOptions = {
  domain: "PAID_MEDIA",
  contextBuilder: buildPaidMediaPlaybookContext,
  templateFilter: paidMediaTemplateFilter,
};

export async function runPaidMediaPlaybookEngine(
  env: LoadedApiEnv,
  organizationId: string,
) {
  return runPlaybookFrameworkEngine(env, organizationId, paidMediaOptions);
}

export async function runPaidMediaPlaybookEngineForAllOrganizations(
  env: LoadedApiEnv,
) {
  return runPlaybookFrameworkEngineForAllOrganizations(env, paidMediaOptions);
}

export { parseActivePlaybookTemplates };
