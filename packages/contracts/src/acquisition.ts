import { z } from "zod";
import {
  playbookTemplateSchema,
  type PlaybookTemplateInput,
} from "./playbook.js";

export const ACQUISITION_MOTIONS = [
  "DEMAND_CREATION",
  "DEMAND_CAPTURE",
  "AUDIENCE_EXPANSION",
  "CHANNEL_EXPANSION",
  "CHANNEL_DIVERSIFICATION",
  "DISTRIBUTION_EXPANSION",
] as const;
export type AcquisitionMotion = (typeof ACQUISITION_MOTIONS)[number];

export const ACQUISITION_CHANNEL_SCOPES = [
  "CHANNEL_NEUTRAL",
  "SPECIFIC_CHANNEL",
  "MULTI_CHANNEL",
] as const;
export type AcquisitionChannelScope =
  (typeof ACQUISITION_CHANNEL_SCOPES)[number];

export const ACQUISITION_EVIDENCE_REQUIREMENTS = [
  "DEMAND_VOLUME_EVIDENCE",
  "DEMAND_QUALITY_EVIDENCE",
  "NEW_CUSTOMER_EVIDENCE",
  "CHANNEL_CONTRIBUTION_EVIDENCE",
  "CHANNEL_CONCENTRATION_EVIDENCE",
  "AUDIENCE_FIT_EVIDENCE",
  "CHANNEL_FIT_EVIDENCE",
  "MARKET_DEMAND_EVIDENCE",
  "ACQUISITION_ECONOMICS_EVIDENCE",
  "MEASUREMENT_CONFIDENCE_EVIDENCE",
] as const;
export type AcquisitionEvidenceRequirement =
  (typeof ACQUISITION_EVIDENCE_REQUIREMENTS)[number];

export const acquisitionInterventionProfileSchema = z.object({
  acquisition_motion: z.enum(ACQUISITION_MOTIONS),
  target_population_ref: z.string().min(1).optional(),
  channel_scope: z.enum(ACQUISITION_CHANNEL_SCOPES),
  channel_refs: z.array(z.string().min(1)).optional(),
  qualification_objective_ref: z.string().min(1).optional(),
  acquisition_evidence_requirements: z.array(
    z.enum(ACQUISITION_EVIDENCE_REQUIREMENTS),
  ),
});
export type AcquisitionInterventionProfile = z.infer<
  typeof acquisitionInterventionProfileSchema
>;

export const acquisitionDomainExtensionSchema = z.object({
  acquisition: acquisitionInterventionProfileSchema.optional(),
});
export type AcquisitionDomainExtension = z.infer<
  typeof acquisitionDomainExtensionSchema
>;

export type AcquisitionPlaybookTemplateLike = PlaybookTemplateInput;

export type AcquisitionTemplateValidation = {
  valid: boolean;
  profile: AcquisitionInterventionProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(
  reason_codes: string[],
  unresolved_fields: string[] = [],
): AcquisitionTemplateValidation {
  return {
    valid: false,
    profile: null,
    reason_codes,
    unresolved_fields,
  };
}

export function parseAcquisitionDomainExtension(
  raw: unknown,
): AcquisitionDomainExtension | null {
  const parsed = acquisitionDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateAcquisitionPlaybookTemplate(
  raw: AcquisitionPlaybookTemplateLike,
): AcquisitionTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) {
    return invalid(["ACQ.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  }

  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  const hasAcquisitionExtension = Object.prototype.hasOwnProperty.call(
    extension,
    "acquisition",
  );
  if (!hasAcquisitionExtension) {
    return {
      valid: true,
      profile: null,
      reason_codes: [],
      unresolved_fields: [],
    };
  }
  if (template.domain !== "ACQUISITION") {
    return invalid(
      ["ACQ.DOMAIN_EXTENSION_FORBIDDEN"],
      ["domain_extension.acquisition"],
    );
  }

  const parsedExtension = acquisitionDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.acquisition) {
    return invalid(["ACQ.DOMAIN_EXTENSION_INVALID"], ["acquisition"]);
  }
  const profile = parsedExtension.data.acquisition;
  const channelRefs = profile.channel_refs ?? [];
  if (
    profile.channel_scope === "CHANNEL_NEUTRAL" &&
    channelRefs.length > 0
  ) {
    return invalid(["ACQ.CHANNEL_REFS_FORBIDDEN"], ["channel_refs"]);
  }
  if (
    (profile.channel_scope === "SPECIFIC_CHANNEL" ||
      profile.channel_scope === "MULTI_CHANNEL") &&
    channelRefs.length === 0
  ) {
    return invalid(["ACQ.CHANNEL_REFS_REQUIRED"], ["channel_refs"]);
  }
  if (
    profile.acquisition_motion === "AUDIENCE_EXPANSION" &&
    !profile.target_population_ref
  ) {
    return invalid(
      ["ACQ.TARGET_POPULATION_REQUIRED"],
      ["target_population_ref"],
    );
  }
  return {
    valid: true,
    profile,
    reason_codes: [],
    unresolved_fields: [],
  };
}
