import { z } from "zod";
import type { FastifyInstance } from "fastify";

export const INTERNAL_MAILING_VISUAL_IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;

/** Register the only binary image types accepted by the private visual-analysis endpoint. */
export function registerInternalMailingVisualImageBodyParser(app: FastifyInstance) {
  app.addContentTypeParser(
    [...INTERNAL_MAILING_VISUAL_IMAGE_MIMES],
    { parseAs: "buffer" },
    (_request, body, done) => done(null, body),
  );
}

const bounded = (max: number) => z.string().trim().max(max);
const position = z.number().int().min(0).max(100);

export const internalMailingVisualAnalysisSchema = z.object({
  detected_text: z.array(z.object({
    text: bounded(500),
    role: z.enum(["headline", "body", "cta", "label", "other"]),
    position_percent: position,
    confidence: z.enum(["low", "medium", "high"]),
  }).strict()).max(30),
  layout_blocks: z.array(z.object({
    type: z.enum(["header", "hero", "text", "image", "product", "proof", "offer", "cta", "footer", "other"]),
    position_percent: position,
    approximate_height_percent: z.number().int().min(1).max(100),
    description: bounded(500),
  }).strict()).max(24),
  visual_hierarchy: z.array(bounded(300)).max(12),
  typography: z.array(z.object({
    role: bounded(80),
    approximate_size: z.enum(["small", "body", "large", "display", "unclear"]),
    weight_or_emphasis: bounded(120),
    confidence: z.enum(["low", "medium", "high"]),
  }).strict()).max(12),
  ctas: z.array(z.object({
    visible_text: bounded(160),
    position_percent: position,
    treatment: bounded(200),
    prominence: z.enum(["low", "medium", "high"]),
  }).strict()).max(8),
  composition_notes: z.array(bounded(400)).max(12),
  persuasion_cues: z.array(bounded(300)).max(12),
  limitations: z.array(bounded(300)).max(12),
  confidence: z.enum(["low", "medium", "high"]),
}).strict();

export type InternalMailingVisualAnalysis = z.infer<typeof internalMailingVisualAnalysisSchema>;

export const internalMailingVisualAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["detected_text", "layout_blocks", "visual_hierarchy", "typography", "ctas", "composition_notes", "persuasion_cues", "limitations", "confidence"],
  properties: {
    detected_text: { type: "array", maxItems: 30, items: { type: "object", additionalProperties: false, required: ["text", "role", "position_percent", "confidence"], properties: { text: { type: "string" }, role: { type: "string", enum: ["headline", "body", "cta", "label", "other"] }, position_percent: { type: "integer", minimum: 0, maximum: 100 }, confidence: { type: "string", enum: ["low", "medium", "high"] } } } },
    layout_blocks: { type: "array", maxItems: 24, items: { type: "object", additionalProperties: false, required: ["type", "position_percent", "approximate_height_percent", "description"], properties: { type: { type: "string", enum: ["header", "hero", "text", "image", "product", "proof", "offer", "cta", "footer", "other"] }, position_percent: { type: "integer", minimum: 0, maximum: 100 }, approximate_height_percent: { type: "integer", minimum: 1, maximum: 100 }, description: { type: "string" } } } },
    visual_hierarchy: { type: "array", maxItems: 12, items: { type: "string" } },
    typography: { type: "array", maxItems: 12, items: { type: "object", additionalProperties: false, required: ["role", "approximate_size", "weight_or_emphasis", "confidence"], properties: { role: { type: "string" }, approximate_size: { type: "string", enum: ["small", "body", "large", "display", "unclear"] }, weight_or_emphasis: { type: "string" }, confidence: { type: "string", enum: ["low", "medium", "high"] } } } },
    ctas: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["visible_text", "position_percent", "treatment", "prominence"], properties: { visible_text: { type: "string" }, position_percent: { type: "integer", minimum: 0, maximum: 100 }, treatment: { type: "string" }, prominence: { type: "string", enum: ["low", "medium", "high"] } } } },
    composition_notes: { type: "array", maxItems: 12, items: { type: "string" } },
    persuasion_cues: { type: "array", maxItems: 12, items: { type: "string" } },
    limitations: { type: "array", maxItems: 12, items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
} as const;
