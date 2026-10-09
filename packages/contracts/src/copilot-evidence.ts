import { z } from "zod";

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const copilotEvidenceReferenceSchema = z.object({
  kind: z.enum(["section", "entity", "chart_point"]),
  source: z.enum(["meta", "shopify", "klaviyo", "marketing", "operations", "portfolio", "other"]),
  route: z.string().startsWith("/").max(180),
  section: z.string().trim().min(1).max(120),
  connection_id: z.string().uuid().nullable(),
  entity: z.object({ type: z.string().max(60), id: z.string().max(160) }).nullable(),
  metric: z.object({ key: z.enum(["meta_spend", "meta_roas"]), date: isoDay }).nullable(),
  period: z.object({ start: isoDay, end: isoDay }).nullable(),
  period_label: z.string().max(120).nullable(),
  filters: z.record(z.string().max(40), z.string().max(120)),
}).superRefine((value, ctx) => {
  if (Object.keys(value.filters).length > 8) ctx.addIssue({ code: "custom", message: "too_many_filters" });
  if (value.kind === "chart_point" && (value.source !== "meta" || !value.metric)) {
    ctx.addIssue({ code: "custom", message: "unsupported_chart_reference" });
  }
  if (value.kind === "entity" && !value.entity) {
    ctx.addIssue({ code: "custom", message: "entity_required" });
  }
});

export type CopilotEvidenceReference = z.infer<typeof copilotEvidenceReferenceSchema>;
