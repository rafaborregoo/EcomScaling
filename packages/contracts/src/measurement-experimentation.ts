import { z } from "zod";
import { playbookTemplateSchema, type PlaybookTemplateInput } from "./playbook.js";

export const MEASUREMENT_MOTIONS = [
  "TRACKING_RELIABILITY_RECOVERY",
  "DATA_QUALITY_RECOVERY",
  "EVENT_SCHEMA_CORRECTION",
  "IDENTITY_RESOLUTION_IMPROVEMENT",
  "METRIC_DEFINITION_CORRECTION",
  "ATTRIBUTION_VALIDATION",
  "OBSERVABILITY_IMPROVEMENT",
  "EXPERIMENTAL_VALIDATION",
  "CAUSAL_HYPOTHESIS_VALIDATION",
  "MEASUREMENT_COVERAGE_IMPROVEMENT",
] as const;
export const MEASUREMENT_SURFACES = [
  "EVENT_COLLECTION",
  "IDENTITY",
  "METRIC_LAYER",
  "ATTRIBUTION",
  "DATA_PIPELINE",
  "DATA_MODEL",
  "REPORTING",
  "EXPERIMENTATION",
  "OBSERVABILITY",
  "MULTI_SURFACE",
] as const;
export const DATA_SCOPES = ["EVENT", "METRIC", "ENTITY", "SOURCE", "PIPELINE", "DATASET", "JOURNEY", "BUSINESS_WIDE"] as const;
export const QUALITY_STATES = ["TRUSTED", "USABLE_WITH_LIMITATIONS", "DEGRADED", "UNRELIABLE", "UNKNOWN"] as const;
export const EXPERIMENT_MODES = ["NO_EXPERIMENT", "CONTROLLED_EXPERIMENT", "QUASI_EXPERIMENT", "SEQUENTIAL_VALIDATION", "HOLDOUT", "PRE_POST_VALIDATION"] as const;
export const EXPERIMENT_UNITS = ["USER", "CUSTOMER", "SESSION", "ORDER", "PRODUCT", "STORE", "MARKET", "CAMPAIGN", "TIME_WINDOW"] as const;
export const TREATMENT_SCOPES = ["SINGLE_CHANGE", "LIMITED_CHANGE_SET", "MULTI_COMPONENT_INTERVENTION"] as const;

const refs = z.array(z.string().min(1)).default([]);

export const measurementExperimentationProfileSchema = z.object({
  measurement_motion: z.enum(MEASUREMENT_MOTIONS),
  measurement_surface: z.enum(MEASUREMENT_SURFACES),
  data_scope: z.enum(DATA_SCOPES),
  source_refs: refs,
  event_refs: refs,
  metric_refs: refs,
  identity_scope: z.string().min(1).optional(),
  quality_state: z.enum(QUALITY_STATES).optional(),
  experiment_mode: z.enum(EXPERIMENT_MODES).optional(),
  experiment_unit: z.enum(EXPERIMENT_UNITS).optional(),
  treatment_scope: z.enum(TREATMENT_SCOPES).optional(),
  primary_outcome_ref: z.string().min(1).optional(),
  guardrail_metric_refs: refs,
  measurement_evidence_requirements: z.array(z.string().min(1)).min(1),
  experiment_requirements: refs,
  observability_requirements: refs,
});
export type MeasurementExperimentationProfile = z.infer<typeof measurementExperimentationProfileSchema>;

export const measurementExperimentationDomainExtensionSchema = z.object({
  measurement_experimentation: measurementExperimentationProfileSchema.optional(),
});
export type MeasurementExperimentationDomainExtension = z.infer<typeof measurementExperimentationDomainExtensionSchema>;

export type MeasurementExperimentationTemplateValidation = {
  valid: boolean;
  profile: MeasurementExperimentationProfile | null;
  reason_codes: string[];
  unresolved_fields: string[];
};

function invalid(reason_codes: string[], unresolved_fields: string[] = []): MeasurementExperimentationTemplateValidation {
  return { valid: false, profile: null, reason_codes, unresolved_fields };
}

export function parseMeasurementExperimentationDomainExtension(raw: unknown): MeasurementExperimentationDomainExtension | null {
  const parsed = measurementExperimentationDomainExtensionSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateMeasurementExperimentationPlaybookTemplate(raw: PlaybookTemplateInput): MeasurementExperimentationTemplateValidation {
  const parsedTemplate = playbookTemplateSchema.safeParse(raw);
  if (!parsedTemplate.success) return invalid(["MEASUREMENT_EXPERIMENTATION.TEMPLATE_SCHEMA_INVALID"], ["template"]);
  const template = parsedTemplate.data;
  const extension = template.domain_extension as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(extension, "measurement_experimentation")) return { valid: true, profile: null, reason_codes: [], unresolved_fields: [] };
  if (template.domain !== "MEASUREMENT_EXPERIMENTATION") return invalid(["MEASUREMENT_EXPERIMENTATION.DOMAIN_EXTENSION_FORBIDDEN"], ["domain_extension.measurement_experimentation"]);
  const parsedExtension = measurementExperimentationDomainExtensionSchema.safeParse(extension);
  if (!parsedExtension.success || !parsedExtension.data.measurement_experimentation) return invalid(["MEASUREMENT_EXPERIMENTATION.DOMAIN_EXTENSION_INVALID"], ["measurement_experimentation"]);
  const profile = parsedExtension.data.measurement_experimentation;
  const experimentalMotion = ["EXPERIMENTAL_VALIDATION", "CAUSAL_HYPOTHESIS_VALIDATION"].includes(profile.measurement_motion);
  const hasExperimentDesign = profile.experiment_mode && profile.experiment_mode !== "NO_EXPERIMENT";
  if (experimentalMotion || hasExperimentDesign) {
    const missing: string[] = [];
    if (!profile.experiment_mode || profile.experiment_mode === "NO_EXPERIMENT") missing.push("measurement_experimentation.experiment_mode");
    if (!profile.experiment_unit) missing.push("measurement_experimentation.experiment_unit");
    if (!profile.treatment_scope) missing.push("measurement_experimentation.treatment_scope");
    if (!profile.primary_outcome_ref) missing.push("measurement_experimentation.primary_outcome_ref");
    if (profile.guardrail_metric_refs.length === 0) missing.push("measurement_experimentation.guardrail_metric_refs");
    if (profile.experiment_requirements.length === 0) missing.push("measurement_experimentation.experiment_requirements");
    if (missing.length > 0) return invalid(["MEASUREMENT_EXPERIMENTATION.EXPERIMENT_DESIGN_REQUIRED"], missing);
  }
  return { valid: true, profile, reason_codes: [], unresolved_fields: [] };
}
