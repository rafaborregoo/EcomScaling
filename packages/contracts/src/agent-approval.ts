import { z } from "zod";

export const proposedWriteEditSchema = z.object({
  index: z.number().int().min(0),
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().max(12000).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  skip: z.boolean().optional(),
}).strict();

export const agentOutputDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "dismiss_proposal"]),
  reason: z.string().max(2000).optional(),
  reason_category: z.enum(["incorrecto", "sin_evidencia", "irrelevante", "incompleto", "duplicado", "otro"]).optional(),
  edits: z.array(proposedWriteEditSchema).max(100).optional(),
}).strict().superRefine((value, ctx) => {
  const indexes = value.edits?.map((edit) => edit.index) ?? [];
  if (new Set(indexes).size !== indexes.length) ctx.addIssue({ code: "custom", message: "duplicate_proposal_index" });
  if (value.reason_category && value.decision !== "rejected") ctx.addIssue({ code: "custom", message: "reason_category_requires_rejection" });
  if (value.decision === "dismiss_proposal" && (value.edits?.length !== 1 || value.edits[0]?.skip !== true)) {
    ctx.addIssue({ code: "custom", message: "dismiss_requires_one_skipped_proposal" });
  }
});

export type ProposedWriteEdit = z.infer<typeof proposedWriteEditSchema>;
