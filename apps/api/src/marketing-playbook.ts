import { z } from "zod";
import { internalMailingVisualAnalysisSchema } from "./marketing-playbook-visual.js";

const text = (max: number) => z.string().trim().min(1).max(max);
const stringList = (limit: number, max: number) =>
  z.array(text(max)).max(limit).default([]);

export const internalMailingPlaybookDraftSchema = z.object({
  kind: z.enum(["strategy", "example", "counterexample"]),
  title: text(180),
  objective: text(500),
  audience_tags: stringList(20, 80),
  lifecycle_tags: stringList(20, 80),
  content: z.object({
    when_to_use: text(2000).optional(),
    when_not_to_use: text(2000).optional(),
    sequence_arc: text(3000).optional(),
    visual_direction: text(2000).optional(),
    persuasion_principles: stringList(20, 500).optional(),
    cta_guidance: text(1000).optional(),
    risks: stringList(20, 500).optional(),
    lesson: text(2000).optional(),
    excerpt: text(4000).optional(),
    reference_text: z.string().max(12000).optional(),
    raw_html: z.string().max(60000).optional(),
    reference_profile: z.object({
      version: z.literal(1),
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
      analyzed_at: z.string().datetime(),
      structure: z.object({ blocks: z.number().int().nonnegative(), types: z.record(z.string(), z.number().int().nonnegative()) }).strict(),
      palette: z.array(z.object({ hex: z.string().regex(/^#[a-f0-9]{6}$/i), mentions: z.number().int().positive(), share_percent: z.number().min(0).max(100) }).strict()).max(8),
      typography: z.object({ font_sizes_px: z.array(z.number()).max(30), font_weights: stringList(8, 40) }).strict(),
      calls_to_action: z.array(z.object({ label: z.string().max(200), position: z.number().int().positive() }).strict()).max(8),
      persuasion: stringList(10, 40),
    }).strict().optional(),
    reference_profile_notice: z.literal("heuristic_code_counts_not_visual_area").optional(),
    screenshot_visual_profile: z.object({
      version: z.literal(1),
      width: z.number().int().positive().max(12000),
      height: z.number().int().positive().max(12000),
      method: z.literal("sampled_pixels_quantized"),
      colors: z.array(z.object({
        hex: z.string().regex(/^#[a-f0-9]{6}$/i),
        share_percent: z.number().min(0).max(100),
      }).strict()).max(8),
      vertical_bands: z.array(z.object({
        from_percent: z.number().min(0).max(100),
        to_percent: z.number().min(0).max(100),
        dominant_hex: z.string().regex(/^#[a-f0-9]{6}$/i),
      }).strict()).length(8),
    }).strict().optional(),
    screenshot_semantic_analysis: internalMailingVisualAnalysisSchema.optional(),
    screenshot_analysis_run_id: z.string().uuid().optional(),
    do_not_copy: stringList(20, 300).optional(),
  }).strict(),
  evidence: z.object({
    label: z.enum(["inspiration", "observed_result", "significant_test", "counterexample"]).optional(),
    metric: text(80).optional(),
    denominator: z.number().int().nonnegative().optional(),
    period: text(80).optional(),
    confidence: z.enum(["low", "medium", "high"]).optional(),
    limitations: text(1000).optional(),
  }).strict(),
  source: z.object({
    type: z.enum(["internal", "authorized_import", "public_reference"]).default("internal"),
    reference: z.string().trim().max(500).optional(),
    rights_confirmed: z.boolean().default(false),
  }).strict(),
}).strict();

export type InternalMailingPlaybookDraft = z.infer<typeof internalMailingPlaybookDraftSchema>;

export type InternalMailingPlaybookEntry = InternalMailingPlaybookDraft & {
  id: string;
  entry_key: string;
  version: number;
  status: "draft" | "published" | "retired";
  created_at: string;
  updated_at: string;
};

/** Rehydrates the compact PostgREST projection shared by planner and admin preview. */
export function internalMailingPlaybookRetrievalEntry(row: Record<string, unknown>): InternalMailingPlaybookEntry {
  return {
    id: String(row.id ?? ""),
    entry_key: "retrieval-projection",
    version: 1,
    kind: row.kind === "example" || row.kind === "counterexample" ? row.kind : "strategy",
    title: String(row.title ?? ""),
    objective: String(row.objective ?? ""),
    audience_tags: Array.isArray(row.audience_tags) ? row.audience_tags.map(String) : [],
    lifecycle_tags: Array.isArray(row.lifecycle_tags) ? row.lifecycle_tags.map(String) : [],
    content: {
      when_to_use: typeof row.when_to_use === "string" ? row.when_to_use : undefined,
      when_not_to_use: typeof row.when_not_to_use === "string" ? row.when_not_to_use : undefined,
      sequence_arc: typeof row.sequence_arc === "string" ? row.sequence_arc : undefined,
      visual_direction: typeof row.visual_direction === "string" ? row.visual_direction : undefined,
      persuasion_principles: Array.isArray(row.persuasion_principles) ? row.persuasion_principles.map(String) : undefined,
      cta_guidance: typeof row.cta_guidance === "string" ? row.cta_guidance : undefined,
      risks: Array.isArray(row.risks) ? row.risks.map(String) : undefined,
    },
    evidence: {},
    source: {
      type: row.source_type === "internal" || row.source_type === "authorized_import" || row.source_type === "public_reference" ? row.source_type : "public_reference",
      rights_confirmed: row.rights_confirmed === true,
    },
    status: "published",
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
  };
}

export function canManageInternalMailingPlaybook(platformRole: string | null | undefined) {
  return platformRole === "platform_admin";
}

export function canPublishInternalMailingPlaybookReference(
  source: { type?: unknown; rights_confirmed?: unknown } | null | undefined,
  content: { raw_html?: unknown; reference_text?: unknown; excerpt?: unknown; screenshot_visual_profile?: unknown; screenshot_semantic_analysis?: unknown } | null | undefined,
) {
  const hasImportedReference = Boolean(content?.raw_html || content?.reference_text || content?.excerpt || content?.screenshot_visual_profile || content?.screenshot_semantic_analysis);
  return source?.type === "internal" && !hasImportedReference
    ? true
    : source?.rights_confirmed === true;
}

/**
 * Small, deterministic retrieval for A27. It intentionally emits only the
 * strategy fields needed for planning, never source metadata or raw excerpts.
 */
export function rankInternalMailingPlaybook(
  entries: InternalMailingPlaybookEntry[],
  input: { objective: string; audience?: string | null },
) {
  return scoreInternalMailingPlaybookEntries(entries, input)
    .slice(0, 4)
    .map(({ entry, score }) => ({
      // Do not disclose internal record names, source identifiers, evidence,
      // excerpts, examples or original HTML to the planner/model.
      objective: entry.objective.slice(0, 300),
      fit_score: score,
      when_to_use: entry.content.when_to_use?.slice(0, 1000) ?? null,
      when_not_to_use: entry.content.when_not_to_use?.slice(0, 1000) ?? null,
      sequence_arc: entry.content.sequence_arc?.slice(0, 1500) ?? null,
      visual_direction: entry.content.visual_direction?.slice(0, 1000) ?? null,
      persuasion_principles: (entry.content.persuasion_principles ?? []).slice(0, 8).map((item) => item.slice(0, 300)),
      cta_guidance: entry.content.cta_guidance?.slice(0, 700) ?? null,
      risks: (entry.content.risks ?? []).slice(0, 8).map((item) => item.slice(0, 300)),
  }));
}

/** Compact private composition guidance for A11; never returns IDs, names, excerpts or HTML. */
export function buildInternalMailingDesignContext(
  entries: InternalMailingPlaybookEntry[],
  input: { objective: string; audience?: string | null },
) {
  const selected = rankInternalMailingPlaybook(entries, input).map((entry) => ({
    objective: entry.objective,
    when_to_use: entry.when_to_use,
    when_not_to_use: entry.when_not_to_use,
    sequence_arc: entry.sequence_arc,
    visual_direction: entry.visual_direction,
    persuasion_principles: entry.persuasion_principles,
    cta_guidance: entry.cta_guidance,
    risks: entry.risks,
  }));
  return {
    status: selected.length > 0 ? ("available" as const) : ("no_match" as const),
    selected,
  };
}

function scoreInternalMailingPlaybookEntries(
  entries: InternalMailingPlaybookEntry[],
  input: { objective: string; audience?: string | null },
) {
  const objectiveTokens = new Set(input.objective.toLowerCase().split(/[^a-z0-9áéíóúüñ]+/).filter((v) => v.length > 2));
  const audience = input.audience?.toLowerCase() ?? "";
  return entries
    .filter((entry) => entry.status === "published"
      && entry.kind === "strategy"
      && canPublishInternalMailingPlaybookReference(entry.source, entry.content))
    .map((entry) => {
      const haystack = `${entry.objective} ${entry.title} ${entry.lifecycle_tags.join(" ")}`.toLowerCase();
      const tokens = haystack.split(/[^a-z0-9áéíóúüñ]+/).filter((v) => v.length > 2);
      const matchedObjectiveTokens = [...new Set(tokens.filter((token) => objectiveTokens.has(token)))];
      const matchedAudienceTags = audience
        ? entry.audience_tags.filter((tag) => audience.includes(tag.toLowerCase()))
        : [];
      const objectiveScore = tokens.filter((token) => objectiveTokens.has(token)).length;
      const score = objectiveScore + matchedAudienceTags.length * 2;
      return { entry, score, matchedObjectiveTokens, matchedAudienceTags };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.entry.updated_at.localeCompare(a.entry.updated_at));
}

/** Admin-only, explainable preview that uses the exact same ranking logic as A27. */
export function previewInternalMailingPlaybook(
  entries: InternalMailingPlaybookEntry[],
  input: { objective: string; audience?: string | null },
) {
  const objectiveTokens = new Set(input.objective.toLowerCase().split(/[^a-z0-9áéíóúüñ]+/).filter((v) => v.length > 2));
  const audience = input.audience?.toLowerCase() ?? "";
  const counts = { not_published: 0, not_strategy: 0, rights_unconfirmed: 0, no_match: 0, outside_top_four: 0 };
  for (const entry of entries) {
    if (entry.status !== "published") counts.not_published++;
    else if (entry.kind !== "strategy") counts.not_strategy++;
    else if (!canPublishInternalMailingPlaybookReference(entry.source, entry.content)) counts.rights_unconfirmed++;
    else {
      const tokens = `${entry.objective} ${entry.title} ${entry.lifecycle_tags.join(" ")}`.toLowerCase().split(/[^a-z0-9áéíóúüñ]+/).filter((v) => v.length > 2);
      const hasObjectiveMatch = tokens.some((token) => objectiveTokens.has(token));
      const hasAudienceMatch = audience && entry.audience_tags.some((tag) => audience.includes(tag.toLowerCase()));
      if (!hasObjectiveMatch && !hasAudienceMatch) counts.no_match++;
    }
  }
  const ranked = scoreInternalMailingPlaybookEntries(entries, input);
  counts.outside_top_four = Math.max(0, ranked.length - 4);
  return {
    candidate_count: entries.length,
    matched_count: ranked.length,
    excluded: counts,
    selected: ranked.slice(0, 4).map(({ entry, score, matchedObjectiveTokens, matchedAudienceTags }) => ({
      id: entry.id,
      title: entry.title,
      objective: entry.objective,
      fit_score: score,
      matched_objective_terms: matchedObjectiveTokens,
      matched_audience_tags: matchedAudienceTags,
      planner_context: {
        when_to_use: entry.content.when_to_use?.slice(0, 1000) ?? null,
        when_not_to_use: entry.content.when_not_to_use?.slice(0, 1000) ?? null,
        sequence_arc: entry.content.sequence_arc?.slice(0, 1500) ?? null,
        visual_direction: entry.content.visual_direction?.slice(0, 1000) ?? null,
        persuasion_principles: (entry.content.persuasion_principles ?? []).slice(0, 8).map((item) => item.slice(0, 300)),
        cta_guidance: entry.content.cta_guidance?.slice(0, 700) ?? null,
        risks: (entry.content.risks ?? []).slice(0, 8).map((item) => item.slice(0, 300)),
      },
    })),
  };
}
